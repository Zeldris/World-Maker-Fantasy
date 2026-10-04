import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { registrarSuceso } from './sucesos.js';
import { evaluarConsecuencias } from './consecuencias.js';
import { ACTIVIDAD_ALTA, narrarDia, SUCESOS_DE_FONDO, TOPE_PRESUPUESTO, type SucesoDeFondo } from './narradorFondo.js';

// CR-12 (hito 0.2, roadmap-cronista.md § 7.3) — narrador de fondo contra Postgres real: presupuesto
// por ritmo, enfriamientos, días de mucha actividad, noticia solo a quien puede saberlo, y cada
// entrada del catálogo inicial aplicable sobre el mundo clonado de una partida.
describe('narrador de fondo (CR-12)', () => {
  const saveIds: string[] = [];
  let worldId: string;
  const malestar = SUCESOS_DE_FONDO.find((s) => s.tipo === 'MALESTAR_INTERNO')!;

  /// Azar reproducible (mulberry32).
  function semilla(n: number): () => number {
    let a = n;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function partida(nombre: string, estiloNarrador = 'EQUILIBRADO', presupuestoTension = 0) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'N',
        worldState: { create: { fictionalMinutes: 480 + 40 * 1440, estiloNarrador, presupuestoTension } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return save.id;
  }

  /// Deja una sola facción de la partida con cohesión baja (candidata a malestar).
  async function descontenta(saveId: string) {
    const f = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: { not: null } }, orderBy: { slug: 'asc' } });
    await prisma.faction.updateMany({ where: { saveId }, data: { cohesion: 70 } });
    await prisma.faction.update({ where: { id: f.id }, data: { cohesion: 20 } });
    return f;
  }

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('gana presupuesto por día, gasta la importancia del suceso y respeta el enfriamiento', async () => {
    const saveId = await partida('Narrador (CR-12) presupuesto');
    const f = await descontenta(saveId);

    const r1 = await narrarDia(prisma, saveId, 10, semilla(1), [malestar]);
    expect(r1).toMatchObject({ tipo: 'MALESTAR_INTERNO', presupuesto: 0 });
    const suceso = await prisma.suceso.findUniqueOrThrow({ where: { id: r1.sucesoId! } });
    expect(suceso).toMatchObject({ origen: 'MUNDO', texto: `Crece el descontento dentro de ${f.name}.`, fictionalMinutes: 10 * 1440 + 720 });
    expect((await prisma.faction.findUniqueOrThrow({ where: { id: f.id } })).cohesion).toBe(15);

    // Al día siguiente sigue en enfriamiento (3 días): no pasa nada y el presupuesto se guarda.
    expect(await narrarDia(prisma, saveId, 11, semilla(1), [malestar])).toMatchObject({ sucesoId: null, presupuesto: 3, motivo: 'sin-candidatos' });
    expect((await narrarDia(prisma, saveId, 13, semilla(1), [malestar])).tipo).toBe('MALESTAR_INTERNO');
  });

  it('el ritmo Tranquilo tarda más en juntar presupuesto y nunca pasa del tope', async () => {
    const saveId = await partida('Narrador (CR-12) tranquilo', 'TRANQUILO');
    await descontenta(saveId);
    expect(await narrarDia(prisma, saveId, 10, semilla(2), [malestar])).toMatchObject({ sucesoId: null, presupuesto: 1 });
    expect(await narrarDia(prisma, saveId, 11, semilla(2), [malestar])).toMatchObject({ sucesoId: null, presupuesto: 2 });
    expect((await narrarDia(prisma, saveId, 12, semilla(2), [malestar])).tipo).toBe('MALESTAR_INTERNO');

    const caotica = await partida('Narrador (CR-12) tope', 'CAOTICO', TOPE_PRESUPUESTO);
    expect(await narrarDia(prisma, caotica, 10, semilla(2), [])).toMatchObject({ presupuesto: TOPE_PRESUPUESTO });
  });

  it('un día de mucha actividad de la jugadora no hay suceso de fondo', async () => {
    const saveId = await partida('Narrador (CR-12) actividad');
    await descontenta(saveId);
    for (let i = 0; i < ACTIVIDAD_ALTA; i++) {
      await prisma.$transaction((tx) => registrarSuceso(tx, {
        saveId, tipo: 'ACCION_RELEVANTE', fictionalMinutes: 10 * 1440 + 600 + i, origen: 'JUGADOR',
        actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' }], datos: { personaje: 'N', accion: 'algo' },
      }));
    }
    expect(await narrarDia(prisma, saveId, 10, semilla(3), [malestar])).toMatchObject({ sucesoId: null, presupuesto: 3, motivo: 'actividad' });
    expect((await narrarDia(prisma, saveId, 11, semilla(3), [malestar])).tipo).toBe('MALESTAR_INTERNO');
  });

  it('una noticia sin lugar solo llega si el personaje conoce la facción, como rumor y al día siguiente', async () => {
    const saveId = await partida('Narrador (CR-12) noticia');
    const f = await descontenta(saveId);
    await narrarDia(prisma, saveId, 10, semilla(4), [malestar]);
    expect(await prisma.consecuencia.count({ where: { saveId, regla: 'NOTICIA' } })).toBe(0);

    await prisma.worldState.update({ where: { saveId }, data: { factionsStatus: { [f.name]: 0 }, fictionalMinutes: 14 * 1440 + 720 } });
    await narrarDia(prisma, saveId, 14, semilla(4), [malestar]);
    const rumor = `Se dice que crece el descontento dentro de ${f.name}.`;
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: rumor } })).toBe(0);
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 15 * 1440 + 480 } });
    await evaluarConsecuencias(prisma, saveId);
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: rumor } })).toBe(1);
  });

  it('una plaga resta solo la parte de la especie que vive en la región', async () => {
    const saveId = await partida('Narrador (CR-12) plaga regional', 'EQUILIBRADO', TOPE_PRESUPUESTO);
    const plaga = SUCESOS_DE_FONDO.find((s) => s.tipo === 'PLAGA')!;
    const fauna = await prisma.worldPopulation.findMany({ where: { saveId, targetType: { not: 'RAZA' }, poblacion: { gte: 10 } } });
    const antes = new Map(fauna.map((f) => [f.targetSlug, f.poblacion]));
    const r = await narrarDia(prisma, saveId, 10, semilla(7), [plaga]);
    const suceso = await prisma.suceso.findUniqueOrThrow({ where: { id: r.sucesoId! } });
    const afectada = fauna.find((f) => f.label === (suceso.datos as { afecta: string }).afecta)!;
    const dist = afectada.distribucion as Record<string, number>;
    const total = Object.values(dist).reduce((s, v) => s + v, 0);
    const region = (suceso.datos as { region: string }).region.replace(/^(Las|La|El|Los) /, '');
    const esperada = Math.max(1, Math.round(antes.get(afectada.targetSlug)! * ((dist[region] ?? 0) / total) * 0.2));
    const despues = (await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: afectada.targetSlug } })).poblacion;
    expect(antes.get(afectada.targetSlug)! - despues).toBe(esperada);
  });

  it('cada entrada del catálogo inicial se aplica sobre el mundo de la partida cuando tiene candidatos', async () => {
    const saveId = await partida('Narrador (CR-12) catálogo');
    await descontenta(saveId);
    // La facción descontenta, aliada con una fuerte: candidata a absorción.
    const [debil, fuerte] = await prisma.faction.findMany({ where: { saveId, origenSlug: { not: null } }, orderBy: { slug: 'asc' }, take: 2 });
    await prisma.faction.update({ where: { id: fuerte!.id }, data: { cohesion: 80 } });
    // Justo antes de su turno: una caravana anterior podría cambiar la banda de la relación.
    const aliar = () => prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId: debil!.id, targetFactionId: fuerte!.id } },
      create: { worldId, saveId, sourceFactionId: debil!.id, targetFactionId: fuerte!.id, type: 'ALIANZA' },
      update: { type: 'ALIANZA' },
    });

    // Y un Reino de la jugadora, para el visitante ilustre.
    await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-narrador', name: 'Reino del Narrador', raza: 'humano', description: 'x' } });
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: `save:${saveId}`, felicidad: 50 } });

    const aplicados: string[] = [];
    let dia = 10;
    for (const entrada of SUCESOS_DE_FONDO as SucesoDeFondo[]) {
      await prisma.worldState.update({ where: { saveId }, data: { presupuestoTension: TOPE_PRESUPUESTO } });
      if (entrada.tipo === 'FACCION_ABSORBIDA') await aliar();
      const r = await narrarDia(prisma, saveId, dia, semilla(dia), [entrada]);
      dia += 20;
      if (r.sucesoId) {
        expect(r.tipo).toBe(entrada.tipo);
        expect((await prisma.suceso.findUniqueOrThrow({ where: { id: r.sucesoId } })).tipo).toBe(entrada.tipo);
        aplicados.push(entrada.tipo);
      }
    }
    // En el mundo sembrado hay facciones en tensión y con tratado, fauna, edificios de facción, y lo de arriba.
    expect(aplicados).toEqual(SUCESOS_DE_FONDO.map((e) => e.tipo));
    // Las regiones van por su slug, como en el resto del Libro.
    const deFauna = await prisma.suceso.findMany({ where: { saveId, tipo: { in: ['PLAGA', 'AUGE_POBLACION', 'MIGRACION_FAUNA'] } }, include: { actores: true } });
    for (const s of deFauna) {
      expect(s.regionSlug).toMatch(/^[a-z0-9-]+$/);
      for (const a of s.actores.filter((x) => x.entidadTipo === 'REGION')) expect(a.entidadId).toMatch(/^[a-z0-9-]+$/);
    }
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `save:${saveId}` } })).felicidad).toBe(55);
    expect((await prisma.faction.findUniqueOrThrow({ where: { id: debil!.id } })).disueltaEn).not.toBeNull();
  });
});
