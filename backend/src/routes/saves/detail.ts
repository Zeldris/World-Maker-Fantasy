import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { maxCombatAbilitiesFor } from '../../services/progression.js';
import { energiaMaxFor } from '../../services/energy.js';
import { destinationsFrom } from '../../services/travel.js';
import { type Requisitos } from '../../services/requisitos.js';
import { scopeFor } from '../../services/npcScene.js';
import { effectiveAttributes, effectiveSecondaryAttributes, attributeBonusesFromEquipment, type StatBonusMap } from '../../services/equipment.js';
import { imageUrlsFor, iconoUrlFor } from '../../lib/imageAssets.js';
import type { AttributeBlock } from '../../services/dice.js';
import { normalizeSecondaryAttributes } from '../../services/secondaryAttributes.js';
import { toFrontendLogEntry } from './shared.js';
import { comidaPct, aguaPct } from '../../services/companionSupervivencia.js';
import { parseActiveEffects } from '../../services/activeEffects.js';
import { instanceNumbersByParticipantId } from '../../services/combateMultiple.js';
import { entornoTemporalFor } from '../../services/worldClock.js';
import { parseAgenda } from '../../services/worldAgenda.js';
import type { PendingDynamicMode } from '../../services/dynamicMode.js';
import { resolveActiveCombatAbilityNames } from '../../services/combatAbilities.js';
import { sanitizeSkillBarAbilityNames, hasBaseSkillBar, SKILL_BAR_CATEGORIES, type SkillBarCategory } from '../../services/skillBars.js';
import { especializacionesConHuecosPara, resumenMecanicoEspecializacion, clasesPermitidasParaRaza, CLASE_DESCRIPTION } from '../../services/classAbilities.js';
import { NIVEL_MINIMO_ESPECIALIZACION } from './progression.js';

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
        almacenItems: { orderBy: { createdAt: 'asc' } },
        plantillasEquipo: { orderBy: { createdAt: 'asc' } },
        skillBars: { orderBy: [{ slotIndex: 'asc' }] },
        characterTransit: true,
        savedActions: { orderBy: { createdAt: 'asc' } },
        currentLocation: true,
        quests: { orderBy: { createdAt: 'asc' } },
        professionProgress: true,
        kingdomStats: true,
      },
    });

    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    // Barras de habilidades múltiples (2026-09-04, rediseñado 2026-09-06 — hallazgo 10: 3 barras EN
    // GENERAL, sin categoría) — reconciliación en lectura, no migración de datos: partidas creadas
    // antes de este sistema (o cualquier fila borrada por error) nunca deben quedarse sin ninguna
    // barra base. `skipDuplicates` hace esto seguro ante llamadas casi simultáneas (dos pestañas,
    // doble recarga) sin condición de carrera real.
    if (!hasBaseSkillBar(save.skillBars)) {
      await prisma.skillBar.createMany({
        data: [{ saveId: save.id, slotIndex: 0, name: 'Barra 1' }],
        skipDuplicates: true,
      });
      save.skillBars = await prisma.skillBar.findMany({ where: { saveId: save.id }, orderBy: [{ slotIndex: 'asc' }] });
    }

    // Log de Reino SIN ventana de 24h (auditoría de código 2026-08-17: `save.logEntries` de arriba
    // ya viene recortado por `logWindowStart`, pensado para el feed continuo de personaje/mundo —
    // los hitos de Reino (fundar/mejorar Ayuntamiento, levantar Campamento) son raros y deberían
    // seguir visibles como buildings/territories, no desaparecer del panel a las 24h de juego).
    const kingdomLogEntries = await prisma.logEntry.findMany({
      where: { saveId: save.id, channel: 'KINGDOM' },
      orderBy: { createdAt: 'asc' },
    });

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
    const [destinations, catalogItems, questTargetLocations, questTargetNpcs, pendingCombatNpcs, activeCombatEncounter] = await Promise.all([
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
      // `CombatEncounter` de grupo real (2026-08-27, bug real jugando: "ataqué a los dos buitres a
      // la vez" — recargar la partida a mitad de un combate de grupo perdía el `participantId`/
      // `instanceNumber` de cada individuo, reconstruyendo solo por `pendingCombatNpcSlugs`, que no
      // distingue combatientes con el mismo Npc de catálogo). Mismo criterio que
      // `turnResolution.ts` (`activeCombatEncounter`, línea ~2445): `EN_CURSO` + `jugable` (el
      // único sub-combate que la jugadora ve en directo).
      prisma.combatEncounter.findFirst({ where: { saveId: save.id, estado: 'EN_CURSO', jugable: true } }),
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
    //
    // BUG REAL CERRADO (2026-08-29, reverificación en vivo con Playwright): para FAUNA
    // (`ataqueNatural` truthy, mismo marcador que `carcassCandidatesFor` en recolectar.ts) YA
    // MUERTA este filtro dejaba un candado circular sin salida — un Kirelon Arenoso MUERTO nunca
    // pasa por "Saquear todo" (ese botón del resumen de combate, `CombatPanel.tsx`, solo cuenta
    // NPCs presentes en `enciclopedia.npcs`, es decir humanoides; fauna se despieza por Desollar,
    // un mecanismo aparte). Con `saqueado` siempre `false` para fauna, `combateIniciado` nunca se
    // vaciaba, y el aviso pasivo de Desollar (`GameView.tsx`, "Hay presas caídas sin desollar")
    // exige `!combateIniciado` para aparecer — el jugador quedaba entre un botón "Salir" que no
    // limpiaba nada y un botón "Combatir" que solo reabría la misma pantalla de victoria sin
    // ninguna opción de desuello. Fauna MUERTA nunca cuenta como "pendiente de resolver" aquí — su
    // resolución real es Desollar, que vive fuera de `combateIniciado` a propósito.
    //
    // BUG REAL CERRADO (2026-09-03, "combate fantasma" — reverificando en vivo con Playwright tras
    // el fix de reveal ambiental de la Pieza 4 de esta misma sesión): el fix de arriba usaba
    // `n.ataqueNatural` (un campo de TEXTO descriptivo, ej. Ruptidar: `"No ataca."`) como si fuera
    // un booleano de "esta fauna ya está resuelta" — cualquier string no vacío es truthy en JS, así
    // que un combate REAL EN CURSO contra esa fauna (con tirada/golpe conectado/XP concedido de
    // verdad, `Save.pendingCombatNpcSlugs` activo) quedaba excluido de `combateIniciado` igual que
    // si ya estuviera muerta — `GET /saves/:id` devolvía `combateIniciado: null` sin ningún botón
    // "Combatir" visible (0 encontrados jugando), sin ninguna vía de UI para resolverlo. El
    // criterio correcto es mirar la `condicionFisica` REAL del `NpcState` — solo excluir cuando de
    // verdad está `MUERTO`, nunca por la mera presencia de texto en `ataqueNatural`.
    const pendingCombatNpcsSinResolver = pendingCombatNpcs.filter((n) => {
      const state = pendingCombatStateByKey.get(`${n.id}|${scopeFor(n.kind, save.currentLocationId)}`);
      if (n.ataqueNatural && state?.condicionFisica === 'MUERTO') return false;
      return !state?.saqueado;
    });
    // `CombatEncounter` de grupo real activo (2026-08-27) — reconstruye `combateIniciado` a partir
    // de sus `CombatParticipant` reales (mismo shape/algoritmo que `turnResolution.ts`, incluido
    // `participantId`/`instanceNumber`) en vez de `pendingCombatNpcSlugs`, que no distingue
    // combatientes con el mismo Npc de catálogo — ver comentario largo de la consulta arriba.
    const combatParticipantesReales = activeCombatEncounter
      ? await prisma.combatParticipant.findMany({ where: { encounterId: activeCombatEncounter.id } })
      : [];
    const combatEnemigoNpcIds = combatParticipantesReales.filter((p) => p.tipo === 'NPC' && p.npcId).map((p) => p.npcId!);
    const combatEnemigoNpcRows = combatEnemigoNpcIds.length
      ? await prisma.npc.findMany({ where: { id: { in: combatEnemigoNpcIds } }, select: { id: true, slug: true, name: true, atributoResistencia: true } })
      : [];
    const combatNpcRowById = new Map(combatEnemigoNpcRows.map((n) => [n.id, n]));
    const combatSoloNpcIds = combatParticipantesReales
      .filter((p) => p.tipo === 'NPC' && p.npcId && p.condicionFisicaGrupo === null)
      .map((p) => p.npcId!);
    const combatSoloStates = combatSoloNpcIds.length
      ? await prisma.npcState.findMany({ where: { saveId: save.id, npcId: { in: combatSoloNpcIds } } })
      : [];
    const combatSoloStateByNpcId = new Map(combatSoloStates.map((s) => [s.npcId, s]));
    // Bug real jugando en vivo (2026-08-29, primer combate múltiple real): la tarjeta MATAR/
    // CLEMENTE de un individuo de grupo ya resuelto (Clemente/Capturar) reaparecía tras recargar —
    // este endpoint reconstruía `combateIniciado` desde `CombatParticipant` sin mirar si la
    // jugadora ya decidió su suerte. `dismissedGrupo` (ver comentario de la columna en
    // schema.prisma) es la señal real que Clemente/Capturar ahora escriben para un miembro de
    // grupo — igual que fauna MUERTA se excluye arriba por su propio motivo, un participante ya
    // resuelto por decisión de la jugadora nunca vuelve a la tarjeta pendiente.
    const combatEnemigosParaDisplay = combatParticipantesReales.filter(
      (p) => p.tipo === 'NPC' && p.npcId && combatNpcRowById.has(p.npcId) && !p.dismissedGrupo,
    );
    const combatInstanceNumberByParticipantId = instanceNumbersByParticipantId(
      combatEnemigosParaDisplay.map((p) => ({ participantId: p.id, npcId: p.npcId! })),
    );

    const combateIniciado = activeCombatEncounter
      ? {
          npcs: combatEnemigosParaDisplay.map((p) => {
            const npcRow = combatNpcRowById.get(p.npcId!)!;
            const state = p.condicionFisicaGrupo === null ? combatSoloStateByNpcId.get(p.npcId!) : undefined;
            return {
              slug: npcRow.slug,
              name: npcRow.name,
              condicionFisica: p.condicionFisicaGrupo ?? state?.condicionFisica ?? 'ILESO',
              saqueado: state?.saqueado ?? false,
              lootedItemNames: state?.lootedItemNames ?? [],
              // "Analizar Rival" real en combate múltiple (2026-08-27) — miembro de grupo lee de su
              // propio `CombatParticipant.analizadoGrupo` (`state` es `undefined` para él, ver
              // comentario de la columna en schema.prisma).
              analizado: p.condicionFisicaGrupo !== null ? (p.analizadoGrupo ?? false) : (state?.analizado ?? false),
              capturable: npcRow.atributoResistencia !== null,
              activeEffects: parseActiveEffects(state?.activeEffects),
              participantId: p.id,
              instanceNumber: combatInstanceNumberByParticipantId.get(p.id) ?? null,
            };
          }),
        }
      : pendingCombatNpcsSinResolver.length
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
              // Rediseño de combate (2026-08-09, "Analizar rival") — mismo campo que ya manda
              // turnResolution.ts en la respuesta directa del turno; sin esto, recargar la partida
              // a mitad de combate perdía el desbloqueo de la ficha del rival hasta el próximo golpe.
              analizado: state?.analizado ?? false,
              // Mismo campo que turnResolution.ts (2026-08-26, "el botón Capturar no debería salir
              // si el NPC no es capturable") — gatea el botón "Capturar" de la tarjeta Matar/
              // Capturar/Clemente también tras recargar la partida a mitad de combate.
              capturable: n.atributoResistencia !== null,
              // Fase 2 de efectos de clase (2026-08-27, indicador de combate) — mismo criterio que
              // el resto de campos de aquí: recargar la partida a mitad de combate no debe perder
              // un AUMENTO/DEBILIDAD ya activo.
              activeEffects: parseActiveEffects(state?.activeEffects),
              // "Matar" persistido (2026-09-05, bug real: se perdía al recargar) — mismo criterio
              // que `analizado`: sin esto, recargar tras pulsar Matar volvía a mostrar la tarjeta
              // MATAR/CLEMENTE y bloqueaba el composer de nuevo.
              targetedForKill: state?.targetedForKill ?? false,
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
      // Desglose base/equipo (2026-08-14, petición explícita: barra de atributos jugables con
      // tramo claro=base y tramo oscuro=bonus de equipo, con tooltip "Base: X · Equipo: +Y") — a
      // diferencia de `secondaryAttributes` de abajo, aquí SÍ hace falta mandar el bonus aparte
      // porque `attributes` ya viaja como el base puro (ver comentario histórico de
      // `effectiveAttributes` más abajo, línea ~289: nunca se expuso el efectivo de los 7
      // jugables en esta ficha, solo se usaba internamente para energiaMax).
      attributeBonuses: attributeBonusesFromEquipment(equippedItems),
      secondaryAttributes: effectiveSecondaryAttributes(normalizeSecondaryAttributes(save.secondaryAttributes), equippedItems),
      portraitInitial: save.portraitInitial,
      fictionalDateLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      // Estación/clima (2026-08-27, auditoría backend↔frontend: "ni siquiera llegan a la
      // narración, mucho menos a un panel", pese a bloquear recolección/crafteo de verdad) —
      // recalculado siempre fresco a partir de `fictionalMinutes`, mismo criterio que
      // `fictionalDateLabel`, nunca guardado aparte.
      entorno: entornoTemporalFor(save.worldState?.fictionalMinutes ?? 480, save.currentLocation?.region ?? null, save.raza),
      // WorldState.agenda (2026-08-27, auditoría backend↔frontend + diseño/UX § 2.3: "solo llega
      // como prosa ocasional inyectada a sessionFacts, nunca como dato estructurado") — hitos de
      // mundo reales, expuestos tal cual (id/title/stage/maxStage), sin filtrar ninguno todavía
      // (hoy solo hay uno, el conflicto Serhu-Concordia vs Helsig/Goshg).
      worldAgenda: parseAgenda(save.worldState?.agenda),
      // Reputación de facción (roadmap 2026-07-19) — expuesto ya aunque todavía no haya panel
      // dedicado en el frontend, para poder inspeccionarlo mientras se decide esa UI.
      factionsStatus: (save.worldState?.factionsStatus as Record<string, number> | null) ?? {},
      characterLog: save.logEntries.filter((e) => e.channel === 'CHARACTER').map(toFrontendLogEntry),
      worldLog: save.logEntries.filter((e) => e.channel === 'WORLD').map(toFrontendLogEntry),
      // Log de Reino (2026-08-17) — canal aparte, alternable con el de mundo en el frontend (uno u
      // otro, nunca los dos a la vez): eventos de fundar/mejorar el Ayuntamiento y levantar
      // construcciones de reino, ver dónde se escribe en turnResolution.ts. Consulta propia sin
      // ventana de 24h (`kingdomLogEntries`, arriba) — no `save.logEntries.filter(...)`.
      kingdomLog: kingdomLogEntries.map(toFrontendLogEntry),
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
          // Datos de curación (2026-08-17, panel "Curar" — startingAbilities.ts) — expuestos para
          // que el frontend pueda mostrar qué hace cada curativo ANTES de elegirlo, mismo criterio
          // que el resto de campos de catálogo de aquí arriba (siempre la definición ACTUAL, nunca
          // una foto congelada). Ver comentario de los campos homónimos en schema.prisma.
          curaHasta: catalogItem?.curaHasta ?? null,
          curaUnPaso: catalogItem?.curaUnPaso ?? false,
          curaEnergia: catalogItem?.curaEnergia ?? null,
          // Habilidad "Comer/Beber" (2026-09-04) — mismo criterio que curaHasta/curaEnergia.
          curaHambre: catalogItem?.curaHambre ?? null,
          // Hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06) — mismo criterio que curaHambre.
          curaAgua: catalogItem?.curaAgua ?? null,
          // Imagen real de la Enciclopedia (petición explícita de la usuaria, 2026-07-24: "las
          // imágenes no salen" al ver un objeto desde Inventario/Equipo) — `DetailModal.tsx`
          // (kind:'item') nunca recibía esto, así que solo mostraba el emoji genérico aunque la
          // misma entidad ya tuviera banner real subido y visible desde la Enciclopedia.
          imageUrls: i.catalogSlug ? imageUrlsFor('item', i.catalogSlug) : undefined,
          // Grupo 3 § Compañeros y supervivencia (2026-08-25) — ambos null = equipado en el propio
          // personaje o sin equipar (comportamiento de siempre); el frontend los usa para saber
          // qué objetos están ya puestos en QUÉ compañero/súbdito concreto.
          companionId: i.companionId,
          subjectId: i.subjectId,
          // Rediseño de captura (2026-08-28) — no null = esta fila ES una captura en tránsito
          // (fauna/NPC atado, sin depositar en Jaula/Celda todavía), ver
          // docs/rpgtarkor/captura-rediseno-2026-08-28.md. El frontend usa esto para mostrar el
          // botón "Depositar"/"Soltar" en vez de las acciones normales de un objeto.
          capturaNpcId: i.capturaNpcId,
          capturaExpiraAtMinutes: i.capturaExpiraAtMinutes,
        };
      }),
      // Felicidad/Comida/Agua (Grupo 3 § Compañeros y supervivencia, 2026-08-25) — `felicidad:
      // null` = compañero de quest/narración libre, sin capa mecánica (comportamiento de siempre,
      // `comida`/`agua`/`esSlotDomador`/`rolReino` se devuelven igual pero el frontend no debe
      // mostrar barras para esos). El resto sí tiene Comida/Agua reales, derivadas en vivo del
      // reloj de ficción — nunca un contador guardado aparte.
      companions: save.companions.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        notes: c.notes,
        tipo: c.tipo,
        felicidad: c.felicidad,
        comida: c.felicidad !== null ? comidaPct(c.lastFedAtMinutes, save.worldState?.fictionalMinutes ?? 0) : null,
        agua: c.felicidad !== null ? aguaPct(c.lastWateredAtMinutes, save.worldState?.fictionalMinutes ?? 0) : null,
        esSlotDomador: c.esSlotDomador,
        rolReino: c.rolReino,
        plantillaEquipoId: c.plantillaEquipoId,
        // B.14 (checklist frontend 2026-08-27) — el campo YA existe en Companion desde el rediseño
        // de combate múltiple (2026-08-25, `combatParticipants`), participa de verdad en combate,
        // pero nunca se exponía aquí: el panel de Compañeros no tenía forma de saber si uno estaba
        // GRAVE/CONVALECIENTE fuera de la pantalla de combate. `null` para compañeros sin capa
        // mecánica (`attributes: null`, de quest/narración libre) — mismo criterio que
        // `comida`/`agua`, su `condicionFisica` de catálogo (ILESO por defecto) no significa nada.
        condicionFisica: c.attributes !== null ? c.condicionFisica : null,
        // Grupos de combate (2026-09-08) — qué grupo entra a combate en directo (solo el 0,
        // "Grupo 1", junto al jugador). El panel de Compañeros lo usa para mostrar en qué grupo
        // está cada uno; la gestión real (mover/renombrar/crear grupos) vive en su propio endpoint
        // (/saves/:id/combat-groups).
        combatGroupSlotIndex: c.combatGroupSlotIndex,
      })),
      level: save.level,
      xp: save.xp,
      goirnos: save.goirnos,
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
        plantillaEquipoId: s.plantillaEquipoId,
      })),
      // Almacén de Reino + Plantillas de equipo (Grupo 3 § Compañeros y supervivencia § 6-7)
      almacenItems: save.almacenItems.map((a) => ({ id: a.id, name: a.name, description: a.description, catalogSlug: a.catalogSlug })),
      plantillasEquipo: save.plantillasEquipo.map((p) => ({
        id: p.id,
        name: p.name,
        personalizada: p.personalizada,
        rol: p.rol,
        slots: p.slots,
        prioridad: p.prioridad,
      })),
      // Hambre/Sed del propio personaje (§5) — derivadas en vivo, igual que Comida/Agua de compañero.
      hambre: comidaPct(save.lastAteAtMinutes, save.worldState?.fictionalMinutes ?? 0),
      sed: aguaPct(save.lastDrankAtMinutes, save.worldState?.fictionalMinutes ?? 0),
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
        // Rediseño de combate (2026-08-09) — ver `enum AbilityRol` (schema.prisma).
        rol: a.rol,
        // Bug real (2026-08-28, "jugando no se ve el +2/+4 de las habilidades de arma/clase"):
        // `attributeBonus` (2026-08-24, clases.md § "Habilidad de daño vs ataque básico") se
        // aplicaba en combate desde siempre pero nunca viajaba hasta el frontend — ni en la ficha
        // de la habilidad ni en el desglose de la tirada (ver combatExchange.ts § ExchangeSideResult).
        attributeBonus: a.attributeBonus,
      })),
      // "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3) — lista YA resuelta
      // (saneada + con el "todas activas" por defecto aplicado si nunca se configuró), lista para
      // que CombatPanel.tsx filtre directo, sin reimplementar la lógica de reconciliación en el
      // frontend. `resolveActiveCombatAbilityNames`, combatAbilities.ts.
      activeCombatAbilityNames: resolveActiveCombatAbilityNames(
        save.activeCombatAbilityNames,
        save.savedActions.filter((a) => a.category === 'combate').map((a) => ({ name: a.name, isGeneric: a.isGeneric })),
        save.activeCombatAbilityNamesConfigured,
      ),
      // Barras de habilidades múltiples (2026-09-04, rediseñado 2026-09-06 — hallazgo 10: sin
      // categoría propia, una barra puede mezclar habilidades de General/Profesión/Reino) —
      // `abilityNames` ya saneado contra las `SavedAction` reales de esas 3 categorías juntas
      // (mismo criterio que `activeCombatAbilityNames` arriba); solo nombres, el frontend resuelve
      // icono/descripción contra `savedActions`, que ya viaja completo en esta misma respuesta.
      skillBars: save.skillBars.map((bar) => ({
        id: bar.id,
        slotIndex: bar.slotIndex,
        name: bar.name,
        abilityNames: sanitizeSkillBarAbilityNames(
          bar.abilityNames,
          save.savedActions.filter((a) => SKILL_BAR_CATEGORIES.includes(a.category as SkillBarCategory)).map((a) => ({ name: a.name })),
        ),
      })),
      activeSkillBarId: save.activeSkillBarId,
      habilidadSlots: maxCombatAbilitiesFor(save.level),
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
            // B.19 (checklist frontend 2026-08-27) — el hallazgo original suponía que un territorio
            // DISPUTADO/PERDIDO se explicaba por el conflicto de facciones (WorldState.agenda), pero
            // son dos sistemas de causalidad DISTINTA: `Territory.control` cambia por felicidad
            // sostenida del propio reino (turnResolution.ts, DIAS_PARA_REBELION/CONSOLIDAR), nunca
            // por el conflicto del mundo. Se expone la causa REAL en vez de inventar un enlace falso.
            diasFelicidadBaja: save.kingdomStats.diasFelicidadBaja,
            diasFelicidadAlta: save.kingdomStats.diasFelicidadAlta,
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
      // Fase 2 de efectos de clase (2026-08-27, indicador de combate en CombatPanel.tsx) — mismo
      // criterio que el resto de campos de este endpoint: recargar la partida a mitad de un
      // AUMENTO/DEBILIDAD activo no debe perderlo hasta el próximo golpe.
      activeEffects: parseActiveEffects(save.activeEffects),
      salud: save.salud,
      // Sistema de fatiga (2026-07-29) — `energia` es el valor real persistido; `energiaMax` se
      // deriva de Constitución EFECTIVA (con equipo, mismo criterio que narrateAndPersistTurn),
      // nunca se persiste (evita que desincronice si sube el atributo o cambia de equipo).
      energia: save.energia,
      energiaMax: energiaMaxFor(effectiveAttributes(save.attributes as AttributeBlock, equippedItems).constitucion),
      dificultad: save.dificultad,
      deathCount: save.deathCount,
      endedAt: save.endedAt?.toISOString() ?? null,
      // Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — para que recargar/reconectar a
      // mitad de una muerte pendiente de resolver siga mostrando el botón, mismo criterio que
      // `endedAt`.
      pendingDeathResolution: save.pendingDeathResolution,
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
      combateIniciado,
      // "Modo dinámico" (checklist frontend 2026-08-27, A.3) — mismo criterio que `combateIniciado`
      // arriba: reconstruido tras CUALQUIER resincronización (F5, reconexión), no solo devuelto en
      // la respuesta directa del turno que lo abrió. Sin esto, recargar con una conversación en
      // curso la hacía desaparecer del frontend aunque siguiera viva en `Save.pendingDynamicMode`.
      pendingDynamicMode: save.pendingDynamicMode as PendingDynamicMode | null,
      // Oferta SIN aceptar todavía (bug real 2026-08-28) — mismo criterio, un escalón antes: el
      // botón "Interactuar"/"Ignorar" en sí, reconstruido tras recargar en vez de vivir solo en el
      // `characterLog` efímero de React.
      pendingDynamicModeOffer: save.pendingDynamicModeOffer as { tipo: 'NPC' | 'FAUNA'; targetSlug: string; targetName: string } | null,
      // Oferta de misión SIN aceptar todavía (bug real jugando en vivo, 2026-09-03: "misión de
      // apertura no sobrevive a un F5") — mismo criterio exacto que `pendingDynamicModeOffer` de
      // arriba: la tarjeta "MISIÓN PROPUESTA" (botones Aceptar/Cancelar) solo vivía en el
      // `characterLog` efímero de React.
      //
      // Bug real jugando en vivo (2026-09-08, "MISIÓN PROPUESTA: UNDEFINED" al abrir la partida,
      // sin haber jugado ningún turno): `turnResolution.ts` ya exige `title?.trim()` al ESCRIBIR
      // este campo (fix del 2026-09-07), pero esta lectura confiaba ciegamente en lo persistido sin
      // repetir la validación — cualquier fila con un `title` vacío/ausente que se hubiera colado
      // antes de ese fix (o por cualquier otro camino de escritura que no pase por ese guard) sigue
      // mostrando la tarjeta rota para siempre, en cada carga, sin que ningún turno nuevo la genere.
      // Filtrada aquí también, en el punto de lectura — nunca confiar solo en la validación de
      // escritura para un campo que persiste indefinidamente hasta que el jugador lo resuelve.
      pendingQuestOfferInfo:
        save.pendingQuestOfferInfo && (save.pendingQuestOfferInfo as { title?: string }).title?.trim()
          ? (save.pendingQuestOfferInfo as { title: string; description: string })
          : null,
      // Menú contextual de interacción con NPC SIN resolver todavía (2026-09-06) — mismo criterio
      // exacto que `pendingDynamicModeOffer`/`pendingQuestOfferInfo`: reconstruido tras recargar.
      pendingNpcInteractionOffer: save.pendingNpcInteractionOffer as { npcSlug: string; npcName: string; options: string[] } | null,
      // Ataque enemigo pendiente de defensa en combate 1v1 clásico (bug real 2026-08-28/29,
      // "recargar mientras el enemigo tiene la iniciativa rompe el turno") — mismo criterio que
      // `combateIniciado` arriba: `Save.pendingNpcAttack` ya persistía bien, pero nunca viajaba en
      // esta respuesta, así que el frontend no podía distinguir "toca defender" de "toca atacar"
      // tras F5. Mismo cálculo exacto que `esperandoDefensaJugador` en turnResolution.ts (línea
      // ~6137) — booleano puro, el contenido real del ataque (`attribute`/`abilityName`/`effects`)
      // ya lo consume el backend directamente de `Save.pendingNpcAttack` en el siguiente turno, no
      // hace falta exponerlo al frontend.
      esperandoDefensaJugador: !!save.pendingNpcAttack,
      raza: save.raza,
      clase: save.clase,
      especializacion: save.especializacion,
      // Elección obligatoria de clase al empezar a jugar (auditoría en 6 agentes, 2026-09-01,
      // bug real: un personaje custom se quedaba con `clase: null` para siempre — `PATCH
      // /saves/:id/clase` ya existía y funcionaba, pero ningún punto de la UI lo llamaba nunca).
      // Derivado igual que `pendingEspecializacionChoice` — sin flag persistido propio.
      pendingClaseChoice: !save.clase,
      clasesDisponibles: !save.clase
        ? clasesPermitidasParaRaza(save.raza).map((clase) => ({
            clase,
            resumenMecanico: CLASE_DESCRIPTION[clase] ?? '',
            iconoUrl: iconoUrlFor('clase', clase),
          }))
        : undefined,
      // Elección obligatoria de especialización a nivel 10 (2026-09-01) — derivado, igual que
      // `esperandoDefensaJugador` arriba: sin flag persistido propio, se recalcula solo en cada
      // GET. El frontend bloquea el composer mientras sea `true`, mismo patrón que
      // `pendingDeathResolution`.
      pendingEspecializacionChoice: !!save.clase && save.level >= NIVEL_MINIMO_ESPECIALIZACION && !save.especializacion,
      especializacionesDisponibles:
        save.clase && save.level >= NIVEL_MINIMO_ESPECIALIZACION && !save.especializacion
          ? especializacionesConHuecosPara(save.clase).map((especializacion) => ({
              especializacion,
              resumenMecanico: resumenMecanicoEspecializacion(save.clase!, especializacion),
              // Roadmap de banners de clase/especialización (2026-09-01) — icono ya subido a mano
              // por la usuaria (`uploads/images/especializacion/<ENUM>-icono.<ext>`), null hasta
              // entonces (el modal cae al icono de fallback, ver EspecializacionModal.tsx).
              iconoUrl: iconoUrlFor('especializacion', especializacion),
            }))
          : undefined,
    };
  });
}
