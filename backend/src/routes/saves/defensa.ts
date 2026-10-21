// CR-65 (65b, hito 0.3): Reino › Defensa — módulos, guarnición y milicia de cada asentamiento.
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { asentamientosDelReino, asignarGuarnicion, comprarEquiposMilicia, convocarMilicia, radarDelReino } from '../../services/defensaReino.js';
import { repararEmpalizada } from '../../services/asaltos.js';
import { lockRowForUpdate, rejectIfEnded, rejectIfPendingDeath } from './shared.js';

const selectSave = { id: true, endedAt: true, pendingDeathResolution: true, worldState: { select: { fictionalMinutes: true } } } as const;

export async function defensaRoutes(app: FastifyInstance) {
  /// Los asentamientos del Reino con sus módulos de defensa, su guarnición y lo que suman.
  app.get<{ Params: { id: string } }>('/saves/:id/defensa', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    // P284: el Ayuntamiento o el Cuartel dañados no defienden; se dice cuál es para que se repare, no «construye uno».
    return prisma.$transaction(async (tx) => ({
      asentamientos: await asentamientosDelReino(tx, save.id),
      avistados: await radarDelReino(tx, save.id),
      danados: (await tx.building.findMany({ where: { saveId: save.id, recipeKey: { in: ['ayuntamiento', 'cuartel-avanzado'] }, status: 'DANADO' }, select: { id: true, name: true }, orderBy: { createdAt: 'asc' } })),
    }));
  });

  /// Q7: asigna un soldado o vigía a la guarnición de un asentamiento.
  app.post<{ Params: { id: string }; Body: { subjectId?: string; asentamientoId?: string } }>('/saves/:id/defensa/guarnicion', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const { subjectId, asentamientoId } = request.body ?? {};
    if (!subjectId || !asentamientoId) return reply.status(400).send({ error: 'Falta a quién y adónde.' });
    const r = await prisma.$transaction(async (tx) => {
      // Dos asignaciones a la vez no pasan del tope de plazas.
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return asignarGuarnicion(tx, save.id, subjectId, asentamientoId);
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return { ok: true };
  });

  /// Q6: compra equipos de milicia para una Armería.
  app.post<{ Params: { id: string; armeriaId: string }; Body: { cantidad?: number } }>('/saves/:id/defensa/armeria/:armeriaId/equipos', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    try {
      const r = await prisma.$transaction(async (tx) => {
        await lockRowForUpdate(tx, 'Save', save.id, ['id']);
        return comprarEquiposMilicia(tx, save.id, request.params.armeriaId, Number(request.body?.cantidad ?? 1));
      });
      if (!r.ok) return reply.status(400).send({ error: r.motivo });
      return r;
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'No se pudo comprar.' });
    }
  });

  /// Q6: «Llamar a la milicia» de un asentamiento.
  app.post<{ Params: { id: string; asentamientoId: string } }>('/saves/:id/defensa/:asentamientoId/milicia', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const armados = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return convocarMilicia(tx, save.id, request.params.asentamientoId, save.worldState?.fictionalMinutes ?? 0);
    });
    if (armados === 0) return reply.status(400).send({ error: 'No hay equipos libres en la Armería o trabajadores que armar.' });
    return { ok: true, armados };
  });

  /// Q4: repara una Empalizada caída.
  app.post<{ Params: { id: string; buildingId: string } }>('/saves/:id/defensa/empalizada/:buildingId/reparar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return repararEmpalizada(tx, save.id, request.params.buildingId);
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return { ok: true };
  });
}
