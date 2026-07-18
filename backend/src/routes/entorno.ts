import type { FastifyInstance } from 'fastify';
import { generateSurroundings } from '../services/entorno.js';
import { retrieveLore, formatLoreForPrompt } from '../services/retrieval.js';
import { prisma } from '../lib/prisma.js';

interface EntornoBody {
  saveId: string;
}

/// Panel "El mundo" v1, ya con persistencia real: solo necesita `saveId`, carga el resto de
/// Postgres y escribe el resultado como LogEntry (WORLD, y CHARACTER si surge un evento).
export async function entornoRoutes(app: FastifyInstance) {
  app.post<{ Body: EntornoBody }>('/entorno', async (request, reply) => {
    const { saveId } = request.body;

    if (!saveId) {
      return reply.status(400).send({ error: 'Falta el campo: saveId' });
    }

    const save = await prisma.save.findUnique({
      where: { id: saveId },
      include: { worldState: true },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const characterSummary = `${save.characterName}, ${save.characterArchetype}. ${save.characterOrigin} ${save.characterMotivation}`;
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
    const sessionFacts = (save.worldState?.facts as string[] | undefined) ?? [];

    // Consulta genérica de ambientación (terreno, clima, fauna), no la biografía completa del
    // personaje — mismo motivo que en /turn: el resumen de personaje ahoga la señal semántica.
    const retrieved = await retrieveLore(`entorno inmediato, terreno, clima, fauna — ${timeLabel}`, save.worldId, 4);

    const result = await generateSurroundings({
      worldFacts: [...formatLoreForPrompt(retrieved), ...sessionFacts],
      characterSummary,
      timeLabel,
    });

    const entries = [prisma.logEntry.create({ data: { saveId, channel: 'WORLD', text: result.description, timeLabel } })];
    if (result.event) {
      entries.push(
        prisma.logEntry.create({
          data: { saveId, channel: 'CHARACTER', text: `${result.event} ¿Qué haces?`, timeLabel },
        }),
      );
    }
    await prisma.$transaction(entries);

    return result;
  });
}
