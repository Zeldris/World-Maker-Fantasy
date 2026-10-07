// CR-63 (63d, hito 0.3): Reino › Partidas — partidas de caza y captura del Reino.
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { lanzarPartida, opcionesDePartida, ordenarPartida, partidasDelReino, type PeticionPartida } from '../../services/partidasReino.js';
import { comprarCarneAViajero, preguntarAViajero, viajerosAqui } from '../../services/viajerosCruce.js';
import { lockRowForUpdate, rejectIfEnded, rejectIfPendingDeath } from './shared.js';

const selectSave = { id: true, endedAt: true, pendingDeathResolution: true, worldState: { select: { fictionalMinutes: true } } } as const;

export async function partidasRoutes(app: FastifyInstance) {
  /// Las partidas del Reino y con quién y adónde puede salir una nueva.
  app.get<{ Params: { id: string } }>('/saves/:id/partidas', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    return prisma.$transaction(async (tx) => ({
      partidas: await partidasDelReino(tx, save.id),
      opciones: await opcionesDePartida(tx, save.id, save.worldState?.fictionalMinutes ?? 0),
    }));
  });

  /// Lanza una partida de caza o captura (de una vez o con orden permanente).
  app.post<{ Params: { id: string }; Body: PeticionPartida }>('/saves/:id/partidas', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      // Dos lanzamientos a la vez no se llevan a la misma gente ni las mismas cuerdas.
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return lanzarPartida(tx, save.id, request.body ?? ({} as PeticionPartida), save.worldState?.fictionalMinutes ?? 0);
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return { ok: true, id: r.id };
  });

  /// CR-63 (63e, Q9): los viajeros que están ahora donde está el personaje.
  app.get<{ Params: { id: string } }>('/saves/:id/viajeros/aqui', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    return { viajeros: await prisma.$transaction((tx) => viajerosAqui(tx, save.id)) };
  });

  /// «Preguntar» a un viajero: lo que ha visto por el camino.
  app.post<{ Params: { id: string; viajeroId: string } }>('/saves/:id/viajeros/:viajeroId/preguntar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    const r = await prisma.$transaction((tx) => preguntarAViajero(tx, save.id, request.params.viajeroId));
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return r;
  });

  /// «Comerciar»: comprar la carne de una pieza a una partida de otra facción.
  app.post<{ Params: { id: string; viajeroId: string } }>('/saves/:id/viajeros/:viajeroId/comprar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction((tx) => comprarCarneAViajero(tx, save.id, request.params.viajeroId));
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return r;
  });

  /// Órdenes a una partida en marcha: parar (deja de repetir), volver o cambiar de destino.
  app.post<{ Params: { id: string; viajeroId: string }; Body: { accion: string; destinoLocationId?: string } }>('/saves/:id/partidas/:viajeroId/orden', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction((tx) => ordenarPartida(tx, save.id, request.params.viajeroId, request.body?.accion ?? '', request.body?.destinoLocationId));
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return { ok: true };
  });
}
