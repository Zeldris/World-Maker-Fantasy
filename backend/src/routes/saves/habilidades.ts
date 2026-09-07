import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { sanitizeActiveCombatAbilityNames } from '../../services/combatAbilities.js';

/// CRUD de habilidades 'general' creadas a mano por la jugadora (deuda técnica 2026-07-30, split
/// de saves.ts) — las de combate (isStarting/isDynamic) son fijas por clase/raza/arma y nunca
/// pasan por aquí, verificado en cada handler y no solo ocultando el botón en el frontend.
export async function habilidadesRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { name: string; promptText: string; icon?: string; description?: string; category?: string } }>(
    '/saves/:id/habilidades',
    async (request, reply) => {
      // Roadmap de rediseño de paneles (2026-07-20/21): las habilidades de combate son fijas por
      // clase/raza/arma (las da el diseño, nunca la jugadora) — solo "general" es creable a mano.
      // `maxCombatAbilitiesFor` sigue existiendo para saber cuántas hay activas ahora mismo, ya no
      // como cupo de creación.
      const { name, promptText, icon, description, category } = request.body;
      if (!name?.trim() || !promptText?.trim()) {
        return reply.status(400).send({ error: 'Faltan campos: name, promptText' });
      }
      if (category === 'combate') {
        return reply.status(400).send({ error: 'Las habilidades de combate son fijas de la clase, no se crean a mano' });
      }

      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
      });
      if (!save) {
        return reply.status(404).send({ error: 'Partida no encontrada' });
      }
      // Mismo guard que turn.ts/combat/flee/cazar/recolectar/reino (auditoría de bugs 2026-08-21
      // + decisión explícita de la usuaria al cerrar la ronda de preguntas abiertas): crear/borrar/
      // editar habilidades tras una muerte definitiva no debería seguir permitido.
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const created = await prisma.savedAction.create({
        data: {
          saveId: save.id,
          name: name.trim(),
          promptText: promptText.trim(),
          icon: icon?.trim() || '✨',
          description: description?.trim() || '',
          category: 'general',
        },
      });
      return {
        id: created.id,
        name: created.name,
        promptText: created.promptText,
        icon: created.icon,
        description: created.description,
        isStarting: created.isStarting,
        isDynamic: created.isDynamic,
        category: created.category,
        preferredAttribute: created.preferredAttribute,
        energyCost: created.energyCost,
        energyRegen: created.energyRegen,
        isGeneric: created.isGeneric,
        dualWield: created.dualWield,
        rol: created.rol,
      };
    },
  );

  app.delete<{ Params: { id: string; habilidadId: string } }>(
    '/saves/:id/habilidades/:habilidadId',
    async (request, reply) => {
      // Bug real (2026-07-29, comentario del schema nunca aplicado en la ruta): `isStarting`
      // (kit inicial/clase) e `isDynamic` (racial/arma, ver SavedAction.isDynamic) están pensadas
      // como "nunca editable/borrable por la jugadora" desde que existen, pero esta ruta borraba
      // cualquier fila sin comprobarlo — el frontend nunca ofrece el botón para estas, pero nada
      // lo impedía si se llamaba directamente. Mismo criterio que el PATCH de abajo: verificado
      // aquí, no solo ocultando el botón.
      const existing = await prisma.savedAction.findFirst({
        where: { id: request.params.habilidadId, saveId: request.params.id },
      });
      if (!existing) {
        return reply.status(204).send();
      }
      if (existing.isStarting || existing.isDynamic) {
        return reply.status(400).send({ error: 'Esta habilidad no se puede borrar a mano' });
      }
      // Mismo guard que turn.ts/combat/flee/cazar/recolectar/reino (auditoría de bugs 2026-08-21
      // + decisión explícita de la usuaria al cerrar la ronda de preguntas abiertas).
      const saveForEndedAt = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
      if (saveForEndedAt && rejectIfEnded(saveForEndedAt, reply)) return;
      if (saveForEndedAt && rejectIfPendingDeath(saveForEndedAt, reply)) return;
      await prisma.savedAction.deleteMany({ where: { id: request.params.habilidadId, saveId: request.params.id } });
      return reply.status(204).send();
    },
  );

  // Editar una habilidad creada por la jugadora (roadmap de rediseño de paneles, Fable
  // 2026-07-20/21) — las de partida inicial (isStarting: true) o racial/de arma (isDynamic: true,
  // 2026-07-29) nunca son editables, verificado aquí en el backend y no solo ocultando el botón
  // en el frontend.
  app.patch<{
    Params: { id: string; habilidadId: string };
    Body: { name?: string; promptText?: string; icon?: string; description?: string };
  }>('/saves/:id/habilidades/:habilidadId', async (request, reply) => {
    const existing = await prisma.savedAction.findFirst({
      where: { id: request.params.habilidadId, saveId: request.params.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Habilidad no encontrada' });
    }
    if (existing.isStarting || existing.isDynamic) {
      return reply.status(400).send({ error: 'Esta habilidad no se puede editar a mano' });
    }
    // Mismo guard que turn.ts/combat/flee/cazar/recolectar/reino (auditoría de bugs 2026-08-21 +
    // decisión explícita de la usuaria al cerrar la ronda de preguntas abiertas).
    const saveForEndedAt = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
    if (saveForEndedAt && rejectIfEnded(saveForEndedAt, reply)) return;
    if (saveForEndedAt && rejectIfPendingDeath(saveForEndedAt, reply)) return;

    const { name, promptText, icon, description } = request.body;
    if (name !== undefined && !name.trim()) {
      return reply.status(400).send({ error: 'El campo name no puede quedar vacío' });
    }
    if (promptText !== undefined && !promptText.trim()) {
      return reply.status(400).send({ error: 'El campo promptText no puede quedar vacío' });
    }

    const updated = await prisma.savedAction.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(promptText !== undefined && { promptText: promptText.trim() }),
        ...(icon !== undefined && icon.trim() && { icon: icon.trim() }),
        ...(description !== undefined && { description: description.trim() }),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      promptText: updated.promptText,
      icon: updated.icon,
      description: updated.description,
      isStarting: updated.isStarting,
      isDynamic: updated.isDynamic,
      category: updated.category,
      preferredAttribute: updated.preferredAttribute,
      energyCost: updated.energyCost,
      energyRegen: updated.energyRegen,
      isGeneric: updated.isGeneric,
      dualWield: updated.dualWield,
      rol: updated.rol,
    };
  });

  /// "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3) — reemplaza la lista completa
  /// en el orden recibido (mismo criterio que reordenar un inventario: el cliente manda el estado
  /// final ya decidido, no operaciones incrementales). Saneada contra las habilidades de combate NO
  /// genéricas reales de AHORA MISMO (`sanitizeActiveCombatAbilityNames`) — nunca se confía en que
  /// el cliente mande solo nombres válidos. Marca `activeCombatAbilityNamesConfigured: true` SIEMPRE
  /// que se llama, incluso si el resultado saneado queda vacío — a partir de aquí,
  /// `resolveActiveCombatAbilityNames` deja de aplicar el "todas activas" por defecto.
  app.patch<{ Params: { id: string }; Body: { names: string[] } }>('/saves/:id/combat-abilities', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const combatAbilities = await prisma.savedAction.findMany({
      where: { saveId: save.id, category: 'combate' },
      select: { name: true, isGeneric: true },
    });
    const sanitized = sanitizeActiveCombatAbilityNames(request.body.names ?? [], combatAbilities);

    const updated = await prisma.save.update({
      where: { id: save.id },
      data: { activeCombatAbilityNames: sanitized, activeCombatAbilityNamesConfigured: true },
    });
    return { activeCombatAbilityNames: updated.activeCombatAbilityNames };
  });
}
