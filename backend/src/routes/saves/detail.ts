import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { maxCombatAbilitiesFor } from '../../services/progression.js';
import { energiaMaxFor } from '../../services/energy.js';
import { destinationsFrom } from '../../services/travel.js';
import { type Requisitos } from '../../services/requisitos.js';
import { scopeFor } from '../../services/npcScene.js';
import { effectiveAttributes, effectiveSecondaryAttributes, type StatBonusMap } from '../../services/equipment.js';
import { imageUrlsFor } from '../../lib/imageAssets.js';
import type { AttributeBlock } from '../../services/dice.js';
import { normalizeSecondaryAttributes } from '../../services/secondaryAttributes.js';
import { toFrontendLogEntry } from './shared.js';

export async function detailRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/saves/:id', async (request, reply) => {
    // Ventana de 24h de juego (rework 2026-07-24, petición explícita: "el log de personaje solo
    // muestre 24h del mundo") — antes esta consulta cargaba TODAS las LogEntry desde el principio
    // de la partida, sin límite, cada vez que se abría o recargaba la página. `fictionalMinutes`
    // (minuto de ficción real en el momento de crear la entrada, no el reloj real) es lo que
    // decide la ventana, no `createdAt` — coherente con que el reloj del propio juego es el que
    // avanza por turnos, no por tiempo real transcurrido fuera de la partida. El registro completo
    // sigue disponible, agrupado por día, en GET /saves/:id/diario.
    const worldStatePeek = await prisma.worldState.findUnique({ where: { saveId: request.params.id }, select: { fictionalMinutes: true } });
    const logWindowStart = (worldStatePeek?.fictionalMinutes ?? 480) - 24 * 60;

    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: {
        world: true,
        worldState: true,
        logEntries: { where: { fictionalMinutes: { gte: logWindowStart } }, orderBy: { createdAt: 'asc' } },
        inventoryItems: { orderBy: { createdAt: 'asc' } },
        companions: { orderBy: { createdAt: 'asc' } },
        territories: { orderBy: { acquiredAt: 'asc' } },
        buildings: { orderBy: { createdAt: 'asc' } },
        subjects: { orderBy: { createdAt: 'asc' } },
        characterTransit: true,
        savedActions: { orderBy: { createdAt: 'asc' } },
        currentLocation: true,
        quests: { orderBy: { createdAt: 'asc' } },
        sessionSummaries: { orderBy: { chapterNumber: 'asc' } },
        professionProgress: true,
        kingdomStats: true,
      },
    });

    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    // Tier/requisitos de equipar (sesión de diseño 2026-07-23) — viven en ItemCatalog, no en la
    // fila de InventoryItem; se resuelven aquí por `catalogSlug` para no repetir la consulta por
    // objeto. Objetos sin `catalogSlug` (narrativos sueltos, `newItem` del modelo) quedan sin tier.
    const catalogSlugs = [...new Set(save.inventoryItems.map((i) => i.catalogSlug).filter((s): s is string => Boolean(s)))];

    // Solo lo EQUIPADO cuenta para bonificadores (2026-08-03, bug real encontrado de paso: esta
    // consulta trae TODO el inventario sin filtrar por `slot`, a diferencia de turn.ts/worldTick.ts
    // que sí filtran en la propia query — `effectiveAttributes` no filtra por dentro, así que un
    // arma sin equipar en la mochila estaba inflando `energiaMax` más abajo). Mismo criterio que
    // el comentario de `effectiveAttributes`/`effectiveDefense`: la mochila nunca suma.
    const equippedItems = save.inventoryItems.filter((i) => i.slot !== null);

    // Marca de misión en el mapa (punto 3 del diseño de Gistera Koh, 2026-07-23): el mapa necesita
    // saber en qué Location dibujar el "!" — bien la del propio `targetLocationId`, bien la
    // `homeLocationSlug` del `targetNpcId` cuando la misión apunta a un NPC en vez de a un sitio
    // (p.ej. "derrota al Orco Enfurecido", que vive en la Hondonada del Eco).
    const questTargetLocationIds = save.quests.map((q) => q.targetLocationId).filter((id): id is string => Boolean(id));
    const questTargetNpcIds = save.quests.map((q) => q.targetNpcId).filter((id): id is string => Boolean(id));

    // Combate pendiente, reconstruido tras cualquier resincronización (bug real, 2026-07-23,
    // "revisar partida" — ver comentario de `pendingCombatNpcSlugs` en schema.prisma): mismo
    // shape que ya devuelve `/turn/narrate` directamente, para que `syncFromSave` en el frontend
    // pueda reabrir el aviso de "Combatir" aunque la respuesta directa del turno se perdiera.
    const pendingCombatSlugs = (save.pendingCombatNpcSlugs as string[] | null) ?? [];

    // Auditoría de rendimiento 2026-07-28 ("rascar segundos"): estas 5 consultas no dependen entre
    // sí (todas solo leen de `save`, ya resuelto arriba) — antes iban en 5 `await` secuenciales,
    // cada uno pagando su propio viaje de ida y vuelta al pool remoto de Supabase. Este endpoint es
    // el de carga de partida (se dispara en cada apertura/recarga), así que el ahorro se nota en el
    // punto de la sesión donde más se espera antes de poder hacer nada.
    const [destinations, catalogItems, questTargetLocations, questTargetNpcs, pendingCombatNpcs] = await Promise.all([
      // Posición (docs/12-mundo-estructurado.md § 1.6): destinos directos desde la ubicación
      // actual, con tiempos ya ajustados a la destreza del personaje — misma lista cerrada que
      // ve el clasificador, visible también para el jugador en el mapa.
      save.currentLocation ? destinationsFrom(save.currentLocation.id, save.attributes as AttributeBlock) : Promise.resolve([]),
      catalogSlugs.length ? prisma.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: catalogSlugs } } }) : Promise.resolve([]),
      questTargetLocationIds.length ? prisma.location.findMany({ where: { id: { in: questTargetLocationIds } } }) : Promise.resolve([]),
      questTargetNpcIds.length ? prisma.npc.findMany({ where: { id: { in: questTargetNpcIds } } }) : Promise.resolve([]),
      pendingCombatSlugs.length
        ? prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: pendingCombatSlugs } } })
        : Promise.resolve([]),
    ]);
    const catalogItemBySlug = new Map(catalogItems.map((c) => [c.slug, c]));
    const locationSlugById = new Map(questTargetLocations.map((l) => [l.id, l.slug]));
    const npcHomeLocationSlugById = new Map(questTargetNpcs.map((n) => [n.id, n.homeLocationSlug]));

    const pendingCombatStates = pendingCombatNpcs.length
      ? await prisma.npcState.findMany({
          where: {
            saveId: save.id,
            npcId: { in: pendingCombatNpcs.map((n) => n.id) },
          },
        })
      : [];
    const pendingCombatStateByKey = new Map(pendingCombatStates.map((s) => [`${s.npcId}|${s.scope}`, s]));
    // Bug real jugando en vivo (2026-08-01, "el orco que metí volvió a aparecer" / "al reiniciar
    // me empieza en combate" — auditoría a fondo de todos los sitios donde se lee/escribe
    // `pendingCombatNpcSlugs`): este endpoint es justo el que se dispara en CADA apertura/recarga
    // de partida, y reconstruía `combateIniciado` a ciegas a partir del campo persistido, sin mirar
    // si el NPC ya está saqueado del todo (nada que hacer con él, ver `saqueado` en NpcState/
    // turnResolution.ts § lootMode). Aunque el resto de fixes de esta sesión ya evitan que
    // `pendingCombatNpcSlugs` vuelva a ensuciarse con un NPC ya resuelto, este filtro es la última
    // línea de defensa — si por lo que sea el campo persistido queda desactualizado (partidas ya
    // creadas antes de esos fixes, por ejemplo), ya no basta para reabrir el aviso de "Combatir".
    const pendingCombatNpcsSinResolver = pendingCombatNpcs.filter(
      (n) => !pendingCombatStateByKey.get(`${n.id}|${scopeFor(n.kind, save.currentLocationId)}`)?.saqueado,
    );
    const combateIniciado = pendingCombatNpcsSinResolver.length
      ? {
          npcs: pendingCombatNpcsSinResolver.map((n) => {
            const state = pendingCombatStateByKey.get(`${n.id}|${scopeFor(n.kind, save.currentLocationId)}`);
            return {
              slug: n.slug,
              name: n.name,
              condicionFisica: state?.condicionFisica ?? 'ILESO',
              saqueado: state?.saqueado ?? false,
              // Saqueo parcial (2026-07-31) — sin esto, recargar la partida a mitad de un saqueo
              // parcial dejaba `lootedItemNames` undefined en el frontend (NpcInSceneInfo lo exige
              // siempre), rompiendo el filtro del modal de saqueo (CombatPanel.tsx).
              lootedItemNames: state?.lootedItemNames ?? [],
            };
          }),
        }
      : null;

    return {
      id: save.id,
      worldSlug: save.world.slug,
      worldName: save.world.name,
      characterName: save.characterName,
      characterArchetype: save.characterArchetype,
      characterOrigin: save.characterOrigin,
      characterMotivation: save.characterMotivation,
      attributes: save.attributes,
      secondaryAttributes: effectiveSecondaryAttributes(normalizeSecondaryAttributes(save.secondaryAttributes), equippedItems),
      portraitInitial: save.portraitInitial,
      fictionalDateLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      // Reputación de facción (roadmap 2026-07-19) — expuesto ya aunque todavía no haya panel
      // dedicado en el frontend, para poder inspeccionarlo mientras se decide esa UI.
      factionsStatus: (save.worldState?.factionsStatus as Record<string, number> | null) ?? {},
      characterLog: save.logEntries.filter((e) => e.channel === 'CHARACTER').map(toFrontendLogEntry),
      worldLog: save.logEntries.filter((e) => e.channel === 'WORLD').map(toFrontendLogEntry),
      inventory: save.inventoryItems.map((i) => {
        const catalogItem = i.catalogSlug ? catalogItemBySlug.get(i.catalogSlug) : undefined;
        return {
          id: i.id,
          name: i.name,
          description: i.description,
          origin: i.origin,
          slot: i.slot,
          statBonuses: i.statBonuses as StatBonusMap | null,
          catalogSlug: i.catalogSlug,
          tier: catalogItem?.tier,
          requisitos: catalogItem?.requisitos as Requisitos | null | undefined,
          // Ranura de equipo real (2026-07-30, "categorizar por ranura") — para que el frontend
          // filtre el selector de equipo por compatibilidad real, no deje elegir cualquier hueco.
          equipSlot: catalogItem?.equipSlot ?? null,
          // Categorización mecánica (2026-07-29) — mismo catalogItemBySlug de siempre, dos
          // campos más para que el frontend pueda agrupar/filtrar por tipo/categoría real.
          tipo: catalogItem?.tipo,
          category: catalogItem?.category,
          // Efecto especial (2026-08-03, `tipo: ESPECIAL`) — mismo criterio que tier/requisitos:
          // siempre la definición ACTUAL del catálogo, nunca una foto congelada en InventoryItem.
          effectKey: catalogItem?.effectKey ?? null,
          effectDescription: catalogItem?.effectDescription ?? null,
          // Imagen real de la Enciclopedia (petición explícita de la usuaria, 2026-07-24: "las
          // imágenes no salen" al ver un objeto desde Inventario/Equipo) — `DetailModal.tsx`
          // (kind:'item') nunca recibía esto, así que solo mostraba el emoji genérico aunque la
          // misma entidad ya tuviera banner real subido y visible desde la Enciclopedia.
          imageUrls: i.catalogSlug ? imageUrlsFor('item', i.catalogSlug) : undefined,
        };
      }),
      companions: save.companions.map((c) => ({ id: c.id, name: c.name, role: c.role, notes: c.notes })),
      level: save.level,
      xp: save.xp,
      pendingAttributePoints: save.pendingAttributePoints,
      kingdomName: save.kingdomName,
      territories: save.territories.map((t) => ({
        id: t.id,
        name: t.name,
        region: t.region,
        description: t.description,
        control: t.control,
        population: t.population,
      })),
      buildings: save.buildings.map((b) => ({
        id: b.id,
        territoryId: b.territoryId,
        locationId: b.locationId,
        recipeKey: b.recipeKey,
        tier: b.tier,
        name: b.name,
        kind: b.kind,
        status: b.status,
        description: b.description,
      })),
      subjects: save.subjects.map((s) => ({
        id: s.id,
        territoryId: s.territoryId,
        name: s.name,
        role: s.role,
        notes: s.notes,
      })),
      // `duracionMinutos` (2026-07-30, petición explícita de la usuaria: mostrar tiempo real Y
      // ficticio juntos en la espera) — se lee de `zoneContext` (guardado por turn.ts al crear el
      // CharacterTransit) en vez de recalcularlo aquí; puede faltar en transits creados antes de
      // este cambio, de ahí el `?? null`.
      transit: save.characterTransit
        ? {
            activity: save.characterTransit.activity,
            busyUntil: save.characterTransit.busyUntil.toISOString(),
            duracionMinutos: (save.characterTransit.zoneContext as { duracionMinutos?: number } | null)?.duracionMinutos ?? null,
          }
        : null,
      savedActions: save.savedActions.map((a) => ({
        id: a.id,
        name: a.name,
        promptText: a.promptText,
        icon: a.icon,
        description: a.description,
        isStarting: a.isStarting,
        // Rediseño de habilidades por arma (2026-07-29) — igual que `isStarting`, marca una
        // habilidad como no editable/borrable por la jugadora (ver DetailModal.tsx), pero
        // resincronizada sola en vez de fija de por vida.
        isDynamic: a.isDynamic,
        category: a.category,
        // Rediseño del turno de combate (2026-07-28) — "tipo" para colorear el chip en la UI;
        // null en habilidades 'general' o en partidas anteriores a este campo.
        preferredAttribute: a.preferredAttribute,
        // Sistema de fatiga (2026-07-29) — coste de energía para deshabilitar el botón en la UI
        // cuando no alcanza (ver CombatPanel.tsx).
        energyCost: a.energyCost,
        // Rediseño 2026-07-31 — energía que recupera (Defenderse/Esquivar); 0 en el resto.
        energyRegen: a.energyRegen,
        // Rediseño 2026-07-31 — marca Ataque Básico/Defenderse/Esquivar para su bloque propio en
        // la UI, en vez de la vieja heurística `energyCost === 0` (dejó de servir en cuanto Ataque
        // Básico pasó a costar 5).
        isGeneric: a.isGeneric,
        // Rediseño 2026-07-31 — habilidad real por categoría de arma colapsada por llevar la
        // misma en las dos manos (ver weaponAbilities.ts § DUAL_WIELD_DIFFICULTY_BONUS).
        dualWield: a.dualWield,
      })),
      habilidadSlots: maxCombatAbilitiesFor(save.level),
      profession: save.profession,
      professionProgress: save.professionProgress.map((p) => ({ professionId: p.professionId, nivel: p.nivel, xp: p.xp })),
      kingdomStats: save.kingdomStats
        ? {
            poblacion: save.kingdomStats.poblacion,
            felicidad: save.kingdomStats.felicidad,
            comida: save.kingdomStats.comida,
            bebida: save.kingdomStats.bebida,
            riqueza: save.kingdomStats.riqueza,
            soldados: save.kingdomStats.soldados,
            trabajadores: save.kingdomStats.trabajadores,
            visitantes: save.kingdomStats.visitantes,
          }
        : null,
      currentLocation: save.currentLocation
        ? {
            id: save.currentLocation.id,
            slug: save.currentLocation.slug,
            name: save.currentLocation.name,
            region: save.currentLocation.region,
            description: save.currentLocation.description,
          }
        : null,
      destinations: destinations.map((d) => ({ locationId: d.locationId, slug: d.slug, name: d.name, minutos: d.minutos })),
      condicionFisica: save.condicionFisica,
      salud: save.salud,
      // Sistema de fatiga (2026-07-29) — `energia` es el valor real persistido; `energiaMax` se
      // deriva de Constitución EFECTIVA (con equipo, mismo criterio que narrateAndPersistTurn),
      // nunca se persiste (evita que desincronice si sube el atributo o cambia de equipo).
      energia: save.energia,
      energiaMax: energiaMaxFor(effectiveAttributes(save.attributes as AttributeBlock, equippedItems).constitucion),
      dificultad: save.dificultad,
      deathCount: save.deathCount,
      endedAt: save.endedAt?.toISOString() ?? null,
      quests: save.quests.map((q) => {
        // Dos pasos en vez de un único `??` anidado en tres niveles (bug real, auditoría
        // 2026-07-30: TS 6.0.2 marca la versión de una sola expresión como "always nullish"
        // — falso positivo del checker sobre este patrón concreto de ternario+`??` anidado,
        // confirmado con un repro aislado; separado en dos `const` para no depender de una
        // rareza de una versión concreta del compilador).
        const fromLocation = q.targetLocationId ? locationSlugById.get(q.targetLocationId) : undefined;
        const fromNpc = q.targetNpcId ? npcHomeLocationSlugById.get(q.targetNpcId) : undefined;
        return {
          id: q.id,
          title: q.title,
          description: q.description,
          status: q.status,
          objetivo: q.objetivo,
          rewardXp: q.rewardXp,
          rewardItems: q.rewardItems,
          targetLocationSlug: fromLocation ?? fromNpc ?? null,
        };
      }),
      chapters: save.sessionSummaries.map((c) => ({ chapterNumber: c.chapterNumber, summary: c.summary })),
      combateIniciado,
    };
  });
}
