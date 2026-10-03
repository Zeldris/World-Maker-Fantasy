import type { FastifyInstance } from 'fastify';
import { Prisma, type Save, type WorldState } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { normalizeText, matchDestination } from '../../services/travel.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import { grantQuestRewardItems, questRewardNarrationFor, GISTERA_DESPEDIDA_NARRATION } from '../../services/questResolution.js';
import { generateQuestResponseNarration } from '../../services/narrador.js';
import { rejectIfEnded, rejectIfPendingDeath, clearPendingOffer } from './shared.js';

/// Misión con lógica especial propia, además del anclaje genérico NPC/Location/Item (bug real
/// 2026-08-28, "misión se salta los botones" — la creaba directamente `turnResolution.ts`, ahora
/// solo ofrece vía `newQuestOfferInfo` como cualquier otra). Reconocida por su TÍTULO EXACTO
/// (`narrador.ts` sigue proponiéndolo así, sin conocer `questSlug`) — si llega aquí con este
/// título, se aplica su objetivo/recompensa fija y el caso "el jugador ya había derrotado al Orco
/// Enfurecido por su cuenta antes de aceptar" (bug real 2026-08-04, hallazgo 9: sin esto la misión
/// quedaba ACTIVA para siempre, sin ningún camino de cierre — ni ataque nuevo posible, ni saqueo
/// nuevo, ambos ya resueltos).
///
/// `questSlug` estructurado (roadmap 2026-09-03) — antes esta constante era también la clave de
/// PERSISTENCIA (se guardaba tal cual en `Quest.title`, y todo el código mecánico comparaba contra
/// ese título literal). Ahora el título narrativo (lo que ve la jugadora) y el slug mecánico son
/// dos campos separados: `narrador.ts` puede seguir proponiendo este título tal cual, pero el
/// reconocimiento y toda la lógica de aquí abajo usan `ORCO_ENFURECIDO_QUEST_SLUG`, guardado en
/// `Quest.questSlug` — un cambio futuro de texto narrativo no rompería la mecánica.
const ORCO_ENFURECIDO_QUEST_TITLE = 'Acabar con el Orco Enfurecido';
export const ORCO_ENFURECIDO_QUEST_SLUG = 'orco-enfurecido-hondonada-gistera';

/// Botones "Aceptar"/"Cancelar" cuando un NPC ofrece una misión (2026-08-26, petición explícita:
/// "en vez de depender de que la jugadora escriba texto libre para aceptar... que 'Aceptar' genere
/// una narración determinista de aceptación, sin esperar a que el LLM decida si acepta o no") —
/// `narration.newQuest` (narrador.ts) sigue proponiendo el título/descripción como siempre, pero
/// `turnResolution.ts` YA NO crea la `Quest` de ese camino genérico: solo devuelve
/// `newQuestOfferInfo` para que el frontend pinte los botones. Esta ruta es la ÚNICA que la
/// materializa de verdad, determinista, sin pasar por Ollama — mismo espíritu que el resto de
/// "mundo determinista": la narración deja de decidir si se acepta, solo lo describe una vez ya
/// decidido por la jugadora.
///
/// Resuelve los anclajes (targetNpcId/targetLocationId/targetItemName) contra TODO el mundo, no
/// contra `npcsInScene` del turno original — para cuando la jugadora pulsa "Aceptar" (quizás
/// turnos después, o tras recargar), la escena que vio el modelo ya no es fiable.
/// Extraída de la ruta HTTP (2026-09-09, mismo patrón que `resolverRecoleccion`/`recolectar.ts`) —
/// el guion determinista de Gistera Koh en modo dinámico (dynamicMode.ts § `narrarVueltaGistera`)
/// necesita crear la Quest DIRECTAMENTE en cuanto el jugador elige "Aceptar ayudarla" dentro de la
/// conversación, sin pedirle una segunda confirmación por botones (bug real jugando en vivo,
/// 2026-09-09 — Álvaro: "al acabar de interactuar me sale para aceptar la misión otra vez... como
/// ya aceptamos esto no debería salir... solo un log al final... que confirme que la misión se ha
/// aceptado"). Firma idéntica al cuerpo que ya tenía la ruta — ni una línea de lógica cambiada,
/// solo movida de sitio y con el `save`/`request.params.id` recibidos como parámetros.
export async function aceptarQuest(
  save: Save & { worldState: WorldState | null },
  title: string,
  description: string,
): Promise<{
  quest: { id: string; questSlug: string | null; title: string; objetivo: string | null };
  alreadyExisted: boolean;
  // `null` solo en el caso idempotente (`alreadyExisted: true`) — no hay ningún LogEntry nuevo que
  // reportar porque no se creó nada, la Quest ya existía de una llamada anterior.
  logEntry: { id: string; text: string; timeLabel: string; createdAt: string } | null;
  questCompletedInfo: { logEntryId: string; text: string; title: string; grantedItems: string[]; rewardXp: number } | null;
}> {
  // Idempotente (doble clic, o "Aceptar" pulsado dos veces tras recargar): una misión con el
  // mismo título ya activa/resuelta para esta partida no se duplica, se devuelve tal cual.
  // Para el caso especial de Orco Enfurecido/Gistera, la idempotencia mira `questSlug` (no
  // `title`) — mismo motivo que el resto de este archivo, ver comentario de
  // `ORCO_ENFURECIDO_QUEST_SLUG` arriba: el título es solo lo que ve la jugadora.
  const isOrcoEnfurecidoTitle = title === ORCO_ENFURECIDO_QUEST_TITLE;
  const existing = await prisma.quest.findFirst({
    where: isOrcoEnfurecidoTitle ? { saveId: save.id, questSlug: ORCO_ENFURECIDO_QUEST_SLUG } : { saveId: save.id, title },
  });
  if (existing) {
    return { quest: existing, alreadyExisted: true, logEntry: null, questCompletedInfo: null };
  }

  const questText = normalizeText(`${title} ${description}`);
  const [worldNpcs, worldLocations, worldItems] = await Promise.all([
    prisma.npc.findMany({ where: { worldId: save.worldId, muertoEnMundo: false } }),
    prisma.location.findMany({ where: { worldId: save.worldId } }),
    prisma.itemCatalog.findMany({ where: { worldId: save.worldId } }),
  ]);
  const targetNpc = worldNpcs.find((npc) => questText.includes(normalizeText(npc.name)));
  const targetNpcId = targetNpc?.id;
  const targetLocationId = matchDestination(questText, worldLocations)?.id;
  const targetItemName = worldItems.find((item) => questText.includes(normalizeText(item.name)))?.name;

  const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
  const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
  // Narración real de la aceptación (2026-08-30, petición explícita: "esto genera narración de
  // respuesta... según el tono del pj responde y acepta la misión") — antes era texto fijo
  // ("${characterName} acepta la misión: ${title}."), sin pasar por Ollama. La MECÁNICA sigue
  // 100% determinista (la Quest ya se crea más abajo pase lo que pase con el texto); si Ollama
  // falla o tarda, se cae al texto fijo de siempre en vez de bloquear la aceptación.
  const sessionFactsForNarration = await loadSessionFacts(save.id);
  // Fallback también si la llamada resuelve pero el guard `hasMetaInstructionLeak` descarta
  // el texto (devuelve '') — no solo si Ollama lanza un error.
  const acceptanceText =
    (await generateQuestResponseNarration({
      characterName: save.characterName,
      npcName: targetNpc?.name ?? null,
      questTitle: title,
      accepted: true,
      sessionFacts: sessionFactsForNarration,
    }).catch(() => '')) || `${save.characterName} acepta la misión: ${title}.`;
  // Bug real jugando en vivo (2026-08-30, "la narracion deberia continuar con la parte que
  // gistera acepta tu aceptacion y te dice que se va a la cienaga al campamento del clan
  // gosh") — este texto de despedida YA EXISTÍA en turnResolution.ts (`gisteraAceptaEsteTurno`),
  // pero solo se narraba dentro de un turno normal — con el rediseño del botón (2026-08-26/30),
  // la Quest se crea AQUÍ, sin pasar nunca por ese bloque, así que la despedida nunca llegaba a
  // narrarse. Mismo texto fijo compartido (`GISTERA_DESPEDIDA_NARRATION`, questResolution.ts —
  // fuente de verdad única desde 2026-09-15, antes copiado literalmente en ambos sitios).
  // Bug real jugando en vivo (2026-08-30, "esta respuesta ha quedado rara") — la concatenación
  // directa con un simple espacio pegaba la reacción de Gorhorn a la despedida de Gistera en el
  // mismo bloque de texto corrido, sin ninguna pausa entre "habla Gorhorn" y "reacciona
  // Gistera". Salto de párrafo (línea en blanco) entre ambas, mismo criterio que el resto del
  // juego usa para separar turnos de habla distintos dentro de la misma narración.
  const text = isOrcoEnfurecidoTitle ? `${acceptanceText}\n\n${GISTERA_DESPEDIDA_NARRATION}` : acceptanceText;

  const { quest, logEntry, questCompletedInfo } = await prisma.$transaction(async (tx) => {
    // Caso especial (ver comentario de ORCO_ENFURECIDO_QUEST_SLUG arriba): objetivo/recompensa
    // fija + posible cierre inmediato si el jugador ya había resuelto al Orco Enfurecido por su
    // cuenta antes de pulsar Aceptar.
    const isOrcoEnfurecido = isOrcoEnfurecidoTitle;
    const orcoEnfurecido = isOrcoEnfurecido
      ? await tx.npc.findFirst({ where: { worldId: save.worldId, slug: 'orco-enfurecido-hondonada', saveId: null } })
      : null;
    const orcoState = orcoEnfurecido
      ? await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: save.id, npcId: orcoEnfurecido.id, scope: '' } } })
      : null;
    // Petición explícita 2026-08-31: "Acabar con el Orco Enfurecido" solo cuenta como
    // resuelto con la MUERTE real — CONVALECIENTE (perdonar/capturar) ya no basta, mismo
    // criterio que completeNpcTargetQuests/applyKillSideEffects (turnResolution.ts).
    const orcoYaResuelto = orcoState?.condicionFisica === 'MUERTO';

    const quest = await tx.quest.create({
      data: {
        saveId: save.id,
        questSlug: isOrcoEnfurecido ? ORCO_ENFURECIDO_QUEST_SLUG : undefined,
        title,
        description,
        targetNpcId: isOrcoEnfurecido ? (orcoEnfurecido?.id ?? targetNpcId) : targetNpcId,
        targetLocationId,
        targetItemName,
        objetivo: isOrcoEnfurecido ? 'Derrotar al Orco Enfurecido que persigue a Gistera Koh.' : undefined,
        status: isOrcoEnfurecido && orcoYaResuelto ? 'COMPLETADA' : 'ACTIVA',
        rewardXp: isOrcoEnfurecido ? 100 : undefined,
        rewardItems: isOrcoEnfurecido ? ['Mapa de las Llanuras'] : undefined,
      },
    });
    const logEntry = await tx.logEntry.create({
      data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes, isPlayerAction: false },
    });
    // Limpia la oferta persistida (bug real jugando en vivo, 2026-09-03, ver
    // `pendingQuestOfferInfo` en schema.prisma) — mismo criterio que `pendingDynamicModeOffer`
    // al Interactuar: la tarjeta ya se resolvió de verdad, no debe reaparecer tras F5.
    // Bug real encontrado verificando en vivo (2026-09-03): este endpoint narra la despedida de
    // Gistera Koh (texto fijo arriba) pero nunca replicaba el efecto mecánico equivalente de
    // `gisteraAceptaEsteTurno` en turnResolution.ts (línea ~6002) — el turno de texto libre SÍ
    // hace `npcsRetiredForever: { push: 'gistera-koh' } }`, pero aceptar por el botón (el camino
    // recomendado desde 2026-08-26) lo dejaba vacío. `gisteraQuestYaExiste` en turnResolution.ts
    // ya la excluye igualmente por la existencia del Quest, así que no había síntoma visible en
    // escena — pero `npcsRetiredForever` es el mecanismo GENERAL (`detectNpcsInScene`/
    // `filterFarewellFacts` en npcScene.ts y worldFacts.ts) que otros caminos sí consultan.
    await tx.save.update({
      where: { id: save.id },
      data: {
        pendingQuestOfferInfo: Prisma.JsonNull,
        ...(isOrcoEnfurecido ? { npcsRetiredForever: { push: 'gistera-koh' } } : {}),
      },
    });

    let questCompletedInfo: { logEntryId: string; text: string; title: string; grantedItems: string[]; rewardXp: number } | null = null;
    if (isOrcoEnfurecido && orcoYaResuelto) {
      // Mismo motivo que el bloque original en turnResolution.ts (bug real 2026-08-04,
      // hallazgo 9): la misión nace ya COMPLETADA, nunca pasa por `completeNpcTargetQuests` —
      // hay que conceder la recompensa aquí mismo o se perdería para siempre. A diferencia del
      // bloque original (que vivía DENTRO de un turno, con su propio cálculo de `xpTurno`),
      // este endpoint es independiente — `Save.xp` se actualiza aquí mismo, directamente.
      const grantedItems = await grantQuestRewardItems(tx, save.id, save.worldId, ['Mapa de las Llanuras']);
      await tx.save.update({ where: { id: save.id }, data: { xp: { increment: 100 } } });
      if (grantedItems.length > 0) {
        const rewardText = questRewardNarrationFor(ORCO_ENFURECIDO_QUEST_TITLE, grantedItems, 100);
        // isSystemMessage (ver comentario completo en schema.prisma) — questRewardNarrationFor
        // es una función pura, texto fijo determinista, nunca pasa por el LLM.
        const rewardEntry = await tx.logEntry.create({
          data: { saveId: save.id, channel: 'CHARACTER', text: rewardText, isPlayerAction: false, timeLabel, fictionalMinutes, isSystemMessage: true },
        });
        questCompletedInfo = { logEntryId: rewardEntry.id, text: rewardText, title: ORCO_ENFURECIDO_QUEST_TITLE, grantedItems, rewardXp: 100 };
      }
    }

    return { quest, logEntry, questCompletedInfo };
  });

  await appendSessionFacts(save.id, sessionFactsForNarration, [text]);
  await recordEntityDiscoveries({ saveId: save.id, worldId: save.worldId, mentionedText: `${text} ${description}` });

  return {
    quest,
    alreadyExisted: false,
    logEntry: { id: logEntry.id, text, timeLabel, createdAt: logEntry.createdAt.toISOString() },
    questCompletedInfo,
  };
}

export async function questsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { title: string; description: string } }>(
    '/saves/:id/quests/aceptar',
    async (request, reply) => {
      const { title, description } = request.body;
      if (!title?.trim() || !description?.trim()) {
        return reply.status(400).send({ error: 'Faltan campos: title, description' });
      }
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      return aceptarQuest(save, title, description);
    },
  );

  /// Botón "Cancelar" de la tarjeta "MISIÓN PROPUESTA" (bug real jugando en vivo, 2026-09-03, ver
  /// `pendingQuestOfferInfo` en schema.prisma) — mismo patrón exacto que
  /// `/modo-dinamico/ignorar` (dynamicMode.ts): antes "Cancelar" era 100% local en React
  /// (`questOffer: undefined`, sin llamada a la API) porque nunca se había persistido nada; con la
  /// oferta ahora persistida al proponerse, cancelar sin llamar aquí dejaría la tarjeta
  /// reapareciendo tras F5 aunque el jugador ya la hubiera descartado.
  app.post<{ Params: { id: string } }>('/saves/:id/quests/cancelar', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: { id: true, endedAt: true, pendingDeathResolution: true, pendingQuestOfferInfo: true },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (save.pendingQuestOfferInfo) {
      await clearPendingOffer(save.id, 'pendingQuestOfferInfo');
    }
    return { ok: true };
  });
}
