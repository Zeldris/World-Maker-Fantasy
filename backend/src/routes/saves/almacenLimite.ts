import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';

/// CRUD de `AlmacenLimite` (hueco C, rediseño de Producción estilo Bellwright, 2026-09-21,
/// docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4-ter) — tope configurable del Almacén de Reino por
/// `catalogSlug`, ya leído por `almacenAlTope` (kingdomProduction.ts) pero sin ninguna forma de
/// escribirlo desde el cliente hasta ahora. `limite: null` es el propio default del schema ("sin
/// tope"), así que no hace falta ningún DELETE — fijar `null` ya expresa "vuelve a infinito".
export async function almacenLimiteRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/saves/:id/almacen-limites', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const rows = await prisma.almacenLimite.findMany({ where: { saveId: save.id }, select: { catalogSlug: true, limite: true } });
    return { limites: rows };
  });

  app.post<{ Params: { id: string }; Body: { catalogSlug: string; limite: number | null } }>(
    '/saves/:id/almacen-limites',
    async (request, reply) => {
      const { catalogSlug, limite } = request.body;
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;
      if (!catalogSlug?.trim()) return reply.status(400).send({ error: 'Falta el campo: catalogSlug' });
      if (limite != null && limite < 0) return reply.status(400).send({ error: 'El límite no puede ser negativo' });

      const row = await prisma.almacenLimite.upsert({
        where: { saveId_catalogSlug: { saveId: save.id, catalogSlug } },
        update: { limite },
        create: { saveId: save.id, catalogSlug, limite },
        select: { catalogSlug: true, limite: true },
      });
      return { ok: true, ...row };
    },
  );
}
