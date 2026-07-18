import { narrateAction, type ClassificationResult, type NarrationResult } from './narrador.js';
import { retrieveLore, formatLoreForPrompt, isWeaklyGrounded } from './retrieval.js';
import { xpForRollSuccess, xpForHitos, applyXp, type ProgressionResult } from './progression.js';
import { mergeFacts } from './worldFacts.js';
import { prisma } from '../lib/prisma.js';
import type { RollResult } from './dice.js';
import type { Prisma } from '@prisma/client';

const REINO_XP = { territory: 150, buildingActive: 100, firstSubject: 100, subject: 25 } as const;

interface NarrateAndPersistParams {
  saveId: string;
  worldId: string;
  action: string;
  characterSummary: string;
  characterName: string;
  timeLabel: string;
  sessionFacts: string[];
  currentXp: number;
  currentLevel: number;
  classification: ClassificationResult;
  roll?: RollResult;
}

/// Narra (retrieval + narrateAction) y persiste el resultado de un turno — hechos, XP/nivel,
/// inventario/compañeros, eventos de Reino, LogEntry. Compartido entre el turno síncrono
/// (bandas instantánea/corta, `POST /turn/narrate`) y la resolución diferida de un
/// `CharacterTransit` (bandas extendida/larga, `worldTick`) — misma lógica, dos disparadores.
export async function narrateAndPersistTurn(
  params: NarrateAndPersistParams,
): Promise<{ narration: NarrationResult; progression: ProgressionResult }> {
  const { saveId, worldId, action, characterSummary, characterName, timeLabel, sessionFacts, classification, roll } = params;

  const retrieved = await retrieveLore(action, worldId);

  const narration = await narrateAction({
    worldFacts: [...formatLoreForPrompt(retrieved), ...sessionFacts],
    characterSummary,
    action,
    roll,
    weaklyGrounded: isWeaklyGrounded(retrieved) && sessionFacts.length === 0,
  });

  const progression = await prisma.$transaction(async (tx) => {
    if (narration.newFacts.length) {
      await tx.worldState.update({
        where: { saveId },
        data: { facts: mergeFacts(sessionFacts, narration.newFacts) },
      });
    }
    if (narration.newItem) {
      await tx.inventoryItem.create({
        data: { saveId, name: narration.newItem.name, description: narration.newItem.description, origin: 'partida' },
      });
    }
    if (narration.newCompanion) {
      await tx.companion.create({
        data: {
          saveId,
          name: narration.newCompanion.name,
          role: narration.newCompanion.role,
          notes: narration.newCompanion.notes,
        },
      });
    }

    // Eventos de Reino (docs/10-niveles-xp-reino.md § 5) — necesitan enlazar por nombre de
    // territorio y contar súbditos existentes, por eso van en la transacción interactiva.
    let reinoXp = 0;
    let territoryId: string | undefined;

    if (narration.newTerritory) {
      const territory = await tx.territory.create({
        data: {
          saveId,
          name: narration.newTerritory.name,
          region: narration.newTerritory.region,
          description: narration.newTerritory.description,
        },
      });
      territoryId = territory.id;
      reinoXp = Math.max(reinoXp, REINO_XP.territory);
    }

    async function resolveTerritoryId(name?: string): Promise<string | undefined> {
      if (territoryId) return territoryId;
      if (!name) return undefined;
      const found = await tx.territory.findFirst({ where: { saveId, name } });
      return found?.id;
    }

    if (narration.newBuilding) {
      await tx.building.create({
        data: {
          saveId,
          territoryId: await resolveTerritoryId(narration.newBuilding.territoryName),
          name: narration.newBuilding.name,
          kind: narration.newBuilding.kind,
          description: narration.newBuilding.description,
          status: 'ACTIVO',
        },
      });
      reinoXp = Math.max(reinoXp, REINO_XP.buildingActive);
    }

    if (narration.newSubject) {
      const existingSubjects = await tx.subject.count({ where: { saveId } });
      await tx.subject.create({
        data: {
          saveId,
          territoryId: await resolveTerritoryId(narration.newSubject.territoryName),
          name: narration.newSubject.name,
          role: narration.newSubject.role,
          notes: narration.newSubject.notes,
        },
      });
      reinoXp = Math.max(reinoXp, existingSubjects === 0 ? REINO_XP.firstSubject : REINO_XP.subject);
    }

    const xpTirada = roll ? xpForRollSuccess(classification.dificultad, roll.success) : 0;
    const xpHito = Math.max(xpForHitos(narration.hito ? [narration.hito] : []), reinoXp);
    const xpTurno = xpTirada + xpHito;
    const result = applyXp(params.currentXp, params.currentLevel, xpTurno);

    await tx.logEntry.create({
      data: {
        saveId,
        channel: 'CHARACTER',
        text: narration.narration,
        roll: roll ? (roll as unknown as Prisma.InputJsonValue) : undefined,
        timeLabel,
        xpDelta: xpTurno > 0 ? xpTurno : undefined,
      },
    });

    if (result.leveledUp) {
      const attributeNote =
        result.attributePointsGained > 0 ? ` Gana ${result.attributePointsGained} puntos de atributo para repartir.` : '';
      await tx.logEntry.create({
        data: {
          saveId,
          channel: 'CHARACTER',
          text: `${characterName} sube a nivel ${result.newLevel}.${attributeNote}`,
          timeLabel,
        },
      });
    }

    await tx.save.update({
      where: { id: saveId },
      data: {
        lastPlayedAt: new Date(),
        xp: result.newXp,
        level: result.newLevel,
        pendingAttributePoints: { increment: result.attributePointsGained },
      },
    });

    return result;
  });

  return { narration, progression };
}
