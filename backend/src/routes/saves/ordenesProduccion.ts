import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';

/// CRUD de `OrdenProduccion` (hueco B, rediseño de Producción estilo Bellwright, 2026-09-21,
/// docs/rpgtarkor/mundo-vivo-x4.md § 4.4-ter) — el motor de tick (`kingdomProduction.ts`,
/// `tickOrdenesProduccion`, ya enganchado en turnResolution.ts) corre cada día de ficción, pero
/// hasta ahora no existía NINGUNA forma de crear/editar una orden real desde el cliente. Sin
/// filtrado de recetas por tipo de `Building` a propósito (decisión confirmada con Álvaro,
/// 2026-09-21): el motor real solo mira nivel de oficio del trabajador (`trabajadorPuedeProducir`),
/// nunca el edificio — el frontend ofrece el roster completo de `CraftingRecipe` ya expuesto por
/// `GET /profession-recipes`, no un catálogo nuevo restringido por edificio.
async function findOwnedBuilding(saveId: string, buildingId: string) {
  return prisma.building.findFirst({ where: { id: buildingId, saveId } });
}

export async function ordenesProduccionRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string; buildingId: string } }>(
    '/saves/:id/edificios/:buildingId/ordenes',
    async (request, reply) => {
      const building = await findOwnedBuilding(request.params.id, request.params.buildingId);
      if (!building) return reply.status(404).send({ error: 'Edificio no encontrado' });

      const ordenes = await prisma.ordenProduccion.findMany({
        where: { buildingId: building.id },
        orderBy: { prioridad: 'asc' },
      });
      return { ordenes };
    },
  );

  app.post<{ Params: { id: string; buildingId: string }; Body: { recipeKey: string; modo?: 'unico' | 'reponer'; limite?: number | null; prioridad?: number } }>(
    '/saves/:id/edificios/:buildingId/ordenes',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const building = await findOwnedBuilding(request.params.id, request.params.buildingId);
      if (!building) return reply.status(404).send({ error: 'Edificio no encontrado' });

      const { recipeKey, modo = 'reponer', limite = null, prioridad = 5 } = request.body;
      if (!recipeKey?.trim()) return reply.status(400).send({ error: 'Falta el campo: recipeKey' });
      if (modo !== 'unico' && modo !== 'reponer') return reply.status(400).send({ error: `Modo desconocido: ${modo}` });
      if (prioridad < 0 || prioridad > 9) return reply.status(400).send({ error: 'Prioridad fuera de rango (0-9)' });
      if (limite != null && limite < 1) return reply.status(400).send({ error: 'El límite debe ser al menos 1' });

      const orden = await prisma.ordenProduccion.upsert({
        where: { buildingId_recipeKey: { buildingId: building.id, recipeKey } },
        // Reactivar una orden ya existente (mismo buildingId+recipeKey) en vez de duplicarla —
        // mismo criterio que el botón "✕" del frontend: nunca DELETE, solo activa/desactiva.
        update: { modo, limite, prioridad, activa: true },
        create: { buildingId: building.id, recipeKey, modo, limite, prioridad },
      });
      return { ok: true, orden };
    },
  );

  app.patch<{ Params: { id: string; ordenId: string }; Body: { prioridad?: number; limite?: number | null; activa?: boolean } }>(
    '/saves/:id/ordenes/:ordenId',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      // Resuelto vía join al Building (no hay `saveId` propio en OrdenProduccion) — nunca deja
      // editar/leer una orden de un Building de otra partida.
      const orden = await prisma.ordenProduccion.findFirst({
        where: { id: request.params.ordenId, building: { saveId: request.params.id } },
      });
      if (!orden) return reply.status(404).send({ error: 'Orden no encontrada' });

      const { prioridad, limite, activa } = request.body;
      if (prioridad != null && (prioridad < 0 || prioridad > 9)) {
        return reply.status(400).send({ error: 'Prioridad fuera de rango (0-9)' });
      }
      if (limite !== undefined && limite != null && limite < 1) {
        return reply.status(400).send({ error: 'El límite debe ser al menos 1' });
      }

      const updated = await prisma.ordenProduccion.update({
        where: { id: orden.id },
        data: {
          ...(prioridad != null && { prioridad }),
          ...(limite !== undefined && { limite }),
          ...(activa != null && { activa }),
        },
      });
      return { ok: true, orden: updated };
    },
  );

  app.delete<{ Params: { id: string; ordenId: string } }>('/saves/:id/ordenes/:ordenId', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const orden = await prisma.ordenProduccion.findFirst({
      where: { id: request.params.ordenId, building: { saveId: request.params.id } },
    });
    if (!orden) return reply.status(404).send({ error: 'Orden no encontrada' });

    await prisma.ordenProduccion.delete({ where: { id: orden.id } });
    return { ok: true };
  });
}
