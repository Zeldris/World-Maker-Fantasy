import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { CRAFTING_RECIPES } from '../../services/crafting.js';
import { oficioProducidoForRecipeKey } from '../../services/construction.js';
import { recetaEncajaConOficioDeEdificio } from '../../services/kingdomProduction.js';

/// CRUD de `OrdenProduccion` (hueco B, rediseño de Producción estilo Bellwright, 2026-09-21,
/// docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4-ter) — el motor de tick (`kingdomProduction.ts`,
/// `tickOrdenesProduccion`, ya enganchado en turnResolution.ts) corre cada día de ficción, pero
/// hasta ahora no existía NINGUNA forma de crear/editar una orden real desde el cliente.
///
/// Filtro por oficio del edificio (P-3, decisión de Álvaro, 2026-09-29; sustituye a la decisión de
/// 2026-09-21 de ofrecer el roster completo): un edificio de oficio solo ofrece y acepta recetas de
/// su oficio (una herrería, solo recetas de herrero). Los edificios sin oficio (Choza, Campamento,
/// construcciones libres) no filtran, como antes. Ver `recetasDeProduccionDelEdificio`.
export function recetasDeProduccionDelEdificio(recipeKeyEdificio: string | null): { oficio: string | null; recipeKeys: string[] } {
  const oficio = oficioProducidoForRecipeKey(recipeKeyEdificio);
  const recipeKeys = CRAFTING_RECIPES.filter((r) => recetaEncajaConOficioDeEdificio(r, oficio)).map((r) => r.key);
  return { oficio, recipeKeys };
}

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

  // Recetas que este edificio puede producir (mismo filtro que valida el POST) — lo consume el
  // modal "Nueva orden" del frontend.
  app.get<{ Params: { id: string; buildingId: string } }>(
    '/saves/:id/edificios/:buildingId/recetas-produccion',
    async (request, reply) => {
      const building = await findOwnedBuilding(request.params.id, request.params.buildingId);
      if (!building) return reply.status(404).send({ error: 'Edificio no encontrado' });
      return recetasDeProduccionDelEdificio(building.recipeKey);
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

      const { oficio, recipeKeys } = recetasDeProduccionDelEdificio(building.recipeKey);
      if (oficio && !recipeKeys.includes(recipeKey)) {
        return reply.status(400).send({ error: `La receta ${recipeKey} no es del oficio de este edificio (${oficio})` });
      }

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
