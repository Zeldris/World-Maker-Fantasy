import type { FastifyInstance } from 'fastify';
import { classifyAction, type ClassificationResult } from '../services/narrador.js';
import { rollCheck } from '../services/dice.js';
import type { AttributeBlock, RollResult } from '../services/dice.js';
import { computeDuration } from '../services/timedActions.js';
import { narrateAndPersistTurn } from '../services/turnResolution.js';
import { prisma } from '../lib/prisma.js';

interface ClassifyBody {
  saveId: string;
  action: string;
}

interface NarrateBody {
  saveId: string;
  action: string;
  classification: ClassificationResult;
  roll?: RollResult;
}

function characterSummaryFor(save: { characterName: string; characterArchetype: string; characterOrigin: string; characterMotivation: string }) {
  return `${save.characterName}, ${save.characterArchetype}. ${save.characterOrigin} ${save.characterMotivation}`;
}

/// Turno de juego, en dos pasos (docs/08-acciones-por-tiempo.md): `/turn/classify` es rápido
/// (~25s, sin IA de narración) y `/turn/narrate` es el paso lento (30-220s). Separarlos permite
/// que el frontend muestre un contador visual real con la duración de la acción mientras narrar
/// corre de fondo, y que las bandas extendida/larga respondan casi al instante sin esperar nunca
/// el coste de narrar — el resultado se genera en diferido vía `CharacterTransit` (worldTick).
export async function turnRoutes(app: FastifyInstance) {
  app.post<{ Body: ClassifyBody }>('/turn/classify', async (request, reply) => {
    const { saveId, action } = request.body;
    if (!saveId || !action) {
      return reply.status(400).send({ error: 'Faltan campos: saveId, action' });
    }

    const save = await prisma.save.findUnique({
      where: { id: saveId },
      include: { characterTransit: true },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    if (save.characterTransit && save.characterTransit.busyUntil > new Date()) {
      return reply.status(409).send({
        error: 'El personaje sigue ocupado',
        activity: save.characterTransit.activity,
        busyUntil: save.characterTransit.busyUntil,
      });
    }

    const attributes = save.attributes as AttributeBlock;
    const characterSummary = characterSummaryFor(save);
    const timeLabel = 'Día 1, mañana'; // placeholder hasta que exista calendario ficticio real, ver worldState

    const classification = await classifyAction({ characterSummary, action });
    const roll = classification.requiereTirada
      ? rollCheck(attributes, classification.atributo, classification.dificultad)
      : undefined;
    const { minutos, produccion } = computeDuration(action, classification.banda, attributes, classification.duracionEstimadaMinutos);

    if (classification.banda === 'extendida' || classification.banda === 'larga') {
      const busyUntil = new Date(Date.now() + minutos * 60_000);
      const startText = `${save.characterName} se pone a ello: "${action}". Estará ocupado un buen rato${
        produccion ? ` (debería conseguir ${produccion})` : ''
      }.`;

      await prisma.$transaction([
        prisma.logEntry.create({
          data: { saveId, channel: 'CHARACTER', text: action, isPlayerAction: true, timeLabel },
        }),
        prisma.logEntry.create({
          data: { saveId, channel: 'CHARACTER', text: startText, timeLabel },
        }),
        prisma.characterTransit.upsert({
          where: { saveId },
          create: { saveId, activity: action, busyUntil, zoneContext: { action, classification, roll } as object },
          update: { activity: action, busyUntil, zoneContext: { action, classification, roll } as object },
        }),
        prisma.save.update({ where: { id: saveId }, data: { lastPlayedAt: new Date() } }),
      ]);

      return { classification, roll, transit: { busyUntil } };
    }

    // Instantánea/corta: el jugador verá el turno completo en esta misma sesión — deja ya la
    // acción del jugador en el log para que aparezca de inmediato, antes de esperar a narrar.
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: action, isPlayerAction: true, timeLabel },
    });

    return { classification, roll, duracionMinutos: minutos, produccion };
  });

  app.post<{ Body: NarrateBody }>('/turn/narrate', async (request, reply) => {
    const { saveId, action, classification, roll } = request.body;
    if (!saveId || !action || !classification) {
      return reply.status(400).send({ error: 'Faltan campos: saveId, action, classification' });
    }

    const save = await prisma.save.findUnique({ where: { id: saveId }, include: { world: true, worldState: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const sessionFacts = (save.worldState?.facts as string[] | undefined) ?? [];
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';

    const { narration, progression } = await narrateAndPersistTurn({
      saveId,
      worldId: save.worldId,
      action,
      characterSummary: characterSummaryFor(save),
      characterName: save.characterName,
      timeLabel,
      sessionFacts,
      currentXp: save.xp,
      currentLevel: save.level,
      classification,
      roll,
    });

    return { narration, progression };
  });
}
