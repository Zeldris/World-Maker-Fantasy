import { normalizeText } from './travel.js';
import { Prisma } from '@prisma/client';

/// Movido desde turnResolution.ts (refactor de deuda técnica 2026-08-13) — cierre y recompensa de
/// misiones es lógica de dominio propia, no de orquestación de turno.

/// Notificación de misión completada (2026-08-13, ver NarrateAndPersistResult.questCompletedInfo
/// en turnResolution.ts) — `logEntryId`/`text` son los de la fila REAL ya persistida por
/// `questRewardNarrationFor` (nunca un id/texto sintético), para que el frontend pueda insertarla
/// como una LogEntry más, con marca visual de "misión completada" (mismo criterio que
/// newQuestInfo, pero para el cierre en vez del alta).
export interface QuestCompletedInfo {
  logEntryId: string;
  text: string;
  title: string;
  grantedItems: string[];
  rewardXp: number;
}

/// Entrega real de los `InventoryItem` prometidos por `Quest.rewardItems` al completarse una
/// misión (docs/19-post-combate-y-recompensas-mision.md, pieza 3). Antes ese campo era solo texto
/// para mostrar en el panel (ver comentario en schema.prisma) — nunca creaba el objeto de verdad,
/// la entrega dependía enteramente de que el loot normal del cadáver también lo incluyera.
/// Deduplicado por nombre contra lo que el jugador YA tiene, para no duplicar si ya lo consiguió
/// por otra vía (saqueo, crafteo...) antes de que la misión se cerrara — y para que llamar a esto
/// dos veces sobre la misma misión ya recompensada no vuelva a crear nada.
///
/// Exportada: turnResolution.ts también la llama directamente para el caso especial de la misión
/// del Orco Enfurecido que nace ya COMPLETADA (nunca pasa por `completeNpcTargetQuests`, que solo
/// actúa sobre misiones ACTIVA).
export async function grantQuestRewardItems(tx: Prisma.TransactionClient, saveId: string, worldId: string, rewardItems: string[]): Promise<string[]> {
  if (rewardItems.length === 0) return [];
  const owned = await tx.inventoryItem.findMany({ where: { saveId }, select: { name: true } });
  const ownedNormalized = new Set(owned.map((i) => normalizeText(i.name)));
  const toGrant = rewardItems.filter((name) => !ownedNormalized.has(normalizeText(name)));
  if (toGrant.length === 0) return [];
  // Bug real jugando en vivo (2026-08-13): esta función creaba la InventoryItem con solo
  // nombre/descripción genérica, sin `catalogSlug` ni `statBonuses` — el Mapa de las Llanuras
  // entregado como recompensa salía "sin categorizar" en el inventario, equipable en CUALQUIER
  // ranura (`isCompatibleWithSlot`, equipSlots.ts, trata "sin catalogSlug" como objeto narrativo
  // suelto sin nada contra que validar, a propósito permisivo para eso) y su propio efecto
  // (`effectKey`, MapaPanel.tsx) nunca se activaba, porque ese lookup también depende de
  // catalogSlug. Se resuelve por nombre EXACTO contra ItemCatalog del mundo — mismo criterio que
  // ya usa el saqueo/crafteo real (turnResolution.ts), nunca un objeto "de recompensa" sin ficha
  // real detrás si existe una.
  const catalogRows = await tx.itemCatalog.findMany({ where: { worldId, name: { in: toGrant } } });
  const catalogByName = new Map(catalogRows.map((c) => [c.name, c]));
  await tx.inventoryItem.createMany({
    data: toGrant.map((name) => {
      const catalog = catalogByName.get(name);
      return {
        saveId,
        name,
        description: catalog?.description ?? 'Recompensa de misión.',
        origin: 'recompensa de misión',
        catalogSlug: catalog?.slug,
        statBonuses: catalog?.statBonuses ?? Prisma.JsonNull,
      };
    }),
  });
  return toGrant;
}

/// Narración determinista de recompensa (docs/19 pieza 5) — mismo criterio de "nunca lo decide el
/// modelo" que ya rige saqueo/despiece/crafteo. Solo se llama cuando hay algo real que anunciar
/// (objetos concedidos de verdad esta vez, o XP) — nunca para una misión ya recompensada antes.
/// Exportada por el mismo motivo que `grantQuestRewardItems` (caso especial del Orco Enfurecido en
/// turnResolution.ts).
export function questRewardNarrationFor(questTitle: string, grantedItems: string[], rewardXp: number | null): string {
  const parts: string[] = [];
  if (grantedItems.length > 0) parts.push(`consigue ${grantedItems.join(', ')}`);
  if (rewardXp) parts.push(`+${rewardXp} XP`);
  return `Misión completada: "${questTitle}"${parts.length > 0 ? ` — ${parts.join(', ')}` : ''}.`;
}

/// Cierre determinista de misión "conseguir Z" (`Quest.targetItemName`) — cualquier objeto
/// materializado de verdad esta transacción que mencione el nombre objetivo cierra la misión sola,
/// sin pasar por el modelo. Extraída (auditoría 2026-08-11, "pruebas por API") de dentro de
/// `narrateAndPersistTurn` para poder llamarla TAMBIÉN desde los endpoints deterministas nuevos
/// del rediseño de profesiones (`recolectar.ts`/`cazar.ts` § confirmar) — antes solo vivía en el
/// camino de turno normal (saqueo/despiece narrado/crafteo/`newItem`), así que cualquier misión
/// "consígueme N de X" quedaba imposible de completar si X se obtenía minando/talando/cazando por
/// el flujo real del jugador (los botones de Minar/Talar/Cazar), aunque el objeto se creara bien.
/// `timeLabel`/`fictionalMinutes` (2026-08-13, pieza 3): para poder anunciar la recompensa con un
/// `LogEntry` real, mismo criterio que el resto del motor — nunca solo un cambio de estado mudo.
export async function closeItemQuests(params: {
  tx: Prisma.TransactionClient;
  saveId: string;
  worldId: string;
  createdItemNames: string[];
  timeLabel: string;
  fictionalMinutes: number;
}): Promise<void> {
  const { tx, saveId, worldId, createdItemNames, timeLabel, fictionalMinutes } = params;
  if (createdItemNames.length === 0) return;
  const activeQuestsWithItem = await tx.quest.findMany({
    where: { saveId, status: 'ACTIVA', targetItemName: { not: null } },
  });
  for (const quest of activeQuestsWithItem) {
    const targetNormalized = normalizeText(quest.targetItemName!);
    const conseguido = createdItemNames.some((name) => normalizeText(name).includes(targetNormalized));
    if (conseguido) {
      await tx.quest.update({ where: { id: quest.id }, data: { status: 'COMPLETADA' } });
      const grantedItems = await grantQuestRewardItems(tx, saveId, worldId, quest.rewardItems);
      if (grantedItems.length > 0 || quest.rewardXp) {
        await tx.logEntry.create({
          data: {
            saveId,
            channel: 'CHARACTER',
            text: questRewardNarrationFor(quest.title, grantedItems, quest.rewardXp),
            isPlayerAction: false,
            timeLabel,
            fictionalMinutes,
          },
        });
      }
    }
  }
}

/// Cierre determinista de misión "derrotar a X" (`Quest.targetNpcId`) + recompensa real (docs/19
/// pieza 3) — extraído para no duplicar el mismo bloque (buscar quests activas por `targetNpcId`,
/// cerrarlas, conceder `rewardItems`/`rewardXp`, narrar) entre el ataque normal y "Decapitar", los
/// dos caminos que pueden dejar a un NPC INCAPACITADO/MUERTO. `condicionAlcanzada` decide el verbo
/// de la narración de recompensa (mismo criterio que `npcFallsUnconsciousThisTurn` — INCAPACITADO
/// y MUERTO cuentan igual como "derrotado" para efectos de misión).
export async function completeNpcTargetQuests(
  tx: Prisma.TransactionClient,
  saveId: string,
  worldId: string,
  npcId: string,
  timeLabel: string,
  fictionalMinutes: number,
): Promise<QuestCompletedInfo | null> {
  const activeQuestsWithNpc = await tx.quest.findMany({ where: { saveId, targetNpcId: npcId, status: 'ACTIVA' } });
  let lastCompleted: QuestCompletedInfo | null = null;
  for (const quest of activeQuestsWithNpc) {
    await tx.quest.update({ where: { id: quest.id }, data: { status: 'COMPLETADA' } });
    const grantedItems = await grantQuestRewardItems(tx, saveId, worldId, quest.rewardItems);
    if (grantedItems.length > 0 || quest.rewardXp) {
      const rewardText = questRewardNarrationFor(quest.title, grantedItems, quest.rewardXp);
      const rewardEntry = await tx.logEntry.create({
        data: {
          saveId,
          channel: 'CHARACTER',
          text: rewardText,
          isPlayerAction: false,
          timeLabel,
          fictionalMinutes,
        },
      });
      lastCompleted = { logEntryId: rewardEntry.id, text: rewardText, title: quest.title, grantedItems, rewardXp: quest.rewardXp ?? 0 };
    }
  }
  return lastCompleted;
}
