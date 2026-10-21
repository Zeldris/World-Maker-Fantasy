// CR-37 (37b-37c, hito 0.3): guerra con el Reino — con quién hay guerra o tensión, tributo y
// contraataque.
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { faccionDelReino, ordenarEnemigas, lanzarAtaqueAAsentamiento, ofrecerTributo } from '../../services/guerraReino.js';
import { idsDelCuerpo } from './cuerpo.js';
import { lockRowForUpdate, rejectIfEnded, rejectIfPendingDeath } from './shared.js';

const selectSave = { id: true, endedAt: true, pendingDeathResolution: true, worldState: { select: { fictionalMinutes: true } } } as const;

export async function guerraRoutes(app: FastifyInstance) {
  /// Las facciones en guerra o en tensión con el Reino, con su presión.
  app.get<{ Params: { id: string } }>('/saves/:id/guerra', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    const reino = await faccionDelReino(prisma, save.id);
    if (!reino) return { enemigas: [] };
    const rel = await prisma.factionRelation.findMany({
      where: { type: { in: ['GUERRA', 'TENSION'] }, OR: [{ sourceFactionId: reino.id }, { targetFactionId: reino.id }] },
      select: { type: true, presion: true, sourceFaction: { select: { id: true, name: true } }, targetFaction: { select: { id: true, name: true } } },
    });
    const porFaccion = new Map<string, { id: string; nombre: string; relacion: 'GUERRA' | 'TENSION'; presion: number }>();
    for (const r of rel) {
      const otra = r.sourceFaction.id === reino.id ? r.targetFaction : r.sourceFaction;
      const previa = porFaccion.get(otra.id);
      if (!previa || r.presion > previa.presion) porFaccion.set(otra.id, { id: otra.id, nombre: otra.name, relacion: r.type as 'GUERRA' | 'TENSION', presion: r.presion });
    }
    return { enemigas: ordenarEnemigas([...porFaccion.values()]) };
  });

  /// Q4: ofrecer tributo a una facción en guerra o tensión.
  app.post<{ Params: { id: string; factionId: string }; Body: { goirnos?: number } }>('/saves/:id/guerra/:factionId/tributo', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return ofrecerTributo(tx, save.id, request.params.factionId, Number(request.body?.goirnos ?? 0));
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return r;
  });

  /// Q5: contraataque contra la casa de una facción en guerra.
  app.post<{ Params: { id: string; factionId: string }; Body: { companionIds?: unknown; subjectIds?: unknown } }>('/saves/:id/guerra/:factionId/atacar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: selectSave });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return lanzarAtaqueAAsentamiento(tx, save.id, { factionId: request.params.factionId, companionIds: idsDelCuerpo(request.body?.companionIds), subjectIds: idsDelCuerpo(request.body?.subjectIds) }, save.worldState?.fictionalMinutes ?? 0);
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return { ok: true, id: r.id };
  });
}
