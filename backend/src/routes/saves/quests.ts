import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { normalizeText, matchDestination } from '../../services/travel.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import { rejectIfEnded } from './shared.js';

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
      const targetNpcId = worldNpcs.find((npc) => questText.includes(normalizeText(npc.name)))?.id;
      const targetLocationId = matchDestination(questText, worldLocations)?.id;
      const targetItemName = worldItems.find((item) => questText.includes(normalizeText(item.name)))?.name;

      const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
      const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
      const text = `${save.characterName} acepta la misión: ${title}.`;

      const [quest, logEntry] = await prisma.$transaction([
        prisma.quest.create({
          data: { saveId: save.id, title, description, targetNpcId, targetLocationId, targetItemName },
        }),
        prisma.logEntry.create({
          data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes, isPlayerAction: false },
        }),
      ]);

      const sessionFacts = await loadSessionFacts(save.id);
      await appendSessionFacts(save.id, sessionFacts, [text]);
      await recordEntityDiscoveries({ saveId: save.id, worldId: save.worldId, mentionedText: `${text} ${description}` });

      return {
        quest,
        alreadyExisted: false,
        logEntry: { id: logEntry.id, text, timeLabel, createdAt: logEntry.createdAt.toISOString() },
      };
    },
  );
}
