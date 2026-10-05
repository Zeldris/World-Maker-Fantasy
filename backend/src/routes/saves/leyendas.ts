import type { FastifyInstance } from 'fastify';
import type { FamiliaSuceso } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { FAMILIAS, FICHAS_CON_LEYENDAS, leyendasDeEntidad, leyendasDeFicha, leyendasDePartida, TIPOS_ENTIDAD, type FichaConLeyendas } from '../../services/cronista/leyendas.js';
import type { EntidadTipo } from '../../services/cronista/sucesos.js';

/// Leyendas de la partida (CR-19, hito 0.2 — roadmap-cronista.md § 14): solo lo que sabe el
/// personaje. La vista de administración con todo el Libro es `GET /saves/:id/libro`.
export async function leyendasRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { familia?: string; desde?: string; hasta?: string; limite?: string; cursor?: string } }>(
    '/saves/:id/leyendas',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      const { familia, desde, hasta, limite, cursor } = request.query;
      if (familia && !FAMILIAS.includes(familia as FamiliaSuceso)) return reply.status(400).send({ error: `Familia desconocida: ${familia}` });
      const numero = (v?: string) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined);
      return leyendasDePartida(prisma, save.id, {
        familia: familia as FamiliaSuceso | undefined, desde: numero(desde), hasta: numero(hasta), limite: numero(limite), cursor: cursor || undefined,
      });
    },
  );

  app.get<{ Params: { id: string; tipo: string; entidadId: string } }>('/saves/:id/leyendas/entidad/:tipo/:entidadId', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    const tipo = request.params.tipo.toUpperCase() as EntidadTipo;
    if (!TIPOS_ENTIDAD.includes(tipo)) return reply.status(400).send({ error: `Tipo de entidad desconocido: ${request.params.tipo}` });
    return { entradas: await leyendasDeEntidad(prisma, save.id, tipo, request.params.entidadId) };
  });

  // CR-20 (20b): sección «En tu partida» de una ficha de la Enciclopedia, por su slug.
  app.get<{ Params: { id: string; ficha: string; slug: string } }>('/saves/:id/leyendas/ficha/:ficha/:slug', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (!(request.params.ficha in FICHAS_CON_LEYENDAS)) return reply.status(400).send({ error: `Ficha sin leyendas: ${request.params.ficha}` });
    return { entradas: await leyendasDeFicha(prisma, save.id, request.params.ficha as FichaConLeyendas, request.params.slug) };
  });
}
