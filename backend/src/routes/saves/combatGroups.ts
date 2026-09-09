import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded } from './shared.js';
import { COMBAT_GROUP_BASE_SLOT, nextFreeCombatGroupSlot } from '../../services/combatGroups.js';
import { MAX_COMBATIENTES_POR_BANDO } from '../../services/combateMultiple.js';

/// Grupos de combate (2026-09-08) — CRUD de `CombatGroup` (solo metadata/nombre) + mover
/// `Companion` entre grupos vía `combatGroupSlotIndex`. Mismo criterio que skillBars.ts (grupo
/// base = slotIndex 0, no se puede borrar) con una diferencia clave: el Grupo 1 aquí NUNCA
/// necesita una fila de `CombatGroup` para existir — todo compañero ya nace en `combatGroupSlotIndex:
/// 0` por defecto (schema.prisma), así que "el Grupo 1" es el estado inicial del mundo, no algo que
/// haya que crear. Una fila de `CombatGroup` con slotIndex 0 solo existe si el jugador lo renombra.
export async function combatGroupsRoutes(app: FastifyInstance) {
  /// Vista completa: todos los grupos (el 1 implícito + los creados) con sus compañeros dentro —
  /// el frontend necesita esto de una sola llamada para pintar el panel de arrastrar y soltar.
  app.get<{ Params: { id: string } }>('/saves/:id/combat-groups', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const [groups, companions] = await Promise.all([
      prisma.combatGroup.findMany({ where: { saveId: save.id }, orderBy: { slotIndex: 'asc' } }),
      prisma.companion.findMany({
        where: { saveId: save.id },
        select: { id: true, name: true, tipo: true, sourceSlug: true, condicionFisica: true, combatGroupSlotIndex: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const groupNameBySlot = new Map(groups.map((g) => [g.slotIndex, g.name]));
    const slotsConCompanions = [...new Set(companions.map((c) => c.combatGroupSlotIndex))];
    const allSlots = [...new Set([COMBAT_GROUP_BASE_SLOT, ...groups.map((g) => g.slotIndex), ...slotsConCompanions])].sort((a, b) => a - b);

    return {
      groups: allSlots.map((slotIndex) => ({
        slotIndex,
        name: groupNameBySlot.get(slotIndex) ?? (slotIndex === COMBAT_GROUP_BASE_SLOT ? 'Grupo 1' : `Grupo ${slotIndex + 1}`),
        esBase: slotIndex === COMBAT_GROUP_BASE_SLOT,
        companions: companions.filter((c) => c.combatGroupSlotIndex === slotIndex),
      })),
    };
  });

  app.post<{ Params: { id: string } }>('/saves/:id/combat-groups', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;

    const existing = await prisma.combatGroup.findMany({ where: { saveId: save.id }, select: { slotIndex: true } });
    const slotIndex = nextFreeCombatGroupSlot(existing.map((g) => g.slotIndex));

    const group = await prisma.combatGroup.create({
      data: { saveId: save.id, slotIndex, name: `Grupo ${slotIndex + 1}` },
    });
    return reply.status(201).send(group);
  });

  app.patch<{ Params: { id: string; slotIndex: string }; Body: { name: string } }>(
    '/saves/:id/combat-groups/:slotIndex',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;

      const slotIndex = Number(request.params.slotIndex);
      const name = request.body.name?.trim();
      if (!name) return reply.status(400).send({ error: 'Falta el campo: name' });

      // El Grupo 1 (base) no tiene fila hasta que se renombra por primera vez — upsert cubre
      // tanto "ya existe, cambiar nombre" como "renombrar el implícito por primera vez".
      const group = await prisma.combatGroup.upsert({
        where: { saveId_slotIndex: { saveId: save.id, slotIndex } },
        create: { saveId: save.id, slotIndex, name },
        update: { name },
      });
      return group;
    },
  );

  app.delete<{ Params: { id: string; slotIndex: string } }>('/saves/:id/combat-groups/:slotIndex', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;

    const slotIndex = Number(request.params.slotIndex);
    if (slotIndex === COMBAT_GROUP_BASE_SLOT) {
      return reply.status(400).send({ error: 'El Grupo 1 no se puede borrar' });
    }
    const group = await prisma.combatGroup.findFirst({ where: { saveId: save.id, slotIndex } });
    if (!group) return reply.status(404).send({ error: 'Grupo no encontrado' });

    // Compañeros del grupo borrado vuelven al Grupo 1 (nunca se quedan "huérfanos" en un
    // combatGroupSlotIndex sin fila de CombatGroup ni sitio real donde aparecer en el panel).
    await prisma.$transaction([
      prisma.companion.updateMany({ where: { saveId: save.id, combatGroupSlotIndex: slotIndex }, data: { combatGroupSlotIndex: COMBAT_GROUP_BASE_SLOT } }),
      prisma.combatGroup.delete({ where: { id: group.id } }),
    ]);
    return reply.status(204).send();
  });

  /// Mover un compañero a otro grupo (drag-and-drop en el frontend) — respeta el tope de 4
  /// combatientes por bando (MAX_COMBATIENTES_POR_BANDO, mismo tope que ya aplica cazar.ts al
  /// construir el bando JUGADOR real): un grupo con 4 compañeros ya está lleno, contando también
  /// al PJ si es el Grupo 1 (el PJ ocupa un hueco del tope él solo).
  app.patch<{ Params: { id: string; companionId: string }; Body: { combatGroupSlotIndex: number } }>(
    '/saves/:id/companeros/:companionId/grupo',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;

      const targetSlotIndex = request.body.combatGroupSlotIndex;
      if (!Number.isInteger(targetSlotIndex) || targetSlotIndex < 0) {
        return reply.status(400).send({ error: 'combatGroupSlotIndex inválido' });
      }
      const companion = await prisma.companion.findFirst({ where: { id: request.params.companionId, saveId: save.id } });
      if (!companion) return reply.status(404).send({ error: 'Compañero no encontrado' });

      const yaEnGrupo = await prisma.companion.count({ where: { saveId: save.id, combatGroupSlotIndex: targetSlotIndex } });
      const tope = targetSlotIndex === COMBAT_GROUP_BASE_SLOT ? MAX_COMBATIENTES_POR_BANDO - 1 : MAX_COMBATIENTES_POR_BANDO;
      if (yaEnGrupo >= tope) {
        return reply.status(400).send({ error: `Ese grupo ya está lleno (máximo ${tope} compañeros)` });
      }

      const updated = await prisma.companion.update({ where: { id: companion.id }, data: { combatGroupSlotIndex: targetSlotIndex } });
      return { id: updated.id, combatGroupSlotIndex: updated.combatGroupSlotIndex };
    },
  );
}
