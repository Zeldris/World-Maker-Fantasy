import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { MAX_ATTRIBUTE, habilidadSlotsForLevel } from '../services/progression.js';
import { mergeFacts } from '../services/worldFacts.js';
import { startingAbilitiesFor } from '../services/startingAbilities.js';
import { startingInventoryFor } from '../services/startingInventory.js';
import { startingQuestsFor } from '../services/startingQuests.js';
import { startingSecondaryAttributesFor } from '../services/startingSecondaryAttributes.js';
import { normalizeSecondaryAttributes, EMPTY_SECONDARY_ATTRIBUTES } from '../services/secondaryAttributes.js';
import { destinationsFrom, initialLocationSlugFor } from '../services/travel.js';
import { formatFictionalDate, dayForFictionalMinutes } from '../services/worldClock.js';
import { checkRequisitos, shortfallLabel, type Requisitos } from '../services/requisitos.js';
import { recordEntityDiscoveries } from '../services/entityDiscovery.js';
import { scopeFor, contraataqueDifficultyFor } from '../services/npcScene.js';
import { effectiveAttributes, effectiveDefense } from '../services/equipment.js';
import { rollCheck } from '../services/dice.js';
import { imageUrlsFor } from '../lib/imageAssets.js';
import type { AttributeBlock, Attribute } from '../services/dice.js';
import type { Dificultad, EquipSlot } from '@prisma/client';

/// Resuelve `targetNpcSlug` (startingQuests.ts) al id real del Npc de catálogo de este mundo —
/// mismo mecanismo que narrador.ts usa para misiones propuestas en juego (Quest.targetNpcId),
/// pero aquí se resuelve de una vez para las misiones "de serie" en vez de por coincidencia de
/// texto contra la escena.
async function buildStartingQuestsData(worldId: string, characterName: string) {
  const quests = startingQuestsFor(characterName);
  const npcSlugs = quests.map((q) => q.targetNpcSlug).filter((slug): slug is string => Boolean(slug));
  const targetNpcs = npcSlugs.length ? await prisma.npc.findMany({ where: { worldId, slug: { in: npcSlugs } } }) : [];
  const npcIdBySlug = new Map(targetNpcs.map((npc) => [npc.slug, npc.id]));
  return quests.map((q) => ({
    title: q.title,
    description: q.description,
    targetNpcId: q.targetNpcSlug ? npcIdBySlug.get(q.targetNpcSlug) : undefined,
  }));
}

interface CreateSaveBody {
  worldSlug: string;
  pregeneratedCharacterId?: string;
  characterName: string;
  characterArchetype: string;
  characterOrigin: string;
  characterMotivation: string;
  attributes: AttributeBlock;
  portraitInitial: string;
  introCharacterText: string;
  introWorldText: string;
  /// docs/14-combate-y-muerte.md § 4.2 — elegida en el mismo paso que el personaje. Default
  /// MEDIO si no se manda (partidas antiguas o clientes que todavía no la piden).
  dificultad?: Dificultad;
}

function toFrontendLogEntry(entry: {
  id: string;
  channel: string;
  text: string;
  roll: unknown;
  isPlayerAction: boolean;
  timeLabel: string;
  createdAt: Date;
  xpDelta?: number | null;
  entityBannerType?: string | null;
  entityBannerSlug?: string | null;
}) {
  return {
    id: entry.id,
    channel: entry.channel.toLowerCase(),
    text: entry.text,
    timeLabel: entry.timeLabel,
    roll: entry.roll ?? undefined,
    isPlayerAction: entry.isPlayerAction || undefined,
    xpDelta: entry.xpDelta ?? undefined,
    // Persistencia de banners de entidad (rework 2026-07-24) — solo la referencia (tipo+slug); el
    // frontend resuelve la imagen real contra la Enciclopedia ya cargada, nunca se guarda una URL.
    entityBannerType: entry.entityBannerType ?? undefined,
    entityBannerSlug: entry.entityBannerSlug ?? undefined,
    createdAt: entry.createdAt.toISOString(),
  };
}

/// Rutas de persistencia real de partidas (decisión 2026-07-17: /turn y /entorno dejan de ser
/// stateless — el frontend crea una partida una vez y a partir de ahí solo manda `saveId`).
export async function savesRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateSaveBody }>('/saves', async (request, reply) => {
    const {
      worldSlug,
      pregeneratedCharacterId,
      characterName,
      characterArchetype,
      characterOrigin,
      characterMotivation,
      attributes,
      portraitInitial,
      introCharacterText,
      introWorldText,
      dificultad,
    } = request.body;

    if (!worldSlug || !characterName || !attributes) {
      return reply.status(400).send({ error: 'Faltan campos: worldSlug, characterName, attributes' });
    }

    const world = await prisma.world.findUnique({ where: { slug: worldSlug } });
    if (!world) {
      return reply.status(404).send({ error: `No existe el mundo "${worldSlug}"` });
    }

    const userId = await getDefaultUserId();
    const fictionalDateLabel = formatFictionalDate(480);

    const initialLocationSlug = initialLocationSlugFor(characterName);
    const initialLocation = initialLocationSlug
      ? await prisma.location.findUnique({ where: { worldId_slug: { worldId: world.id, slug: initialLocationSlug } } })
      : null;
    const startingQuestsData = await buildStartingQuestsData(world.id, characterName);
    const secondaryAttributes = startingSecondaryAttributesFor(characterName) ?? EMPTY_SECONDARY_ATTRIBUTES;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        pregeneratedCharacterId,
        characterName,
        characterArchetype,
        characterOrigin,
        characterMotivation,
        attributes,
        secondaryAttributes,
        portraitInitial,
        currentLocationId: initialLocation?.id,
        dificultad: dificultad ?? 'MEDIO',
        worldState: { create: { fictionalDateLabel } },
        logEntries: {
          create: [
            { channel: 'CHARACTER', text: introCharacterText, timeLabel: fictionalDateLabel, fictionalMinutes: 480 },
            { channel: 'WORLD', text: introWorldText, timeLabel: fictionalDateLabel, fictionalMinutes: 480 },
          ],
        },
        savedActions: {
          create: startingAbilitiesFor(characterName).map((a) => ({ ...a, isStarting: true })),
        },
        inventoryItems: {
          create: startingInventoryFor(characterName),
        },
        quests: {
          create: startingQuestsData,
        },
      },
    });

    // Enciclopedia progresiva (2026-07-23) — el equipo inicial ya se "conoce" desde el primer
    // instante, sin esperar a que un turno lo mencione (si no, el propio equipo del jugador se
    // vería como "???" hasta su primera acción). `mentionedText` vacío: solo cuenta la posesión.
    await recordEntityDiscoveries({ saveId: save.id, worldId: world.id, mentionedText: '' });
    // Misma lógica para el propio lugar de partida (bug real encontrado auditando la partida de
    // Gorhorn: no había ningún `LocationVisit` para la Hondonada del Eco pese a llevar toda la
    // partida ahí) — inserción directa, no pasa por turnResolution.ts, así que no dispara el
    // hito/XP de "descubrimiento" que sí aplica a lugares nuevos alcanzados jugando.
    if (initialLocation) {
      await prisma.locationVisit.upsert({
        where: { saveId_locationId: { saveId: save.id, locationId: initialLocation.id } },
        create: { saveId: save.id, locationId: initialLocation.id },
        update: {},
      });
    }

    return { id: save.id };
  });

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

    // Posición (docs/12-mundo-estructurado.md § 1.6): destinos directos desde la ubicación
    // actual, con tiempos ya ajustados a la destreza del personaje — misma lista cerrada que
    // ve el clasificador, visible también para el jugador en el mapa.
    const destinations = save.currentLocation
      ? await destinationsFrom(save.currentLocation.id, save.attributes as AttributeBlock)
      : [];

    // Tier/requisitos de equipar (sesión de diseño 2026-07-23) — viven en ItemCatalog, no en la
    // fila de InventoryItem; se resuelven aquí por `catalogSlug` para no repetir la consulta por
    // objeto. Objetos sin `catalogSlug` (narrativos sueltos, `newItem` del modelo) quedan sin tier.
    const catalogSlugs = [...new Set(save.inventoryItems.map((i) => i.catalogSlug).filter((s): s is string => Boolean(s)))];
    const catalogItems = catalogSlugs.length
      ? await prisma.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: catalogSlugs } } })
      : [];
    const catalogItemBySlug = new Map(catalogItems.map((c) => [c.slug, c]));

    // Marca de misión en el mapa (punto 3 del diseño de Gistera Koh, 2026-07-23): el mapa necesita
    // saber en qué Location dibujar el "!" — bien la del propio `targetLocationId`, bien la
    // `homeLocationSlug` del `targetNpcId` cuando la misión apunta a un NPC en vez de a un sitio
    // (p.ej. "derrota al Orco Enfurecido", que vive en la Hondonada del Eco).
    const questTargetLocationIds = save.quests.map((q) => q.targetLocationId).filter((id): id is string => Boolean(id));
    const questTargetNpcIds = save.quests.map((q) => q.targetNpcId).filter((id): id is string => Boolean(id));
    const [questTargetLocations, questTargetNpcs] = await Promise.all([
      questTargetLocationIds.length ? prisma.location.findMany({ where: { id: { in: questTargetLocationIds } } }) : [],
      questTargetNpcIds.length ? prisma.npc.findMany({ where: { id: { in: questTargetNpcIds } } }) : [],
    ]);
    const locationSlugById = new Map(questTargetLocations.map((l) => [l.id, l.slug]));
    const npcHomeLocationSlugById = new Map(questTargetNpcs.map((n) => [n.id, n.homeLocationSlug]));

    // Combate pendiente, reconstruido tras cualquier resincronización (bug real, 2026-07-23,
    // "revisar partida" — ver comentario de `pendingCombatNpcSlugs` en schema.prisma): mismo
    // shape que ya devuelve `/turn/narrate` directamente, para que `syncFromSave` en el frontend
    // pueda reabrir el aviso de "Combatir" aunque la respuesta directa del turno se perdiera.
    const pendingCombatSlugs = (save.pendingCombatNpcSlugs as string[] | null) ?? [];
    const pendingCombatNpcs = pendingCombatSlugs.length
      ? await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: pendingCombatSlugs } } })
      : [];
    const pendingCombatStates = pendingCombatNpcs.length
      ? await prisma.npcState.findMany({
          where: {
            saveId: save.id,
            npcId: { in: pendingCombatNpcs.map((n) => n.id) },
          },
        })
      : [];
    const pendingCombatStateByKey = new Map(pendingCombatStates.map((s) => [`${s.npcId}|${s.scope}`, s]));
    const combateIniciado = pendingCombatNpcs.length
      ? {
          npcs: pendingCombatNpcs.map((n) => {
            const state = pendingCombatStateByKey.get(`${n.id}|${scopeFor(n.kind, save.currentLocationId)}`);
            return { slug: n.slug, name: n.name, condicionFisica: state?.condicionFisica ?? 'ILESO', saqueado: state?.saqueado ?? false };
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
      secondaryAttributes: normalizeSecondaryAttributes(save.secondaryAttributes),
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
          statBonusAttribute: i.statBonusAttribute,
          statBonusAmount: i.statBonusAmount,
          catalogSlug: i.catalogSlug,
          tier: catalogItem?.tier,
          requisitos: catalogItem?.requisitos as Requisitos | null | undefined,
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
      transit: save.characterTransit
        ? { activity: save.characterTransit.activity, busyUntil: save.characterTransit.busyUntil.toISOString() }
        : null,
      savedActions: save.savedActions.map((a) => ({
        id: a.id,
        name: a.name,
        promptText: a.promptText,
        icon: a.icon,
        description: a.description,
        isStarting: a.isStarting,
        category: a.category,
      })),
      habilidadSlots: habilidadSlotsForLevel(save.level),
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
      dificultad: save.dificultad,
      deathCount: save.deathCount,
      endedAt: save.endedAt?.toISOString() ?? null,
      quests: save.quests.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        status: q.status,
        targetLocationSlug:
          (q.targetLocationId ? locationSlugById.get(q.targetLocationId) : undefined) ??
          (q.targetNpcId ? (npcHomeLocationSlugById.get(q.targetNpcId) ?? undefined) : undefined) ??
          null,
      })),
      chapters: save.sessionSummaries.map((c) => ({ chapterNumber: c.chapterNumber, summary: c.summary })),
      combateIniciado,
    };
  });

  app.post<{ Params: { id: string } }>('/saves/:id/restart', async (request, reply) => {
    // Resetea ESTA partida a Día 1 (borra su log y sus hechos) sin borrar la fila de Save —
    // sigue en la lista, con el mismo id, distinto de borrarla del todo (DELETE /saves/:id).
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { world: true },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const fictionalDateLabel = formatFictionalDate(480);
    const introCharacterText = `${save.characterName} llega a las tierras de ${save.world.name}. ${save.characterMotivation} Todo lo que ocurra a partir de ahora empieza aquí.`;
    const introWorldText = `El mundo de ${save.world.name} sigue su curso, ajeno por ahora a la llegada de un nuevo actor en la historia.`;

    const initialLocationSlug = initialLocationSlugFor(save.characterName);
    const initialLocation = initialLocationSlug
      ? await prisma.location.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: initialLocationSlug } } })
      : null;
    const startingQuestsData = await buildStartingQuestsData(save.worldId, save.characterName);

    await prisma.$transaction([
      prisma.logEntry.deleteMany({ where: { saveId: save.id } }),
      prisma.inventoryItem.deleteMany({ where: { saveId: save.id } }),
      prisma.companion.deleteMany({ where: { saveId: save.id } }),
      prisma.subject.deleteMany({ where: { saveId: save.id } }),
      prisma.building.deleteMany({ where: { saveId: save.id } }),
      prisma.territory.deleteMany({ where: { saveId: save.id } }),
      prisma.characterTransit.deleteMany({ where: { saveId: save.id } }),
      prisma.savedAction.deleteMany({ where: { saveId: save.id } }),
      prisma.locationVisit.deleteMany({ where: { saveId: save.id } }),
      prisma.quest.deleteMany({ where: { saveId: save.id } }),
      prisma.sessionSummary.deleteMany({ where: { saveId: save.id } }),
      // NpcState (2026-07-19): sin esto, la condición física/saqueo de un NPC de una partida
      // anterior sobrevivía al "reiniciar" — un NPC ya derrotado seguía derrotado en el Día 1
      // nuevo, en vez de volver a ILESO como todo lo demás.
      prisma.npcState.deleteMany({ where: { saveId: save.id } }),
      // Bug real (2026-07-23, encontrado al reiniciar la partida real de Gorhorn): ProfessionProgress
      // y KingdomStats no se borraban — un nivel de oficio o una economía de reino ya fundada
      // sobrevivían a "reiniciar", igual de incoherente que el NpcState de arriba antes de aquel fix.
      prisma.professionProgress.deleteMany({ where: { saveId: save.id } }),
      prisma.kingdomStats.deleteMany({ where: { saveId: save.id } }),
      // Enciclopedia progresiva (2026-07-23): reiniciar vuelve a Día 1 también en lo que ya se
      // "conoce" — sin esto, la Enciclopedia de una partida recién reiniciada seguiría mostrando
      // NPCs/fauna/objetos de la partida anterior como ya descubiertos.
      prisma.discoveredEntity.deleteMany({ where: { saveId: save.id } }),
      prisma.worldState.update({
        where: { saveId: save.id },
        data: { fictionalDateLabel, fictionalMinutes: 480, facts: [], agenda: [], factionsStatus: {} },
      }),
      prisma.logEntry.create({
        data: { saveId: save.id, channel: 'CHARACTER', text: introCharacterText, timeLabel: fictionalDateLabel },
      }),
      prisma.logEntry.create({
        data: { saveId: save.id, channel: 'WORLD', text: introWorldText, timeLabel: fictionalDateLabel },
      }),
      prisma.savedAction.createMany({
        data: startingAbilitiesFor(save.characterName).map((a) => ({ ...a, saveId: save.id, isStarting: true })),
      }),
      prisma.inventoryItem.createMany({
        data: startingInventoryFor(save.characterName).map((i) => ({ ...i, saveId: save.id })),
      }),
      prisma.quest.createMany({
        data: startingQuestsData.map((q) => ({ ...q, saveId: save.id })),
      }),
      prisma.save.update({
        where: { id: save.id },
        data: {
          lastPlayedAt: new Date(),
          level: 1,
          xp: 0,
          pendingAttributePoints: 0,
          kingdomName: null,
          profession: null,
          currentLocationId: initialLocation?.id ?? null,
          // docs/14-combate-y-muerte.md § 4.4: reiniciar borra el fin de partida y el contador
          // de muertes — la dificultad elegida al crear la partida NO se resetea (es una
          // preferencia de la partida, no parte del progreso que "reiniciar" debe borrar).
          condicionFisica: 'ILESO',
          salud: 100,
          deathCount: 0,
          endedAt: null,
          lastRestLocationId: null,
          pausedAt: null,
        },
      }),
    ]);

    // Mismo motivo que en POST /saves — el equipo inicial ya se "conoce" desde ya.
    await recordEntityDiscoveries({ saveId: save.id, worldId: save.worldId, mentionedText: '' });
    if (initialLocation) {
      await prisma.locationVisit.upsert({
        where: { saveId_locationId: { saveId: save.id, locationId: initialLocation.id } },
        create: { saveId: save.id, locationId: initialLocation.id },
        update: {},
      });
    }

    return { id: save.id };
  });

  // Pausa/reanuda la partida (roadmap 2026-07-20, petición explícita: "quiero que la partida se
  // pause si salgo de ella"). El frontend llama a pause al salir de GameView (desmontaje o
  // beforeunload) y a resume al volver a entrar — ver `pausedAt` en schema.prisma para el
  // razonamiento completo. Solo afecta a `resolveDueTransits` (worldTick.ts): mientras está
  // pausada, un CharacterTransit vencido no se resuelve; al reanudar, `busyUntil` se alarga
  // exactamente lo que ha durado la pausa, sin perder ni regalar tiempo de espera.
  app.post<{ Params: { id: string } }>('/saves/:id/pause', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (!save.pausedAt) {
      await prisma.save.update({ where: { id: save.id }, data: { pausedAt: new Date() } });
    }
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>('/saves/:id/resume', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { characterTransit: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (save.pausedAt) {
      const pausedMs = Date.now() - save.pausedAt.getTime();
      const ops: Prisma.PrismaPromise<unknown>[] = [prisma.save.update({ where: { id: save.id }, data: { pausedAt: null } })];
      if (save.characterTransit && pausedMs > 0) {
        ops.push(
          prisma.characterTransit.update({
            where: { saveId: save.id },
            data: { busyUntil: new Date(save.characterTransit.busyUntil.getTime() + pausedMs) },
          }),
        );
      }
      await prisma.$transaction(ops);
    }
    return reply.status(204).send();
  });

  // Cancelar una acción extendida/larga en curso (roadmap 2026-07-21, petición explícita de la
  // usuaria: "quiero meter un botón para poder cancelarla... no se realizará la acción") — borra
  // el CharacterTransit para que worldTick nunca la resuelva, y deja constancia en el diario de
  // que el personaje cambió de idea, en vez de fingir que la acción llegó a completarse.
  app.post<{ Params: { id: string } }>('/saves/:id/transit/cancel', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { characterTransit: true, worldState: true },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (!save.characterTransit || save.characterTransit.busyUntil <= new Date()) {
      return reply.status(404).send({ error: 'No hay ninguna acción cancelable ahora mismo' });
    }

    // Mismo patrón de "reclamo atómico" que worldTick.ts: si busyUntil ya pasó a estar en el
    // pasado justo antes de este borrado (carrera con el worker de fondo resolviéndola), el
    // borrado no afecta a ninguna fila y se avisa en vez de fingir que se canceló.
    const deleted = await prisma.characterTransit.deleteMany({
      where: { saveId: save.id, busyUntil: { gt: new Date() } },
    });
    if (deleted.count === 0) {
      return reply.status(409).send({ error: 'La acción ya se estaba resolviendo, no se pudo cancelar' });
    }

    await prisma.logEntry.create({
      data: {
        saveId: save.id,
        channel: 'CHARACTER',
        text: `${save.characterName} decide no seguir adelante con eso — cambia de idea antes de empezar.`,
        timeLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      },
    });
    return reply.status(204).send();
  });

  // Huir ANTES de entrar al combate (petición explícita de la usuaria, 2026-07-24, tras la
  // auditoría "revisa todo bien bien" — punto: el "Huir" de dentro de CombatModal.tsx pasa por
  // todo el pipeline classify+narrate y cierra el popup de inmediato sin esperar a que termine,
  // así que una resincronización a mitad de ese hueco podía resucitar el aviso de "Combatir" para
  // una pelea de la que ya se había huido). Botón nuevo junto al aviso de "⚔️ Combatir", ANTES de
  // abrir el popup: una única tirada determinista de destreza (misma fórmula que el contraataque,
  // cuanto más nivel el enemigo, más difícil escapar), sin IA — si sale bien limpia el combate
  // pendiente del todo (ya no hay carrera posible: es una sola llamada atómica); si falla, el
  // frontend abre igualmente el popup de combate normal.
  app.post<{ Params: { id: string } }>('/saves/:id/combat/flee', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { worldState: true, inventoryItems: { where: { slot: { not: null } } } },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (save.endedAt) {
      return reply.status(409).send({ error: 'Esta partida ha terminado' });
    }

    const pendingSlugs = (save.pendingCombatNpcSlugs as string[] | null) ?? [];
    if (pendingSlugs.length === 0) {
      return reply.status(404).send({ error: 'No hay ningún combate pendiente del que huir' });
    }

    const npcs = await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: pendingSlugs } } });
    const maxNpcLevel = npcs.reduce((max, n) => Math.max(max, n.level), 1);
    const attributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
    const defensa = effectiveDefense(save.inventoryItems);
    const dificultad = contraataqueDifficultyFor(maxNpcLevel, save.level, defensa);
    const roll = rollCheck(attributes, 'destreza', dificultad);
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';

    const text = roll.success
      ? `${save.characterName} logra escapar antes de que el combate llegue a empezar de verdad — pero huir así, dejando la pelea sin dar la cara, es una mancha en su honor que no se borra sola.`
      : `${save.characterName} intenta escapar antes de que empiece la pelea, pero no lo consigue — no hay forma de zafarse de esto ahora mismo.`;

    await prisma.$transaction([
      prisma.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel } }),
      ...(roll.success ? [prisma.save.update({ where: { id: save.id }, data: { pendingCombatNpcSlugs: [] } })] : []),
    ]);

    return { escaped: roll.success, text };
  });

  app.post<{ Params: { id: string }; Body: { attribute: Attribute } }>(
    '/saves/:id/attribute-points',
    async (request, reply) => {
      // Reparte UN punto pendiente de ascenso (ASI) en el atributo pedido (docs/10-niveles-xp-reino.md
      // § 4.2) — se llama una vez por punto, tope duro 18, nunca gasta más de lo disponible.
      const { attribute } = request.body;
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) {
        return reply.status(404).send({ error: 'Partida no encontrada' });
      }
      if (save.pendingAttributePoints <= 0) {
        return reply.status(400).send({ error: 'No quedan puntos de atributo pendientes' });
      }
      const attributes = save.attributes as AttributeBlock;
      if (attributes[attribute] >= MAX_ATTRIBUTE) {
        return reply.status(400).send({ error: `${attribute} ya está en el máximo (${MAX_ATTRIBUTE})` });
      }

      const updated = await prisma.save.update({
        where: { id: save.id },
        data: {
          pendingAttributePoints: { decrement: 1 },
          attributes: { ...attributes, [attribute]: attributes[attribute] + 1 },
        },
      });

      return { attributes: updated.attributes, pendingAttributePoints: updated.pendingAttributePoints };
    },
  );

  app.post<{ Params: { id: string }; Body: { name: string; promptText: string; icon?: string; description?: string; category?: string } }>(
    '/saves/:id/habilidades',
    async (request, reply) => {
      // Roadmap de rediseño de paneles (2026-07-20/21): las habilidades de combate son fijas por
      // clase (las da el diseño al subir de nivel, nunca la jugadora) — solo "general" es creable
      // a mano. `habilidadSlotsForLevel` sigue existiendo para saber cuántas de las de clase están
      // activas en este nivel, ya no como cupo de creación.
      const { name, promptText, icon, description, category } = request.body;
      if (!name?.trim() || !promptText?.trim()) {
        return reply.status(400).send({ error: 'Faltan campos: name, promptText' });
      }
      if (category === 'combate') {
        return reply.status(400).send({ error: 'Las habilidades de combate son fijas de la clase, no se crean a mano' });
      }

      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
      });
      if (!save) {
        return reply.status(404).send({ error: 'Partida no encontrada' });
      }

      const created = await prisma.savedAction.create({
        data: {
          saveId: save.id,
          name: name.trim(),
          promptText: promptText.trim(),
          icon: icon?.trim() || '✨',
          description: description?.trim() || '',
          category: 'general',
        },
      });
      return {
        id: created.id,
        name: created.name,
        promptText: created.promptText,
        icon: created.icon,
        description: created.description,
        isStarting: created.isStarting,
        category: created.category,
      };
    },
  );

  app.post<{ Params: { id: string }; Body: { profession: string } }>('/saves/:id/profesion', async (request, reply) => {
    const { profession } = request.body;
    if (!profession?.trim()) {
      return reply.status(400).send({ error: 'Falta el campo: profession' });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const sessionFacts = (save.worldState?.facts as string[] | undefined) ?? [];
    const fact = `${save.characterName} ejerce como ${profession}.`;

    await prisma.$transaction([
      prisma.save.update({ where: { id: save.id }, data: { profession } }),
      prisma.worldState.update({ where: { saveId: save.id }, data: { facts: mergeFacts(sessionFacts, [fact]) } }),
    ]);

    return { profession };
  });

  app.delete<{ Params: { id: string; habilidadId: string } }>(
    '/saves/:id/habilidades/:habilidadId',
    async (request, reply) => {
      // Bug real (auditoría 2026-07-22): `deleteMany` nunca lanza por "no encontrado" (devuelve
      // count:0 en silencio) — el `.catch(() => null)` que había aquí solo podía estar tragando
      // fallos DE VERDAD (conexión a la base de datos caída, etc.), nunca el caso que decía
      // proteger. Se deja propagar como cualquier otro endpoint.
      await prisma.savedAction.deleteMany({ where: { id: request.params.habilidadId, saveId: request.params.id } });
      return reply.status(204).send();
    },
  );

  // Editar una habilidad creada por la jugadora (roadmap de rediseño de paneles, Fable
  // 2026-07-20/21) — las de partida inicial (isStarting: true) nunca son editables, verificado
  // aquí en el backend y no solo ocultando el botón en el frontend.
  app.patch<{
    Params: { id: string; habilidadId: string };
    Body: { name?: string; promptText?: string; icon?: string; description?: string };
  }>('/saves/:id/habilidades/:habilidadId', async (request, reply) => {
    const existing = await prisma.savedAction.findFirst({
      where: { id: request.params.habilidadId, saveId: request.params.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Habilidad no encontrada' });
    }
    if (existing.isStarting) {
      return reply.status(400).send({ error: 'Las habilidades de partida inicial no se pueden editar' });
    }

    const { name, promptText, icon, description } = request.body;
    if (name !== undefined && !name.trim()) {
      return reply.status(400).send({ error: 'El campo name no puede quedar vacío' });
    }
    if (promptText !== undefined && !promptText.trim()) {
      return reply.status(400).send({ error: 'El campo promptText no puede quedar vacío' });
    }

    const updated = await prisma.savedAction.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(promptText !== undefined && { promptText: promptText.trim() }),
        ...(icon !== undefined && icon.trim() && { icon: icon.trim() }),
        ...(description !== undefined && { description: description.trim() }),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      promptText: updated.promptText,
      icon: updated.icon,
      description: updated.description,
      isStarting: updated.isStarting,
      category: updated.category,
    };
  });

  // Asigna/quita un hueco de equipo — decisión manual de la jugadora, el modelo nunca la toma
  // (mismo criterio narrativo-sin-mecánica que el resto de InventoryItem). Como mucho un objeto
  // por hueco: si otro objeto ya ocupaba ese slot, se desequipa a la mochila en la misma transacción.
  app.patch<{ Params: { id: string; itemId: string }; Body: { slot: EquipSlot | null } }>(
    '/saves/:id/inventario/:itemId',
    async (request, reply) => {
      const { slot } = request.body;
      if (slot !== null && typeof slot !== 'string') {
        return reply.status(400).send({ error: 'Falta el campo: slot (EquipSlot o null)' });
      }
      const item = await prisma.inventoryItem.findFirst({ where: { id: request.params.itemId, saveId: request.params.id } });
      if (!item) {
        return reply.status(404).send({ error: 'Objeto no encontrado' });
      }

      // Requisitos de equipar (sesión de diseño 2026-07-23) — UMBRAL puro, solo al EQUIPAR
      // (slot !== null; desequipar siempre está permitido). Sin `catalogSlug` (objeto puramente
      // narrativo, sin fila de catálogo conocida) no hay nada que comprobar.
      if (slot && item.catalogSlug) {
        const save = await prisma.save.findUnique({ where: { id: request.params.id } });
        if (!save) {
          return reply.status(404).send({ error: 'Partida no encontrada' });
        }
        const catalogItem = await prisma.itemCatalog.findUnique({
          where: { worldId_slug: { worldId: save.worldId, slug: item.catalogSlug } },
        });
        const shortfalls = checkRequisitos(
          catalogItem?.requisitos as Requisitos | undefined,
          save.attributes as AttributeBlock,
          normalizeSecondaryAttributes(save.secondaryAttributes),
        );
        if (shortfalls.length > 0) {
          return reply.status(400).send({
            error: `No cumples los requisitos para equipar "${item.name}": ${shortfalls.map(shortfallLabel).join(', ')}`,
          });
        }
      }

      await prisma.$transaction([
        ...(slot
          ? [
              prisma.inventoryItem.updateMany({
                where: { saveId: request.params.id, slot, NOT: { id: item.id } },
                data: { slot: null },
              }),
            ]
          : []),
        prisma.inventoryItem.update({ where: { id: item.id }, data: { slot } }),
      ]);
      return { id: item.id, slot };
    },
  );

  // Persiste qué entidad se mostró como banner bajo una narración (rework 2026-07-24) — el
  // frontend ya decidió cuál mostrar (mentionedEntityBanner.ts, con su propia deduplicación);
  // esto solo guarda esa decisión para que GET /saves/:id la devuelva igual tras una recarga
  // dentro de la ventana de 24h. Nunca se guarda la URL de la imagen, solo la referencia.
  app.patch<{ Params: { id: string; entryId: string }; Body: { entityType: string; entitySlug: string } }>(
    '/saves/:id/log/:entryId/entity-banner',
    async (request, reply) => {
      const { entityType, entitySlug } = request.body;
      if (!entityType || !entitySlug) {
        return reply.status(400).send({ error: 'Faltan campos: entityType, entitySlug' });
      }
      const entry = await prisma.logEntry.findFirst({ where: { id: request.params.entryId, saveId: request.params.id } });
      if (!entry) {
        return reply.status(404).send({ error: 'Entrada de registro no encontrada' });
      }
      await prisma.logEntry.update({
        where: { id: entry.id },
        data: { entityBannerType: entityType, entityBannerSlug: entitySlug },
      });
      return reply.status(204).send();
    },
  );

  // Registro completo de la partida, agrupado por día de ficción (rework 2026-07-24: "el log de
  // personaje solo muestre 24h... si quieres verlo todo vendrá clasificado por días en el diario").
  // A diferencia de GET /saves/:id, aquí no hay ventana de tiempo ni banner de entidad — el Diario
  // es solo texto por diseño, y se pide bajo demanda (al abrir la pestaña), no en cada carga.
  app.get<{ Params: { id: string } }>('/saves/:id/diario', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    const entries = await prisma.logEntry.findMany({ where: { saveId: save.id }, orderBy: { createdAt: 'asc' } });
    return entries.map((e) => ({ ...toFrontendLogEntry(e), day: dayForFictionalMinutes(e.fictionalMinutes) }));
  });

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
