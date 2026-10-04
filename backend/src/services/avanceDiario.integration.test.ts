import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { avanzarMundoHasta } from './avanceDiario.js';

// CR-7 (hito 0.2, roadmap-cronista.md § 13.1) — el mundo de una partida avanza con SU reloj, contra
// Postgres real: crece su población (no la de otra partida ni la del catálogo) y cada día se
// simula una sola vez.
describe('avanzarMundoHasta (CR-7)', () => {
  const saveIds: string[] = [];
  let worldId: string;

  async function crearPartida(nombre: string) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
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

  const totalPoblacion = async (where: { saveId: string } | { worldId: string; saveId: null }) =>
    (await prisma.worldPopulation.aggregate({ where, _sum: { poblacion: true } }))._sum.poblacion ?? 0;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('diez días hacen crecer la población de la partida, no la de otra ni la del catálogo; repetir no vuelve a simular', async () => {
    const a = await crearPartida('Avance diario (CR-7) A');
    const b = await crearPartida('Avance diario (CR-7) B');
    // Clonar las dos antes de medir (la primera llamada de cada una ya clona).
    await avanzarMundoHasta(prisma, a, 480);
    await avanzarMundoHasta(prisma, b, 480);
    const antesA = await totalPoblacion({ saveId: a });
    const antesB = await totalPoblacion({ saveId: b });
    const antesCatalogo = await totalPoblacion({ worldId, saveId: null });

    const diezDias = 480 + 10 * 1440;
    expect(await avanzarMundoHasta(prisma, a, diezDias, () => 0)).toEqual({ diasSimulados: 10 });

    expect(await totalPoblacion({ saveId: a })).toBeGreaterThan(antesA);
    expect(await totalPoblacion({ saveId: b })).toBe(antesB);
    expect(await totalPoblacion({ worldId, saveId: null })).toBe(antesCatalogo);
    expect((await prisma.worldState.findUniqueOrThrow({ where: { saveId: a } })).ultimoDiaSimulado).toBe(10);

    const tras = await totalPoblacion({ saveId: a });
    expect(await avanzarMundoHasta(prisma, a, diezDias, () => 0)).toEqual({ diasSimulados: 0 });
    expect(await totalPoblacion({ saveId: a })).toBe(tras);
  }, 30_000);
});
