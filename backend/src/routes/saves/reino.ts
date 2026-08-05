import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

/// Fundación de reino (2026-08-04, docs/17-reglas-construcciones-reino.md) — el popup que se abre
/// al terminar de construir el Ayuntamiento (tier 1) manda aquí el formulario. Decisión manual de
/// la jugadora, nunca del modelo (mismo criterio narrativo-sin-mecánica que el resto de Save).
export async function reinoRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { kingdomName: string; description?: string } }>(
    '/saves/:id/reino/fundar',
    async (request, reply) => {
      const { kingdomName, description } = request.body;
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) {
        return reply.status(404).send({ error: 'Partida no encontrada' });
      }

      const ayuntamiento = await prisma.building.findFirst({ where: { saveId: save.id, recipeKey: 'ayuntamiento' } });
      if (!ayuntamiento) {
        return reply.status(400).send({ error: 'Todavía no has construido ningún Ayuntamiento' });
      }

      // Gorhorn (petición explícita, 2026-08-04): el nombre del reino viene precargado y
      // BLOQUEADO — "Maktor" — verificado aquí en el backend, no solo ocultando el campo en el
      // formulario del frontend (mismo criterio que isStarting/isDynamic en habilidades.ts).
      const isGorhorn = save.characterName === 'Gorhorn';
      const finalKingdomName = isGorhorn ? 'Maktor' : kingdomName?.trim();
      if (!finalKingdomName) {
        return reply.status(400).send({ error: 'Falta el campo: kingdomName' });
      }

      await prisma.save.update({ where: { id: save.id }, data: { kingdomName: finalKingdomName } });
      if (description?.trim() && ayuntamiento.territoryId) {
        await prisma.territory.update({ where: { id: ayuntamiento.territoryId }, data: { description: description.trim() } });
      }

      return { kingdomName: finalKingdomName };
    },
  );
}
