import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { scopeFor } from '../../services/npcScene.js';
import { equipSlotFamily, effectiveAttributes } from '../../services/equipment.js';
import type { AttributeBlock, Attribute } from '../../services/dice.js';
import { companionSlotsForRecipeKey } from '../../services/construction.js';
import {
  esDomador,
  felicidadUmbralFor,
  resolverIntento,
  jaulaTamanoRequeridoFor,
  jaulaAlcanzaPara,
  jaulaRecipeKeyFor,
  autoEquiparDesdeAlmacen,
  type PlantillaSlots,
} from '../../services/companionSupervivencia.js';
import { EquipSlot } from '@prisma/client';

/// Grupo 3 § Compañeros y supervivencia (2026-08-25, diseño completo en
/// docs/rpgtarkor/companeros-y-supervivencia.md) — captura+tameo/persuasión, equipo de
/// compañeros/súbditos, Almacén de Reino + plantillas. Hambre/Sed del propio personaje (§5) no
/// tiene rutas propias: se lee ya calculada en GET /saves/:id (detail.ts) y avanza sola en el
/// worldTick de fondo (companionSupervivencia.ts § advancePlayerSurvival).
///
/// Ranuras reducidas de fauna (§6) — simplificación consciente: el doc pide "variando cuánto
/// según tamaño/nivel de la bestia", pero eso exigiría una segunda tabla de calibración manual
/// aparte de `JAULA_TAMANO_REQUERIDO` — de partida, TODA fauna comparte el mismo set reducido
/// (casco/armadura/accesorio), ajustable más adelante si hace falta variar por tamaño de verdad.
const FAUNA_EQUIP_SLOTS: EquipSlot[] = ['CASCO', 'ARMADURA_SUPERIOR', 'ACCESORIO'];

export async function companerosRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════════════
  // § 1 — Captura (fauna y NPC, mismo mecanismo)
  // ═══════════════════════════════════════════════════════════════════════

  /// Candidatos a capturar en la escena actual — mismo patrón que GET /saves/:id/saquear-zona
  /// (panels.ts): barre NpcState en GRAVE/CONVALECIENTE de esta Location, sin capturar todavía.
  app.get<{ Params: { id: string } }>('/saves/:id/capturables', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, currentLocationId: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (!save.currentLocationId) return { candidates: [], tieneTrampaDeLazo: false };

    const tieneTrampaDeLazo = !!(await prisma.inventoryItem.findFirst({ where: { saveId: save.id, catalogSlug: 'trampa-de-lazo' }, select: { id: true } }));

    const states = await prisma.npcState.findMany({
      where: { saveId: save.id, condicionFisica: { in: ['GRAVE', 'CONVALECIENTE'] }, capturado: false },
    });
    if (states.length === 0) return { candidates: [], tieneTrampaDeLazo };

    const npcs = await prisma.npc.findMany({ where: { id: { in: states.map((s) => s.npcId) }, worldId: save.worldId } });
    const npcById = new Map(npcs.map((n) => [n.id, n]));
    const candidates = states
      .map((state) => {
        const npc = npcById.get(state.npcId);
        if (!npc || scopeFor(npc.kind, save.currentLocationId) !== state.scope) return null;
        // Solo lo que de verdad se puede tamear/persuadir — sin atributoResistencia no hay tirada
        // opuesta posible, aunque esté GRAVE/CONVALECIENTE.
        if (!npc.atributoResistencia) return null;
        return { npcSlug: npc.slug, name: npc.name, tipo: npc.ataqueNatural !== null ? ('FAUNA' as const) : ('NPC' as const) };
      })
      .filter((c): c is NonNullable<typeof c> => !!c);
    return { candidates, tieneTrampaDeLazo };
  });

  /// Atar con éxito — claim atómico sobre `NpcState.capturado`, mismo patrón que `saqueado`
  /// (turnResolution.ts § applyLootMode). Fauna necesita además una Jaula con hueco del tamaño
  /// requerido ya construida; NPC no necesita jaula (pasa directo a "retenido").
  app.post<{ Params: { id: string; npcSlug: string } }>('/saves/:id/capturar/:npcSlug', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, currentLocationId: true, endedAt: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (save.endedAt) return reply.status(409).send({ error: 'Esta partida ha terminado', endedAt: save.endedAt });
    if (!save.currentLocationId) return reply.status(400).send({ error: 'Sin ubicación actual' });

    const tieneTrampaDeLazo = await prisma.inventoryItem.findFirst({ where: { saveId: save.id, catalogSlug: 'trampa-de-lazo' }, select: { id: true } });
    if (!tieneTrampaDeLazo) return reply.status(400).send({ error: 'Necesitas una trampa de lazo (en inventario o equipada) para intentar atar.' });

    const npc = await prisma.npc.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: request.params.npcSlug } } });
    if (!npc || !npc.atributoResistencia) return reply.status(404).send({ error: 'Objetivo no capturable' });
    const scope = scopeFor(npc.kind, save.currentLocationId);
    const state = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } } });
    if (!state || !['GRAVE', 'CONVALECIENTE'].includes(state.condicionFisica) || state.capturado) {
      return reply.status(400).send({ error: 'Este objetivo no está listo para atar (tiene que estar GRAVE o CONVALECIENTE, sin capturar ya).' });
    }

    const esFauna = npc.ataqueNatural !== null;
    let jaulaBuildingId: string | null = null;
    if (esFauna) {
      const tamanoRequerido = jaulaTamanoRequeridoFor(npc.slug);
      const jaulas = await prisma.building.findMany({
        where: { saveId: save.id, status: 'ACTIVO', recipeKey: { in: ['jaula-pequena', 'jaula-mediana', 'jaula-grande'] } },
      });
      const jaulaConHueco = await (async () => {
        for (const jaula of jaulas) {
          const jaulaTamano = jaula.recipeKey === jaulaRecipeKeyFor('GRANDE') ? 'GRANDE' : jaula.recipeKey === jaulaRecipeKeyFor('MEDIANA') ? 'MEDIANA' : 'PEQUENA';
          if (!jaulaAlcanzaPara(jaulaTamano, tamanoRequerido)) continue;
          // Capacidad = 1 animal por Jaula (companionSupervivencia.ts § JAULA_ORDEN comment) —
          // ocupada = cualquier NpcState todavía capturado sin confirmar apuntando a esta Jaula.
          const ocupada = await prisma.npcState.findFirst({ where: { capturaJaulaBuildingId: jaula.id } });
          if (!ocupada) return jaula;
        }
        return null;
      })();
      if (!jaulaConHueco) {
        return reply.status(400).send({ error: `Necesitas una Jaula (${tamanoRequerido.toLowerCase()} o mayor) con hueco libre para retener a esta criatura.` });
      }
      jaulaBuildingId = jaulaConHueco.id;
    }

    // Claim atómico — mismo patrón que `saqueado` (turnResolution.ts): el `where` incluye
    // `capturado: false` para que dos peticiones casi simultáneas no reclamen el mismo objetivo.
    const claimed = await prisma.npcState.updateMany({
      where: { id: state.id, capturado: false },
      data: { capturado: true, capturaFelicidad: 0, capturaJaulaBuildingId: jaulaBuildingId },
    });
    if (claimed.count === 0) return reply.status(409).send({ error: 'Alguien más ya ató a este objetivo.' });

    return { npcSlug: npc.slug, tipo: esFauna ? 'FAUNA' : 'NPC', jaulaBuildingId };
  });

  // ═══════════════════════════════════════════════════════════════════════
  // § 2/3 — Tameo/persuasión: alimentar (fauna) o persuadir (NPC), mismo mecanismo
  // ═══════════════════════════════════════════════════════════════════════

  app.get<{ Params: { id: string } }>('/saves/:id/tameo-pendientes', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: { id: true, worldId: true, clase: true, especializacion: true },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    const domador = esDomador(save.clase, save.especializacion);

    const states = await prisma.npcState.findMany({ where: { saveId: save.id, capturado: true } });
    // "Capturado" pero ya confirmado como Companion (sourceSlug ya asignado) no debe seguir
    // apareciendo aquí — comparado contra los Companion ya creados de este save.
    const yaConfirmados = new Set(
      (await prisma.companion.findMany({ where: { saveId: save.id, sourceSlug: { not: null } }, select: { sourceSlug: true } })).map((c) => c.sourceSlug),
    );
    const npcs = await prisma.npc.findMany({ where: { id: { in: states.map((s) => s.npcId) }, worldId: save.worldId } });
    const npcById = new Map(npcs.map((n) => [n.id, n]));

    const pendientes = states
      .map((state) => {
        const npc = npcById.get(state.npcId);
        if (!npc || yaConfirmados.has(npc.slug)) return null;
        const esFauna = npc.ataqueNatural !== null;
        // Ventaja de información del Domador (§2) — SOLO para fauna, nunca persuasión de NPC.
        const mostrarResistencia = esFauna && domador;
        return {
          npcSlug: npc.slug,
          name: npc.name,
          tipo: esFauna ? ('FAUNA' as const) : ('NPC' as const),
          felicidad: state.capturaFelicidad,
          umbral: felicidadUmbralFor(esFauna && domador),
          atributoResistencia: mostrarResistencia ? npc.atributoResistencia : null,
          enJaula: state.capturaJaulaBuildingId !== null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => !!p);
    return { pendientes };
  });

  app.post<{ Params: { id: string; npcSlug: string }; Body: { attribute: Attribute } }>(
    '/saves/:id/tameo-pendientes/:npcSlug/intentar',
    async (request, reply) => {
      const { attribute } = request.body;
      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        include: { inventoryItems: { where: { slot: { not: null } } } },
      });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (save.endedAt) return reply.status(409).send({ error: 'Esta partida ha terminado', endedAt: save.endedAt });

      const npc = await prisma.npc.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: request.params.npcSlug } } });
      if (!npc || !npc.atributoResistencia) return reply.status(404).send({ error: 'Objetivo no encontrado' });
      const state = await prisma.npcState.findFirst({ where: { saveId: save.id, npcId: npc.id, capturado: true } });
      if (!state) return reply.status(400).send({ error: 'Este objetivo no está capturado todavía.' });

      const esFauna = npc.ataqueNatural !== null;
      const domador = esDomador(save.clase, save.especializacion) && esFauna;
      const playerAttributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
      const intento = resolverIntento(
        playerAttributes,
        attribute,
        npc.attributes as AttributeBlock,
        npc.atributoResistencia as Attribute,
        state.capturaFelicidad,
        domador,
      );

      await prisma.npcState.update({ where: { id: state.id }, data: { capturaFelicidad: intento.felicidadTras } });
      return { roll: intento.roll, felicidad: intento.felicidadTras, umbral: felicidadUmbralFor(domador), umbralCompletado: intento.umbralCompletado };
    },
  );

  /// Confirma el tameo/persuasión ya completado (Felicidad ≥ umbral) — crea el `Companion` real,
  /// respetando el tope de slots (edificio, o garantizado del Domador si aplica). Sin hueco
  /// libre, se suelta (§2/§3: "sin slot libre... se suelta, no se queda esperando").
  app.post<{ Params: { id: string; npcSlug: string }; Body: { name?: string; role?: string; notes?: string } }>(
    '/saves/:id/tameo-pendientes/:npcSlug/confirmar',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, clase: true, especializacion: true, endedAt: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (save.endedAt) return reply.status(409).send({ error: 'Esta partida ha terminado', endedAt: save.endedAt });

      const npc = await prisma.npc.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: request.params.npcSlug } } });
      if (!npc) return reply.status(404).send({ error: 'Objetivo no encontrado' });
      const state = await prisma.npcState.findFirst({ where: { saveId: save.id, npcId: npc.id, capturado: true } });
      if (!state) return reply.status(400).send({ error: 'Este objetivo no está capturado todavía.' });

      const esFauna = npc.ataqueNatural !== null;
      const domador = esDomador(save.clase, save.especializacion) && esFauna;
      const umbral = felicidadUmbralFor(domador);
      if (state.capturaFelicidad < umbral) {
        return reply.status(400).send({ error: `Todavía no ha ganado suficiente confianza (${state.capturaFelicidad}/${umbral}).` });
      }

      // Condición de carrera real (auditoría de código 2026-08-25): esta ruta no pasa por
      // `claimTurnInFlight` (exclusivo de /turn/narrate), así que dos confirmaciones casi
      // simultáneas (dos capturas pendientes distintas, o doble clic) leían el mismo
      // `companionCount`/`esSlotDomador` antes de que ninguna escribiera, pasando ambas el check y
      // creando ambas — el reino terminaba con más compañeros que huecos reales, o con dos slots de
      // Domador "gratis". Mismo patrón que `progression.ts` (`/attribute-points`): se bloquea la
      // fila de `Save` con `SELECT ... FOR UPDATE` para serializar confirmaciones de la MISMA
      // partida — la segunda ve ya el estado que dejó la primera antes de decidir nada.
      const outcome = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Save" WHERE id = ${save.id} FOR UPDATE`;

        // Slot garantizado del Domador (§2) — solo para fauna con Domador real; el resto compite
        // por `companionSlotsForRecipeKey` como cualquier compañero.
        let esSlotDomador = false;
        if (domador) {
          const yaTieneSlotDomador = await tx.companion.findFirst({ where: { saveId: save.id, esSlotDomador: true } });
          esSlotDomador = !yaTieneSlotDomador;
        }
        if (!esSlotDomador) {
          const [companionCount, buildings] = await Promise.all([
            tx.companion.count({ where: { saveId: save.id, esSlotDomador: false } }),
            tx.building.findMany({ where: { saveId: save.id, status: 'ACTIVO' }, select: { recipeKey: true } }),
          ]);
          const maxCompanions = buildings.reduce((sum, b) => sum + companionSlotsForRecipeKey(b.recipeKey), 0);
          if (companionCount >= maxCompanions) {
            // Sin hueco — se suelta (§2/§3), no se queda esperando.
            await tx.npcState.update({ where: { id: state.id }, data: { capturaJaulaBuildingId: null } });
            return { kind: 'sin-hueco' as const };
          }
        }

        const created = await tx.companion.create({
          data: {
            saveId: save.id,
            name: request.body.name ?? npc.name,
            role: request.body.role ?? (esFauna ? 'mascota' : 'aliado'),
            notes: request.body.notes ?? '',
            tipo: esFauna ? 'FAUNA' : 'NPC',
            sourceSlug: npc.slug,
            felicidad: state.capturaFelicidad,
            esSlotDomador,
            // Bug real (auditoría de deuda técnica 2026-08-25): este campo nunca se rellenaba pese a
            // que el comentario del modelo (schema.prisma) ya prometía "se copia tal cual el
            // attributes del Npc de catálogo origen" — sin esto, `datosVivosDe`
            // (combateMultipleOrquestacion.ts) descarta SIEMPRE a cualquier compañero de un
            // CombatEncounter (`!companion.attributes` → null), así que ningún compañero podía luchar
            // nunca. Se guarda el bloque CRUDO (nivel 1) — el escalado por nivel del Npc origen se
            // aplica en el momento de combatir, no aquí.
            attributes: npc.attributes as object,
          },
        });
        // Libera la Jaula (si venía de fauna) — ya no está "en proceso", ahora es un Companion real.
        if (state.capturaJaulaBuildingId) await tx.npcState.update({ where: { id: state.id }, data: { capturaJaulaBuildingId: null } });
        return { kind: 'ok' as const, companion: created };
      });

      if (outcome.kind === 'sin-hueco') {
        return reply.status(409).send({ error: 'No tienes ningún slot de compañero libre — se suelta.' });
      }
      return { companion: outcome.companion };
    },
  );

  /// Soltar — abandona el proceso a medias (o forzado por falta de slot, ver /confirmar arriba).
  /// Deja `capturado: true` (mismo criterio que `saqueado`: no vuelve a ofrecerse capturar dos
  /// veces al mismo individuo) pero libera la Jaula.
  app.post<{ Params: { id: string; npcSlug: string } }>('/saves/:id/tameo-pendientes/:npcSlug/soltar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    const npc = await prisma.npc.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: request.params.npcSlug } } });
    if (!npc) return reply.status(404).send({ error: 'Objetivo no encontrado' });
    await prisma.npcState.updateMany({ where: { saveId: save.id, npcId: npc.id, capturado: true }, data: { capturaJaulaBuildingId: null } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════════════════
  // § 6 — Equipo de compañero (mismo patrón que PATCH /saves/:id/inventario/:itemId,
  // inventario.ts, con las ranuras reducidas de fauna y sin restricción de clase/requisitos —
  // eso es solo del propio personaje jugable).
  // ═══════════════════════════════════════════════════════════════════════

  app.patch<{ Params: { id: string; companionId: string; itemId: string }; Body: { slot: EquipSlot | null } }>(
    '/saves/:id/companeros/:companionId/equipo/:itemId',
    async (request, reply) => {
      const { slot } = request.body;
      if (slot !== null && !Object.values(EquipSlot).includes(slot)) return reply.status(400).send({ error: `Ranura no válida: "${slot}"` });

      const companion = await prisma.companion.findFirst({ where: { id: request.params.companionId, saveId: request.params.id } });
      if (!companion) return reply.status(404).send({ error: 'Compañero no encontrado' });
      const item = await prisma.inventoryItem.findFirst({ where: { id: request.params.itemId, saveId: request.params.id, companionId: null, subjectId: null } });
      if (!item) return reply.status(404).send({ error: 'Objeto no encontrado (o ya equipado en otro sitio)' });

      if (slot && companion.tipo === 'FAUNA' && !FAUNA_EQUIP_SLOTS.includes(slot)) {
        return reply.status(400).send({ error: `Esta mascota solo puede llevar: ${FAUNA_EQUIP_SLOTS.join(', ')}.` });
      }
      if (slot && item.catalogSlug) {
        const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { worldId: true } });
        const catalogItem = save ? await prisma.itemCatalog.findFirst({ where: { worldId: save.worldId, slug: item.catalogSlug } }) : null;
        if (catalogItem && (!catalogItem.equipSlot || !equipSlotFamily(catalogItem.equipSlot).includes(slot))) {
          return reply.status(400).send({ error: `"${item.name}" no se puede equipar ahí — va en ${catalogItem.equipSlot}, no en ${slot}.` });
        }
      }

      await prisma.$transaction([
        ...(slot
          ? [
              prisma.inventoryItem.updateMany({
                where: { saveId: request.params.id, companionId: companion.id, slot: { in: equipSlotFamily(slot) }, NOT: { id: item.id } },
                data: { slot: null },
              }),
            ]
          : []),
        prisma.inventoryItem.update({ where: { id: item.id }, data: { slot, companionId: slot ? companion.id : null } }),
      ]);
      return { id: item.id, slot, companionId: slot ? companion.id : null };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════
  // § 7 — Almacén de Reino + Plantillas de equipo
  // ═══════════════════════════════════════════════════════════════════════

  /// Depositar un objeto de la mochila personal en el Almacén — dispara el auto-equipo inmediato
  /// (§7: "cada súbdito con una plantilla asignada se auto-equipa en cuanto haya en el almacén un
  /// objeto que encaje").
  app.post<{ Params: { id: string; itemId: string } }>('/saves/:id/almacen/depositar/:itemId', async (request, reply) => {
    const item = await prisma.inventoryItem.findFirst({ where: { id: request.params.itemId, saveId: request.params.id, slot: null, companionId: null, subjectId: null } });
    if (!item) return reply.status(404).send({ error: 'Objeto no encontrado (o ya equipado)' });

    const result = await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.delete({ where: { id: item.id } });
      await tx.almacenItem.create({
        data: { saveId: request.params.id, name: item.name, description: item.description, catalogSlug: item.catalogSlug, statBonuses: item.statBonuses ?? undefined },
      });
      return autoEquiparDesdeAlmacen(tx, request.params.id);
    });
    return { ok: true, autoEquipados: result.equipados };
  });

  /// Retirar un objeto del Almacén de vuelta a la mochila personal, sin equiparlo.
  app.post<{ Params: { id: string; almacenItemId: string } }>('/saves/:id/almacen/retirar/:almacenItemId', async (request, reply) => {
    const item = await prisma.almacenItem.findFirst({ where: { id: request.params.almacenItemId, saveId: request.params.id } });
    if (!item) return reply.status(404).send({ error: 'Objeto no encontrado en el Almacén' });
    await prisma.$transaction([
      prisma.almacenItem.delete({ where: { id: item.id } }),
      prisma.inventoryItem.create({
        data: { saveId: request.params.id, name: item.name, description: item.description, catalogSlug: item.catalogSlug, statBonuses: item.statBonuses ?? undefined, origin: 'Almacén de Reino' },
      }),
    ]);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { name: string; rol: string; personalizada?: boolean; slots: PlantillaSlots; prioridad?: number } }>(
    '/saves/:id/plantillas',
    async (request, reply) => {
      const { name, rol, personalizada, slots, prioridad } = request.body;
      if (!name || !rol || !slots) return reply.status(400).send({ error: 'Faltan campos: name, rol, slots' });
      const created = await prisma.plantillaEquipo.create({
        data: { saveId: request.params.id, name, rol, personalizada: personalizada ?? true, slots: slots as object, prioridad: prioridad ?? 0 },
      });
      return created;
    },
  );

  app.patch<{ Params: { id: string; plantillaId: string }; Body: { name?: string; rol?: string; slots?: PlantillaSlots; prioridad?: number } }>(
    '/saves/:id/plantillas/:plantillaId',
    async (request, reply) => {
      const plantilla = await prisma.plantillaEquipo.findFirst({ where: { id: request.params.plantillaId, saveId: request.params.id } });
      if (!plantilla) return reply.status(404).send({ error: 'Plantilla no encontrada' });
      const updated = await prisma.plantillaEquipo.update({
        where: { id: plantilla.id },
        data: {
          name: request.body.name,
          rol: request.body.rol,
          slots: request.body.slots ? (request.body.slots as object) : undefined,
          prioridad: request.body.prioridad,
        },
      });
      // Reasignar puede haber destapado huecos nuevos que ya se pueden rellenar del Almacén.
      await prisma.$transaction((tx) => autoEquiparDesdeAlmacen(tx, request.params.id));
      return updated;
    },
  );

  app.delete<{ Params: { id: string; plantillaId: string } }>('/saves/:id/plantillas/:plantillaId', async (request, reply) => {
    const plantilla = await prisma.plantillaEquipo.findFirst({ where: { id: request.params.plantillaId, saveId: request.params.id } });
    if (!plantilla) return reply.status(404).send({ error: 'Plantilla no encontrada' });
    await prisma.plantillaEquipo.delete({ where: { id: plantilla.id } });
    return { ok: true };
  });

  /// Asigna/quita una plantilla a un compañero integrado en el Reino (`rolReino`).
  app.post<{ Params: { id: string; companionId: string }; Body: { plantillaEquipoId: string | null; rolReino?: string } }>(
    '/saves/:id/companeros/:companionId/plantilla',
    async (request, reply) => {
      const companion = await prisma.companion.findFirst({ where: { id: request.params.companionId, saveId: request.params.id } });
      if (!companion) return reply.status(404).send({ error: 'Compañero no encontrado' });
      await prisma.companion.update({
        where: { id: companion.id },
        data: { plantillaEquipoId: request.body.plantillaEquipoId, rolReino: request.body.rolReino ?? companion.rolReino },
      });
      await prisma.$transaction((tx) => autoEquiparDesdeAlmacen(tx, request.params.id));
      return { ok: true };
    },
  );

  /// Asigna/quita una plantilla a un súbdito de Reino.
  app.post<{ Params: { id: string; subjectId: string }; Body: { plantillaEquipoId: string | null } }>(
    '/saves/:id/subjects/:subjectId/plantilla',
    async (request, reply) => {
      const subject = await prisma.subject.findFirst({ where: { id: request.params.subjectId, saveId: request.params.id } });
      if (!subject) return reply.status(404).send({ error: 'Súbdito no encontrado' });
      await prisma.subject.update({ where: { id: subject.id }, data: { plantillaEquipoId: request.body.plantillaEquipoId } });
      await prisma.$transaction((tx) => autoEquiparDesdeAlmacen(tx, request.params.id));
      return { ok: true };
    },
  );
}
