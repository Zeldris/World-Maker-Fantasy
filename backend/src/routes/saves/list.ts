import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

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
      fictionalDate: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      lastPlayedAt: save.lastPlayedAt,
      dificultad: save.dificultad,
      endedAt: save.endedAt?.toISOString() ?? null,
    }));
  });
}
