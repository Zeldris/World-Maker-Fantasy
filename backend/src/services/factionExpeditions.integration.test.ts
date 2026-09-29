import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { advanceFactionExpeditions } from './factionExpeditions.js';
import { REGION_OWNING_FACTIONS } from './reputation.js';
import { detectNpcsInScene } from './npcScene.js';

/// Fase 13-B contra Postgres real: lanzar, llegar, completar, stock, XP e idempotencia del tick. Usa la
/// facción sembrada Clan Serhu (con NPC de pescador/herborista con potencial) en el mundo helek-sirik y
/// restaura al terminar marcadores, progreso de NPC, Almacén y expediciones creadas.
describe('advanceFactionExpeditions — integración (Fase 13-B)', () => {
  const DIA = 300_001; // muy por encima de cualquier partida real: domina el "máximo del mundo"
  const random = () => 0.99; // tirada 20 (recolección OK), sin intercepción
  let worldId: string;
  let saveId: string;
  let serhuId: string;
  let statsSnapshot: { id: string; ultimoDiaExpedicion: number | null }[] = [];
  let progresoSnapshot: Awaited<ReturnType<typeof prisma.npcProfessionProgress.findMany>> = [];
  let almacenPreviosIds: string[] = [];
  let expedicionesPreviasIds: string[] = [];

  const irAlDia = (dia: number) => prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: dia * 1440 + 30 } });

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const save = await prisma.save.create({
      data: {
        userId, worldId, characterName: 'Expediciones de facción', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'E',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: DIA * 1440 + 30 } });
    serhuId = (await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-serhu', saveId: null } })).id;
    statsSnapshot = (await prisma.kingdomStats.findMany({ where: { faction: { worldId } }, select: { id: true, ultimoDiaExpedicion: true } }));
    progresoSnapshot = await prisma.npcProfessionProgress.findMany({ where: { npc: { worldId } } });
    almacenPreviosIds = (await prisma.almacenItem.findMany({ where: { faction: { worldId } }, select: { id: true } })).map((a) => a.id);
    expedicionesPreviasIds = (await prisma.expedicion.findMany({ where: { worldId }, select: { id: true } })).map((e) => e.id);
    // Línea base: todas las facciones procesadas hasta DIA-1 → el primer tick procesa exactamente el día DIA.
    await prisma.kingdomStats.updateMany({ where: { faction: { worldId } }, data: { ultimoDiaExpedicion: DIA - 1 } });
  });

  afterAll(async () => {
    await prisma.expedicion.deleteMany({ where: { worldId, id: { notIn: expedicionesPreviasIds } } });
    await prisma.almacenItem.deleteMany({ where: { faction: { worldId }, id: { notIn: almacenPreviosIds } } });
    for (const p of progresoSnapshot) await prisma.npcProfessionProgress.update({ where: { id: p.id }, data: { nivel: p.nivel, xp: p.xp } });
    for (const s of statsSnapshot) await prisma.kingdomStats.update({ where: { id: s.id }, data: { ultimoDiaExpedicion: s.ultimoDiaExpedicion } });
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('lanza, llega, completa, deposita stock y da XP; el mismo día dos veces es idempotente; la intercepción pierde la carga', async () => {
    const propias = () => prisma.expedicion.findMany({ where: { factionId: serhuId, id: { notIn: expedicionesPreviasIds } }, include: { members: true }, orderBy: { diaSalida: 'asc' } });

    // Día DIA: lanza una (y solo una) expedición.
    const r1 = await advanceFactionExpeditions(prisma, random);
    expect(r1.lanzadas).toBeGreaterThan(0);
    let exps = await propias();
    expect(exps).toHaveLength(1);
    const exp = exps[0]!;
    expect(exp).toMatchObject({ status: 'EN_TRANSITO', diaSalida: DIA, diaRegreso: DIA + 2, riesgo: 0 });
    expect(exp.members.filter((m) => m.rol === 'recolector').length).toBeGreaterThanOrEqual(1);
    const recolectores = exp.members.filter((m) => m.rol === 'recolector').map((m) => m.npcId);
    const xpAntes = await prisma.npcProfessionProgress.findMany({ where: { npcId: { in: recolectores }, professionId: exp.professionId } });

    // Idempotencia: mismo día, segundo tick, nada cambia.
    const r2 = await advanceFactionExpeditions(prisma, random);
    expect(r2.diasProcesados).toBe(0);
    expect(r2.lanzadas).toBe(0);
    expect(await propias()).toHaveLength(1);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `faction:${serhuId}` } })).ultimoDiaExpedicion).toBe(DIA);

    // Día DIA+1: llegada, recolección, RETORNANDO con botín.
    await irAlDia(DIA + 1);
    await advanceFactionExpeditions(prisma, random);
    const llegada = (await propias())[0]!;
    expect(llegada.status).toBe('RETORNANDO');
    const items = (llegada.botin as { items: { npcId: string; cantidad: number; catalogSlug: string }[] }).items;
    expect(items.length).toBeGreaterThan(0);
    expect(llegada.tiradaRiesgo).not.toBeNull();

    // Día DIA+2: completa, botín al Almacén con tope, XP a quien sacó algo, y (mismo día) lanza otra.
    await irAlDia(DIA + 2);
    const r3 = await advanceFactionExpeditions(prisma, random);
    expect(r3.completadas).toBeGreaterThan(0);
    exps = await propias();
    expect(exps[0]!.status).toBe('COMPLETADA');
    const almacen = await prisma.almacenItem.findMany({ where: { factionId: serhuId, id: { notIn: almacenPreviosIds } } });
    for (const it of items) expect(almacen.some((a) => a.catalogSlug === it.catalogSlug)).toBe(true);
    const xpDespues = await prisma.npcProfessionProgress.findMany({ where: { npcId: { in: items.map((i) => i.npcId) }, professionId: exp.professionId } });
    expect(xpDespues.length).toBeGreaterThan(0);
    for (const d of xpDespues) {
      const antes = xpAntes.find((a) => a.npcId === d.npcId);
      expect(d.xp).toBeGreaterThan(antes?.xp ?? -1);
    }
    expect(exps).toHaveLength(2);
    expect(exps[1]!.status).toBe('EN_TRANSITO');

    // Segunda expedición con riesgo 100: la intercepción la marca INTERCEPTADA y pierde la carga.
    await prisma.expedicion.update({ where: { id: exps[1]!.id }, data: { riesgo: 100 } });
    const stockAntes = await prisma.almacenItem.count({ where: { factionId: serhuId } });
    await irAlDia(DIA + 3);
    const r4 = await advanceFactionExpeditions(prisma, () => 0.1);
    expect(r4.interceptadas).toBeGreaterThan(0);
    const interceptada = await prisma.expedicion.findUniqueOrThrow({ where: { id: exps[1]!.id } });
    expect(interceptada.status).toBe('INTERCEPTADA');
    expect(interceptada.botin).toBeNull();
    // Nada entra al Almacén por la interceptada.
    expect(await prisma.almacenItem.count({ where: { factionId: serhuId } })).toBe(stockAntes);
  }, 60_000);
});

/// Fase 13-C contra Postgres real: intercepción con combate. Como en el catálogo actual ninguna
/// facción con expediciones comparte región, el test añade TEMPORALMENTE a Feg Ger como segundo
/// dueño de las Llanuras (`REGION_OWNING_FACTIONS` es un objeto mutable) y siembra una relación de
/// GUERRA Serhu→Feg Ger; fija los atributos/nivel de los NPC de ambas para que el combate sea
/// decisivo, y lo restaura todo al terminar (atributos, relaciones, marcadores, Almacén, XP).
describe('advanceFactionExpeditions — intercepción con combate (Fase 13-C)', () => {
  const REGION = 'Las Llanuras del Viento Rojo';
  const bloque = (v: number) => ({ fuerza: v, destreza: v, constitucion: v, inteligencia: v, voluntad: v, carisma: v, magia: v });
  /// La primera tirada (riesgo) dispara la intercepción; el resto (d20 de combate y de recolección) son 20.
  const tiradaBajaLuegoAlta = () => { let n = 0; return () => (n++ === 0 ? 0.1 : 0.99); };
  let worldId: string;
  let saveId: string;
  let serhuId: string;
  let fegGerId: string;
  let duenosOriginales: string[];
  let statsSnapshot: { id: string; ultimoDiaExpedicion: number | null }[] = [];
  let progresoSnapshot: Awaited<ReturnType<typeof prisma.npcProfessionProgress.findMany>> = [];
  let npcSnapshot: { id: string; attributes: unknown; level: number; muertoEnMundo: boolean }[] = [];
  let saveTardioId: string | null = null;
  let relacionesPrevias: Awaited<ReturnType<typeof prisma.factionRelation.findMany>> = [];
  let almacenPreviosIds: string[] = [];
  let expedicionesPreviasIds: string[] = [];
  let dia = 310_001;

  const irAlDia = (d: number) => prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: d * 1440 + 30 } });
  const ponerNpcs = async (serhu: number, hostil: number) => {
    await prisma.npc.updateMany({ where: { worldId, faction: 'Clan Serhu' }, data: { attributes: bloque(serhu), level: 1 } });
    await prisma.npc.updateMany({ where: { worldId, faction: 'Feg Ger' }, data: { attributes: bloque(hostil), level: 1 } });
  };
  const presion = async () => (await prisma.factionRelation.findUniqueOrThrow({ where: { sourceFactionId_targetFactionId: { sourceFactionId: serhuId, targetFactionId: fegGerId } } })).presion;
  const propias = () => prisma.expedicion.findMany({ where: { factionId: serhuId, id: { notIn: expedicionesPreviasIds } }, include: { members: true }, orderBy: { diaSalida: 'asc' } });

  /// Prepara un día limpio: sin expediciones propias del test, relación en GUERRA (presión 85) y todas las
  /// facciones con línea base en `dia - 1`. Lanza la expedición de Serhu y comprueba su riesgo (50 %).
  const lanzar = async () => {
    dia += 10;
    await prisma.expedicion.deleteMany({ where: { worldId, id: { notIn: expedicionesPreviasIds } } });
    await prisma.factionRelation.update({ where: { sourceFactionId_targetFactionId: { sourceFactionId: serhuId, targetFactionId: fegGerId } }, data: { presion: 85, type: 'GUERRA' } });
    await prisma.kingdomStats.updateMany({ where: { faction: { worldId } }, data: { ultimoDiaExpedicion: dia - 1 } });
    await irAlDia(dia);
    await advanceFactionExpeditions(prisma, () => 0.99);
    const exp = (await propias())[0]!;
    expect(exp).toMatchObject({ status: 'EN_TRANSITO', riesgo: 50 });
    expect(exp.members.filter((m) => m.rol === 'guardia').length).toBeGreaterThanOrEqual(1);
    return exp;
  };

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId, worldId, characterName: 'Intercepción de expediciones', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: bloque(10), portraitInitial: 'I',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: dia * 1440 + 30 } });
    serhuId = (await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-serhu', saveId: null } })).id;
    fegGerId = (await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'feg-ger', saveId: null } })).id;
    statsSnapshot = await prisma.kingdomStats.findMany({ where: { faction: { worldId } }, select: { id: true, ultimoDiaExpedicion: true } });
    progresoSnapshot = await prisma.npcProfessionProgress.findMany({ where: { npc: { worldId } } });
    npcSnapshot = await prisma.npc.findMany({ where: { worldId, faction: { in: ['Clan Serhu', 'Feg Ger'] } }, select: { id: true, attributes: true, level: true, muertoEnMundo: true } });
    relacionesPrevias = await prisma.factionRelation.findMany({ where: { worldId } });
    almacenPreviosIds = (await prisma.almacenItem.findMany({ where: { faction: { worldId } }, select: { id: true } })).map((a) => a.id);
    expedicionesPreviasIds = (await prisma.expedicion.findMany({ where: { worldId }, select: { id: true } })).map((e) => e.id);
    duenosOriginales = REGION_OWNING_FACTIONS[REGION]!;
    REGION_OWNING_FACTIONS[REGION] = ['Clan Serhu', 'Feg Ger'];
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId: serhuId, targetFactionId: fegGerId } },
      update: {}, create: { worldId, sourceFactionId: serhuId, targetFactionId: fegGerId, presion: 85, type: 'GUERRA' },
    });
  });

  afterAll(async () => {
    REGION_OWNING_FACTIONS[REGION] = duenosOriginales;
    await prisma.expedicion.deleteMany({ where: { worldId, id: { notIn: expedicionesPreviasIds } } });
    await prisma.almacenItem.deleteMany({ where: { faction: { worldId }, id: { notIn: almacenPreviosIds } } });
    for (const p of progresoSnapshot) await prisma.npcProfessionProgress.update({ where: { id: p.id }, data: { nivel: p.nivel, xp: p.xp } });
    for (const n of npcSnapshot) await prisma.npc.update({ where: { id: n.id }, data: { attributes: n.attributes as object, level: n.level, muertoEnMundo: n.muertoEnMundo } });
    for (const s of statsSnapshot) await prisma.kingdomStats.update({ where: { id: s.id }, data: { ultimoDiaExpedicion: s.ultimoDiaExpedicion } });
    // Relaciones: las que ya existían vuelven a su valor; las que creó el test se borran.
    await prisma.factionRelation.deleteMany({ where: { worldId, id: { notIn: relacionesPrevias.map((r) => r.id) } } });
    for (const r of relacionesPrevias) await prisma.factionRelation.update({ where: { id: r.id }, data: { presion: r.presion, type: r.type, stage: r.stage } });
    await prisma.save.deleteMany({ where: { id: { in: [saveId, ...(saveTardioId ? [saveTardioId] : [])] } } });
  });

  it('guardias que ganan: la expedición sigue, completa con stock y la presión no cambia', async () => {
    await ponerNpcs(18, 4);
    const exp = await lanzar();
    await irAlDia(dia + 1);
    const r = await advanceFactionExpeditions(prisma, tiradaBajaLuegoAlta());
    expect(r.interceptadas).toBe(0);
    const llegada = (await propias())[0]!;
    expect(llegada.status).toBe('RETORNANDO');
    expect(llegada.interceptacion).toMatchObject({ faccionHostil: 'Feg Ger', ganador: 'defensores', presionAplicada: false });
    expect((llegada.interceptacion as { atacanteSlug: string }).atacanteSlug).toBeTruthy();
    expect(await presion()).toBe(85);

    await irAlDia(dia + 2);
    await advanceFactionExpeditions(prisma, () => 0.99);
    const fin = await prisma.expedicion.findUniqueOrThrow({ where: { id: exp.id } });
    expect(fin.status).toBe('COMPLETADA');
    const items = (fin.botin as { items: { catalogSlug: string }[] }).items;
    expect(items.length).toBeGreaterThan(0);
    const almacen = await prisma.almacenItem.findMany({ where: { factionId: serhuId, id: { notIn: almacenPreviosIds } } });
    for (const it of items) expect(almacen.some((a) => a.catalogSlug === it.catalogSlug)).toBe(true);
    expect(fin.interceptacion).toMatchObject({ ganador: 'defensores' });
  }, 60_000);

  it('guardias que pierden: INTERCEPTADA, carga perdida y presión +8 en la relación', async () => {
    await ponerNpcs(4, 18);
    const exp = await lanzar();
    const stockAntes = await prisma.almacenItem.count({ where: { factionId: serhuId } });
    await irAlDia(dia + 1);
    const r = await advanceFactionExpeditions(prisma, tiradaBajaLuegoAlta());
    expect(r.interceptadas).toBe(1);
    const fin = await prisma.expedicion.findUniqueOrThrow({ where: { id: exp.id } });
    expect(fin.status).toBe('INTERCEPTADA');
    expect(fin.botin).toBeNull();
    expect(fin.interceptacion).toMatchObject({ faccionHostil: 'Feg Ger', ganador: 'atacante', presionAplicada: true });
    expect(await presion()).toBe(93); // BAJA_DE_GUERRA pesa +8
    expect(await prisma.almacenItem.count({ where: { factionId: serhuId } })).toBe(stockAntes);
  }, 60_000);

  it('muerte en la intercepción: el guardia caído muere en TODAS las partidas (también las creadas después), un re-seed no lo resucita y no vuelve a salir de expedición', async () => {
    await ponerNpcs(4, 18);
    const exp = await lanzar();
    const guardiaIds = exp.members.filter((m) => m.rol === 'guardia').map((m) => m.npcId);
    const guardias = await prisma.npc.findMany({ where: { id: { in: guardiaIds } } });
    expect(guardias.every((g) => !g.muertoEnMundo)).toBe(true);
    const escena = async (sid: string, nombre: string) =>
      (await detectNpcsInScene({ action: `Hablo con ${nombre}`, worldId, sessionFacts: [], saveId: sid, currentLocationId: null, fictionalMinutes: 480 })).map((n) => n.slug);
    // Control: en vida, la partida existente lo detecta en escena por su nombre.
    const objetivo = guardias[0]!;
    expect(await escena(saveId, objetivo.name)).toContain(objetivo.slug);

    // Intercepción perdida con probabilidad de muerte 1: caen (CONVALECIENTE) y mueren todos los guardias.
    await irAlDia(dia + 1);
    const r = await advanceFactionExpeditions(prisma, tiradaBajaLuegoAlta(), { probabilidadMuerte: 1 });
    expect(r.interceptadas).toBe(1);
    expect(r.muertes).toBeGreaterThanOrEqual(guardias.length);
    const fin = await prisma.expedicion.findUniqueOrThrow({ where: { id: exp.id } });
    const muertes = (fin.interceptacion as { muertes: { slug: string; rol: string }[] }).muertes;
    for (const g of guardias) expect(muertes).toContainEqual({ slug: g.slug, rol: 'guardia' });
    const muertosBd = await prisma.npc.findMany({ where: { id: { in: guardiaIds } }, select: { muertoEnMundo: true } });
    expect(muertosBd.every((n) => n.muertoEnMundo)).toBe(true);

    // Partida existente: ya no aparece en escena aunque se le nombre.
    expect(await escena(saveId, objetivo.name)).not.toContain(objetivo.slug);
    // Partida creada DESPUÉS de la muerte: tampoco (la muerte es del Npc de mundo, no de un NpcState perezoso).
    const tardia = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Partida tardía', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: bloque(10), portraitInitial: 'T',
      },
    });
    saveTardioId = tardia.id;
    await prisma.worldState.create({ data: { saveId: tardia.id, fictionalMinutes: 480 } });
    expect(await escena(tardia.id, objetivo.name)).not.toContain(objetivo.slug);

    // Un upsert como el de `seed-catalog` (el `update` no incluye `muertoEnMundo`) no lo resucita.
    await prisma.npc.upsert({
      where: { worldId_slug: { worldId, slug: objetivo.slug } },
      update: { name: objetivo.name, role: objetivo.role, level: objetivo.level, bio: objetivo.bio },
      create: { ...objetivo, id: undefined, attributes: objetivo.attributes as object, habilidadesRaciales: objetivo.habilidadesRaciales as object },
    });
    expect((await prisma.npc.findUniqueOrThrow({ where: { id: objetivo.id } })).muertoEnMundo).toBe(true);
    expect(readFileSync(new URL('../scripts/seed-catalog.ts', import.meta.url), 'utf8')).not.toContain('muertoEnMundo');

    // Los muertos no vuelven a unirse a una expedición (ni como guardia ni como recolector).
    await prisma.expedicion.deleteMany({ where: { worldId, id: { notIn: expedicionesPreviasIds } } });
    await prisma.kingdomStats.updateMany({ where: { faction: { worldId } }, data: { ultimoDiaExpedicion: dia + 9 } });
    await irAlDia(dia + 10);
    await advanceFactionExpeditions(prisma, () => 0.99);
    for (const e of await propias()) for (const m of e.members) expect(guardiaIds).not.toContain(m.npcId);
  }, 60_000);

  it('una relación NEUTRAL nunca intercepta: riesgo 0 al lanzar y tirada 0 no dispara', async () => {
    await prisma.factionRelation.update({ where: { sourceFactionId_targetFactionId: { sourceFactionId: serhuId, targetFactionId: fegGerId } }, data: { presion: 50, type: 'NEUTRAL' } });
    await prisma.expedicion.deleteMany({ where: { worldId, id: { notIn: expedicionesPreviasIds } } });
    dia += 10;
    await prisma.kingdomStats.updateMany({ where: { faction: { worldId } }, data: { ultimoDiaExpedicion: dia - 1 } });
    await irAlDia(dia);
    await advanceFactionExpeditions(prisma, () => 0.99);
    expect((await propias())[0]).toMatchObject({ status: 'EN_TRANSITO', riesgo: 0 });
    await irAlDia(dia + 1);
    const r = await advanceFactionExpeditions(prisma, () => 0);
    expect(r.interceptadas).toBe(0);
    expect((await propias())[0]!.interceptacion).toBeNull();
  }, 60_000);
});
