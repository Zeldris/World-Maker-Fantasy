import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded } from './shared.js';
import { sanitizeSkillBarAbilityNames, nextFreeSkillBarSlot, SKILL_BARS_MAX, SKILL_BAR_CATEGORIES } from '../../services/skillBars.js';

/// Barras de habilidades múltiples fuera de combate (2026-09-04, rediseñado 2026-09-06 — hallazgo
/// 10 de la sesión de pruebas: 3 barras EN GENERAL sin distinguir categoría, en vez de 3 por cada
/// una) — CRUD de `SkillBar`, mismo criterio que companeros.ts § PlantillaEquipo (N filas
/// configurables por save, una "básica" que no se puede borrar). El contenido (`abilityNames`) se
/// reemplaza SIEMPRE completo, nunca con operaciones incrementales — mismo criterio que
/// /saves/:id/combat-abilities.
export async function skillBarsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/saves/:id/skill-bars', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;

    const existing = await prisma.skillBar.findMany({ where: { saveId: save.id }, select: { slotIndex: true } });
    const slotIndex = nextFreeSkillBarSlot(existing.map((b) => b.slotIndex));
    if (slotIndex === null) {
      return reply.status(400).send({ error: `Ya tienes ${SKILL_BARS_MAX} barras de habilidades` });
    }

    const bar = await prisma.skillBar.create({
      data: { saveId: save.id, slotIndex, name: `Barra ${slotIndex + 1}` },
    });
    return reply.status(201).send(bar);
  });

  app.patch<{ Params: { id: string; barId: string }; Body: { name?: string; abilityNames?: string[] } }>(
    '/saves/:id/skill-bars/:barId',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;

      const bar = await prisma.skillBar.findFirst({ where: { id: request.params.barId, saveId: save.id } });
      if (!bar) return reply.status(404).send({ error: 'Barra no encontrada' });

      const { name, abilityNames } = request.body;
      let sanitizedAbilityNames: string[] | undefined;
      if (abilityNames) {
        // Rediseño (2026-09-06) — el saneo ya no filtra por la categoría FIJA de la barra (que ya
        // no existe): una barra puede mezclar habilidades de las 3 categorías (General/Profesión/
        // Reino, elegidas por tabs en el editor). Combate queda fuera a propósito, mismo criterio
        // de siempre — sigue viviendo en su propio cinturón aparte.
        const available = await prisma.savedAction.findMany({
          where: { saveId: save.id, category: { in: [...SKILL_BAR_CATEGORIES] } },
          select: { name: true },
        });
        sanitizedAbilityNames = sanitizeSkillBarAbilityNames(abilityNames, available);
      }

      const updated = await prisma.skillBar.update({
        where: { id: bar.id },
        data: {
          ...(name?.trim() ? { name: name.trim() } : {}),
          ...(sanitizedAbilityNames ? { abilityNames: sanitizedAbilityNames } : {}),
        },
      });
      return updated;
    },
  );

  app.delete<{ Params: { id: string; barId: string } }>('/saves/:id/skill-bars/:barId', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;

    const bar = await prisma.skillBar.findFirst({ where: { id: request.params.barId, saveId: save.id } });
    if (!bar) return reply.status(404).send({ error: 'Barra no encontrada' });
    if (bar.slotIndex === 0) {
      return reply.status(400).send({ error: 'La barra base no se puede borrar' });
    }

    await prisma.$transaction([
      prisma.skillBar.delete({ where: { id: bar.id } }),
      prisma.save.updateMany({ where: { id: save.id, activeSkillBarId: bar.id }, data: { activeSkillBarId: null } }),
    ]);
    return reply.status(204).send();
  });

  app.patch<{ Params: { id: string }; Body: { skillBarId: string | null } }>('/saves/:id/active-skill-bar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;

    const { skillBarId } = request.body;
    if (skillBarId !== null) {
      const bar = await prisma.skillBar.findFirst({ where: { id: skillBarId, saveId: save.id } });
      if (!bar) return reply.status(404).send({ error: 'Barra no encontrada' });
    }

    const updated = await prisma.save.update({ where: { id: save.id }, data: { activeSkillBarId: skillBarId } });
    return { activeSkillBarId: updated.activeSkillBarId };
  });
}
