import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { registrarSuceso } from '../../services/cronista/sucesos.js';
import { scopeFor, type NpcItemInScene } from '../../services/npcScene.js';
import { rejectIfEnded, rejectIfPendingDeath, toFrontendLogEntry } from './shared.js';
import { CONDICIONES_INTERACTUABLE } from '../../services/death.js';

/// Entregar un objeto a un NPC (2026-08-31, mecánica real — antes solo existía la mitigación de
/// coherencia `hasFalseItemGivenAway`, narrador.ts: bloqueaba que la narración PROMETIERA una
/// entrega, pero ningún InventoryItem se retiraba nunca, sin ningún camino real de cumplirla).
///
/// Mismo patrón que Capturar (`companeros.ts`, docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md):
/// mutación 100% determinista sin narración de por medio, endpoint dedicado propio, botón en el
/// frontend en vez de detección de texto libre (decisión explícita: dos referencias a resolver a
/// la vez — objeto Y NPC — hacían frágil el matching por comillas simples que usa `explicitTarget`
/// para un solo objetivo).
///
/// Restringido a solo COMPAÑEROS de equipo (2026-09-06, bug real jugando en vivo — petición
/// explícita de la usuaria: "la habilidad Entregar sirve para entregar cosas a los inventarios de
/// los compañeros, no a cualquiera que pase") — antes permitía entregar a cualquier NPC
/// interactuable en escena, sin relación con el equipo real de la jugadora. Un NPC cuenta como
/// compañero si existe un `Companion.sourceSlug` real que lo referencia en esta partida (mismo
/// campo que usa `companeros.ts` al materializar un tameo/persuasión).
///
/// El objeto entregado no desaparece sin más: se guarda aplanado en `NpcState.givenItems` (mismo
/// shape que `NpcItemInScene`) y se suma al loadout del NPC en `buildNpcInScene` — si ese NPC
/// concreto es derrotado más adelante, el objeto entregado aparece entre lo saqueable, mismo
/// pipeline que el loot de catálogo, sin lógica paralela (ver comentario del campo en
/// schema.prisma).
/// CR-12 (12d): quien pide materiales en un encargo pendiente (`ENCARGO_MATERIALES`) también puede
/// recibir objetos: es la única excepción a «solo compañeros» (decisión de la usuaria del 2026-09-06).
export async function slugsDeEncargados(saveId: string, worldId: string): Promise<Set<string>> {
  const encargos = await prisma.consecuencia.findMany({ where: { saveId, regla: 'ENCARGO_MATERIALES', estado: 'PENDIENTE', npcId: { not: null } }, select: { npcId: true } });
  if (encargos.length === 0) return new Set();
  const npcs = await prisma.npc.findMany({ where: { worldId, id: { in: encargos.map((e) => e.npcId!) } }, select: { slug: true } });
  return new Set(npcs.map((n) => n.slug));
}

/// P241: ¿hay botón Entregar para este NPC? Solo compañeros de equipo y encargados de ENCARGO_MATERIALES (mismo
/// criterio que `/entregables` y `POST /entregar/:npcSlug`).
export async function puedeRecibirEntregas(saveId: string, worldId: string, npcSlug: string): Promise<boolean> {
  const companero = await prisma.companion.findFirst({ where: { saveId, sourceSlug: npcSlug }, select: { id: true } });
  if (companero) return true;
  return (await slugsDeEncargados(saveId, worldId)).has(npcSlug);
}

export async function entregaRoutes(app: FastifyInstance) {
  /// Candidatos: objetos NO equipados del inventario + compañeros de equipo ya presentes en esta
  /// ubicación (mismo criterio de presencia que Capturar/Saquear-zona: `NpcState` real +
  /// `scopeFor`, cruzado contra `Companion.sourceSlug` de esta partida).
  app.get<{ Params: { id: string } }>('/saves/:id/entregables', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: { id: true, worldId: true, currentLocationId: true, inventoryItems: { where: { slot: null }, select: { id: true, name: true, description: true } } },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (!save.currentLocationId || save.inventoryItems.length === 0) return { items: [], npcs: [] };

    const companionSourceSlugs = new Set(
      (await prisma.companion.findMany({ where: { saveId: save.id, sourceSlug: { not: null } }, select: { sourceSlug: true } })).map((c) => c.sourceSlug!),
    );
    // CR-12: también quien pide materiales en un encargo pendiente (oportunidades.ts).
    for (const slug of await slugsDeEncargados(save.id, save.worldId)) companionSourceSlugs.add(slug);
    if (companionSourceSlugs.size === 0) return { items: save.inventoryItems, npcs: [] };

    const states = await prisma.npcState.findMany({
      where: { saveId: save.id, condicionFisica: { in: CONDICIONES_INTERACTUABLE } },
    });
    if (states.length === 0) return { items: save.inventoryItems, npcs: [] };

    const npcs = await prisma.npc.findMany({ where: { id: { in: states.map((s) => s.npcId) }, worldId: save.worldId, slug: { in: [...companionSourceSlugs] } } });
    const npcById = new Map(npcs.map((n) => [n.id, n]));
    const candidateNpcs = states
      .map((state) => {
        const npc = npcById.get(state.npcId);
        if (!npc || scopeFor(npc.kind, save.currentLocationId) !== state.scope) return null;
        return { npcSlug: npc.slug, name: npc.name };
      })
      .filter((n): n is { npcSlug: string; name: string } => !!n);

    return { items: save.inventoryItems, npcs: candidateNpcs };
  });

  app.post<{ Params: { id: string; npcSlug: string }; Body: { itemId: string } }>(
    '/saves/:id/entregar/:npcSlug',
    async (request, reply) => {
      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        select: { id: true, worldId: true, currentLocationId: true, endedAt: true, pendingDeathResolution: true, characterName: true, worldState: { select: { fictionalDateLabel: true, fictionalMinutes: true } } },
      });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;
      if (!save.currentLocationId) return reply.status(400).send({ error: 'Sin ubicación actual' });

      const { itemId } = request.body;
      if (!itemId) return reply.status(400).send({ error: 'Falta itemId' });

      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
      if (!item || item.saveId !== save.id) return reply.status(404).send({ error: 'Objeto no encontrado en tu inventario' });
      if (item.slot !== null) return reply.status(400).send({ error: 'Desequípalo antes de entregarlo' });

      const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, slug: request.params.npcSlug, saveId: null } });
      if (!npc) return reply.status(404).send({ error: 'NPC no encontrado' });
      const isCompanion = await prisma.companion.findFirst({ where: { saveId: save.id, sourceSlug: npc.slug } });
      const esEncargado = !isCompanion && (await slugsDeEncargados(save.id, save.worldId)).has(npc.slug);
      if (!isCompanion && !esEncargado) return reply.status(400).send({ error: 'Solo puedes entregar objetos a compañeros de tu equipo' });
      const scope = scopeFor(npc.kind, save.currentLocationId);
      const state = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } } });
      if (!state || !CONDICIONES_INTERACTUABLE.includes(state.condicionFisica)) {
        return reply.status(400).send({ error: 'Ese NPC no está aquí para recibir nada' });
      }

      const catalog = item.catalogSlug
        ? await prisma.itemCatalog.findFirst({ where: { worldId: save.worldId, slug: item.catalogSlug } })
        : null;
      const givenItem: NpcItemInScene = {
        name: item.name,
        cantidad: 1,
        notas: item.description,
        description: item.description,
        equipSlot: catalog?.equipSlot ?? null,
        statBonuses: item.statBonuses as NpcItemInScene['statBonuses'],
        // `NpcItem.catalogSlug` real siempre viene de una relación con ficha (nunca null) — un
        // objeto entregado puede ser puramente narrativo (sin catalogSlug), mismo criterio que el
        // resto del proyecto usa para "objeto sin ficha real detrás" (turnResolution.ts, botín).
        catalogSlug: item.catalogSlug ?? '',
        effectKey: catalog?.effectKey ?? null,
        category: catalog?.category ?? 'objeto',
        tipoArma: catalog?.tipoArma ?? null,
        tipo: catalog?.tipo ?? 'MATERIAL',
      };

      const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
      const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
      // `givenItems` es Json, no un array escalar nativo — `push` de Prisma solo existe para
      // String[]/Int[]. Se lee/muta/escribe entero, mismo criterio que cualquier otro campo Json
      // acumulativo de este proyecto (p.ej. `activeEffects`).
      const existingGivenItems = (state.givenItems as unknown as NpcItemInScene[] | undefined) ?? [];
      const createdLogEntry = await prisma.$transaction(async (tx) => {
        await tx.inventoryItem.delete({ where: { id: item.id } });
        await tx.npcState.update({
          where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } },
          data: { givenItems: [...existingGivenItems, givenItem] as unknown as object },
        });
        const entrada = await tx.logEntry.create({
          data: {
            saveId: save.id,
            channel: 'CHARACTER',
            text: `${save.characterName} le entrega ${item.name} a ${npc.name}.`,
            timeLabel,
            fictionalMinutes,
            isPlayerAction: true,
          },
        });
        // Libro de Sucesos (CR-3, hito 0.2).
        await registrarSuceso(tx, {
          saveId: save.id,
          tipo: 'REGALO',
          fictionalMinutes,
          locationId: save.currentLocationId,
          origen: 'JUGADOR',
          logEntryId: entrada.id,
          actores: [
            { entidadTipo: 'PERSONAJE', entidadId: save.id, papel: 'AUTOR' },
            { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' },
          ],
          datos: { personaje: save.characterName, a: npc.name, objeto: { nombre: item.name, ...(catalog?.category ? { categoria: catalog.category } : {}) } },
        });
        return entrada;
      });

      return { npcSlug: npc.slug, itemName: item.name, logEntry: toFrontendLogEntry(createdLogEntry) };
    },
  );
}
