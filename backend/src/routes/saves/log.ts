import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { dayForFictionalMinutes } from '../../services/worldClock.js';
import { toFrontendLogEntry } from './shared.js';

/// Registro de la partida (deuda técnica 2026-07-30, split de saves.ts): guardar qué entidad se
/// mostró como banner bajo una narración, y el Diario completo agrupado por día — a diferencia de
/// GET /saves/:id (detail.ts, ventana de 24h con banners ya resueltos), este es el histórico
/// entero, pedido bajo demanda al abrir la pestaña.
export async function logRoutes(app: FastifyInstance) {
  // Persiste qué entidad se mostró como banner bajo una narración (rework 2026-07-24) — el
  // frontend ya decidió cuál mostrar (mentionedEntityBanner.ts, con su propia deduplicación);
  // esto solo guarda esa decisión para que GET /saves/:id la devuelva igual tras una recarga
  // dentro de la ventana de 24h. Nunca se guarda la URL de la imagen, solo la referencia.
  app.patch<{ Params: { id: string; entryId: string }; Body: { entityType: string; entitySlug: string } }>(
    '/saves/:id/log/:entryId/entity-banner',
    async (request, reply) => {
      const { entityType, entitySlug } = request.body;
      if (!entityType || !entitySlug) {
        return reply.status(400).send({ error: 'Faltan campos: entityType, entitySlug' });
      }
      const entry = await prisma.logEntry.findFirst({ where: { id: request.params.entryId, saveId: request.params.id } });
      if (!entry) {
        return reply.status(404).send({ error: 'Entrada de registro no encontrada' });
      }
      await prisma.logEntry.update({
        where: { id: entry.id },
        data: { entityBannerType: entityType, entityBannerSlug: entitySlug },
      });
      return reply.status(204).send();
    },
  );

  // Registro completo de la partida, agrupado por día de ficción (rework 2026-07-24: "el log de
  // personaje solo muestre 24h... si quieres verlo todo vendrá clasificado por días en el diario").
  // A diferencia de GET /saves/:id, aquí no hay ventana de tiempo ni banner de entidad — el Diario
  // es solo texto por diseño, y se pide bajo demanda (al abrir la pestaña), no en cada carga.
  app.get<{ Params: { id: string } }>('/saves/:id/diario', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    const entries = await prisma.logEntry.findMany({ where: { saveId: save.id }, orderBy: { createdAt: 'asc' } });
    return entries.map((e) => ({ ...toFrontendLogEntry(e), day: dayForFictionalMinutes(e.fictionalMinutes) }));
  });
}
