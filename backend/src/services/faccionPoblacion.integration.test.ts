import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { growAllPopulations, syncFactionPopulationToKingdomStats } from './population.js';

/// Reproducción poblacional de facciones (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.6, 2026-09-21) —
/// verifica el flujo real de dos pasos que corre en worldTick.ts: growAllPopulations incrementa
/// las filas WorldPopulation FACCION reales (Clan Serhu), y syncFactionPopulationToKingdomStats
/// refleja ese crecimiento en el KingdomStats real de la Faction — sin mocks, contra Postgres.
describe('Reproducción poblacional de facción — flujo real de dos pasos (2026-09-21)', () => {
  let worldId: string;
  let serhuFactionId: string;
  let poblacionRowId: string;
  let originalPoblacion: number;
  let originalUpdatedAt: Date;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const serhu = await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-serhu', saveId: null } });
    serhuFactionId = serhu.id;
    const poblacionRow = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'FACCION', targetSlug: 'clan-serhu-poblacion' },
    });
    poblacionRowId = poblacionRow.id;
    originalPoblacion = poblacionRow.poblacion;
    originalUpdatedAt = poblacionRow.updatedAt;

    // Retrasa `updatedAt` 60 días reales para forzar un delta de crecimiento real y medible —
    // mismo criterio que growAllPopulations.test.ts (population.test.ts).
    await prisma.worldPopulation.update({
      where: { id: poblacionRowId },
      data: { updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60_000) },
    });
  });

  afterAll(async () => {
    // Restaura el estado real del sandbox — esta fila es compartida (World, no Save), no se borra.
    await prisma.worldPopulation.update({ where: { id: poblacionRowId }, data: { poblacion: originalPoblacion, updatedAt: originalUpdatedAt } });
  });

  it('growAllPopulations incrementa la fila FACCION real, y el sync la refleja en el KingdomStats real de esa Faction', async () => {
    // `WorldPopulation`/`KingdomStats` de Faction son de `World`, compartidas entre TODA la suite
    // (mismo criterio que el resto de `WorldPopulation`) — otro test corriendo en paralelo puede
    // haber tocado esta misma fila justo antes. Se compara por DELTA relativo al valor real leído
    // aquí mismo, nunca contra un número fijo capturado en `beforeAll` (ese sí puede quedar
    // obsoleto por la carrera).
    const rowBeforeGrow = await prisma.worldPopulation.findUniqueOrThrow({ where: { id: poblacionRowId } });

    const growResult = await growAllPopulations(prisma);
    expect(growResult.updated).toBeGreaterThan(0);

    const rowAfterGrow = await prisma.worldPopulation.findUniqueOrThrow({ where: { id: poblacionRowId } });
    expect(rowAfterGrow.poblacion).toBeGreaterThan(rowBeforeGrow.poblacion);

    const syncResult = await syncFactionPopulationToKingdomStats(prisma);
    expect(syncResult.synced).toBeGreaterThan(0);

    const kingdomStatsAfter = await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: serhuFactionId } });
    expect(kingdomStatsAfter.poblacion).toBe(rowAfterGrow.poblacion);
    // Los otros 3 campos (soldados/trabajadores/visitantes) también se re-escriben en cada sync,
    // reflejando su fila WorldPopulation correspondiente — no solo poblacion.
    // Contra el valor real de cada fila (2026-10-02): growAllPopulations también hace crecer
    // soldados/trabajadores según el tiempo real desde su último crecimiento, así que un número
    // fijo (500) fallaba en una base local con horas de uso. En la CI la base está recién sembrada.
    const filas = await prisma.worldPopulation.findMany({
      where: { worldId, targetType: 'FACCION', targetSlug: { in: ['clan-serhu-soldados', 'clan-serhu-trabajadores', 'clan-serhu-visitantes'] }, saveId: null },
    });
    const valor = (slug: string) => filas.find((f) => f.targetSlug === slug)!.poblacion;
    expect(kingdomStatsAfter.soldados).toBe(valor('clan-serhu-soldados'));
    expect(kingdomStatsAfter.trabajadores).toBe(valor('clan-serhu-trabajadores'));
    expect(kingdomStatsAfter.visitantes).toBe(valor('clan-serhu-visitantes'));
  }, 15_000);
});
