import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { narrateAndPersistTurn } from '../services/turnResolution.js';
import type { ClassificationResult } from '../services/narrador.js';
import type { RollResult } from '../services/dice.js';

interface TransitZoneContext {
  action: string;
  classification: ClassificationResult;
  roll?: RollResult;
}

/// Worker local del reloj de mundo (decisiones técnicas 3 y 4 en docs/04-decisiones-tecnicas.md).
/// Se pausa solo con el proceso del backend — no hay "recuperación al arrancar" (decisión de
/// producto 4, revisada): el mundo retoma justo donde lo dejó la última vez que corrió.
///
/// TODO (pendiente de "métricas de juego" y del contrato del primer mundo):
/// - Resolver eventos de `WorldState.agenda` que hayan vencido → llamada al Cronista → LogEntry (channel WORLD).
export async function resolveDueTransits(): Promise<void> {
  const due = await prisma.characterTransit.findMany({
    where: { busyUntil: { lte: new Date() } },
    include: { save: { include: { worldState: true } } },
  });

  for (const transit of due) {
    try {
      const { action, classification, roll } = transit.zoneContext as unknown as TransitZoneContext;
      const save = transit.save;
      const sessionFacts = (save.worldState?.facts as string[] | undefined) ?? [];
      const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';

      await narrateAndPersistTurn({
        saveId: save.id,
        worldId: save.worldId,
        action,
        characterSummary: `${save.characterName}, ${save.characterArchetype}. ${save.characterOrigin} ${save.characterMotivation}`,
        characterName: save.characterName,
        timeLabel,
        sessionFacts,
        currentXp: save.xp,
        currentLevel: save.level,
        classification,
        roll,
      });

      await prisma.characterTransit.delete({ where: { id: transit.id } });
    } catch (err) {
      // Un tránsito que falla al resolver se reintenta en el siguiente tick — no se borra.
      console.error(`[worldTick] error resolviendo tránsito ${transit.id}:`, err);
    }
  }
}

async function tick(): Promise<void> {
  await resolveDueTransits();

  const dueWorldStates = await prisma.worldState.findMany({
    select: { id: true, saveId: true },
  });

  for (const worldState of dueWorldStates) {
    await prisma.worldState.update({
      where: { id: worldState.id },
      data: { lastTickedAt: new Date() },
    });
  }
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startWorldTickWorker(): void {
  if (intervalHandle) return;
  const intervalMs = env.worldTickIntervalMinutes * 60_000;
  intervalHandle = setInterval(() => {
    tick().catch((err) => console.error('[worldTick] error en el tick:', err));
  }, intervalMs);
  console.log(`[worldTick] worker iniciado, tick cada ${env.worldTickIntervalMinutes} min`);
}

export function stopWorldTickWorker(): void {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}
