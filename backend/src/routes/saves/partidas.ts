// CR-63 (63d, hito 0.3): Reino › Partidas — partidas de caza y captura del Reino.
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { lanzarPartida, opcionesDePartida, ordenarPartida, partidasDelReino, type PeticionPartida } from '../../services/partidasReino.js';
import { comidaVendible, comprarCarneAViajero, preguntarAViajero, venderAViajero, viajerosAqui } from '../../services/viajerosCruce.js';
import { idsDelCuerpo } from './cuerpo.js';
import { lockRowForUpdate, rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { campamentosConocidos } from '../../services/campamentos.js';
import { guerrerosLibres, lanzarAtaqueACampamento, type PeticionAtaque } from '../../services/ataquesCampamento.js';

const selectSave = { id: true, endedAt: true, pendingDeathResolution: true, worldState: { select: { fictionalMinutes: true } } } as const;

export async function partidasRoutes(app: FastifyInstance) {
  /// Las partidas del Reino y con quién y adónde puede salir una nueva.
  app.get<{ Params: { id: string } }>('/saves/:id/partidas', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    return prisma.$transaction(async (tx) => ({
      partidas: await partidasDelReino(tx, save.id),
      opciones: await opcionesDePartida(tx, save.id, save.worldState?.fictionalMinutes ?? 0),
      // CR-50 (50d): campamentos de bandidos que conoces y quién puede ir a por ellos.
      campamentos: await campamentosConocidos(tx, save.id),
      guerreros: await guerrerosLibres(tx, save.id, save.worldState?.fictionalMinutes ?? 0),
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
    return prisma.$transaction(async (tx) => ({ viajeros: await viajerosAqui(tx, save.id), vendibles: await comidaVendible(tx, save.id) }));
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

  /// «Comerciar»: venderle algo de comer de tu bolsa a una partida de otra facción.
  app.post<{ Params: { id: string; viajeroId: string }; Body: { itemId: string } }>('/saves/:id/viajeros/:viajeroId/vender', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction((tx) => venderAViajero(tx, save.id, request.params.viajeroId, request.body?.itemId ?? ''));
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

  /// CR-50 (50c-50d, Q5): manda una partida a por un campamento de bandidos que conoces.
  app.post<{ Params: { id: string; campamentoId: string }; Body: Omit<PeticionAtaque, 'campamentoId'> }>('/saves/:id/campamentos/:campamentoId/atacar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return lanzarAtaqueACampamento(tx, save.id, { companionIds: idsDelCuerpo(request.body?.companionIds), subjectIds: idsDelCuerpo(request.body?.subjectIds), campamentoId: request.params.campamentoId }, save.worldState?.fictionalMinutes ?? 0);
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return { ok: true, id: r.id };
  });
}
