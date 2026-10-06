import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { avanzarExpedicionesDePartida, esComestible, metodoExpedicionFor, RACIONES_POR_UNIDAD_COMESTIBLE } from './factionExpeditions.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { REGION_OWNING_FACTIONS } from './reputation.js';
import { detectNpcsInScene } from './npcScene.js';

const bloque = (v: number) => ({ fuerza: v, destreza: v, constitucion: v, inteligencia: v, voluntad: v, carisma: v, magia: v });

/// El botín va al Almacén de la facción, salvo lo comestible de una expedición mandada por hambre
/// (CR-34 34b), que va a su reserva de comida.
async function esperarDestinoDelBotin(factionId: string, motivo: string | null, items: { catalogSlug: string }[]): Promise<void> {
  const almacen = await prisma.almacenItem.findMany({ where: { factionId } });
  const catalogo = await prisma.itemCatalog.findMany({ where: { slug: { in: items.map((i) => i.catalogSlug) } }, select: { slug: true, category: true, curaHambre: true } });
  for (const it of items) {
    const cat = catalogo.find((c) => c.slug === it.catalogSlug)!;
    const aLaReserva = motivo === 'COMIDA' && esComestible(cat);
    expect(almacen.some((a) => a.catalogSlug === it.catalogSlug)).toBe(!aLaReserva);
  }
}

/// Partida de prueba con su copia del mundo (CR-6). Borrarla borra sus facciones, expediciones y Almacén.
async function crearPartida(worldId: string, nombre: string, dia: number, factionsStatus: Record<string, number> = {}): Promise<string> {
  const save = await prisma.save.create({
    data: {
      userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
      attributes: bloque(10), portraitInitial: 'E',
      worldState: { create: { fictionalMinutes: dia * 1440 + 30, factionsStatus } },
    },
  });
  await asegurarMundoDePartida(prisma, save.id);
  return save.id;
}

/// Fase 13-B contra Postgres real, en el mundo de una partida (CR-35): lanzar, llegar, completar, stock,
/// XP e idempotencia del día. Usa la copia del Clan Serhu (con NPC de pescador/herborista con
/// potencial) y restaura al terminar el progreso de los NPC (es del NPC, no de la partida).
describe('avanzarExpedicionesDePartida — ciclo completo (Fase 13-B)', () => {
  const DIA = 20;
  const random = () => 0.99; // tirada 20 (recolección OK), sin intercepción
  let worldId: string;
  let saveId: string;
  /// Fase D (hito 0.1): otra partida, sin reputación con Serhu ni en su región — no debe enterarse.
  let saveAjenaId: string;
  let serhuId: string;
  let progresoSnapshot: Awaited<ReturnType<typeof prisma.npcProfessionProgress.findMany>> = [];

  const irAlDia = (dia: number) => prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: dia * 1440 + 30 } });
  const avanzar = (dia: number, r: () => number = random) => avanzarExpedicionesDePartida(prisma, worldId, saveId, dia, r);

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    progresoSnapshot = await prisma.npcProfessionProgress.findMany({ where: { npc: { worldId } } });
    // El progreso de oficio de los NPC es del catálogo y otros tests pueden dejarlo en el tope (la XP ya
    // no sube): se parte de 0 para los de Serhu y `afterAll` lo restaura.
    await prisma.npcProfessionProgress.updateMany({ where: { npc: { worldId, faction: 'Clan Serhu' } }, data: { nivel: 1, xp: 0 } });
    // Reputación con el Clan Serhu: el personaje se entera de lo que le pasa (Fase D, noticias del mundo).
    saveId = await crearPartida(worldId, 'Expediciones de facción', DIA, { 'Clan Serhu': 0 });
    saveAjenaId = await crearPartida(worldId, 'Sin noticias de Serhu', DIA, { 'Concordia de Hierro': 0 });
    serhuId = (await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' } })).id;
    // Línea base: todas las facciones de la partida procesadas hasta DIA-1 → el primero procesa el día DIA.
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId } }, data: { ultimoDiaExpedicion: DIA - 1 } });
  });

  afterAll(async () => {
    for (const p of progresoSnapshot) await prisma.npcProfessionProgress.update({ where: { id: p.id }, data: { nivel: p.nivel, xp: p.xp } });
    await prisma.save.deleteMany({ where: { id: { in: [saveId, saveAjenaId] } } });
  });

  it('lanza, llega, completa, deposita stock y da XP; el mismo día dos veces es idempotente; la intercepción pierde la carga', async () => {
    const propias = () => prisma.expedicion.findMany({ where: { factionId: serhuId }, include: { members: true }, orderBy: { diaSalida: 'asc' } });

    // Día DIA: lanza una (y solo una) expedición.
    const r1 = await avanzar(DIA);
    expect(r1.lanzadas).toBeGreaterThan(0);
    let exps = await propias();
    expect(exps).toHaveLength(1);
    const exp = exps[0]!;
    expect(exp).toMatchObject({ status: 'EN_TRANSITO', diaSalida: DIA, diaRegreso: DIA + 2, riesgo: 0, saveId });
    expect(exp.members.filter((m) => m.rol === 'recolector').length).toBeGreaterThanOrEqual(1);
    const recolectores = exp.members.filter((m) => m.rol === 'recolector').map((m) => m.npcId);
    const xpAntes = await prisma.npcProfessionProgress.findMany({ where: { npcId: { in: recolectores }, professionId: exp.professionId } });

    // Idempotencia: mismo día, segunda pasada, nada cambia.
    const r2 = await avanzar(DIA);
    expect(r2.diasProcesados).toBe(0);
    expect(r2.lanzadas).toBe(0);
    expect(await propias()).toHaveLength(1);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `faction:${serhuId}` } })).ultimoDiaExpedicion).toBe(DIA);

    // Día DIA+1: llegada, recolección, RETORNANDO con botín.
    await irAlDia(DIA + 1);
    await avanzar(DIA + 1);
    const llegada = (await propias())[0]!;
    expect(llegada.status).toBe('RETORNANDO');
    const items = (llegada.botin as { items: { npcId: string; cantidad: number; catalogSlug: string }[] }).items;
    expect(items.length).toBeGreaterThan(0);
    expect(llegada.tiradaRiesgo).not.toBeNull();

    // Día DIA+2: completa, botín al Almacén con tope, XP a quien sacó algo, y (mismo día) lanza otra.
    await irAlDia(DIA + 2);
    const r3 = await avanzar(DIA + 2);
    expect(r3.completadas).toBeGreaterThan(0);
    exps = await propias();
    expect(exps[0]!.status).toBe('COMPLETADA');
    // Libro de Sucesos (CR-3): la salida y la vuelta quedan en el Libro de esta partida, no en otra.
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'EXPEDICION_SALE' } })).toBeGreaterThan(0);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'EXPEDICION_VUELVE' } })).toBeGreaterThan(0);
    expect(await prisma.suceso.count({ where: { saveId: saveAjenaId, tipo: { in: ['EXPEDICION_SALE', 'EXPEDICION_VUELVE'] } } })).toBe(0);
    await esperarDestinoDelBotin(serhuId, exp.motivo, items);
    const xpDespues = await prisma.npcProfessionProgress.findMany({ where: { npcId: { in: items.map((i) => i.npcId) }, professionId: exp.professionId } });
    expect(xpDespues.length).toBeGreaterThan(0);
    for (const d of xpDespues) {
      const antes = xpAntes.find((a) => a.npcId === d.npcId);
      expect(d.xp).toBeGreaterThan(antes?.xp ?? -1);
    }
    expect(exps).toHaveLength(2);
    expect(exps[1]!.status).toBe('EN_TRANSITO');

    // Fase D (hito 0.1) — el regreso con botín es noticia en "El mundo" de quien conoce a Serhu.
    const noticiasDe = (id: string) => prisma.logEntry.findMany({ where: { saveId: id, channel: 'WORLD' }, orderBy: { createdAt: 'asc' } });
    expect(r3.noticias).toBeGreaterThan(0);
    const tras3 = await noticiasDe(saveId);
    expect(tras3.some((l) => l.text.startsWith('Los recolectores de Clan Serhu regresan de '))).toBe(true);

    // Segunda expedición con riesgo 100: la intercepción la marca INTERCEPTADA y pierde la carga.
    await prisma.expedicion.update({ where: { id: exps[1]!.id }, data: { riesgo: 100 } });
    const stockAntes = await prisma.almacenItem.count({ where: { factionId: serhuId } });
    await irAlDia(DIA + 3);
    const r4 = await avanzar(DIA + 3, () => 0.1);
    expect(r4.interceptadas).toBeGreaterThan(0);
    const interceptada = await prisma.expedicion.findUniqueOrThrow({ where: { id: exps[1]!.id } });
    expect(interceptada.status).toBe('INTERCEPTADA');
    // Fase D — el asalto también es noticia (con el texto que toque según cómo se perdió la carga)…
    const tras4 = await noticiasDe(saveId);
    expect(tras4.length).toBeGreaterThan(tras3.length);
    expect(tras4.slice(tras3.length).some((l) => l.text.includes('expedición de Clan Serhu'))).toBe(true);
    // …y la otra partida no se entera de nada.
    expect(await noticiasDe(saveAjenaId)).toHaveLength(0);
    expect(interceptada.botin).toBeNull();
    // Nada entra al Almacén por la interceptada.
    expect(await prisma.almacenItem.count({ where: { factionId: serhuId } })).toBe(stockAntes);
  }, 60_000);
});

/// Fase 13-C contra Postgres real, en el mundo de una partida (CR-35): intercepción con combate. Como en
/// el catálogo ninguna facción con expediciones comparte región, el test añade TEMPORALMENTE a Feg Ger
/// como segundo dueño de las Llanuras (`REGION_OWNING_FACTIONS` es un objeto mutable) y pone en GUERRA
/// las copias Serhu→Feg Ger; fija los atributos/nivel de los NPC de ambas para que el combate sea
/// decisivo, y restaura al terminar lo que no es de la partida (atributos, XP).
describe('avanzarExpedicionesDePartida — intercepción con combate (Fase 13-C)', () => {
  const REGION = 'Las Llanuras del Viento Rojo';
  /// La primera tirada (riesgo) dispara la intercepción; el resto (d20 de combate y de recolección) son 20.
  const tiradaBajaLuegoAlta = () => { let n = 0; return () => (n++ === 0 ? 0.1 : 0.99); };
  let worldId: string;
  let saveId: string;
  let serhuId: string;
  let fegGerId: string;
  let duenosOriginales: string[];
  let progresoSnapshot: Awaited<ReturnType<typeof prisma.npcProfessionProgress.findMany>> = [];
  let npcSnapshot: { id: string; attributes: unknown; level: number; muertoEnMundo: boolean }[] = [];
  let dia = 10;

  const irAlDia = (d: number) => prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: d * 1440 + 30 } });
  const avanzar = (d: number, r: () => number, opciones: { probabilidadMuerte?: number } = {}) => avanzarExpedicionesDePartida(prisma, worldId, saveId, d, r, opciones);
  const ponerNpcs = async (serhu: number, hostil: number) => {
    await prisma.npc.updateMany({ where: { worldId, faction: 'Clan Serhu' }, data: { attributes: bloque(serhu), level: 1 } });
    await prisma.npc.updateMany({ where: { worldId, faction: 'Feg Ger' }, data: { attributes: bloque(hostil), level: 1 } });
  };
  const relacion = { sourceFactionId_targetFactionId: { get sourceFactionId() { return serhuId; }, get targetFactionId() { return fegGerId; } } };
  const presion = async () => (await prisma.factionRelation.findUniqueOrThrow({ where: relacion })).presion;
  const propias = () => prisma.expedicion.findMany({ where: { factionId: serhuId }, include: { members: true }, orderBy: { diaSalida: 'asc' } });

  /// Prepara un día limpio: sin expediciones de la partida, relación en GUERRA (presión 85) y todas las
  /// facciones con línea base en `dia - 1`. Lanza la expedición de Serhu y comprueba su riesgo (50 %).
  const lanzar = async () => {
    dia += 10;
    await prisma.expedicion.deleteMany({ where: { saveId } });
    await prisma.factionRelation.update({ where: relacion, data: { presion: 85, type: 'GUERRA' } });
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId } }, data: { ultimoDiaExpedicion: dia - 1 } });
    await irAlDia(dia);
    await avanzar(dia, () => 0.99);
    const exp = (await propias())[0]!;
    expect(exp).toMatchObject({ status: 'EN_TRANSITO', riesgo: 50 });
    expect(exp.members.filter((m) => m.rol === 'guardia').length).toBeGreaterThanOrEqual(1);
    return exp;
  };

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    progresoSnapshot = await prisma.npcProfessionProgress.findMany({ where: { npc: { worldId } } });
    npcSnapshot = await prisma.npc.findMany({ where: { worldId, faction: { in: ['Clan Serhu', 'Feg Ger'] } }, select: { id: true, attributes: true, level: true, muertoEnMundo: true } });
    saveId = await crearPartida(worldId, 'Intercepción de expediciones', dia);
    serhuId = (await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' } })).id;
    fegGerId = (await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'feg-ger' } })).id;
    duenosOriginales = REGION_OWNING_FACTIONS[REGION]!;
    REGION_OWNING_FACTIONS[REGION] = ['Clan Serhu', 'Feg Ger'];
    await prisma.factionRelation.upsert({
      where: relacion,
      update: {}, create: { worldId, saveId, sourceFactionId: serhuId, targetFactionId: fegGerId, presion: 85, type: 'GUERRA' },
    });
  });

  afterAll(async () => {
    REGION_OWNING_FACTIONS[REGION] = duenosOriginales;
    for (const p of progresoSnapshot) await prisma.npcProfessionProgress.update({ where: { id: p.id }, data: { nivel: p.nivel, xp: p.xp } });
    for (const n of npcSnapshot) await prisma.npc.update({ where: { id: n.id }, data: { attributes: n.attributes as object, level: n.level, muertoEnMundo: n.muertoEnMundo } });
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('guardias que ganan: la expedición sigue, completa con stock y la presión no cambia', async () => {
    await ponerNpcs(18, 4);
    const exp = await lanzar();
    await irAlDia(dia + 1);
    const r = await avanzar(dia + 1, tiradaBajaLuegoAlta());
    expect(r.interceptadas).toBe(0);
    const llegada = (await propias())[0]!;
    expect(llegada.status).toBe('RETORNANDO');
    expect(llegada.interceptacion).toMatchObject({ faccionHostil: 'Feg Ger', ganador: 'defensores', presionAplicada: false });
    expect((llegada.interceptacion as { atacanteSlug: string }).atacanteSlug).toBeTruthy();
    expect(await presion()).toBe(85);

    await irAlDia(dia + 2);
    await avanzar(dia + 2, () => 0.99);
    const fin = await prisma.expedicion.findUniqueOrThrow({ where: { id: exp.id } });
    expect(fin.status).toBe('COMPLETADA');
    const items = (fin.botin as { items: { catalogSlug: string }[] }).items;
    expect(items.length).toBeGreaterThan(0);
    await esperarDestinoDelBotin(serhuId, fin.motivo, items);
    expect(fin.interceptacion).toMatchObject({ ganador: 'defensores' });
  }, 60_000);

  it('guardias que pierden: INTERCEPTADA, carga perdida y presión +8 en la relación', async () => {
    await ponerNpcs(4, 18);
    const exp = await lanzar();
    const stockAntes = await prisma.almacenItem.count({ where: { factionId: serhuId } });
    await irAlDia(dia + 1);
    const r = await avanzar(dia + 1, tiradaBajaLuegoAlta());
    expect(r.interceptadas).toBe(1);
    const fin = await prisma.expedicion.findUniqueOrThrow({ where: { id: exp.id } });
    expect(fin.status).toBe('INTERCEPTADA');
    expect(fin.botin).toBeNull();
    expect(fin.interceptacion).toMatchObject({ faccionHostil: 'Feg Ger', ganador: 'atacante', presionAplicada: true });
    expect(await presion()).toBe(93); // BAJA_DE_GUERRA pesa +8
    expect(await prisma.almacenItem.count({ where: { factionId: serhuId } })).toBe(stockAntes);
  }, 60_000);

  it('muerte en la intercepción: el guardia caído muere en la partida, sale de la escena y no vuelve a salir de expedición', async () => {
    await ponerNpcs(4, 18);
    const exp = await lanzar();
    const guardiaIds = exp.members.filter((m) => m.rol === 'guardia').map((m) => m.npcId);
    const guardias = await prisma.npc.findMany({ where: { id: { in: guardiaIds } } });
    const escena = async (nombre: string) =>
      (await detectNpcsInScene({ action: `Hablo con ${nombre}`, worldId, sessionFacts: [], saveId, currentLocationId: null, fictionalMinutes: 480 })).map((n) => n.slug);
    // Control: en vida, la partida lo detecta en escena por su nombre.
    const objetivo = guardias[0]!;
    expect(await escena(objetivo.name)).toContain(objetivo.slug);

    // Intercepción perdida con probabilidad de muerte 1: caen (CONVALECIENTE) y mueren todos los guardias.
    await irAlDia(dia + 1);
    const r = await avanzar(dia + 1, tiradaBajaLuegoAlta(), { probabilidadMuerte: 1 });
    expect(r.interceptadas).toBe(1);
    expect(r.muertes).toBeGreaterThanOrEqual(guardias.length);
    const fin = await prisma.expedicion.findUniqueOrThrow({ where: { id: exp.id } });
    const muertes = (fin.interceptacion as { muertes: { slug: string; rol: string }[] }).muertes;
    for (const g of guardias) expect(muertes).toContainEqual({ slug: g.slug, rol: 'guardia' });
    expect(await prisma.npcState.count({ where: { saveId, npcId: { in: guardiaIds }, muerto: true } })).toBe(guardiaIds.length);
    expect(await escena(objetivo.name)).not.toContain(objetivo.slug);

    // Los muertos no vuelven a unirse a una expedición (ni como guardia ni como recolector).
    await prisma.expedicion.deleteMany({ where: { saveId } });
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId } }, data: { ultimoDiaExpedicion: dia + 9 } });
    await irAlDia(dia + 10);
    await avanzar(dia + 10, () => 0.99);
    for (const e of await propias()) for (const m of e.members) expect(guardiaIds).not.toContain(m.npcId);
  }, 60_000);

  it('un re-seed no resucita a un muerto de mundo de las partidas antiguas (D-10)', async () => {
    const objetivo = await prisma.npc.findFirstOrThrow({ where: { worldId, faction: 'Clan Serhu', saveId: null } });
    await prisma.npc.update({ where: { id: objetivo.id }, data: { muertoEnMundo: true } });
    // Un upsert como el de `seed-catalog` (el `update` no incluye `muertoEnMundo`) no lo resucita.
    await prisma.npc.upsert({
      where: { id: objetivo.id },
      update: { name: objetivo.name, role: objetivo.role, level: objetivo.level, bio: objetivo.bio },
      create: { ...objetivo, id: undefined, attributes: objetivo.attributes as object, habilidadesRaciales: objetivo.habilidadesRaciales as object, atributosPotenciales: undefined },
    });
    expect((await prisma.npc.findUniqueOrThrow({ where: { id: objetivo.id } })).muertoEnMundo).toBe(true);
    expect(readFileSync(new URL('../scripts/seed-catalog.ts', import.meta.url), 'utf8')).not.toContain('muertoEnMundo');
  });

  it('una relación NEUTRAL nunca intercepta: riesgo 0 al lanzar y tirada 0 no dispara', async () => {
    await prisma.factionRelation.update({ where: relacion, data: { presion: 50, type: 'NEUTRAL' } });
    await prisma.expedicion.deleteMany({ where: { saveId } });
    dia += 10;
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId } }, data: { ultimoDiaExpedicion: dia - 1 } });
    await irAlDia(dia);
    await avanzar(dia, () => 0.99);
    expect((await propias())[0]).toMatchObject({ status: 'EN_TRANSITO', riesgo: 0 });
    await irAlDia(dia + 1);
    const r = await avanzar(dia + 1, () => 0);
    expect(r.interceptadas).toBe(0);
    expect((await propias())[0]!.interceptacion).toBeNull();
  }, 60_000);
});

/// CR-7 (hito 0.2): las expediciones de las copias de una partida avanzan con SU reloj; sus muertes
/// van a `NpcState.muerto` de esa partida (el NPC sigue vivo en otra) y el Libro y las noticias solo
/// llegan a ella.
describe('avanzarExpedicionesDePartida — por partida (CR-7)', () => {
  const REGION = 'Las Llanuras del Viento Rojo';
  const tiradaBajaLuegoAlta = () => { let n = 0; return () => (n++ === 0 ? 0.1 : 0.99); };
  const DIA = 5;
  let worldId: string;
  let a: string;
  let b: string;
  let duenosOriginales: string[];
  let npcSnapshot: { id: string; attributes: unknown; level: number }[] = [];
  let progresoSnapshot: Awaited<ReturnType<typeof prisma.npcProfessionProgress.findMany>> = [];

  const crear = async (nombre: string) => {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: bloque(10), portraitInitial: 'P',
        worldState: { create: { fictionalMinutes: DIA * 1440 + 30, factionsStatus: { 'Clan Serhu': 0 } } },
      },
    });
    return save.id;
  };

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    npcSnapshot = await prisma.npc.findMany({ where: { worldId, faction: { in: ['Clan Serhu', 'Feg Ger'] } }, select: { id: true, attributes: true, level: true } });
    progresoSnapshot = await prisma.npcProfessionProgress.findMany({ where: { npc: { worldId } } });
    duenosOriginales = REGION_OWNING_FACTIONS[REGION]!;
    REGION_OWNING_FACTIONS[REGION] = ['Clan Serhu', 'Feg Ger'];
    a = await crear('Expediciones por partida A');
    b = await crear('Expediciones por partida B');
    await asegurarMundoDePartida(prisma, a);
    await asegurarMundoDePartida(prisma, b);
    // Relación en guerra entre las copias de A (riesgo 50 %) y línea base del día anterior.
    const serhu = await prisma.faction.findFirstOrThrow({ where: { saveId: a, origenSlug: 'clan-serhu' } });
    const feg = await prisma.faction.findFirstOrThrow({ where: { saveId: a, origenSlug: 'feg-ger' } });
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId: serhu.id, targetFactionId: feg.id } },
      update: { presion: 85, type: 'GUERRA' }, create: { worldId, saveId: a, sourceFactionId: serhu.id, targetFactionId: feg.id, presion: 85, type: 'GUERRA' },
    });
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId: a } }, data: { ultimoDiaExpedicion: DIA - 1 } });
    // Guardias de Serhu débiles frente a Feg Ger: caen siempre.
    await prisma.npc.updateMany({ where: { worldId, faction: 'Clan Serhu' }, data: { attributes: bloque(4), level: 1 } });
    await prisma.npc.updateMany({ where: { worldId, faction: 'Feg Ger' }, data: { attributes: bloque(18), level: 1 } });
  });

  afterAll(async () => {
    REGION_OWNING_FACTIONS[REGION] = duenosOriginales;
    for (const n of npcSnapshot) await prisma.npc.update({ where: { id: n.id }, data: { attributes: n.attributes as object, level: n.level } });
    for (const p of progresoSnapshot) await prisma.npcProfessionProgress.update({ where: { id: p.id }, data: { nivel: p.nivel, xp: p.xp } });
    await prisma.save.deleteMany({ where: { id: { in: [a, b] } } });
  });

  it('lanza en la copia de la partida; la intercepción mata en esa partida y no en otra ni en el mundo', async () => {
    const r1 = await avanzarExpedicionesDePartida(prisma, worldId, a, DIA, () => 0.99);
    expect(r1.lanzadas).toBeGreaterThan(0);
    const exp = await prisma.expedicion.findFirstOrThrow({ where: { saveId: a, faction: { origenSlug: 'clan-serhu' } }, include: { members: true } });
    expect(exp).toMatchObject({ status: 'EN_TRANSITO', riesgo: 50 });
    expect(await prisma.expedicion.count({ where: { saveId: b } })).toBe(0);
    expect(await prisma.suceso.count({ where: { saveId: a, tipo: 'EXPEDICION_SALE' } })).toBeGreaterThan(0);
    expect(await prisma.suceso.count({ where: { saveId: b, tipo: 'EXPEDICION_SALE' } })).toBe(0);

    const guardiaIds = exp.members.filter((m) => m.rol === 'guardia').map((m) => m.npcId);
    expect(guardiaIds.length).toBeGreaterThan(0);
    const r2 = await avanzarExpedicionesDePartida(prisma, worldId, a, DIA + 1, tiradaBajaLuegoAlta(), { probabilidadMuerte: 1 });
    expect(r2.interceptadas).toBe(1);
    expect(r2.muertes).toBeGreaterThanOrEqual(guardiaIds.length);

    const muertosA = await prisma.npcState.findMany({ where: { saveId: a, npcId: { in: guardiaIds }, muerto: true } });
    expect(muertosA).toHaveLength(guardiaIds.length);
    expect(await prisma.npcState.count({ where: { saveId: b, npcId: { in: guardiaIds }, muerto: true } })).toBe(0);
    const npcs = await prisma.npc.findMany({ where: { id: { in: guardiaIds } }, select: { muertoEnMundo: true } });
    expect(npcs.every((n) => !n.muertoEnMundo)).toBe(true);

    const objetivo = await prisma.npc.findUniqueOrThrow({ where: { id: guardiaIds[0]! } });
    const escena = async (sid: string) =>
      (await detectNpcsInScene({ action: `Hablo con ${objetivo.name}`, worldId, sessionFacts: [], saveId: sid, currentLocationId: null, fictionalMinutes: 480 })).map((n) => n.slug);
    expect(await escena(a)).not.toContain(objetivo.slug);
    expect(await escena(b)).toContain(objetivo.slug);
  }, 60_000);
});

/// CR-34 34b contra Postgres real: una facción con hambre (el Clan Serhu sembrado: 570 bocas, 150
/// trabajadores, reserva 0) manda la expedición por comida, y lo comestible que trae suma a su reserva
/// en vez de ir al Almacén. Sin hambre, la expedición sale sin motivo.
describe('avanzarExpedicionesDePartida — expediciones dirigidas (CR-34 34b)', () => {
  const DIA = 30;
  let worldId: string;
  let saveId: string;
  let serhuId: string;
  let progresoSnapshot: Awaited<ReturnType<typeof prisma.npcProfessionProgress.findMany>> = [];

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    progresoSnapshot = await prisma.npcProfessionProgress.findMany({ where: { npc: { worldId } } });
    saveId = await crearPartida(worldId, 'Expediciones dirigidas', DIA);
    serhuId = (await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' } })).id;
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId } }, data: { ultimoDiaExpedicion: DIA - 1 } });
  });

  afterAll(async () => {
    for (const p of progresoSnapshot) await prisma.npcProfessionProgress.update({ where: { id: p.id }, data: { nivel: p.nivel, xp: p.xp } });
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('con hambre sale a por comida y lo comestible va a la reserva; sin hambre, sin motivo', async () => {
    // CR-54: con el reparto de la Fase D los Serhu comen justo; aquí pierden trabajadores para pasar hambre.
    await prisma.kingdomStats.update({ where: { factionId: serhuId }, data: { comida: 0, trabajadores: 100 } });
    await avanzarExpedicionesDePartida(prisma, worldId, saveId, DIA, () => 0.99);
    const exp = await prisma.expedicion.findFirstOrThrow({ where: { factionId: serhuId }, orderBy: { diaSalida: 'desc' } });
    expect(exp.motivo).toBe('COMIDA');
    expect(['PESCA', 'EXTRACCION']).toContain(metodoExpedicionFor(exp.professionId));

    // Botín conocido: un comestible (bulbo del Cauce) y algo que no se come (mena).
    const [comestible, mena] = await Promise.all([
      prisma.itemCatalog.findFirstOrThrow({ where: { worldId, slug: 'bulbo-cauce' } }),
      prisma.itemCatalog.findFirstOrThrow({ where: { worldId, category: 'mena' } }),
    ]);
    const npcId = (await prisma.expedicionMember.findFirstOrThrow({ where: { expedicionId: exp.id, rol: 'recolector' } })).npcId;
    const items = [
      { npcId, professionId: exp.professionId, sourceSlug: 'x', catalogSlug: comestible.slug, name: comestible.name, cantidad: 3, tier: 1 },
      { npcId, professionId: exp.professionId, sourceSlug: 'y', catalogSlug: mena.slug, name: mena.name, cantidad: 1, tier: 1 },
    ];
    await prisma.expedicion.update({ where: { id: exp.id }, data: { status: 'RETORNANDO', botin: { items } } });
    await prisma.kingdomStats.update({ where: { ownerKey: `faction:${serhuId}` }, data: { comida: 0 } });

    await avanzarExpedicionesDePartida(prisma, worldId, saveId, exp.diaRegreso, () => 0.99);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `faction:${serhuId}` } })).comida).toBe(3 * RACIONES_POR_UNIDAD_COMESTIBLE);
    const almacen = await prisma.almacenItem.findMany({ where: { factionId: serhuId } });
    expect(almacen.some((a) => a.catalogSlug === comestible.slug)).toBe(false);
    expect(almacen.some((a) => a.catalogSlug === mena.slug)).toBe(true);

    // Sin hambre (reserva enorme), la siguiente sale sin motivo.
    await prisma.kingdomStats.update({ where: { ownerKey: `faction:${serhuId}` }, data: { comida: 1_000_000 } });
    await prisma.expedicion.deleteMany({ where: { saveId } });
    await avanzarExpedicionesDePartida(prisma, worldId, saveId, exp.diaRegreso + 1, () => 0.99);
    expect((await prisma.expedicion.findFirstOrThrow({ where: { factionId: serhuId } })).motivo).toBeNull();
  }, 60_000);
});
