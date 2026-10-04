import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { esEstiloNarrador } from '../../services/cronista/narradorFondo.js';

/// Listado y borrado de partidas (deuda técnica 2026-07-30, split de saves.ts) — la pantalla de
/// "Continuar partida" (CharacterSaves.tsx) solo necesita estos dos: la lista resumida de todas
/// las partidas del usuario, y poder borrar una entera.
export async function listRoutes(app: FastifyInstance) {
  app.delete<{ Params: { id: string } }>('/saves/:id', async (request, reply) => {
    // onDelete: Cascade en el schema se encarga de WorldState/LogEntry/CharacterTransit/
    // InventoryItem/Companion/SessionSummary — borrar el Save basta.
    //
    // Bug real (auditoría 2026-07-22): `.catch(() => null)` tragaba CUALQUIER error, no solo "ya
    // no existe" (P2025) — un fallo real de conexión a la base de datos era indistinguible de un
    // borrado exitoso para quien llama. Ahora solo se absorbe el caso idempotente real.
    try {
      await prisma.save.delete({ where: { id: request.params.id } });
    } catch (err) {
      const isNotFound = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
      if (!isNotFound) throw err;
    }
    return reply.status(204).send();
  });

  app.get('/saves', async () => {
    const userId = await getDefaultUserId();
    const saves = await prisma.save.findMany({
      where: { userId },
      include: { world: true, worldState: true },
      orderBy: { lastPlayedAt: 'desc' },
    });

    return saves.map((save) => ({
      id: save.id,
      worldId: save.world.slug,
      worldName: save.world.name,
      characterName: save.characterName,
      saveName: save.saveName,
      fictionalDate: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      lastPlayedAt: save.lastPlayedAt,
      dificultad: save.dificultad,
      versionCreada: save.versionCreada,
      versionUltimaPartida: save.versionUltimaPartida,
      endedAt: save.endedAt?.toISOString() ?? null,
    }));
  });

  // Nombre editable de la partida (2026-09-06, "poder nombrar las partidas con nombres custom
  // para diferenciarlas") — null/string vacío vuelve al título por defecto en el frontend
  // ("characterName — worldName"), nunca toca `characterName` en sí.
  app.patch<{ Params: { id: string }; Body: { saveName: string | null } }>('/saves/:id/name', async (request, reply) => {
    const saveName = request.body.saveName?.trim() || null;
    try {
      await prisma.save.update({ where: { id: request.params.id }, data: { saveName } });
    } catch (err) {
      const isNotFound = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
      if (isNotFound) return reply.status(404).send();
      throw err;
    }
    return reply.status(200).send({ saveName });
  });

  // CR-12 (hito 0.2, decisión D-7) — «Ritmo del mundo» de la partida (Configuración › Partida): cuánta
  // tensión gana cada día el narrador de fondo. Cambiable en cualquier momento.
  app.get<{ Params: { id: string } }>('/saves/:id/ritmo', async (request, reply) => {
    const ws = await prisma.worldState.findUnique({ where: { saveId: request.params.id }, select: { estiloNarrador: true } });
    if (!ws) return reply.status(404).send();
    return { estiloNarrador: esEstiloNarrador(ws.estiloNarrador) ? ws.estiloNarrador : 'EQUILIBRADO' };
  });

  app.patch<{ Params: { id: string }; Body: { estiloNarrador?: unknown } }>('/saves/:id/ritmo', async (request, reply) => {
    const { estiloNarrador } = request.body ?? {};
    if (!esEstiloNarrador(estiloNarrador)) return reply.status(400).send({ error: 'estiloNarrador debe ser TRANQUILO, EQUILIBRADO o CAOTICO' });
    const r = await prisma.worldState.updateMany({ where: { saveId: request.params.id }, data: { estiloNarrador } });
    if (r.count === 0) return reply.status(404).send();
    return { estiloNarrador };
  });
}
