import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { normalizeText, matchDestination } from '../../services/travel.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import { grantQuestRewardItems, questRewardNarrationFor } from '../../services/questResolution.js';
import { generateQuestResponseNarration } from '../../services/narrador.js';
import { rejectIfEnded } from './shared.js';

/// Misión con lógica especial propia, además del anclaje genérico NPC/Location/Item (bug real
/// 2026-08-28, "misión se salta los botones" — la creaba directamente `turnResolution.ts`, ahora
/// solo ofrece vía `newQuestOfferInfo` como cualquier otra). Reconocida por TÍTULO EXACTO — si
/// llega aquí con este título, se aplica su objetivo/recompensa fija y el caso "el jugador ya
/// había derrotado al Orco Enfurecido por su cuenta antes de aceptar" (bug real 2026-08-04,
/// hallazgo 9: sin esto la misión quedaba ACTIVA para siempre, sin ningún camino de cierre —
/// ni ataque nuevo posible, ni saqueo nuevo, ambos ya resueltos).
const ORCO_ENFURECIDO_QUEST_TITLE = 'Acabar con el Orco Enfurecido';

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

      // Idempotente (doble clic, o "Aceptar" pulsado dos veces tras recargar): una misión con el
      // mismo título ya activa/resuelta para esta partida no se duplica, se devuelve tal cual.
      const existing = await prisma.quest.findFirst({ where: { saveId: save.id, title } });
      if (existing) {
        return { quest: existing, alreadyExisted: true };
      }

      const questText = normalizeText(`${title} ${description}`);
      const [worldNpcs, worldLocations, worldItems] = await Promise.all([
        prisma.npc.findMany({ where: { worldId: save.worldId } }),
        prisma.location.findMany({ where: { worldId: save.worldId } }),
        prisma.itemCatalog.findMany({ where: { worldId: save.worldId } }),
      ]);
      const targetNpc = worldNpcs.find((npc) => questText.includes(normalizeText(npc.name)));
      const targetNpcId = targetNpc?.id;
      const targetLocationId = matchDestination(questText, worldLocations)?.id;
      const targetItemName = worldItems.find((item) => questText.includes(normalizeText(item.name)))?.name;

      const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
      const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
      const isOrcoEnfurecidoTitle = title === ORCO_ENFURECIDO_QUEST_TITLE;
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
      // gosh") — este texto de despedida YA EXISTÍA en turnResolution.ts (`gisteraAceptaEsteTurno`,
      // petición explícita 2026-08-01: "en cuanto acepto la misión de Gistera que ella se marche
      // dirección Ciénaga Troncal y que no vuelva a aparecer"), pero solo se narraba dentro de un
      // turno normal — con el rediseño del botón (2026-08-26/30), la Quest se crea AQUÍ, sin pasar
      // nunca por ese bloque, así que la despedida nunca llegaba a narrarse. Mismo texto fijo
      // (determinista, nunca generado por LLM — la usuaria fijó el destino/motivo exactos), solo
      // movido a este endpoint para el caso concreto de Gistera/Orco Enfurecido.
      // Bug real jugando en vivo (2026-08-30, "esta respuesta ha quedado rara") — la concatenación
      // directa con un simple espacio pegaba la reacción de Gorhorn a la despedida de Gistera en el
      // mismo bloque de texto corrido, sin ninguna pausa entre "habla Gorhorn" y "reacciona
      // Gistera". Salto de párrafo (línea en blanco) entre ambas, mismo criterio que el resto del
      // juego usa para separar turnos de habla distintos dentro de la misma narración.
      const text = isOrcoEnfurecidoTitle
        ? `${acceptanceText}\n\nGistera Koh asiente, aliviada, y sin perder ni un segundo más echa a andar hacia el sur, en dirección a la Ciénaga Troncal, perdiéndose pronto entre la maleza.`
        : acceptanceText;

      const { quest, logEntry, questCompletedInfo } = await prisma.$transaction(async (tx) => {
        // Caso especial (ver comentario de ORCO_ENFURECIDO_QUEST_TITLE arriba): objetivo/recompensa
        // fija + posible cierre inmediato si el jugador ya había resuelto al Orco Enfurecido por su
        // cuenta antes de pulsar Aceptar.
        const isOrcoEnfurecido = title === ORCO_ENFURECIDO_QUEST_TITLE;
        const orcoEnfurecido = isOrcoEnfurecido
          ? await tx.npc.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: 'orco-enfurecido-hondonada' } } })
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
            const rewardEntry = await tx.logEntry.create({
              data: { saveId: save.id, channel: 'CHARACTER', text: rewardText, isPlayerAction: false, timeLabel, fictionalMinutes },
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
    },
  );
}
