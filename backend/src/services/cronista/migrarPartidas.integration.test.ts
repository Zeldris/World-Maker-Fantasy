import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { migrarPartida } from './migrarPartidas.js';
import { CONFLICTO_ID, stagesConflictoPorRegion } from '../worldAgenda.js';
import { ambitoFacciones } from '../mundoPartida.js';

// CR-8 (hito 0.2, roadmap-cronista.md § 16) — migración de una partida antigua contra Postgres real.
describe('migrarPartida (CR-8)', () => {
  let saveId: string;
  let retirado: { id: string; slug: string };
  let muertoDeMundo: { id: string };

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const [a, b] = await prisma.npc.findMany({ where: { worldId: world.id, muertoEnMundo: false }, orderBy: { slug: 'asc' }, take: 2, select: { id: true, slug: true } });
    retirado = a!;
    muertoDeMundo = b!;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId: world.id,
        characterName: 'Partida antigua (CR-8)',
        characterArchetype: 'guerrero',
        characterOrigin: 'x',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'A',
        npcsRetiredForever: [retirado.slug],
        // Día 7 de ficción, con el conflicto Serhu ya en etapa 3.
        worldState: {
          create: {
            fictionalMinutes: 7 * 1440 + 30,
            agenda: [{ id: CONFLICTO_ID, title: 't', stage: 3, maxStage: 4, nextStageAtMinutes: 99 * 1440 }],
          },
        },
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin aplicar solo informa; al aplicar clona, marca muertos, sube el conflicto y fija el día; repetir no cambia nada', async () => {
    const simulado = await migrarPartida(prisma, saveId, [muertoDeMundo.id], false);
    expect(simulado).toEqual({ saveId, clonaMundo: true, npcsMuertos: 2, etapaConflicto: 3, diaSimulado: 7 });
    expect((await prisma.worldState.findUniqueOrThrow({ where: { saveId } })).mundoClonadoEn).toBeNull();
    expect(await prisma.npcState.count({ where: { saveId } })).toBe(0);

    await migrarPartida(prisma, saveId, [muertoDeMundo.id], true);
    const ws = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect(ws.mundoClonadoEn).not.toBeNull();
    expect(ws.ultimoDiaSimulado).toBe(7);
    const muertos = await prisma.npcState.findMany({ where: { saveId, muerto: true }, select: { npcId: true } });
    expect(muertos.map((m) => m.npcId).sort()).toEqual([retirado.id, muertoDeMundo.id].sort());
    expect((await stagesConflictoPorRegion(prisma, await ambitoFacciones(prisma, saveId))).get('Cristal Helado')).toBeGreaterThanOrEqual(3);

    const facciones = await prisma.faction.count({ where: { saveId } });
    const informe = await migrarPartida(prisma, saveId, [muertoDeMundo.id], true);
    expect(informe?.clonaMundo).toBe(false);
    expect(await prisma.faction.count({ where: { saveId } })).toBe(facciones);
    expect(await prisma.npcState.count({ where: { saveId, muerto: true } })).toBe(2);
  }, 30_000);
});
