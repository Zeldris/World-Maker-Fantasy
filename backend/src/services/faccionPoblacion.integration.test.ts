import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { crecerPoblacionDePartida, syncFactionPopulationToKingdomStats } from './population.js';

/// Reproducción poblacional de facciones (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.6, 2026-09-21) —
/// verifica el flujo real de dos pasos del avance diario de una partida (CR-7, hito 0.2):
/// `crecerPoblacionDePartida` incrementa sus filas WorldPopulation FACCION (Clan Serhu), y
/// `syncFactionPopulationToKingdomStats` refleja ese crecimiento en el KingdomStats de la copia de
/// la Faction en esa partida — sin mocks, contra Postgres.
describe('Reproducción poblacional de facción — flujo real de dos pasos (CR-7)', () => {
  let saveId: string;
  let serhuFactionId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId: world.id,
        characterName: 'Reproducción de facción (CR-7)',
        characterArchetype: 'guerrero',
        characterOrigin: 'x',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'R',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
    serhuFactionId = (await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' } })).id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('crecer la población de la partida incrementa su fila FACCION, y el sync la refleja en el KingdomStats de su copia', async () => {
    const fila = () => prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetType: 'FACCION', targetSlug: 'clan-serhu-poblacion' } });
    const antes = await fila();

    expect(await crecerPoblacionDePartida(prisma, saveId, 60, () => 0)).toBeGreaterThan(0);
    const tras = await fila();
    expect(tras.poblacion).toBeGreaterThan(antes.poblacion);

    const syncResult = await syncFactionPopulationToKingdomStats(prisma, { saveId });
    expect(syncResult.synced).toBeGreaterThan(0);

    const kingdomStats = await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: serhuFactionId } });
    // CR-54 (Q16): comen todos — la población del KingdomStats son civiles y trabajadores.
    const trabajadores = await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetType: 'FACCION', targetSlug: 'clan-serhu-trabajadores' } });
    expect(kingdomStats.poblacion).toBe(tras.poblacion + trabajadores.poblacion);
    // Los otros 3 campos (soldados/trabajadores/visitantes) también se re-escriben en cada sync,
    // reflejando su fila WorldPopulation de la partida — no solo poblacion.
    const filas = await prisma.worldPopulation.findMany({
      where: { saveId, targetType: 'FACCION', targetSlug: { in: ['clan-serhu-soldados', 'clan-serhu-trabajadores', 'clan-serhu-visitantes'] } },
    });
    const valor = (slug: string) => filas.find((f) => f.targetSlug === slug)!.poblacion;
    expect(kingdomStats.soldados).toBe(valor('clan-serhu-soldados'));
    expect(kingdomStats.trabajadores).toBe(valor('clan-serhu-trabajadores'));
    expect(kingdomStats.visitantes).toBe(valor('clan-serhu-visitantes'));
  }, 15_000);
});
