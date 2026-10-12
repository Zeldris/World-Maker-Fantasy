import { registrarFinDeMision } from './cronista/emisores.js';
import type { NewInventoryItemInfo } from './turnResolution.js';
import { cupoDeCamas } from './cronista/subditos.js';
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

/// Despedida determinista de Gistera Koh al aceptar la misión (petición explícita de la usuaria,
/// 2026-08-01: "en cuanto acepto la misión de Gistera que ella se marche dirección Ciénaga del
/// Pantano y que no vuelva a aparecer" — nombre real de la región, Ciénaga Troncal, ver
/// KNOWN_REGIONS en narrationLint.ts). Destino ocultado de la narración visible (2026-09-05): la
/// frase no dice hacia dónde se va, solo que abandona la Hondonada del Eco.
///
/// Deuda técnica (2026-09-15, auditoría): este texto fijo estaba copiado literalmente en dos
/// sitios — `turnResolution.ts` § `gisteraAceptaEsteTurno` (aceptar por texto libre) y
/// `quests.ts` § `POST /quests/aceptar` (aceptar por el botón, camino recomendado desde
/// 2026-08-26) — ya habían divergido en un detalle real (solo uno de los dos escribía el
/// `newFacts` con el destino) antes de que nadie lo notara. Fuente de verdad única a partir de
/// ahora; el `newFacts` con el destino real sigue siendo responsabilidad de cada caller (solo
/// hace falta para el guard `gisteraSeHaMarchado`/`filterFarewellFacts`, que `quests.ts` cubre
/// igual con `npcsRetiredForever`).
export const GISTERA_DESPEDIDA_NARRATION = 'Gistera Koh asiente, aliviada, y sin perder ni un segundo más se aleja de la Hondonada del Eco, perdiéndose pronto en el horizonte.';

/// Entrega real de los `InventoryItem` prometidos por `Quest.rewardItems` al completarse una
/// misión (docs/mecanicas/19-post-combate-y-recompensas-mision.md, pieza 3). Antes ese campo era solo texto
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

/// QA-54 (retro de la tercera tanda de QA-27): la recompensa de una misión recién cerrada, con la
/// misma forma que los objetos nuevos de un turno. Toda respuesta que anuncia «misión completada»
/// la manda entre sus objetos nuevos; sin esto, el Mapa de las Llanuras no llegaba a la pantalla
/// hasta recargar (P32, salió por tres caminos distintos).
export async function recompensasComoObjetosNuevos(
  tx: Prisma.TransactionClient,
  saveId: string,
  worldId: string,
  nombres: string[],
): Promise<NewInventoryItemInfo[]> {
  if (nombres.length === 0) return [];
  const recompensas = await tx.inventoryItem.findMany({ where: { saveId, name: { in: nombres } } });
  const slugs = recompensas.map((r) => r.catalogSlug).filter((s): s is string => !!s);
  const catalogo = slugs.length
    ? await tx.itemCatalog.findMany({ where: { worldId, slug: { in: slugs } }, select: { slug: true, equipSlot: true, effectKey: true, tipo: true } })
    : [];
  const porSlug = new Map(catalogo.map((c) => [c.slug, c]));
  return recompensas.map((r) => {
    const c = r.catalogSlug ? porSlug.get(r.catalogSlug) : undefined;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      origin: r.origin,
      slot: null,
      statBonuses: r.statBonuses,
      equipSlot: c?.equipSlot ?? null,
      effectKey: c?.effectKey ?? null,
      tipo: c?.tipo ?? null,
    };
  });
}

/// Forma real de `Quest.rewardCompanion` (`Json?` en schema.prisma) — único punto de verdad
/// (auditoría de deuda técnica 2026-08-18: este shape estaba definido por su cuenta en 3 sitios —
/// aquí, en `startingQuests.ts` y repetido en cada cast de más abajo — con el riesgo real de tocar
/// uno y olvidar los otros dos).
export interface QuestRewardCompanion {
  name: string;
  role: string;
  notes: string;
}

/// Valida en tiempo de ejecución la forma de `Quest.rewardCompanion` antes de usarlo — nunca
/// confiar ciegamente en un campo `Json` de Prisma (auditoría de deuda técnica 2026-08-18, mismo
/// criterio que ya se aplica en otros sitios del motor). `null` si el campo está vacío o el JSON
/// persistido no tiene la forma esperada (dato corrupto/a medio migrar), en vez de reventar.
export function parseRewardCompanion(value: Prisma.JsonValue | null | undefined): QuestRewardCompanion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== 'string' || typeof obj.role !== 'string' || typeof obj.notes !== 'string') return null;
  return { name: obj.name, role: obj.role, notes: obj.notes };
}

/// Recompensa no-objeto (2026-08-17, petición explícita: "añadir un reward que no sea item
/// solo, sino también recetas, compañeros o pasivas temporales") — recetas: unión simple contra
/// `Save.unlockedRecipeKeys` (sin duplicados); compañero: mismo tope real de slots que cualquier
/// otro compañero (`companionSlotsForRecipeKey`) — si no hay hueco, no se crea, el resto de la
/// recompensa (XP/objetos/recetas) se concede igual, nunca se pierde en bloque por esto. Pasivas
/// temporales quedan fuera a propósito (necesitan un sistema de duración que todavía no existe).
export async function grantQuestRewardRecipesAndCompanion(
  tx: Prisma.TransactionClient,
  saveId: string,
  rewardRecipeKeys: string[],
  rewardCompanion: QuestRewardCompanion | null,
): Promise<{ grantedRecipeKeys: string[]; grantedCompanionName: string | null }> {
  let grantedRecipeKeys: string[] = [];
  if (rewardRecipeKeys.length > 0) {
    const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { unlockedRecipeKeys: true } });
    const already = new Set(save.unlockedRecipeKeys);
    grantedRecipeKeys = rewardRecipeKeys.filter((k) => !already.has(k));
    if (grantedRecipeKeys.length > 0) {
      await tx.save.update({ where: { id: saveId }, data: { unlockedRecipeKeys: [...save.unlockedRecipeKeys, ...grantedRecipeKeys] } });
    }
  }
  let grantedCompanionName: string | null = null;
  if (rewardCompanion) {
    // `esSlotDomador: false` (Grupo 3 § Compañeros y supervivencia, 2026-08-25) — el compañero
    // tameado que ocupa el slot GARANTIZADO del Domador nunca cuenta contra el cupo de edificio.
    // REI-118 (Q2): compañeros y súbditos comparten las camas.
    if ((await cupoDeCamas(tx, saveId)).libres > 0) {
      await tx.companion.create({ data: { saveId, name: rewardCompanion.name, role: rewardCompanion.role, notes: rewardCompanion.notes } });
      grantedCompanionName = rewardCompanion.name;
    }
  }
  return { grantedRecipeKeys, grantedCompanionName };
}

/// Narración determinista de recompensa (docs/19 pieza 5) — mismo criterio de "nunca lo decide el
/// modelo" que ya rige saqueo/despiece/crafteo. Solo se llama cuando hay algo real que anunciar
/// (objetos/recetas/compañero concedidos de verdad esta vez, o XP) — nunca para una misión ya
/// recompensada antes.
/// Exportada por el mismo motivo que `grantQuestRewardItems` (caso especial del Orco Enfurecido en
/// turnResolution.ts).
export function questRewardNarrationFor(
  questTitle: string,
  grantedItems: string[],
  rewardXp: number | null,
  grantedRecipeKeys: string[] = [],
  grantedCompanionName: string | null = null,
): string {
  const parts: string[] = [];
  if (grantedItems.length > 0) parts.push(`consigue ${grantedItems.join(', ')}`);
  if (grantedRecipeKeys.length > 0) parts.push(`aprende ${grantedRecipeKeys.length} receta(s) nueva(s)`);
  if (grantedCompanionName) parts.push(`se une ${grantedCompanionName}`);
  if (rewardXp) parts.push(`+${rewardXp} XP`);
  return `Misión completada: «${questTitle}»${parts.length > 0 ? ` — ${parts.join(', ')}` : ''}.`;
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
  /// Ver comentario de `completeNpcTargetQuests` más abajo — mismo criterio de orden de lectura.
  createdAt?: () => Date;
}): Promise<void> {
  const { tx, saveId, worldId, createdItemNames, timeLabel, fictionalMinutes, createdAt } = params;
  if (createdItemNames.length === 0) return;
  const activeQuestsWithItem = await tx.quest.findMany({
    where: { saveId, status: 'ACTIVA', targetItemName: { not: null } },
  });
  for (const quest of activeQuestsWithItem) {
    const targetNormalized = normalizeText(quest.targetItemName!);
    const conseguido = createdItemNames.some((name) => normalizeText(name).includes(targetNormalized));
    if (conseguido) {
      await tx.quest.update({ where: { id: quest.id }, data: { status: 'COMPLETADA' } });
      await registrarFinDeMision(tx, { saveId, titulo: quest.title, estado: 'COMPLETADA', fictionalMinutes });
      const grantedItems = await grantQuestRewardItems(tx, saveId, worldId, quest.rewardItems);
      const { grantedRecipeKeys, grantedCompanionName } = await grantQuestRewardRecipesAndCompanion(
        tx,
        saveId,
        quest.rewardRecipeKeys,
        parseRewardCompanion(quest.rewardCompanion),
      );
      if (grantedItems.length > 0 || quest.rewardXp || grantedRecipeKeys.length > 0 || grantedCompanionName) {
        // isSystemMessage (ver comentario completo en schema.prisma) — questRewardNarrationFor es
        // una función pura, texto fijo determinista, nunca pasa por el LLM.
        await tx.logEntry.create({
          data: {
            saveId,
            channel: 'CHARACTER',
            text: questRewardNarrationFor(quest.title, grantedItems, quest.rewardXp, grantedRecipeKeys, grantedCompanionName),
            isPlayerAction: false,
            timeLabel,
            fictionalMinutes,
            isSystemMessage: true,
            ...(createdAt ? { createdAt: createdAt() } : {}),
          },
        });
      }
    }
  }
}

/// Aviso (sin cerrar nada) de que un NPC tiene misión(es) activas de "derrotar a X" pendientes de
/// él (2026-09-15, hallazgo real jugando en vivo: Clemente/Capturar dejan al NPC vivo — por diseño
/// explícito de 2026-08-31, `completeNpcTargetQuests` solo cierra con MUERTE real — pero el panel
/// de Misiones no dice nada más: sigue "ACTIVA" sin ninguna pista de que el objetivo real sigue
/// vivo y rematable). Solo lectura, nunca toca `Quest.status` — el caller (Clemente/Capturar en
/// `session.ts`/`companeros.ts`) lo añade a su respuesta para que el frontend pueda avisar.
export async function activeQuestTitlesTargeting(tx: Prisma.TransactionClient, saveId: string, npcId: string): Promise<string[]> {
  const quests = await tx.quest.findMany({ where: { saveId, targetNpcId: npcId, status: 'ACTIVA' }, select: { title: true } });
  return quests.map((q) => q.title);
}

/// Cierre determinista de misión "derrotar a X" (`Quest.targetNpcId`) + recompensa real (docs/19
/// pieza 3) — extraído para no duplicar el mismo bloque (buscar quests activas por `targetNpcId`,
/// cerrarlas, conceder `rewardItems`/`rewardXp`, narrar) entre el ataque normal y "Decapitar", los
/// dos caminos que pueden dejar a un NPC CONVALECIENTE/MUERTO. `condicionAlcanzada` decide el verbo
/// de la narración de recompensa (mismo criterio que `npcFallsUnconsciousThisTurn` — CONVALECIENTE
/// y MUERTO cuentan igual como "derrotado" para efectos de misión).
export async function completeNpcTargetQuests(
  tx: Prisma.TransactionClient,
  saveId: string,
  worldId: string,
  npcId: string,
  timeLabel: string,
  fictionalMinutes: number,
  /// Auditoría "revisar partida" 2026-08-13 (bug real jugando en vivo: "Misión completada" se leía
  /// ANTES que la narración del propio turno que la resolvió) — quien llama desde dentro de la
  /// transacción de `narrateAndPersistTurn` pasa su reloj sintético "después de mainLogEntry"
  /// (ver comentario al principio de esa transacción); opcional para no romper otros posibles
  /// llamadores que no tengan ese concepto (usa el `createdAt` implícito de Postgres si no se pasa).
  createdAt?: () => Date,
): Promise<QuestCompletedInfo | null> {
  const activeQuestsWithNpc = await tx.quest.findMany({ where: { saveId, targetNpcId: npcId, status: 'ACTIVA' } });
  let lastCompleted: QuestCompletedInfo | null = null;
  for (const quest of activeQuestsWithNpc) {
    await tx.quest.update({ where: { id: quest.id }, data: { status: 'COMPLETADA' } });
    await registrarFinDeMision(tx, { saveId, titulo: quest.title, estado: 'COMPLETADA' });
    const grantedItems = await grantQuestRewardItems(tx, saveId, worldId, quest.rewardItems);
    const { grantedRecipeKeys, grantedCompanionName } = await grantQuestRewardRecipesAndCompanion(
      tx,
      saveId,
      quest.rewardRecipeKeys,
      parseRewardCompanion(quest.rewardCompanion),
    );
    if (grantedItems.length > 0 || quest.rewardXp || grantedRecipeKeys.length > 0 || grantedCompanionName) {
      const rewardText = questRewardNarrationFor(quest.title, grantedItems, quest.rewardXp, grantedRecipeKeys, grantedCompanionName);
      // isSystemMessage (ver comentario completo en schema.prisma) — texto fijo determinista.
      const rewardEntry = await tx.logEntry.create({
        data: {
          saveId,
          channel: 'CHARACTER',
          text: rewardText,
          isPlayerAction: false,
          timeLabel,
          fictionalMinutes,
          isSystemMessage: true,
          ...(createdAt ? { createdAt: createdAt() } : {}),
        },
      });
      lastCompleted = { logEntryId: rewardEntry.id, text: rewardText, title: quest.title, grantedItems, rewardXp: quest.rewardXp ?? 0 };
    }
  }
  return lastCompleted;
}
