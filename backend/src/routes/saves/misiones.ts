import type { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { aceptarMision, abandonarMision, entregarMision, ErrorMision } from '../../services/cronista/misionesJugadora.js';
import { avisosDeTablon } from '../../services/cronista/tablones.js';

// CR-40 (40e, hito 0.2): misiones secundarias del motor. Aceptar un aviso (de un tablón o de un NPC),
// entregar lo que pide una misión de Entregar y abandonar. El progreso del resto lo lleva el motor.
function responderError(reply: FastifyReply, err: unknown) {
  if (err instanceof ErrorMision) return reply.status(err.status).send({ error: err.message });
  throw err;
}

export async function misionesRoutes(app: FastifyInstance) {
  // Avisos a la vista en un tablón (el del Reino muestra los de sus aliados).
  app.get<{ Params: { id: string; buildingId: string } }>('/saves/:id/tablones/:buildingId', async (request, reply) => {
    const r = await avisosDeTablon(prisma, request.params.id, request.params.buildingId);
    if (!r) return reply.status(404).send({ error: 'Ese tablón no existe' });
    return r;
  });

  app.post<{ Params: { id: string; avisoId: string } }>('/saves/:id/misiones/avisos/:avisoId/aceptar', async (request, reply) => {
    try {
      const quest = await aceptarMision(prisma, request.params.id, request.params.avisoId);
      return { questId: quest.id, title: quest.title };
    } catch (err) {
      return responderError(reply, err);
    }
  });

  app.post<{ Params: { id: string; questId: string } }>('/saves/:id/misiones/:questId/entregar', async (request, reply) => {
    try {
      await entregarMision(prisma, request.params.id, request.params.questId);
      const quest = await prisma.quest.findUniqueOrThrow({ where: { id: request.params.questId }, select: { status: true, progreso: true, cantidad: true } });
      return quest;
    } catch (err) {
      return responderError(reply, err);
    }
  });

  app.post<{ Params: { id: string; questId: string } }>('/saves/:id/misiones/:questId/abandonar', async (request, reply) => {
    try {
      await abandonarMision(prisma, request.params.id, request.params.questId);
      return { status: 'ABANDONADA' };
    } catch (err) {
      return responderError(reply, err);
    }
  });
}
