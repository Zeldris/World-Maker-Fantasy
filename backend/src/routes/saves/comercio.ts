import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { MERCADO_RECIPE_KEY } from '../../services/construction.js';

/// CR-47 (47d, hito 0.2): el Mercado del Reino — órdenes permanentes de compra y venta y las
/// caravanas que las cumplen.
export async function comercioRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/saves/:id/reino/comercio', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    const reino = await prisma.faction.findFirst({ where: { saveId: save.id, origenSlug: null, disueltaEn: null }, select: { id: true } });
    const mercado = !!(await prisma.building.findFirst({ where: { saveId: save.id, recipeKey: MERCADO_RECIPE_KEY, status: 'ACTIVO' }, select: { id: true } }));
    const [ordenes, caravanas, objetos, relaciones] = await Promise.all([
      prisma.ordenComercio.findMany({ where: { saveId: save.id }, orderBy: { createdAt: 'asc' } }),
      prisma.caravana.findMany({
        where: { saveId: save.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, tipo: true, catalogSlug: true, unidades: true, traidas: true, riqueza: true, status: true, diaRegreso: true, faction: { select: { name: true } } },
      }),
      prisma.itemCatalog.findMany({ where: { worldId: save.worldId, valorGoirnos: { gt: 0 }, tipo: { in: ['RECURSO', 'MATERIAL'] } }, select: { slug: true, name: true }, orderBy: { name: 'asc' } }),
      reino
        ? prisma.factionRelation.findMany({
            where: { type: { in: ['ALIANZA', 'TRATADO_COMERCIAL'] }, OR: [{ sourceFactionId: reino.id }, { targetFactionId: reino.id }] },
            select: { sourceFaction: { select: { id: true, slug: true, name: true } }, targetFaction: { select: { id: true, slug: true, name: true } } },
          })
        : [],
    ]);
    const nombreDe = new Map(objetos.map((o) => [o.slug, o.name]));
    const socios = relaciones.map((r) => (r.sourceFaction.id === reino!.id ? r.targetFaction : r.sourceFaction)).map((f) => ({ slug: f.slug, name: f.name }));
    return {
      reino: !!reino,
      mercado,
      socios,
      objetos,
      ordenes: ordenes.map((o) => ({ ...o, nombre: nombreDe.get(o.catalogSlug) ?? o.catalogSlug })),
      caravanas: caravanas.map((c) => ({ ...c, faccion: c.faction.name, nombre: nombreDe.get(c.catalogSlug) ?? c.catalogSlug, faction: undefined })),
    };
  });

  app.post<{ Params: { id: string }; Body: { catalogSlug?: string; tipo?: string; umbral?: number; lote?: number; factionSlug?: string | null } }>(
    '/saves/:id/reino/comercio/ordenes',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;
      const { catalogSlug, tipo, umbral, lote, factionSlug } = request.body ?? {};
      if (!catalogSlug || (tipo !== 'COMPRA' && tipo !== 'VENTA')) return reply.status(400).send({ error: 'Falta el objeto o si es compra o venta.' });
      if (!Number.isInteger(umbral) || umbral! < 0 || !Number.isInteger(lote) || lote! < 1 || lote! > 50) {
        return reply.status(400).send({ error: 'El umbral es un número entero de 0 en adelante y el lote, de 1 a 50.' });
      }
      if (!(await prisma.building.findFirst({ where: { saveId: save.id, recipeKey: MERCADO_RECIPE_KEY, status: 'ACTIVO' }, select: { id: true } }))) {
        return reply.status(400).send({ error: 'Hace falta un Mercado en el Reino.' });
      }
      const item = await prisma.itemCatalog.findFirst({ where: { worldId: save.worldId, slug: catalogSlug, valorGoirnos: { gt: 0 } }, select: { slug: true } });
      if (!item) return reply.status(400).send({ error: 'Ese objeto no se comercia.' });
      const orden = await prisma.ordenComercio.create({ data: { saveId: save.id, catalogSlug, tipo, umbral: umbral!, lote: lote!, factionSlug: factionSlug ?? null } });
      return { orden };
    },
  );

  app.delete<{ Params: { id: string; ordenId: string } }>('/saves/:id/reino/comercio/ordenes/:ordenId', async (request, reply) => {
    const borradas = await prisma.ordenComercio.deleteMany({ where: { id: request.params.ordenId, saveId: request.params.id } });
    if (borradas.count === 0) return reply.status(404).send({ error: 'Esa orden no existe.' });
    return { ok: true };
  });
}
