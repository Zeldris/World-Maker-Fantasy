import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ambitoFacciones, asegurarMundoDePartida, faccionesDeCatalogo, npcVivoEnPartida, npcsMuertosEnPartida } from './mundoPartida.js';
import { sincronizarRelacionesConflicto, stagesConflictoPorRegion } from './worldAgenda.js';

// CR-6 (hito 0.2, roadmap-cronista.md § 5.3) — clonado perezoso e idempotente del mundo vivo de una
// partida, contra Postgres real: dos partidas del mismo mundo tienen copias independientes.
describe('asegurarMundoDePartida (CR-6)', () => {
  const saveIds: string[] = [];
  let worldId: string;

  async function crearPartida(nombre: string) {
    const userId = await getDefaultUserId();
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: nombre,
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: 480, fictionalDateLabel: 'Día 1, mañana' } },
      },
    });
    saveIds.push(save.id);
    return save.id;
  }

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('clona facciones, relaciones, reino de facción y población; marca y deja suceso; la segunda vez no hace nada', async () => {
    const saveId = await crearPartida('Mundo por partida (CR-6) A');
    const [nFacciones, nPoblacion, nRelaciones] = await Promise.all([
      prisma.faction.count({ where: { worldId, saveId: null } }),
      prisma.worldPopulation.count({ where: { worldId, saveId: null } }),
      prisma.factionRelation.count({ where: { sourceFaction: { worldId, saveId: null }, targetFaction: { saveId: null } } }),
    ]);

    expect(await asegurarMundoDePartida(prisma, saveId)).toBe(true);

    const copias = await prisma.faction.findMany({ where: { saveId }, include: { kingdomStats: true } });
    expect(copias).toHaveLength(nFacciones);
    expect(copias.every((c) => c.origenSlug === c.slug)).toBe(true);
    expect(await prisma.factionRelation.count({ where: { saveId } })).toBe(nRelaciones);
    expect(await prisma.worldPopulation.count({ where: { saveId } })).toBe(nPoblacion);
    const serhu = copias.find((c) => c.slug === 'clan-serhu')!;
    expect(serhu.kingdomStats?.ownerKey).toBe(`faction:${serhu.id}`);
    const ws = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect(ws.mundoClonadoEn).not.toBeNull();
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'SISTEMA_MUNDO_INICIADO' } })).toBe(1);

    expect(await asegurarMundoDePartida(prisma, saveId)).toBe(false);
    expect(await prisma.faction.count({ where: { saveId } })).toBe(nFacciones);
  });

  it('dos partidas del mismo mundo divergen: cambiar la población de una no toca la otra ni el catálogo', async () => {
    const a = await crearPartida('Mundo por partida (CR-6) B');
    const b = await crearPartida('Mundo por partida (CR-6) C');
    await Promise.all([asegurarMundoDePartida(prisma, a), asegurarMundoDePartida(prisma, b)]);
    const filtro = { targetType: 'RAZA' as const, targetSlug: 'orcos-llanuras' };
    const catalogo = await prisma.worldPopulation.findFirstOrThrow({ where: { worldId, saveId: null, ...filtro } });
    await prisma.worldPopulation.updateMany({ where: { saveId: a, ...filtro }, data: { poblacion: { decrement: 7 } } });
    const [enA, enB, enCatalogo] = await Promise.all([
      prisma.worldPopulation.findFirstOrThrow({ where: { saveId: a, ...filtro } }),
      prisma.worldPopulation.findFirstOrThrow({ where: { saveId: b, ...filtro } }),
      prisma.worldPopulation.findFirstOrThrow({ where: { worldId, saveId: null, ...filtro } }),
    ]);
    expect(enA.poblacion).toBe(catalogo.poblacion - 7);
    expect(enB.poblacion).toBe(catalogo.poblacion);
    expect(enCatalogo.poblacion).toBe(catalogo.poblacion);
  });

  it('borrar la partida se lleva su mundo clonado', async () => {
    const saveId = await crearPartida('Mundo por partida (CR-6) D');
    await asegurarMundoDePartida(prisma, saveId);
    await prisma.save.delete({ where: { id: saveId } });
    expect(await prisma.faction.count({ where: { saveId } })).toBe(0);
    expect(await prisma.worldPopulation.count({ where: { saveId } })).toBe(0);
  });

  it('el conflicto de la agenda de una partida mueve solo sus relaciones (ni las de otra ni las del catálogo)', async () => {
    const a = await crearPartida('Mundo por partida (CR-6) conflicto A');
    const b = await crearPartida('Mundo por partida (CR-6) conflicto B');
    const faccionesA = await ambitoFacciones(prisma, a);
    const faccionesB = await ambitoFacciones(prisma, b);
    const catalogo = faccionesDeCatalogo(worldId);
    const antesB = await stagesConflictoPorRegion(prisma, faccionesB);
    const antesCatalogo = await stagesConflictoPorRegion(prisma, catalogo);

    await sincronizarRelacionesConflicto(prisma, faccionesA, 4);

    expect((await stagesConflictoPorRegion(prisma, faccionesA)).get('Cristal Helado')).toBe(4);
    expect(await stagesConflictoPorRegion(prisma, faccionesB)).toEqual(antesB);
    expect(await stagesConflictoPorRegion(prisma, catalogo)).toEqual(antesCatalogo);
  });

  it('un NPC muerto fuera de escena en una partida (NpcState.muerto) sigue vivo en otra', async () => {
    const a = await crearPartida('Mundo por partida (CR-7) muerto A');
    const b = await crearPartida('Mundo por partida (CR-7) muerto B');
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, muertoEnMundo: false, saveId: null }, orderBy: { slug: 'asc' } });
    await prisma.npcState.create({ data: { saveId: a, npcId: npc.id, scope: '', muerto: true, muertoEn: 480 } });

    expect(await prisma.npc.count({ where: { id: npc.id, ...npcVivoEnPartida(a) } })).toBe(0);
    expect(await prisma.npc.count({ where: { id: npc.id, ...npcVivoEnPartida(b) } })).toBe(1);
    expect((await npcsMuertosEnPartida(prisma, a)).has(npc.id)).toBe(true);
    expect((await npcsMuertosEnPartida(prisma, b)).has(npc.id)).toBe(false);
  });
});
