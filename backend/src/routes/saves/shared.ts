import type { FastifyReply } from 'fastify';
import { Prisma, type Clase } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { startingQuestsFor } from '../../services/startingQuests.js';
import type { Attribute, AttributeBlock } from '../../services/dice.js';
import { energiaMaxFor } from '../../services/energy.js';
import { startingAbilitiesFor } from '../../services/startingAbilities.js';
import { GENERIC_COMBAT_ABILITIES } from '../../services/genericCombatAbilities.js';
import { classAbilityUnlocksFor } from '../../services/classAbilities.js';
import { startingInventoryFor, type StartingInventoryItem } from '../../services/startingInventory.js';
import { startingProfessionsFor } from '../../services/startingProfessions.js';
import { professionAbilityUnlocksFor } from '../../services/professionAbilities.js';
import { harvestAbilityUnlocksFor } from '../../services/harvestAbilities.js';
import { syncDynamicCombatAbilities, resolveEquippedWeaponSlots } from '../../services/dynamicAbilities.js';
import { initialLocationSlugFor } from '../../services/travel.js';
import { formatFictionalDate } from '../../services/worldClock.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';

/// Único punto de verdad para los 7 atributos válidos (deuda técnica 2026-08-21: `creation.ts` §
/// `validationErrorFor` y `progression.ts` § `/saves/:id/attribute-points` mantenían cada una su
/// propia copia idéntica de este array — duplicación real, reconocida a propósito en un comentario
/// de creation.ts ("no hay un módulo compartido de validación de atributos todavía"). Ahora sí lo
/// hay: las dos rutas importan esta misma constante.
export const VALID_ATTRIBUTES: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'magia'];

/// Guard de `save.endedAt` (deuda técnica, auditoría 2026-08-25) — el mismo bloque de 3 líneas
/// estaba copiado literalmente en 8+ archivos de `routes/saves/` (`recolectar.ts`, `cazar.ts`,
/// `companeros.ts`, `habilidades.ts`, `inventario.ts`, `progression.ts`, `reino.ts`, `session.ts`),
/// cada uno con su propio comentario reconociendo la duplicación pero sin extraerla nunca. No
/// sustituye el `prisma.save.findUnique` de cada ruta (cada una necesita su propio `select`/
/// `include`) — solo el guard en sí, una vez que la ruta ya tiene el `save` en la mano. Devuelve
/// `true` si ya respondió el 409 (el caller debe hacer `if (rejectIfEnded(save, reply)) return;`).
export function rejectIfEnded(save: { endedAt: Date | null }, reply: FastifyReply): boolean {
  if (save.endedAt) {
    reply.status(409).send({ error: 'Esta partida ha terminado', endedAt: save.endedAt });
    return true;
  }
  return false;
}

/// Guard de `save.pendingDeathResolution` (auditoría de código backend 2026-09-07, decisión
/// confirmada con la usuaria: bloquear TODO menos el propio `POST /death/resolve` mientras hay una
/// muerte pendiente de resolver, mismo espíritu que `rejectIfEnded` pero para este estado
/// transitorio). Antes solo se comprobaba a mano en `routes/turn.ts` (`/turn/classify` y
/// `/turn/narrate`) — mismo mensaje/forma de respuesta que ya usaban esos dos, ahora reutilizable
/// desde cualquier ruta mutante de `routes/saves/`. Igual que `rejectIfEnded`: no sustituye el
/// `prisma.save.findUnique` de cada ruta, solo el guard en sí una vez que la ruta ya tiene el `save`
/// en la mano. Devuelve `true` si ya respondió el 409 (el caller debe hacer
/// `if (rejectIfPendingDeath(save, reply)) return;`).
export function rejectIfPendingDeath(save: { pendingDeathResolution: boolean }, reply: FastifyReply): boolean {
  if (save.pendingDeathResolution) {
    reply.status(409).send({ error: 'Tienes una muerte pendiente de resolver', pendingDeathResolution: true });
    return true;
  }
  return false;
}

/// Limpia un campo `pending*Offer` de `Save` (deuda técnica, "Interactuar" motor unificado de
/// eventos de escena, 2026-09-08, Franja 2) — la misma línea `prisma.save.update({..., data: {
/// [campo]: Prisma.JsonNull } })` estaba copiada 5 veces entre `dynamicMode.ts` (×3),
/// `quests.ts` (×2) y `npcInteraction.ts` (×1). Investigado a fondo si merecía la pena unificar
/// también QUIÉN decide el candidato de cada oferta (`dynamicModeOffer`/`newQuestOfferInfo`/
/// `npcInteractionOffer`) — decisión explícita: no, son estructuralmente distintos (motor decide/
/// LLM propone+valida/verbo del jugador decide respectivamente) y forzar un servicio común ahí
/// distorsionaría alguno de los tres sin necesidad real. Solo se extrae lo que de verdad se repite:
/// la limpieza en sí, una vez que la ruta ya decidió que toca limpiar.
export async function clearPendingOffer(saveId: string, campo: 'pendingDynamicModeOffer' | 'pendingDynamicMode' | 'pendingQuestOfferInfo' | 'pendingNpcInteractionOffer'): Promise<void> {
  await prisma.save.update({ where: { id: saveId }, data: { [campo]: Prisma.JsonNull } });
}

/// Bloquea una fila con `SELECT ... FOR UPDATE` y relee las columnas pedidas dentro de la misma
/// transacción — deuda técnica cerrada (auditoría 2026-09-01): el mismo `$queryRaw` con `FOR
/// UPDATE` estaba copiado 7 veces entre `progression.ts`, `session.ts`, `cazar.ts` y
/// `companeros.ts`, cada uno con su propio comentario explicando el mismo patrón de condición de
/// carrera (doble clic / dos peticiones casi simultáneas viendo el mismo estado stale antes de que
/// ninguna escriba). `columns` va sin comillas ni interpolación de valores — solo nombres de
/// columna literales del propio caller, nunca texto de request. Cuando solo hace falta serializar
/// sin leer nada (el caller solo quiere el lock), pasa `['id']` y descarta la fila devuelta.
export async function lockRowForUpdate<T extends Record<string, unknown>>(
  tx: Prisma.TransactionClient,
  table: 'Save' | 'CombatParticipant',
  id: string,
  columns: string[],
): Promise<T> {
  const columnList = Prisma.raw(columns.map((c) => `"${c}"`).join(', '));
  const [row] = await tx.$queryRaw<T[]>`SELECT ${columnList} FROM ${Prisma.raw(`"${table}"`)} WHERE id = ${id} FOR UPDATE`;
  return row;
}

/// Resuelve `targetNpcSlug` (startingQuests.ts) al id real del Npc de catálogo de este mundo —
/// mismo mecanismo que narrador.ts usa para misiones propuestas en juego (Quest.targetNpcId),
/// pero aquí se resuelve de una vez para las misiones "de serie" en vez de por coincidencia de
/// texto contra la escena. Compartido entre POST /saves y POST /saves/:id/restart (creation.ts) —
/// las dos rutas de "arranca en Día 1" necesitan exactamente lo mismo.
export async function buildStartingQuestsData(worldId: string, characterName: string) {
  const quests = startingQuestsFor(characterName);
  const npcSlugs = quests.map((q) => q.targetNpcSlug).filter((slug): slug is string => Boolean(slug));
  const targetNpcs = npcSlugs.length ? await prisma.npc.findMany({ where: { worldId, slug: { in: npcSlugs } } }) : [];
  const npcIdBySlug = new Map(targetNpcs.map((npc) => [npc.slug, npc.id]));
  return quests.map((q) => ({
    title: q.title,
    description: q.description,
    targetNpcId: q.targetNpcSlug ? npcIdBySlug.get(q.targetNpcSlug) : undefined,
    objetivo: q.objetivo,
    rewardXp: q.rewardXp,
    rewardItems: q.rewardItems ?? [],
  }));
}

/// Forma de LogEntry que espera el frontend — compartida entre GET /saves/:id (ventana de 24h,
/// detail.ts) y GET /saves/:id/diario (registro completo, log.ts): las dos aplanan la misma fila
/// de Prisma al mismo shape, solo cambia qué ventana de filas se lee antes de mapear.
export function toFrontendLogEntry(entry: {
  id: string;
  channel: string;
  text: string;
  roll: unknown;
  isPlayerAction: boolean;
  timeLabel: string;
  createdAt: Date;
  xpDelta?: number | null;
  xpHitoDelta?: number | null;
  xpHitoLabel?: string | null;
  entityBannerType?: string | null;
  entityBannerSlug?: string | null;
  combate?: boolean;
  travelInterrupted?: boolean;
  combatExchange?: unknown;
  npcAbilityUsed?: unknown;
  playerAbilityUsed?: unknown;
  initiativeRoll?: unknown;
  noticia?: unknown;
}) {
  return {
    id: entry.id,
    // UX-38: categoría, oportunidad y resumen de una noticia de «El mundo».
    noticia: entry.noticia ?? undefined,
    channel: entry.channel.toLowerCase(),
    text: entry.text,
    timeLabel: entry.timeLabel,
    roll: entry.roll ?? undefined,
    // Bug real jugando en vivo (2026-08-13) — sin esto, recargar la partida perdía el lado
    // "Enemigo" del intercambio de combate (ver comentario de la columna en schema.prisma).
    combatExchange: entry.combatExchange ?? undefined,
    // Bug gemelo del de arriba (2026-08-14) — mismo motivo, mismo fix: sin esto, recargar perdía
    // el badge de "NPC ataca/se defiende con..." y "Usas..." y (nuevo) el nombre real del NPC en
    // CombatExchangeBadge, que cae a "el enemigo" sin `npcAbilityUsed.npcName`.
    npcAbilityUsed: entry.npcAbilityUsed ?? undefined,
    playerAbilityUsed: entry.playerAbilityUsed ?? undefined,
    // Tercer bug gemelo (2026-08-21) — ver comentario de la columna en schema.prisma: sin esto,
    // recargar durante un combate abierto perdía el banner de iniciativa por completo.
    initiativeRoll: entry.initiativeRoll ?? undefined,
    isPlayerAction: entry.isPlayerAction || undefined,
    xpDelta: entry.xpDelta ?? undefined,
    // UX 2026-09-01 (ver comentario de la columna en schema.prisma) — desglose del chip de XP:
    // separa la parte de hito/capítulo/Reino de la de tirada normal tras recargar la partida.
    xpHitoDelta: entry.xpHitoDelta ?? undefined,
    xpHitoLabel: entry.xpHitoLabel ?? undefined,
    // Persistencia de banners de entidad (rework 2026-07-24) — solo la referencia (tipo+slug); el
    // frontend resuelve la imagen real contra la Enciclopedia ya cargada, nunca se guarda una URL.
    entityBannerType: entry.entityBannerType ?? undefined,
    entityBannerSlug: entry.entityBannerSlug ?? undefined,
    createdAt: entry.createdAt.toISOString(),
    // Rediseño de la vista de combate (2026-07-28) — fondo rojo en el frontend.
    combate: entry.combate || undefined,
    // Eventos de viaje interactivos (2026-08-05) — fondo ámbar en el frontend, mismo criterio.
    travelInterrupted: entry.travelInterrupted || undefined,
  };
}

/// Copia `statBonuses` del catálogo al kit inicial cuando la propia entrada no lo trae ya (bug
/// real 2026-08-XX, ver comentario original en creation.ts) — mismo criterio que el saqueo/crafteo
/// real (turnResolution.ts). Movida aquí (2026-08-31) desde creation.ts para que
/// `restartSaveTransactionBody` (más abajo) pueda reutilizarla sin duplicarla — antes solo la usaba
/// POST /saves y POST /saves/:id/restart, ahora también el reinicio total tras morir sin punto de
/// guardado (routes/saves/death.ts).
export async function withCatalogStatBonuses(
  tx: Prisma.TransactionClient,
  worldId: string,
  items: StartingInventoryItem[],
): Promise<StartingInventoryItem[]> {
  const slugs = items.map((i) => i.catalogSlug).filter((s): s is string => !!s);
  if (slugs.length === 0) return items;
  const catalogRows = await tx.itemCatalog.findMany({ where: { worldId, slug: { in: slugs } }, select: { slug: true, statBonuses: true } });
  const statBonusesBySlug = new Map(catalogRows.map((r) => [r.slug, r.statBonuses]));
  return items.map((item) => {
    if (item.statBonuses || !item.catalogSlug) return item;
    const catalogBonuses = statBonusesBySlug.get(item.catalogSlug);
    return catalogBonuses ? { ...item, statBonuses: catalogBonuses as StartingInventoryItem['statBonuses'] } : item;
  });
}

/// Cuerpo real de "volver a Día 1" — extraído (2026-08-31, muerte permanente) de
/// POST /saves/:id/restart (creation.ts) para que POST /saves/:id/death/resolve (death.ts) pueda
/// reutilizarlo tal cual cuando toca reiniciar la partida entera (sin punto de guardado y sin
/// tutorial superado): mismo borrado total de progreso, mismo kit inicial, misma Enciclopedia
/// "de serie" — un jugador que reinicia a mano y uno que muere sin red de seguridad terminan
/// exactamente en el mismo Día 1, sin dos implementaciones que puedan divergir con el tiempo.
/// El caller ya está dentro de una transacción (`tx`) y ya resolvió `introCharacterText`/
/// `introWorldText` — aquí solo vive el borrado + reconstrucción en sí.
export async function restartSaveTransactionBody(
  tx: Prisma.TransactionClient,
  save: {
    id: string;
    worldId: string;
    characterName: string;
    raza: string | null;
    clase: Clase | null;
    attributes: unknown;
  },
  introCharacterText: string,
  introWorldText: string,
): Promise<void> {
  const fictionalDateLabel = formatFictionalDate(480);
  const initialLocationSlug = initialLocationSlugFor(save.characterName);
  const initialLocation = initialLocationSlug
    ? await tx.location.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: initialLocationSlug } } })
    : null;
  const startingProfessions = startingProfessionsFor(save.characterName, save.raza, initialLocation?.region ?? null);
  const startingQuestsData = await buildStartingQuestsData(save.worldId, save.characterName);

  await tx.logEntry.deleteMany({ where: { saveId: save.id } });
  // Libro de Sucesos (CR-1, hito 0.2): reiniciar es empezar la historia de cero — lo vivido se va.
  await tx.suceso.deleteMany({ where: { saveId: save.id } });
  // Bug real (2026-09-22, jugando en vivo): un CombatEncounter EN_CURSO (combate múltiple) nunca se
  // borraba al reiniciar — mismo patrón que zonaPosX/Y y pendingCombatNpcSlugs, un dato nuevo que
  // este flujo desconocía. `GET /saves/:id` (detail.ts) reconstruye `combateIniciado` con un
  // findFirst por `saveId` sin mirar fecha/reinicio, así que un reinicio dejaba la partida "sucia"
  // para siempre con el combate viejo reapareciendo de inmediato, sin ninguna vía de UI para salir.
  // `CombatParticipant` se borra en cascada (`onDelete: Cascade` en el schema), no hace falta un
  // segundo deleteMany.
  await tx.combatEncounter.deleteMany({ where: { saveId: save.id } });
  // Fase 5 (B1): el estado vivo de zona (fauna movida/cazada, grupos) es de la partida — se re-clona de la plantilla.
  await tx.zonePoint.deleteMany({ where: { saveId: save.id } });
  await tx.inventoryItem.deleteMany({ where: { saveId: save.id } });
  await tx.companion.deleteMany({ where: { saveId: save.id } });
  await tx.subject.deleteMany({ where: { saveId: save.id } });
  await tx.almacenItem.deleteMany({ where: { saveId: save.id } });
  await tx.plantillaEquipo.deleteMany({ where: { saveId: save.id } });
  await tx.building.deleteMany({ where: { saveId: save.id } });
  await tx.territory.deleteMany({ where: { saveId: save.id } });
  await tx.characterTransit.deleteMany({ where: { saveId: save.id } });
  await tx.savedAction.deleteMany({ where: { saveId: save.id } });
  await tx.locationVisit.deleteMany({ where: { saveId: save.id } });
  await tx.quest.deleteMany({ where: { saveId: save.id } });
  await tx.sessionSummary.deleteMany({ where: { saveId: save.id } });
  await tx.npcState.deleteMany({ where: { saveId: save.id } });
  await tx.professionProgress.deleteMany({ where: { saveId: save.id } });
  await tx.kingdomStats.deleteMany({ where: { saveId: save.id } });
  // CR-6 (hito 0.2): también se van las copias del mundo de esta partida (facciones con su origen y
  // población); `mundoClonadoEn: null` hace que se vuelvan a clonar del catálogo en el primer uso.
  await tx.faction.deleteMany({ where: { saveId: save.id } });
  await tx.worldPopulation.deleteMany({ where: { saveId: save.id } });
  await tx.discoveredEntity.deleteMany({ where: { saveId: save.id } });
  await tx.sessionFact.deleteMany({ where: { saveId: save.id } });
  await tx.worldState.update({
    where: { saveId: save.id },
    data: { fictionalDateLabel, fictionalMinutes: 480, agenda: [], factionsStatus: {}, mundoClonadoEn: null },
  });
  // isSystemMessage (ver comentario completo en schema.prisma) — ambos textos son deterministas
  // (awakensText es pura, introWorldText es plantilla fija), nunca pasan por el LLM.
  await tx.logEntry.create({
    data: { saveId: save.id, channel: 'CHARACTER', text: introCharacterText, timeLabel: fictionalDateLabel, isSystemMessage: true },
  });
  await tx.logEntry.create({
    data: { saveId: save.id, channel: 'WORLD', text: introWorldText, timeLabel: fictionalDateLabel, isSystemMessage: true },
  });
  await tx.savedAction.createMany({
    data: [
      ...startingAbilitiesFor(save.characterName).map((a) => ({ ...a, saveId: save.id, isStarting: true })),
      ...GENERIC_COMBAT_ABILITIES.map((a) => ({ ...a, saveId: save.id, isStarting: true, isGeneric: true })),
      ...classAbilityUnlocksFor(save.characterName, 1, save.clase).map((a) => ({ ...a, saveId: save.id, isStarting: true })),
      ...startingProfessions.flatMap((oficio) => [
        ...professionAbilityUnlocksFor(oficio, 1).map((a) => ({ ...a, saveId: save.id, isStarting: true })),
        ...harvestAbilityUnlocksFor(oficio, 1).map((a) => ({ ...a, saveId: save.id, isStarting: true })),
      ]),
    ],
  });
  const startingInventoryWithStats = await withCatalogStatBonuses(tx, save.worldId, startingInventoryFor(save.characterName));
  const restartedInventory = await tx.inventoryItem.createManyAndReturn({
    data: startingInventoryWithStats.map((i) => ({ ...i, saveId: save.id })),
  });
  const restartedEquippedWeaponSlots = await resolveEquippedWeaponSlots(tx, save.worldId, restartedInventory);
  await syncDynamicCombatAbilities(tx, save.id, save.raza, 1, restartedEquippedWeaponSlots);
  await tx.quest.createMany({
    data: startingQuestsData.map((q) => ({ ...q, saveId: save.id })),
  });
  await tx.professionProgress.createMany({
    data: startingProfessions.map((professionId) => ({ professionId, saveId: save.id })),
  });
  await tx.save.update({
    where: { id: save.id },
    data: {
      lastPlayedAt: new Date(),
      level: 1,
      xp: 0,
      pendingAttributePoints: 0,
      kingdomName: null,
      currentLocationId: initialLocation?.id ?? null,
      condicionFisica: 'ILESO',
      salud: 100,
      lastAteAtMinutes: 480,
      lastDrankAtMinutes: 480,
      energia: energiaMaxFor((save.attributes as AttributeBlock).constitucion),
      deathCount: 0,
      endedAt: null,
      lastRestLocationId: null,
      pausedAt: null,
      pendingCombatNpcSlugs: [],
      pendingNpcAttack: Prisma.JsonNull,
      // Bug real (2026-09-22, mismo hallazgo que el CombatEncounter huérfano de arriba): las 4
      // ofertas "pending" de modo dinámico/misión/interacción tampoco se limpiaban al reiniciar —
      // una oferta abierta en el momento del reinicio (p. ej. "GESGURIO BUSCA TU ATENCIÓN") seguía
      // reapareciendo en la partida ya reiniciada, con el `targetSlug` de la partida ANTERIOR.
      pendingDynamicMode: Prisma.JsonNull,
      pendingDynamicModeOffer: Prisma.JsonNull,
      pendingQuestOfferInfo: Prisma.JsonNull,
      pendingNpcInteractionOffer: Prisma.JsonNull,
      // Muerte permanente (2026-08-31) — un reinicio total también vuelve al tutorial no
      // superado, mismo criterio que el resto de este bloque (Día 1 sin nada acumulado).
      tutorialCompletedAt: null,
      pendingDeathResolution: false,
      // Punto del jugador en el mapa de Zona (2026-09-22, bug real: reiniciar una partida dejaba
      // al jugador en la última posición que tenía ANTES del reinicio, en vez de volver al punto
      // de entrada — este bloque nunca replicó los campos que `creation.ts` sí fija al crear una
      // partida nueva. Mismos valores/comentario que ahí: esquina noroeste calibrada para quedar
      // fuera del radio de persecución de la fauna agresiva conocida de "hondonada-del-eco".
      zonaPosX: 75,
      zonaPosY: 75,
      zonaPosEntradaX: 75,
      zonaPosEntradaY: 75,
      // Mismo hueco (2026-09-28): un trayecto a medias o el último encuentro de Zona de la partida
      // anterior tampoco deben sobrevivir al reinicio.
      zonaCaminoPendiente: Prisma.JsonNull,
      zonaUltimoEncuentro: Prisma.JsonNull,
    },
  });

  await recordEntityDiscoveries(
    {
      saveId: save.id,
      worldId: save.worldId,
      mentionedText: startingQuestsData
        .map((q) => q.objetivo)
        .filter((o): o is string => !!o)
        .join('\n'),
    },
    tx,
  );
  if (initialLocation) {
    await tx.locationVisit.upsert({
      where: { saveId_locationId: { saveId: save.id, locationId: initialLocation.id } },
      create: { saveId: save.id, locationId: initialLocation.id },
      update: {},
    });
  }
}
