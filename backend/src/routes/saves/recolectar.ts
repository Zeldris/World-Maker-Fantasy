import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { metodoForOficio } from '../../services/harvestAbilities.js';
import { detectHarvestSourcesInScene } from '../../services/harvest.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import { inventoryCapacityFor } from '../../services/inventoryCapacity.js';
import { effectiveInventorySlotsBonus } from '../../services/equipment.js';
import type { AttributeBlock } from '../../services/dice.js';
import type { MetodoObtencion } from '@prisma/client';

/// Recolección (rediseño de profesiones, 2026-08-07) — lado "recolectora" (minero/talador): a
/// diferencia de las de oficio creador (crafting.ts, un solo objeto por texto libre), aquí el
/// pop-up de la habilidad base ("Minar"/"Talar") necesita saber QUÉ hay recolectable antes de que
/// el jugador escriba nada. Desuello (CAZA) no pasa por aquí — sigue el flujo de despiece normal
/// ya existente (harvest.ts), targeteando una presa ya derrotada, no una fuente por explorar.

interface SourceCandidate {
  sourceSlug: string;
  sourceName: string;
  disponible: number;
  yields: { itemSlug: string; itemName: string; cantidadMaxima: number }[];
}

/// Fuentes candidatas para `oficio` en la región actual: las que tienen HarvestYield con el
/// método correcto Y una fila WorldPopulation tipo RECURSO con población real > 0 en esa región
/// (nunca se ofrece recolectar algo que el propio mundo dice que no queda).
async function candidateSourcesFor(worldId: string, metodo: MetodoObtencion, region: string | null): Promise<SourceCandidate[]> {
  const rows = await prisma.harvestYield.findMany({ where: { worldId, metodoObtencion: metodo }, include: { item: true } });
  if (rows.length === 0) return [];
  const bySlug = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!bySlug.has(row.sourceSlug)) bySlug.set(row.sourceSlug, []);
    bySlug.get(row.sourceSlug)!.push(row);
  }
  const populations = await prisma.worldPopulation.findMany({
    where: { worldId, targetType: 'RECURSO', targetSlug: { in: [...bySlug.keys()] }, poblacion: { gt: 0 } },
  });
  const candidates: SourceCandidate[] = [];
  for (const pop of populations) {
    // Sin región conocida (save.currentLocation nulo — posible según el schema), falla CERRADO:
    // ninguna fuente es candidata, en vez de ofrecer las de todas las regiones del mundo por
    // saltarse el filtro (bug real encontrado en auditoría, 2026-08-07 — antes `region && ...`
    // con region=null no filtraba nada).
    if (!region) continue;
    const distribucion = pop.distribucion as Record<string, number>;
    if (!(distribucion[region] > 0)) continue;
    const sourceRows = bySlug.get(pop.targetSlug) ?? [];
    if (sourceRows.length === 0) continue;
    candidates.push({
      sourceSlug: pop.targetSlug,
      sourceName: sourceRows[0].sourceName,
      disponible: pop.poblacion,
      yields: sourceRows.map((r) => ({ itemSlug: r.item.slug, itemName: r.item.name, cantidadMaxima: r.cantidad })),
    });
  }
  return candidates;
}

export async function recolectarRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string; oficio: string } }>('/saves/:id/recolectar/:oficio', async (request, reply) => {
    const metodo = metodoForOficio(request.params.oficio);
    if (!metodo || metodo === 'CAZA') {
      return reply.status(400).send({ error: `"${request.params.oficio}" no es un oficio recolector con exploración (usa el despiece normal para desuello)` });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const candidates = await candidateSourcesFor(save.worldId, metodo, save.currentLocation?.region ?? null);
    if (candidates.length === 0) return { sources: [], puedeExplorar: false };

    const sessionFacts = await loadSessionFacts(save.id);
    const localizados = detectHarvestSourcesInScene(
      sessionFacts,
      candidates.map((c) => c.sourceSlug),
    );
    const sources = candidates.filter((c) => localizados.includes(c.sourceSlug));
    return { sources, puedeExplorar: sources.length === 0 };
  });

  // Determinista, sin gastar turno ni pasar por Ollama (decisión de diseño, 2026-08-07: ya existe
  // WorldPopulation con población real por región, no hace falta narrar para saber qué hay) —
  // registra el hallazgo como hecho de sesión para que futuras aperturas del pop-up (y el propio
  // Narrador) ya lo den por localizado sin tener que volver a explorar.
  app.post<{ Params: { id: string; oficio: string } }>('/saves/:id/recolectar/:oficio/explorar', async (request, reply) => {
    const metodo = metodoForOficio(request.params.oficio);
    if (!metodo || metodo === 'CAZA') {
      return reply.status(400).send({ error: `"${request.params.oficio}" no es un oficio recolector con exploración` });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const candidates = await candidateSourcesFor(save.worldId, metodo, save.currentLocation?.region ?? null);
    if (candidates.length === 0) return { sources: [] };

    const sessionFacts = await loadSessionFacts(save.id);
    await appendSessionFacts(
      save.id,
      sessionFacts,
      candidates.map((c) => `${save.characterName} localiza ${c.sourceName.toLowerCase()} en la zona.`),
    );
    return { sources: candidates };
  });

  app.post<{ Params: { id: string }; Body: { selections: { sourceSlug: string; itemSlug: string; cantidad: number }[] } }>(
    '/saves/:id/recolectar/confirmar',
    async (request, reply) => {
      const { selections } = request.body;
      if (!Array.isArray(selections) || selections.length === 0) {
        return reply.status(400).send({ error: 'Falta el campo: selections' });
      }

      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

      const created = await prisma.$transaction(async (tx) => {
        // Capacidad real (Parte D) — releída DENTRO de la transacción, igual que el resto de
        // gates de este proyecto (revalidar justo antes de escribir, no confiar en un conteo de
        // antes de abrir la transacción).
        const [currentCount, equippedItems] = await Promise.all([
          tx.inventoryItem.count({ where: { saveId: save.id } }),
          tx.inventoryItem.findMany({ where: { saveId: save.id, slot: { not: null } }, select: { statBonuses: true } }),
        ]);
        const capacity = inventoryCapacityFor(
          (save.attributes as AttributeBlock).fuerza,
          (save.attributes as AttributeBlock).constitucion,
          effectiveInventorySlotsBonus(equippedItems),
        );
        if (currentCount + selections.length > capacity) {
          throw new Error(`No te cabe en el inventario (${currentCount}/${capacity} slots, intentas añadir ${selections.length}).`);
        }

        const newItems: { id: string; name: string; description: string; slot: null; catalogSlug: string; equipSlot: null; effectKey: null }[] = [];
        for (const sel of selections) {
          if (sel.cantidad <= 0) continue;

          // Validación contra la fuente de verdad (2026-08-07, auditoría: sin esto, `selections`
          // viene del cliente sin comprobar nada — se podía pedir cualquier itemSlug para
          // cualquier sourceSlug, y `sel.cantidad` no tenía más tope que la población total del
          // mundo, saltándose por completo el máximo real por recolección de `HarvestYield.cantidad`
          // (p. ej. "3 piedras por recolección" se convertía en "toda la veta de una vez").
          const yieldRow = await tx.harvestYield.findFirst({
            where: { worldId: save.worldId, sourceSlug: sel.sourceSlug, item: { slug: sel.itemSlug } },
            include: { item: true },
          });
          if (!yieldRow) continue;
          const cantidad = Math.min(sel.cantidad, yieldRow.cantidad);

          // Depleción atómica (mismo patrón que decrementPopulationOnDeath, population.ts) — el
          // guard `poblacion: { gte: cantidad }` evita bajar de 0 sin necesitar releer nada antes;
          // si `count` da 0, otra recolección casi simultánea ya se llevó lo que quedaba.
          const result = await tx.worldPopulation.updateMany({
            where: { worldId: save.worldId, targetType: 'RECURSO', targetSlug: sel.sourceSlug, poblacion: { gte: cantidad } },
            data: { poblacion: { decrement: cantidad } },
          });
          if (result.count === 0) continue;

          const catalogItem = yieldRow.item;
          const item = await tx.inventoryItem.create({
            data: {
              saveId: save.id,
              name: cantidad > 1 ? `${catalogItem.name} (${cantidad})` : catalogItem.name,
              description: catalogItem.description,
              origin: 'recolección',
              catalogSlug: catalogItem.slug,
            },
          });
          // Materia prima cruda (RECURSO) — nunca EQUIPABLE ni ESPECIAL, mismo criterio que el
          // resto de yields de despiece/recolección (turnResolution.ts): equipSlot/effectKey null.
          newItems.push({ id: item.id, name: item.name, description: item.description, slot: null, catalogSlug: catalogItem.slug, equipSlot: null, effectKey: null });
        }
        return newItems;
      });

      return { items: created };
    },
  );
}
