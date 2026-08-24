import { env } from '../config/env.js';
import { narrateAction, generateNpcReply, hasFalseTravelClaim, hasFalsePhantomTravel, type ClassificationResult, type NarrationResult } from './narrador.js';
import { retrieveLore, formatLoreForPrompt, isWeaklyGrounded } from './retrieval.js';
import { xpForRollSuccess, xpForHitos, applyXp, type ProgressionResult, type HitoTipo } from './progression.js';
import { alivioForLevel, xpForCraftSuccess, professionLevelForXp } from './professionProgress.js';
import { tickKingdom, daysCrossed, DEFAULT_KINGDOM_STATS, territoryPopulationDelta, DIAS_PARA_CONSOLIDAR, DIAS_PARA_REBELION } from './kingdomTick.js';
import { appendSessionFacts, selectRelevantFacts } from './worldFacts.js';
import { closeItemQuests, completeNpcTargetQuests, grantQuestRewardItems, questRewardNarrationFor, type QuestCompletedInfo } from './questResolution.js';
import {
  applyFactionRepDelta,
  effectiveTemperamento,
  resolveFoundingOutcome,
  FACTION_REP_ATTACK_DELTA,
  FACTION_REP_PEACE_DELTA,
  type FoundingOutcome,
} from './reputation.js';
import {
  detectNpcsInScene,
  npcSceneBlockFor,
  difficultyHintFor,
  detectsAttackIntent,
  detectsHostileSearchIntent,
  detectsDialogueIntent,
  detectsVerbalAcceptanceIntent,
  detectsLootIntent,
  detectsExecuteIntent,
  detectsInventoryReviewIntent,
  scopeFor,
  pickAmbientEncounterCandidate,
  buildNpcInScene,
  hasPendingLoot,
  type NpcInScene,
  type NpcWithItems,
} from './npcScene.js';
import {
  resolveExchange,
  resolveIndependentExchange,
  rollInitiative,
  exchangeContextBlock,
  effectiveExchangeOutcome,
  independentExchangeContextBlock,
  hitSeverityHint,
  type PendingNpcAttack,
  type InitiativeResult,
  type CombatExchangeDisplay,
} from './combatExchange.js';
import { npcCombatAbilitiesFor, chooseNpcAbility } from './npcCombatAbilities.js';
import { detectHarvest, type HarvestMatch } from './harvest.js';
import { detectItemReference, detectMedicalItemUse, detectEnergyItemUse, detectsCompassUse, missingItemBlockFor } from './itemReference.js';
import { compassNarrationText, type CompassLinkInfo } from './compassNarration.js';
import { energiaMaxFor, nextEnergia } from './energy.js';
import { WEAPON_ABILITY_LEVEL_AVANZADA, dualWieldAdjustedDifficulty, weaponCategoryForRealAbilityName, type EquippedWeaponSlot } from './weaponAbilities.js';
import { syncDynamicCombatAbilities } from './dynamicAbilities.js';
import {
  CRAFTING_RECIPES,
  detectsCraftIntent,
  canCraft,
  craftRequisitoShortfalls,
  planCraftConsumption,
  hasToolForOficio,
  OFICIOS_CON_HERRAMIENTA_REQUERIDA,
} from './crafting.js';
import {
  detectsBuildIntent,
  checkRecipe,
  planRecipeConsumption,
  baseNameOf,
  quantityOf,
  CONSTRUCTION_RECIPES,
  companionSlotsForRecipeKey,
  computeBuildBlockedReason,
  type ConstructionRecipe,
  type RecipeCheck,
} from './construction.js';
import { shortfallLabel } from './requisitos.js';
import type { CatalogLookup, InventoryRowLike } from './ingredients.js';
import { classAbilityUnlocksFor } from './classAbilities.js';
import { professionAbilityUnlocksFor } from './professionAbilities.js';
import type { StartingAbility } from './startingAbilities.js';
import { protectedFactsFor } from './protectedFacts.js';
import { lintRegionMismatch } from './narrationLint.js';
import { decrementPopulationOnDeath, stripRegionArticle } from './population.js';
import {
  destinationsFrom,
  normalizeText,
  initialLocationSlugFor,
  matchDestination,
  detectsTravelIntent,
  detectsVagueMovementIntent,
  cardinalDirectionBetween,
  type TravelResolution,
} from './travel.js';
import { detectsRestIntent, type Produccion } from './timedActions.js';
import { claimChapterIfDue, scheduleChapterSummaryGeneration, releaseChapterClaim } from './chapterSummary.js';
import { captureLiveTeacherExample } from './liveTeacherCapture.js';
import { recordEntityDiscoveries } from './entityDiscovery.js';
import { detectsSearchIntent } from './discovery.js';
import {
  nextCondicionFisica,
  resolveDeathOutcome,
  whisperText,
  isValidRestLocationKind,
  isCondicionDowngrade,
  nextCondicionForAttack,
  saludForCondicion,
  saludBandFor,
  healCeilingFor,
  applySequentialHeals,
  npcRecoversFromConvaleciente,
  npcCorpseShouldDespawn,
} from './death.js';
import { continentForRegion, oppositeContinent } from '../lib/continent.js';
import { advanceFictionalMinutes, formatFictionalDate } from './worldClock.js';
import { prisma } from '../lib/prisma.js';
import type { RollResult, AttributeBlock, Attribute, GradoExito } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';
import { Prisma } from '@prisma/client';
import type { CondicionFisica, Dificultad, AbilityEffect, AbilityRol } from '@prisma/client';

const REINO_XP = { territory: 150, buildingActive: 100, firstSubject: 100, subject: 25, consolidado: 300 } as const;
/// Población anónima con la que arranca todo Territory nuevo (2026-08-23, Grupo 3) — un puñado de
/// gente ya vivía ahí o se instala al fundar, nunca 0 en seco. Misma cifra para RECLAMADO/DISPUTADO
/// — primera pasada, ajustable jugando.
const TERRITORIO_POBLACION_INICIAL = 15;

// Bug real (auditoría 2026-07-28): race entre worldTick.ts resolviendo un CharacterTransit vencido
// y POST /saves/:id/transit/cancel — el worker "reclama" el tránsito moviendo busyUntil al futuro
// (+10 min) mientras narra en segundo plano; en esa ventana, el endpoint de cancelar veía busyUntil
// en el futuro (igual que si aún no hubiera vencido) y borraba la fila con éxito, pero la narración
// en curso terminaba igual y persistía sus efectos — un "cancelado" con los efectos completos ya
// aplicados. Señal de que el caller es worldTick.ts y de que debe verificarse la cancelación.
export class TransitCancelledError extends Error {
  constructor() {
    super('El CharacterTransit fue cancelado mientras se resolvía este turno.');
    this.name = 'TransitCancelledError';
  }
}

function minutesLabel(minutos: number): string {
  if (minutos < 60) return `~${minutos} min`;
  const horas = minutos / 60;
  return horas < 24 ? `~${horas.toFixed(1)}h` : `~${(horas / 24).toFixed(1)}d`;
}

/// `WorldState.factionsStatus` es un `Json` de Prisma (sin esquema propio en BD) — este mismo
/// cast repetía 6 veces en este archivo (auditoría de deuda técnica 2026-08-21), uno por cada
/// sitio que lee el campo. Centralizado en un solo helper para no repetir la aserción de tipo.
function parseFactionsStatus(raw: Prisma.JsonValue | null | undefined): Record<string, number> {
  return (raw as Record<string, number> | null) ?? {};
}

interface NarrateAndPersistParams {
  saveId: string;
  worldId: string;
  action: string;
  characterSummary: string;
  characterName: string;
  timeLabel: string;
  sessionFacts: string[];
  currentXp: number;
  currentLevel: number;
  classification: ClassificationResult;
  roll?: RollResult;
  attributes: AttributeBlock;
  /// Recetas de crafteo desbloqueadas por recompensa de misión (2026-08-17) — ver
  /// CraftingRecipe.requiresUnlock (crafting.ts) y Save.unlockedRecipeKeys (schema.prisma).
  /// Opcional (default `[]`): el turno diferido de worldTick.ts todavía no lo pasa — sin ninguna
  /// receta `requiresUnlock:true` hoy, el efecto es idéntico a no pasarlo nunca.
  unlockedRecipeKeys?: string[];
  /// Sesión de diseño 2026-07-23: nunca se pasa a rollCheck — solo alimenta comprobaciones de
  /// UMBRAL (requisitos de crafteo/construcción, ver requisitos.ts).
  secondaryAttributes: SecondaryAttributeBlock;
  /// Slot de defensa (roadmap 2026-07-19): suma de bonificadores 'defensa' del equipo puesto
  /// (equipment.ts effectiveDefense) — resta a la dificultad de contraataque del NPC.
  defensa: number;
  /// Nombres de las armas equipadas ahora mismo (roadmap 2026-07-20, mitigación de calidad
  /// narrativa) — se le dice al modelo explícitamente en combate para que nunca confunda el arma
  /// del jugador con la del enemigo.
  equippedWeapons: string[];
  /// TODO el equipo puesto + su description real (2026-07-30, auditoría "revisar partida" — el
  /// Narrador nunca sabía qué llevaba puesto el personaje más allá del arma, ni conocía su
  /// aspecto/historia concretos, ver equipment.ts § equippedItemsSummary). Vacío en partidas
  /// previas a este campo (nunca null: el caller siempre lo deriva de `save.inventoryItems`).
  equippedItems: { name: string; description: string }[];
  /// Sistema de habilidades por arma/raza (2026-07-29) — slug de BERIG_RAZAS (berigLore.ts) o
  /// null (personaje sin raza asignada, partidas previas a este campo).
  raza: string | null;
  currentLocationId: string | null;
  /// Presente cuando /turn/classify resolvió un viaje por el grafo de ubicaciones (docs/12 § 1.4)
  /// — el mismo objeto viaja tal cual desde classify (síncrono) o desde CharacterTransit.zoneContext
  /// (diferido, worldTick), para que la llegada se resuelva aquí una sola vez.
  travel?: TravelResolution | null;
  /// Minutos ficticios que cuesta ESTE turno (travel.minutos si es viaje, computeDuration() si
  /// no) y el total acumulado antes de este turno — el reloj (worldClock.ts) avanza con esto al
  /// persistir, nunca lo decide el modelo. Ambos calculados por el caller (turn.ts/worldTick.ts),
  /// mismo patrón que `sessionFacts`/`timeLabel`.
  minutosDeEsteTurno: number;
  fictionalMinutesActuales: number;
  /// Roadmap 2026-07-19: antes la producción prometida ("debería conseguir 60 de leña") nunca se
  /// materializaba de verdad — computeDuration() ya calculada por el caller, mismo patrón que
  /// minutosDeEsteTurno. Solo se aplica en instantánea/corta (síncrono) o al resolver el
  /// CharacterTransit — nunca la decide el modelo.
  produccion?: Produccion;
  /// docs/14-combate-y-muerte.md § 1, § 4.
  condicionFisica: CondicionFisica;
  /// Sistema de fatiga (2026-07-29) — valor ACTUAL de energía antes de este turno; el tope real
  /// se deriva de `attributes.constitucion` (energy.ts § energiaMaxFor), nunca viaja aquí.
  energia: number;
  dificultad: Dificultad;
  deathCount: number;
  lastRestLocationId: string | null;
  /// true dentro del popup de combate (§ 2.3) — cambia el tono y permite que la condición
  /// física empeore hasta un escalón por turno; fuera de combate solo puede mejorar.
  enCombate?: boolean;
  /// Streaming (roadmap de velocidad, 2026-07-20, punto 13) — se reenvían tal cual a
  /// narrateAction. Ausentes en las llamadas diferidas de worldTick.ts (no hay cliente HTTP
  /// esperando), presentes en el turno síncrono de /turn/narrate.
  onNarrationChunk?: (delta: string) => void;
  onNarrationReset?: () => void;
  /// Animación de dados en paralelo (petición explícita, 2026-08-15: "que veas los resultados
  /// sacados por ambos... mientras la narración se genera") — el intercambio de combate (dos
  /// tiradas + desenlace) ya está resuelto del todo ANTES de llamar a `narrateAction` (se le pasa
  /// como contexto "YA RESUELTO, no lo cambies"), pero hasta ahora el frontend no se enteraba de
  /// nada hasta el `{type:'done'}` final, streaming de narración incluido — toda esa espera real
  /// del modelo local quedaba como tiempo muerto sin nada que mostrar. Se dispara UNA vez, justo
  /// antes de narrar, con el mismo `CombatExchangeDisplay` que después viaja también en la
  /// respuesta final (nunca dos cálculos distintos). `undefined` en turnos sin intercambio de
  /// combate — nunca se llama. `npcName` viaja aparte (no vive dentro de `CombatExchangeDisplay`)
  /// para que el frontend pueda etiquetar el dado del rival sin esperar al `npcAbilityUsed` final.
  onExchangeResolved?: (exchange: CombatExchangeDisplay, npcName: string | null) => void;
  /// Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2): id de la
  /// SavedAction pulsada en CombatModal.tsx, si la hay. Cuando resuelve a una con `effect` no
  /// nulo, ese efecto GANA sobre los regex de npcScene.ts (detectsAttackIntent) para decidir si
  /// el turno cuenta como golpe sobre el NPC, si un REMATE lo remata de verdad, y si el NPC
  /// contraataca este turno — los regex se quedan intactos solo para cuando el jugador escribe
  /// la acción a mano, sin pulsar ningún botón de habilidad.
  savedActionId?: string;
  /// Rediseño de combate (2026-08-09, petición explícita: "si uso un consumible el rival también
  /// puede actuar") — true cuando esta acción consume un objeto en combate (GameView.tsx §
  /// handleCombatUseItem, que hoy no manda `savedActionId`, solo texto libre). Hace que
  /// `combateActivo` se active igual que una habilidad real (el NPC puede actuar este turno) SIN
  /// que el consumo cuente nunca como golpe propio (`countsAsAttack` se queda en `false` a
  /// propósito) — antes de esto, consumir un objeto en tu turno de iniciativa no arriesgaba nada:
  /// ni intención de ataque ni `abilityEffect`, así que `combateActivo` salía `false` y el NPC
  /// nunca llegaba a responder.
  isItemUse?: boolean;
  /// Presente SOLO cuando llama worldTick.ts para resolver un CharacterTransit vencido (nunca en
  /// el turno síncrono de /turn/narrate) — el id de esa fila. Se borra DENTRO de la misma
  /// transacción que aplica los efectos del turno (en vez de después, como antes) para que sea
  /// atómico con POST /saves/:id/transit/cancel: si esa fila ya no existe (el jugador canceló
  /// mientras se narraba), el borrado afecta 0 filas y toda la transacción se aborta sin aplicar
  /// nada — ver TransitCancelledError.
  transitIdToFinalize?: string;
  /// Building.status EN_CONSTRUCCION real (2026-08-23, Grupo 3 § Building.status) — id de la fila
  /// que `turn.ts` ya creó EN_CONSTRUCCION al iniciar una construcción determinista (ver
  /// `planDeterministicBuild`, construction.ts, y `TransitZoneContext.buildingId`, worldTick.ts).
  /// Presente SOLO cuando esta llamada resuelve esa misma construcción — si `buildValidNow` sigue
  /// siendo true al llegar aquí, esta fila se completa a ACTIVO en vez de crearse una nueva; si la
  /// construcción pierde la carrera (`buildMode && !buildValidNow`, ver más abajo), se borra en
  /// vez de quedarse huérfana en EN_CONSTRUCCION para siempre. Nunca presente en el turno síncrono
  /// de /turn/narrate (ahí no hay `CharacterTransit`/`zoneContext` de por medio).
  earlyBuildingId?: string;
  /// Espera de viaje precalculada (2026-08-13, petición explícita: "el prompt se lanza ya en
  /// medio de la espera... dejandolo calculado" — no apilar la latencia del modelo DESPUÉS de la
  /// espera visual, solapar las dos). Presente SOLO cuando `turn.ts` arranca esta narración de
  /// forma anticipada, nada más iniciar un viaje sin evento (ver `startEagerTransitResolution`,
  /// workers/worldTick.ts) — todo el cómputo (narrar, resolver combate/crafteo/etc.) corre igual
  /// de pronto como siempre, pero la escritura real en BD (justo debajo) espera hasta esta fecha
  /// antes de comprometerse, para que el jugador nunca vea la llegada antes de que termine la
  /// espera visual que ya se le prometió (`CharacterTransit.busyUntil`). Si el cómputo tarda más
  /// que esto (poco frecuente), se compromete en cuanto termina, sin esperar de más.
  notBefore?: Date;
  /// Rediseño del turno de combate (2026-07-28) — `Save.pendingNpcAttack` leído por el caller
  /// (turn.ts) antes de llamar aquí. Presente = este turno es la defensa a ciegas del jugador
  /// contra un ataque de NPC ya decidido el intercambio anterior; ausente/null = el jugador tiene
  /// la iniciativa y este es su propio ataque (caso de siempre).
  pendingNpcAttack?: PendingNpcAttack | null;
  /// Auditoría de rendimiento 2026-07-28 ("rascar segundos"): /turn/classify ya calculó esto para
  /// la MISMA acción justo antes de llamar aquí (turn.ts) — sin esto, `detectNpcsInScene` volvía a
  /// traer TODO el roster de NPCs del mundo (con sus objetos) por segunda vez, mismo viaje de ida
  /// y vuelta a Supabase remoto que la primera. Ausente cuando llama worldTick.ts (resolución
  /// diferida, sin classify previo en esta llamada) — ahí se sigue calculando fresco.
  npcsInScene?: NpcInScene[];
  /// Saqueo selectivo (petición explícita, 2026-07-30: "que pueda marcar los objetos que me
  /// quiero quedar") — antes el saqueo copiaba SIEMPRE el loadout entero de cada NPC derrotado
  /// (decisión de la usuaria original, docs/12 § 4.5); si se manda esta lista, solo se copian los
  /// objetos cuyo nombre aparezca aquí, del resto no se crea nada. `undefined` (el botón
  /// "Registrar"/"Saquear todo" de uno en uno no la manda) preserva el comportamiento de siempre.
  lootItemNames?: string[];
  /// Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) — lista
  /// ORDENADA de qué `InventoryItem` usar y cuántas veces cada uno; el orden importa de verdad
  /// (ver `applySequentialHeals`, death.ts). `undefined`/vacío deja el camino de siempre intacto:
  /// `detectMedicalItemUse` sobre el texto libre de la acción, un único objeto, "mejor match".
  healItemUses?: { itemId: string; quantity: number }[];
  /// Bug real jugando en vivo (2026-08-04, "ronda larga de pruebas"): `Save.pendingCombatNpcSlugs`
  /// (a quién sigue enfrentado el jugador de un turno a otro) se escribía siempre pero nunca se
  /// leía aquí — un ataque de seguimiento SIN comillas ("le lanzo otro golpe al orco") caía
  /// directo a `npcsInScene[0]`, que no tiene ninguna relación con "contra quién sigo luchando".
  /// Un hecho de sesión de puro trasfondo ("el Orco persigue a Gistera Koh") basta para que
  /// `detectNpcsInScene` la cuele en escena por su alias — y si su Npc.id ordena antes que el del
  /// enemigo real, el combate entero se redirige en silencio contra ella, un PNJ nunca hostil.
  /// Presente = slugs de con quién ya estaba enfrentado ANTES de este turno (turn.ts, leído de
  /// `save.pendingCombatNpcSlugs`); ausente en las llamadas diferidas de worldTick.ts.
  pendingCombatNpcSlugs?: string[];
  /// Eventos de viaje interactivos (2026-08-05) — id de `Npc` elegido por `pickTravelInterruption`
  /// (turn.ts) al iniciar un viaje que se truncó a mitad de camino. Presente = este turno de
  /// llegada debe meter a ese NPC en escena de forma determinista (no depende de que el Narrador
  /// narre su nombre), para que combate forzado/diálogo lo traten como a cualquier NPC real.
  travelInterruptionNpcId?: string | null;
  /// Nombre del destino que el jugador pidió de verdad, antes de truncar (turn.ts) — si está
  /// presente, se escribe un LogEntry determinista aparte avisando de la interrupción (nunca se le
  /// pasa al Narrador: no tiene por qué saber a dónde iba el jugador para narrar bien la llegada).
  travelInterruptionOriginalDestinationName?: string | null;
}

export interface NewInventoryItemInfo {
  id: string;
  name: string;
  description: string;
  origin: string | null;
  slot: null;
  statBonuses: Prisma.JsonValue | null;
  /// Ranura de equipo real del catálogo (2026-07-30, "categorizar por ranura") — null si no hay
  /// catalogSlug (narrativo suelto) o si el catálogo aún no la tiene asignada. Sin esto, un objeto
  /// recién saqueado/crafteado no sabía en qué hueco encaja hasta recargar la partida entera.
  equipSlot: string | null;
  /// Clave de efecto especial de catálogo (bug real jugando, 2026-08-06: "Mapa de las Llanuras"
  /// saqueado en pleno turno no activaba los puntos del mapa hasta recargar la partida entera —
  /// mismo patrón exacto ya arreglado una vez para `equipSlot`, ver comentario ahí). Null si el
  /// objeto no tiene catalogSlug o su entrada de catálogo no es ESPECIAL.
  effectKey: string | null;
  /// Categorización real para agrupar el Inventario (bug real jugando en vivo, 2026-08-07 —
  /// mismo patrón exacto que equipSlot/effectKey de arriba, olvidado en los dos arreglos
  /// anteriores): sin esto, un objeto recién conseguido este turno (saqueo/crafteo/despiece/
  /// construcción/recolección) se veía "sin categorizar" en el Inventario hasta recargar la
  /// partida entera, porque `InventoryItem` no guarda `tipo` — se calcula al vuelo en `detail.ts`
  /// vía join con `ItemCatalog`. `null` solo para objetos narrativos sin `catalogSlug` (newItem).
  tipo: string | null;
}

/// Notificación de fundación de reino (2026-08-04, "el Ayuntamiento" — docs/17-reglas-
/// construcciones-reino.md) — se rellena solo al construir el Ayuntamiento tier 1 desde cero
/// (nunca en una mejora de tier), para que el frontend abra el popup de fundación de facción.
export interface KingdomFoundedInfo {
  title: string;
  region: string;
  outcome: FoundingOutcome;
  /// "Maktor" precargado si `characterName === 'Gorhorn'`, si no null (formulario en blanco).
  suggestedName: string | null;
  /// true solo para Gorhorn — el nombre del reino queda bloqueado, verificado también en el
  /// backend al fundar de verdad (POST /saves/:id/reino/fundar), no solo aquí.
  nameLocked: boolean;
}

export interface NarrateAndPersistResult {
  narration: NarrationResult;
  progression: ProgressionResult;
  condicionFisica: CondicionFisica;
  /// Sistema de fatiga (2026-07-29) — energía real tras este turno y su tope actual (deriva de
  /// Constitución, ver energy.ts § energiaMaxFor), para que el frontend pinte la barra sin tener
  /// que recalcularlo por su cuenta.
  energia: number;
  energiaMax: number;
  /// Hora ficticia real tras este turno (worldClock.ts) — ver el comentario en el `return` de
  /// `narrateAndPersistTurn` para el bug que cierra: sin esto, el frontend no tenía forma de saber
  /// que el reloj había avanzado dentro de una sesión en vivo, y seguía sellando cada entrada nueva
  /// del log con la hora del último `syncFromSave` completo.
  timeLabel: string;
  /// Enriquecido con nombres y estado real (el modelo solo propone slugs, § 2.5) para que el
  /// frontend pueda mostrar el popup de combate ya sincronizado con `NpcState`, sin una consulta
  /// adicional ni asumir que todo NPC arranca ILESO/sin saquear.
  combateIniciado?: {
    npcs: { slug: string; name: string; condicionFisica: CondicionFisica; saqueado: boolean; lootedItemNames: string[]; analizado: boolean }[];
  } | null;
  finDePartida: boolean;
  /// Bug real (2026-07-29, "si muero no hace lo que fijamos que haría" en combate): cuando la
  /// muerte es sobrevivible (no dispara fin de partida), `condicionFisica` de abajo ya vuelve
  /// resuelta a ILESO (el respawn ya ocurrió en esta misma transacción, § 4.3 de
  /// docs/14-combate-y-muerte.md) — el frontend nunca podía distinguir "moriste y reapareciste
  /// este turno" de "no pasó nada", así que el combate en curso nunca se cerraba tras una muerte
  /// no definitiva (seguía el mismo combate como si el jugador no hubiera muerto). true siempre
  /// que este turno propuso MUERTO, sobreviva o no a `finDePartida`.
  justDied: boolean;
  /// Roadmap 2026-07-19 (bug real de UI encontrado en auditoría de frontend): loot/despiece/
  /// producción se materializaban de verdad en la DB, pero `/turn/narrate` nunca devolvía esos
  /// objetos — el inventario en pantalla se quedaba desactualizado hasta recargar la partida.
  /// Ahora el frontend puede añadirlos directamente al estado local sin otra consulta.
  newInventoryItems: NewInventoryItemInfo[];
  /// Bug real (auditoría de código completa, 2026-08-07): crafteo/construcción SÍ borran/reducen
  /// filas reales de InventoryItem al consumir materiales (`plan.deleteIds`/`plan.updateRemainder`
  /// más abajo), pero `/turn/narrate` nunca lo comunicaba — el inventario en pantalla seguía
  /// mostrando materiales ya gastados (fantasma) hasta recargar la partida entera. Mismo criterio
  /// que `newInventoryItems`: el frontend aplica esto directo al estado local, sin otra consulta.
  removedInventoryItemIds: string[];
  /// Filas que NO desaparecen del todo pero cambian de nombre (p. ej. "Piedra (5)" → "Piedra (2)")
  /// al consumirse solo una parte de una pila — mismo hueco que `removedInventoryItemIds`.
  updatedInventoryItems: { id: string; name: string }[];
  /// Id real de la fila LogEntry de esta narración (rework 2026-07-24, persistencia de banners de
  /// entidad) — el frontend ya no usa un id inventado (`c-${Date.now()}`) para la entrada que
  /// acaba de crear, así que puede pedir luego "guarda esta imagen en esta entrada de verdad".
  logEntryId: string;
  /// Bug real (2026-07-25, "revisar partida"): una misión podía crearse/cerrarse de verdad en la
  /// DB este turno (newQuest, la misión determinista del Orco Enfurecido, cierre automático al
  /// derrotar/recoger un objetivo...) sin que `/turn/narrate` devolviera nada al respecto — el
  /// panel de Misiones se quedaba desactualizado hasta recargar la partida entera (mismo patrón
  /// de bug que ya se arregló una vez para el inventario, ver newInventoryItems arriba). Devuelve
  /// la lista COMPLETA de misiones de la partida (no solo un delta) — más simple y sin riesgo de
  /// omitir un cambio, dado que este turno puede tocar varias misiones a la vez por caminos
  /// distintos (newQuest del modelo, el fallback determinista, cierre por derrota/recolección).
  /// `targetLocationSlug` (bug real, auditoría 2026-07-30: se dejaba en null aquí "a propósito",
  /// pero MapaPanel.tsx SÍ lo lee para dibujar el marcador de misión en el mapa — `setQuests`
  /// sustituye el array entero en cada turno, así que el marcador desaparecía en cuanto se jugaba
  /// cualquier acción, hasta la próxima recarga completa) — resuelto igual que en
  /// routes/saves/detail.ts, mismo cruce Location/Npc.
  quests: {
    id: string;
    title: string;
    description: string;
    status: string;
    objetivo: string | null;
    rewardXp: number | null;
    rewardItems: string[];
    targetLocationSlug: string | null;
  }[];
  /// Notificación de misión aceptada (2026-07-31, petición explícita: "que aparezca en la
  /// narración del personaje el título de la misión y el objetivo, a modo de notificación") — a
  /// diferencia de `quests` (lista completa, sin delta), esto marca explícitamente que ESTE turno
  /// creó una misión nueva, para que el frontend la resalte sin tener que comparar arrays. `null`
  /// en la inmensa mayoría de turnos, que no crean ninguna.
  newQuestInfo: { title: string; objetivo: string } | null;
  /// Notificación de misión COMPLETADA (2026-08-13, hallazgo real jugando: la narración de
  /// recompensa — questRewardNarrationFor — se persistía bien como LogEntry aparte, pero
  /// `/turn/narrate` nunca avisaba de que existía, así que ese turno el jugador solo veía la
  /// narración normal de combate; la entrada de recompensa aparecía sin más, sin destacar, y solo
  /// tras la siguiente recarga completa). Mismo criterio que `newQuestInfo`: `null` en la inmensa
  /// mayoría de turnos, que no completan ninguna.
  questCompletedInfo: QuestCompletedInfo | null;
  /// Notificación de fundación de reino (2026-08-04, "el Ayuntamiento") — solo al construir el
  /// Ayuntamiento tier 1 desde cero, nunca en una mejora. `null` en la inmensa mayoría de turnos.
  newKingdomFounded: KingdomFoundedInfo | null;
  /// Compañero REALMENTE creado este turno (2026-08-04, tope de slots) — null si no hubo ninguna
  /// propuesta o si se rechazó por falta de hueco. El frontend debe fiarse de esto, no de
  /// `narration.newCompanion` directo (ese solo dice qué PROPUSO el modelo, no qué pasó de verdad).
  companionCreated: { id: string; name: string; role: string; notes: string } | null;
  /// Rediseño del turno de combate (2026-07-28) — true si la iniciativa del PRÓXIMO intercambio
  /// favorece al NPC: el frontend debe pedirle al jugador que elija su defensa a ciegas en su
  /// siguiente sumisión, en vez del modo de ataque normal. Nunca revela CUÁL habilidad eligió el
  /// NPC (eso vive solo en `Save.pendingNpcAttack`, oculto) — solo que le toca defenderse.
  esperandoDefensaJugador: boolean;
  /// Bug real (2026-07-29, "no sé qué ataques usa el enemigo... es poco claro el combate"): la
  /// narración libre del modelo no garantizaba mencionar qué habilidad usó el NPC — este campo
  /// da al frontend el nombre real, ya resuelto, de la habilidad de ataque/defensa que el NPC
  /// acaba de usar en el intercambio de ESTE turno. null si no hubo intercambio de combate.
  npcAbilityUsed: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa'; maxUsesPerCombat?: number | null } | null;
  /// Revisión de partida 2026-08-08, petición explícita: "que aparezca el resultado de las
  /// tiradas... qué atributo y valor sacó [el jugador] y el del enemigo y por qué perdió o ganó" —
  /// las dos tiradas reales del intercambio de ESTE turno (ver `CombatExchangeDisplay`,
  /// combatExchange.ts), null si no hubo intercambio.
  combatExchangeDisplay: CombatExchangeDisplay | null;
  /// Mismo hueco exacto que `npcAbilityUsed` pero para el lado del jugador (petición explícita,
  /// misma revisión: "cuando seleccione una habilidad esta se refleje en la narración con su
  /// descripción") — null en texto libre sin botón o sin intercambio.
  playerAbilityUsed: { name: string; icon: string; description: string; rol: 'ataque' | 'defensa' } | null;
  /// Rediseño del turno de combate (2026-07-29, "quiero que sea más claro cuando es turno de
  /// ataque... indicándome qué salió en los dados para saber por qué ataco primero") — tirada real
  /// de iniciativa que decidió quién actúa en el PRÓXIMO intercambio, calculada al resolver ESTE
  /// turno. null si la iniciativa se forzó sin dados (aturdimiento/intimidación) o si no hubo
  /// intercambio de combate este turno.
  nextInitiativeRoll: InitiativeResult | null;
  /// Bug real (auditoría de deuda técnica 2026-08-04): construir/mejorar/fundar podía persistir de
  /// verdad en la DB (Building/Territory/KingdomStats) sin que `/turn/narrate` devolviera nada al
  /// respecto — el mapa y el panel de Reino se quedaban desactualizados hasta recargar la partida
  /// entera (mismo patrón de bug ya arreglado una vez para inventario/misiones, ver `quests` más
  /// arriba). Mismo criterio que `quests`: listas COMPLETAS ya fuera de la transacción (que a estas
  /// alturas ya ha hecho commit), no un delta a mano — más simple y sin riesgo de omitir un cambio.
  territories: { id: string; name: string; region: string | null; description: string; control: string; population: number }[];
  buildings: {
    id: string;
    territoryId: string | null;
    locationId: string | null;
    recipeKey: string | null;
    tier: number | null;
    name: string;
    kind: string;
    status: string;
    description: string;
  }[];
  subjects: { id: string; territoryId: string | null; name: string; role: string; notes: string }[];
  kingdomStats: {
    poblacion: number;
    felicidad: number;
    comida: number;
    bebida: number;
    riqueza: number;
    soldados: number;
    trabajadores: number;
    visitantes: number;
  } | null;
  /// deathCount/factionsStatus/professionProgress (auditoría 2026-08-06) — mismo criterio que
  /// territories/buildings/subjects/kingdomStats arriba: el frontend necesita el valor YA
  /// actualizado por este turno, no solo lo que tenía cacheado desde el último `syncFromSave`.
  deathCount: number;
  factionsStatus: Record<string, number>;
  professionProgress: { professionId: string; nivel: number; xp: number }[];
}

async function resolveInitialLocationId(
  tx: Prisma.TransactionClient,
  worldId: string,
  characterName: string,
): Promise<string | undefined> {
  const slug = initialLocationSlugFor(characterName);
  if (!slug) return undefined;
  const location = await tx.location.findUnique({ where: { worldId_slug: { worldId, slug } } });
  return location?.id;
}

export interface CombatExchangePhaseInput {
  combateActivo: boolean | null | undefined;
  npcParaIntercambio: NpcInScene | null;
  pendingNpcAttack: PendingNpcAttack | null | undefined;
  pendingNpcStillHere: NpcInScene | null;
  requiereTirada: boolean;
  classificationAtributo: Attribute;
  currentLevel: number;
  condicionFisicaJugador: CondicionFisica;
  attributes: AttributeBlock;
  defensa: number;
  characterName: string;
  /// Lista (2026-08-15, "que una habilidad pueda tener múltiples AbilityEffects") — [] en texto
  /// libre sin botón o si la habilidad elegida no lleva ningún efecto mecánico.
  abilityEffects: AbilityEffect[];
  /// Rediseño de combate (2026-08-09) — rol de la habilidad elegida por el jugador este turno,
  /// paralelo a `abilityEffects` (mismo criterio: null en texto libre sin botón). Decide si este
  /// intercambio se resuelve por `resolveExchange` (ataque-vs-defensa, tabla cruzada) o por
  /// `resolveIndependentExchange` (en cuanto CUALQUIER lado es 'utilidad' — tiradas independientes,
  /// ver combatExchange.ts) y si el gate de daño incondicional (`countsAsAttack` más abajo) se
  /// activa en absoluto.
  abilityRol: 'ataque' | 'defensa' | 'utilidad' | null;
  /// Rediseño de combate (2026-08-09) — ya calculado por el caller con el mismo criterio que
  /// decide `combateActivo` (detectsAttackIntent/abilityRol==='ataque'). CASO ATAQUE lo usa para
  /// el valor por defecto de `jugadorRol` en texto libre SIN botón (`abilityRol === null`) — nunca
  /// asumir 'ataque' a ciegas ahí, o un turno de solo consumir un objeto (que activa
  /// `combateActivo` desde el rediseño de "consumibles gastan turno" pero nunca debería hacer
  /// daño) colaría un golpe válido igual.
  countsAsAttack: boolean;
  /// Habilidad real por categoría de arma colapsada por llevar la misma en las dos manos
  /// (2026-07-31, ver WeaponAbility.dualWield/DUAL_WIELD_DIFFICULTY_BONUS) — true cuando la
  /// habilidad elegida ESTE turno (savedActionId) lo es. Solo se aplica en el CASO ATAQUE (el
  /// jugador tiene la iniciativa) — reduce la dificultad de SU tirada, nunca dobla el intercambio.
  dualWieldBonus: boolean;
  /// Habilidad elegida por el jugador este turno (savedActionId ya resuelto contra SavedAction,
  /// ver el caller) — null en texto libre sin botón. Revisión de partida 2026-08-08, petición
  /// explícita: "falta que cuando seleccione una habilidad esta se refleje en la narración con su
  /// descripción, para que así sepamos que usamos" — mismo hueco que ya se cerró para el NPC
  /// (`npcAbilityUsed`) nunca se cerró para el propio jugador.
  selectedAbility: { name: string; icon: string; description: string } | null;
  /// Emboscada real (petición explícita, 2026-08-22: "¿siempre empiezo atacando yo?" — sí, hasta
  /// ahora: sin `pendingNpcAttack` previo el primer intercambio de cualquier combate nuevo entraba
  /// SIEMPRE por el CASO ATAQUE del jugador, aunque `ambushHint` (narrador.ts) narrara "el NPC te
  /// sorprende a ti" en el turno de apertura — la narración no tenía ningún efecto mecánico real).
  /// `openingAmbush` = mismo criterio que `hostileEngagement` de narrador.ts (`!enCombate &&
  /// npcsInScene.length > 0 && (detectsAttackIntent || detectsHostileSearchIntent)`), calculado
  /// por el caller ANTES de saber `combateActivo` (que en este turno concreto es siempre false).
  openingAmbush: boolean;
  /// `roll.gradoExito` de la tirada tabulada de ESTE turno de apertura — 'fallo' siembra un
  /// `pendingNpcAttack` real (ver bloque nuevo antes de `combateActivo`), para que el próximo
  /// intercambio (ya dentro del panel) llegue como defensa a ciegas del jugador, coherente con lo
  /// que la narración ya decía. `null` fuera de este escenario (sin roll, o turno normal).
  rollGradoExito: GradoExito | null;
}

export interface CombatExchangePhaseResult {
  npcAttackTarget: NpcInScene | null;
  npcAttackHits: boolean;
  npcTargetNewCondicion: CondicionFisica | null;
  jugadorRecibeGolpe: boolean;
  jugadorGolpeEfectos: AbilityEffect[];
  nuevoPendingNpcAttack: PendingNpcAttack | null;
  exchangeNarrationBlock: string | null;
  combatExchangeRoll: RollResult | null;
  npcAbilityUsed: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa'; maxUsesPerCombat?: number | null } | null;
  /// Cara visible de las dos tiradas del intercambio (jugador y NPC), ver
  /// `CombatExchangeDisplay` (combatExchange.ts) — null si no hubo intercambio real este turno.
  combatExchangeDisplay: CombatExchangeDisplay | null;
  /// Habilidad del JUGADOR usada en este intercambio (nombre/icono/descripción de catálogo, ver
  /// `CombatExchangePhaseInput.selectedAbility`) — null en texto libre sin botón o sin intercambio.
  playerAbilityUsed: { name: string; icon: string; description: string; rol: 'ataque' | 'defensa' } | null;
  nextInitiativeRoll: InitiativeResult | null;
  exchangeHappened: boolean;
  npcEnergiaMax: number | null;
  npcNuevaEnergia: number | null;
  /// "Revisar partida" 2026-07-30 (queja explícita: "las habilidades que no son de ataque no
  /// tienen mucho sentido con la narración... no queda claro si la estás usando") — a diferencia
  /// del golpe/fallo normal (que ya tiene su bloque `exchangeNarrationBlock`), el efecto real de
  /// ATURDIMIENTO/INTIMIDACION (quién gana la iniciativa siguiente) y REMATE (mata solo si el
  /// objetivo ya estaba GRAVE/CONVALECIENTE) se decidía puramente en memoria y nunca se le
  /// mencionaba al Narrador — el modelo solo veía golpea/falla, nunca "esto además lo aturdió" o
  /// "el remate no bastó para matarlo". Null salvo cuando el jugador ataca (tiene la iniciativa)
  /// con una de estas 3 habilidades.
  abilityEffectHint: string | null;
  /// Rediseño de combate (2026-08-09) — true cuando "Analizar rival" se resolvió con éxito este
  /// intercambio (rol:'utilidad', effect:'ANALISIS', tirada propia con éxito — nunca reactivo al
  /// rival). El caller (narrateAndPersistTurn) escribe `NpcState.analizado = true` cuando esto es
  /// cierto, mismo criterio idempotente que el resto de NpcState.
  analizarRivalExito: boolean;
  /// RECUPERACION (2026-08-17) — bonus de energía del jugador este intercambio, aparte del
  /// `energyRegen` propio de la habilidad; el bonus del lado NPC ya se suma dentro de esta función
  /// a `npcNuevaEnergia` directamente (no necesita salir aparte). El caller lo suma a su propio
  /// cálculo de `nuevaEnergia` (fuera de esta función, no tiene acceso a `energiaMax` del jugador).
  jugadorRecuperacionExtra: number;
}

/// Rediseño de combate (2026-08-09) — ¿se dispara el efecto reactivo de una habilidad
/// `rol:'utilidad'` este intercambio? Dos reglas, según el propio `effect`:
/// - `ANALISIS` (Analizar rival): NO reactiva — solo depende de la propia tirada, nunca de qué
///   eligió el rival (petición explícita: revela el atributo recomendado con solo usarla y
///   acertar tu tirada, no hace falta que el rival ataque).
/// - Cualquier otro (`ATAQUE`=Contraataque, `INTIMIDACION`=Grito de Guerra, `ATURDIMIENTO`=
///   Instinto Salvaje): reactiva de verdad — exige AMBAS cosas a la vez: la tirada PROPIA tuvo
///   éxito (`ownEfectoAplica`, independiente de la tirada del rival, ver
///   `resolveIndependentExchange`) Y la habilidad que el RIVAL eligió este mismo intercambio es
///   `rol:'ataque'` (si el rival se defendió o usó utilidad, no hay ataque de daño al que
///   reaccionar, así que nunca se dispara).
function utilityTriggered(
  ownRol: 'ataque' | 'defensa' | 'utilidad',
  ownEffects: AbilityEffect[],
  ownEfectoAplica: boolean,
  opponentRol: 'ataque' | 'defensa' | 'utilidad',
): boolean {
  if (ownRol !== 'utilidad' || !ownEfectoAplica) return false;
  if (ownEffects.includes('ANALISIS')) return true;
  return opponentRol === 'ataque';
}

/// Etiqueta en prosa, minúscula, de cada `CondicionFisica` — para la narración determinista del
/// panel "Curar" (2026-08-18), nunca para hints al Narrador (esos usan `saludBandFor`, distinto
/// criterio cualitativo).
const CONDICION_NARRATION_LABEL: Record<CondicionFisica, string> = {
  ILESO: 'ileso',
  HERIDO: 'herido',
  GRAVE: 'grave',
  CONVALECIENTE: 'convaleciente',
  MUERTO: 'muerto',
};

/// Frase "YA RESUELTO" para el Narrador sobre CADA efecto concreto de una habilidad de utilidad
/// (rediseño de combate, 2026-08-09; multi-efecto 2026-08-15, "que una habilidad pueda tener
/// múltiples AbilityEffects") — companion de `utilityTriggered`. Una habilidad con varios efectos
/// reconocidos aquí concatena una frase por cada uno; un efecto no reconocido (la mayoría de los
/// ~19 nuevos siguen sin mecánica propia, ver schema.prisma § AbilityEffect — RECUPERACION es el
/// primero implementado, 2026-08-17) simplemente no añade nada, no revienta.
/// `userName`/`rivalName` son de quién usó la utilidad y contra quién, en ese orden (funciona
/// igual si es el jugador o el NPC quien la usó — el caller decide el orden de los nombres).
const UTILITY_EFFECT_NARRATION: Partial<Record<AbilityEffect, (triggered: boolean, userName: string, rivalName: string) => string>> = {
  ATAQUE: (triggered, userName, rivalName) => // Contraataque
    triggered
      ? `El contraataque de ${userName} responde de vuelta contra ${rivalName} — narra el golpe de respuesta, aparte del ataque original.`
      : `${userName} se prepara para contraatacar, pero no llega a responder de verdad esta vez (o ${rivalName} no atacó con daño) — no hay golpe de respuesta que narrar.`,
  INTIMIDACION: (triggered, userName, rivalName) => // Grito de Guerra
    triggered
      ? `El grito de ${userName} quiebra por completo el ataque de ${rivalName} — su golpe NO llega a conectar en absoluto, y ${userName} se queda con la iniciativa del próximo intercambio. Narra el ataque frustrado, nunca un golpe que sí llega.`
      : `El grito de ${userName} no consigue nada especial esta vez (${rivalName} no atacó con daño, o el intento falla) — narra sin ningún efecto añadido.`,
  ATURDIMIENTO: (triggered, userName, rivalName) => // Instinto Salvaje/Barrido Salvaje
    triggered
      ? `El arrebato de ${userName} desorienta a ${rivalName} — ${userName} se queda con la iniciativa del próximo intercambio (el golpe de ${rivalName}, si conecta, sigue haciéndolo igual). Narra el desconcierto, sin que esto por sí solo hiera a nadie.`
      : `El arrebato de ${userName} no consigue desorientar a nadie esta vez (${rivalName} no atacó con daño, o el intento falla).`,
  ANALISIS: (triggered, userName, rivalName) => // Analizar rival
    triggered
      ? `${userName} lee con éxito el punto débil de ${rivalName} — narra el instante de estudio, nunca un golpe.`
      : `${userName} intenta leer a ${rivalName} pero no consigue sacar nada útil esta vez — narra el intento fallido, nunca un golpe.`,
  // RECUPERACION (2026-08-17, primera mecánica real de los ~19 efectos que la usuaria dejó solo
  // como nombre + comentario) — recupera energía de más allá del `energyRegen` propio de la
  // habilidad (ver RECUPERACION_ENERGY_BONUS más arriba), sin cancelar ni añadir ningún golpe.
  RECUPERACION: (triggered, userName) =>
    triggered
      ? `${userName} recupera un extra de aliento con este movimiento — narra el respiro, sin que afecte al golpe en sí.`
      : `${userName} intenta recuperar aliento con este movimiento, pero no llega a conseguirlo esta vez.`,
};

function utilityNarrationHint(effects: AbilityEffect[], triggered: boolean, userName: string, rivalName: string): string {
  return effects
    .map((effect) => UTILITY_EFFECT_NARRATION[effect]?.(triggered, userName, rivalName))
    .filter((text): text is string => !!text)
    .join(' ');
}

/// Rediseño del turno de combate (2026-07-28, extraído a función propia en la auditoría de
/// deuda técnica 2026-07-30 — este bloque es, con diferencia, el más denso de todo el archivo y
/// el que más bugs reales ha causado por estado compartido mal hilado, ver los comentarios de
/// `combatSlugs`/`golpes_mutuos` más abajo en el historial de git): resuelve QUIÉN golpea a quién
/// este turno — "primero se tiran dados y se ve quien ataca primero... el otro entra en un turno
/// de defensa... con su propia tirada de dados independiente de la de ataque" — y decide la
/// iniciativa del PRÓXIMO intercambio. Puro respecto a la base de datos (no escribe nada); quien
/// llama decide qué persistir con el resultado.
function resolveCombatExchangePhase(input: CombatExchangePhaseInput): CombatExchangePhaseResult {
  const { npcParaIntercambio, pendingNpcAttack, pendingNpcStillHere, attributes, defensa, characterName, abilityEffects, abilityRol } = input;

  let npcAttackTarget: NpcInScene | null = null;
  let npcAttackHits = false;
  let npcTargetNewCondicion: CondicionFisica | null = null;
  // El jugador puede recibir un golpe en CUALQUIERA de los dos casos: si el NPC tiene la
  // iniciativa (ataque directo), o incluso atacando él mismo, si su ataque falla del todo y la
  // defensa del NPC es tan buena que de propina replica (`defensor_contragolpea`).
  let jugadorRecibeGolpe = false;
  let jugadorGolpeEfectos: AbilityEffect[] = [];
  // RECUPERACION (2026-08-17, "sirve para recuperar la energia indicada por la habilidad") — bonus
  // de energía aparte del `energyRegen` propio de la habilidad, solo cuando el efecto de verdad se
  // dispara (mismo `jugadorDisparo`/`npcDisparo` que ya gatea ATAQUE/INTIMIDACION/ATURDIMIENTO).
  // Cifra fija (2026-08-17): no hay ningún dato en el catálogo hoy que exprese "cuánta energía
  // recupera" por separado del `energyRegen` normal — mismo criterio que el resto de cifras nuevas
  // de esta pasada (documentado, ajustable si hace falta).
  const RECUPERACION_ENERGY_BONUS = 15;
  let jugadorRecuperacionExtra = 0;
  let npcRecuperacionExtra = 0;
  // Ataque de NPC para el PRÓXIMO intercambio, si la iniciativa lo favorece — se persiste en
  // Save.pendingNpcAttack (ver tx.save.update más abajo) para que el jugador lo defienda a
  // ciegas en su siguiente sumisión.
  let nuevoPendingNpcAttack: PendingNpcAttack | null = null;
  // `contextBlocks` (el array real donde se acumula el texto para el Narrador) vive en el caller
  // — este intercambio se resuelve antes de esa declaración, así que el texto se devuelve aquí y
  // el caller lo empuja en cuanto `contextBlocks` existe.
  let exchangeNarrationBlock: string | null = null;
  // Auditoría 2026-07-28: el roll tabulado de /turn/classify (`roll`, en el caller) ya no decide
  // nada del combate desde que resolveExchange existe — antes seguía usándose para la XP y el
  // RollBadge persistido, completamente desconectado del resultado real del intercambio (podía
  // marcar "Éxito" junto a una narración que describía un fallo total). El lado del jugador en
  // el intercambio (`combatExchangeRoll`) pasa a ser la única fuente de verdad para los dos.
  let combatExchangeRoll: RollResult | null = null;
  // Ver comentario de `CombatExchangePhaseResult.combatExchangeDisplay`/`playerAbilityUsed` más
  // arriba — se rellenan en cada una de las dos ramas de abajo, siempre que haya intercambio.
  let combatExchangeDisplay: CombatExchangeDisplay | null = null;
  // `rol` aquí es de qué LADO del intercambio jugó cada uno este turno (ataque/defensa, igual que
  // el parámetro `side` de chooseNpcAbility) — no la clasificación `rol` propia de la habilidad
  // (que puede ser 'utilidad' aunque se esté jugando en el lado "defensa", p.ej. Contraataque).
  let playerAbilityUsed: { name: string; icon: string; description: string; rol: 'ataque' | 'defensa' } | null = null;
  // Nombre real de la habilidad de ataque/defensa que usó el NPC en el intercambio de este turno
  // (2026-07-29, ver NarrateAndPersistResult.npcAbilityUsed) — se rellena en cada una de las dos
  // ramas de abajo, siempre que haya intercambio.
  let npcAbilityUsed: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa'; maxUsesPerCombat?: number | null } | null = null;
  // Tirada real de iniciativa que decide QUIÉN actúa en el próximo intercambio (2026-07-29, "quiero
  // que sea más claro cuando es turno de ataque... indicándome qué salió en los dados") — null
  // cuando la iniciativa se fuerza sin dados (aturdimiento/intimidación del turno anterior, ver
  // más abajo) o cuando no hubo intercambio de combate este turno.
  let nextInitiativeRoll: InitiativeResult | null = null;
  // Sistema de fatiga (2026-07-29) — hoisted fuera del bloque de abajo: hace falta después, al
  // calcular la energía de este turno, sepa o no haber intercambio real de combate.
  let exchangeHappened = false;
  // Sistema de fatiga simétrico (2026-07-30, deuda técnica: "los NPC siguen eligiendo habilidad
  // sin restricción de energía") — energía persistida del NPC tras este intercambio, mismas
  // reglas que `nuevaEnergia` del jugador pero mirando el rol que tuvo EL NPC. null si no hubo
  // intercambio real este turno (no se toca NpcState.energia).
  let npcEnergiaMax: number | null = null;
  let npcNuevaEnergia: number | null = null;
  // Ver comentario de `CombatExchangePhaseResult.abilityEffectHint` más arriba.
  let abilityEffectHint: string | null = null;
  // Ver comentario de `CombatExchangePhaseResult.analizarRivalExito` más arriba.
  let analizarRivalExito = false;
  // Rediseño de combate (2026-08-09) — cuando una habilidad de utilidad reactiva (Grito de
  // Guerra/Instinto Salvaje) se dispara, roba la iniciativa siguiente SIN pasar por la tirada de
  // `rollInitiative` — sustituye a `jugadorAturdioAlNpc`/`npcAturdioAlJugador` (más abajo) para el
  // camino independiente, mismo espíritu ('quien aturde/intimida se garantiza la iniciativa').
  let iniciativaForzadaPorUtilidad: 'jugador' | 'npc' | null = null;

  // Emboscada real del turno de apertura (2026-08-22, ver comentario de `openingAmbush` arriba) —
  // deliberadamente FUERA del `if (input.combateActivo...)` de abajo: este turno concreto nunca
  // tiene `combateActivo` true (el frontend todavía no manda `enCombate:true`), así que sin esto
  // ningún intercambio real llega a correr aquí. Solo siembra `nuevoPendingNpcAttack` — nada más
  // de este resultado se toca (`exchangeHappened` se queda en false, `npcAttackHits`/
  // `npcTargetNewCondicion` en sus valores por defecto): no hay ningún golpe ni cambio de
  // condición este turno, solo se decide QUIÉN actuará primero en el próximo intercambio real.
  if (!input.combateActivo && input.openingAmbush && input.rollGradoExito === 'fallo' && npcParaIntercambio) {
    const npcWeaponNames = npcParaIntercambio.items.filter((i) => i.category === 'arma').map((i) => i.name);
    const npcAbilities = npcCombatAbilitiesFor(npcParaIntercambio, npcWeaponNames);
    const npcEnergiaMaxAmbush = energiaMaxFor(npcParaIntercambio.attributes.constitucion);
    const npcEnergiaActualAmbush = npcParaIntercambio.energia ?? npcEnergiaMaxAmbush;
    const npcAtaque = chooseNpcAbility(npcAbilities, 'ataque', npcEnergiaActualAmbush, undefined, npcParaIntercambio.abilityUsesThisEncounter);
    nuevoPendingNpcAttack = {
      npcId: npcParaIntercambio.id,
      attribute: npcAtaque.attribute,
      effects: npcAtaque.effects,
      rol: npcAtaque.rol,
      abilityName: npcAtaque.name,
      abilityDescription: npcAtaque.description,
      energyCost: npcAtaque.energyCost,
      energyRegen: npcAtaque.energyRegen,
      maxUsesPerCombat: npcAtaque.maxUsesPerCombat,
    };
  }

  if (input.combateActivo && npcParaIntercambio) {
    npcAttackTarget = npcParaIntercambio;
    const npcWeaponNames = npcParaIntercambio.items.filter((i) => i.category === 'arma').map((i) => i.name);
    const npcAbilities = npcCombatAbilitiesFor(npcParaIntercambio, npcWeaponNames);
    npcEnergiaMax = energiaMaxFor(npcParaIntercambio.attributes.constitucion);
    const npcEnergiaActual = npcParaIntercambio.energia ?? npcEnergiaMax;

    if (pendingNpcAttack && pendingNpcStillHere && !input.requiereTirada) {
      // Salvaguarda (auditoría 2026-07-28): sin una tirada real decidida por el clasificador
      // para ESTA acción concreta (p.ej. algo puramente narrativo escrito a mano mientras hay
      // un ataque de NPC pendiente — huir incluido, si el clasificador no lo ve como algo
      // reñido), no se fabrica una defensa con un atributo/dificultad sin sentido — el ataque
      // pendiente se queda igual para la siguiente acción real del jugador.
      nuevoPendingNpcAttack = pendingNpcAttack;
    } else if (pendingNpcAttack && pendingNpcStillHere) {
      // CASO DEFENSA: el NPC ya atacó (decidido el intercambio anterior, oculto hasta ahora) —
      // el jugador responde a ciegas con la habilidad que acaba de elegir (`classification.atributo`
      // ya refleja su `preferredAttribute` cuando viene de un botón, ver turn.ts).
      //
      // Rediseño de combate (2026-08-09) — `defensorRol` cae a 'defensa' en texto libre sin botón
      // (mismo comportamiento de siempre: una defensa a mano nunca es utilidad). `pendingNpcAttack.rol`
      // en la práctica siempre es 'ataque' (invariante de `chooseNpcAbility`, ver PendingNpcAttack.rol),
      // pero se comprueba igual por si ese invariante cambiara algún día.
      const defensorRol = abilityRol ?? 'defensa';
      const esIndependiente = pendingNpcAttack.rol === 'utilidad' || defensorRol === 'utilidad';
      if (esIndependiente) {
        const independent = resolveIndependentExchange(
          {
            attributes: npcParaIntercambio.attributes,
            attribute: pendingNpcAttack.attribute,
            difficulty: difficultyHintFor(input.currentLevel, npcParaIntercambio.level).dificultad,
            condicionFisica: npcParaIntercambio.condicionFisica,
            rol: pendingNpcAttack.rol,
          },
          {
            attributes,
            attribute: input.classificationAtributo,
            difficulty: difficultyHintFor(npcParaIntercambio.level, input.currentLevel).dificultad,
            condicionFisica: input.condicionFisicaJugador,
            // Bono de equipo de defensa (rediseño a check opuesto, 2026-08-21) — antes reducía la
            // propia dificultad vía `contraataqueDifficultyFor`; ahora se suma directo a la tirada
            // (`ExchangeParticipant.bonoTirada`, combatExchange.ts), como cualquier modificador
            // normal de D&D.
            bonoTirada: defensa,
            rol: defensorRol,
          },
        );
        // Base: el ataque del NPC (siempre rol 'ataque' en la práctica) conecta si SU PROPIA
        // tirada tuvo éxito — sin contraste con la del jugador, eso solo existe en el camino no
        // independiente (resolveExchange). Una utilidad reactiva puede anular esto más abajo
        // (Grito de Guerra) o dejarlo tal cual (Instinto Salvaje/Contraataque).
        jugadorRecibeGolpe = pendingNpcAttack.rol === 'ataque' && independent.atacante.efectoAplica;
        // `?? []` (auditoría de código 2026-08-17): un `pendingNpcAttack` persistido de antes del
        // rediseño a `effects: AbilityEffect[]` (2026-08-15) no tiene este campo — sin el
        // fallback, `nextCondicionForAttack` revienta con `effects.includes(...)` sobre
        // `undefined` en cuanto ese golpe conecte.
        jugadorGolpeEfectos = pendingNpcAttack.effects ?? [];
        let utilityNarration = '';
        if (defensorRol === 'utilidad') {
          const jugadorDisparo = utilityTriggered(defensorRol, abilityEffects, independent.defensor.efectoAplica, pendingNpcAttack.rol);
          utilityNarration = utilityNarrationHint(abilityEffects, jugadorDisparo, characterName, npcParaIntercambio.name);
          if (jugadorDisparo) {
            // Independientes (2026-08-15, "que una habilidad pueda tener múltiples AbilityEffects")
            // — cada efecto reconocido se aplica por su cuenta, no es un else-if: una habilidad con
            // varios de estos a la vez dispara todos.
            if (abilityEffects.includes('INTIMIDACION')) {
              // Grito de Guerra: cancela el golpe entrante del todo + roba iniciativa.
              jugadorRecibeGolpe = false;
              iniciativaForzadaPorUtilidad = 'jugador';
            }
            if (abilityEffects.includes('ATURDIMIENTO')) {
              // Instinto Salvaje: roba iniciativa, nunca cancela ni añade daño.
              iniciativaForzadaPorUtilidad = 'jugador';
            }
            if (abilityEffects.includes('ATAQUE')) {
              // Contraataque: además del golpe base (si lo hubo), devuelve un golpe propio al NPC.
              // `nextCondicionForAttack(abilityEffects, ...)` (auditoría 2026-08-17), no
              // `oneStepWorseThan` a secas — si esta misma habilidad también lleva `LETAL`
              // (schema.prisma ya lo da como ejemplo real: `[LETAL, LIMITADA]`), el contragolpe
              // debe matar igual que lo haría un ataque primario con ese efecto.
              npcAttackHits = true;
              npcTargetNewCondicion = nextCondicionForAttack(abilityEffects, npcParaIntercambio.condicionFisica);
            }
            if (abilityEffects.includes('ANALISIS')) {
              analizarRivalExito = true;
            }
            if (abilityEffects.includes('RECUPERACION')) {
              jugadorRecuperacionExtra = RECUPERACION_ENERGY_BONUS;
            }
          }
        }
        exchangeNarrationBlock =
          `${npcParaIntercambio.name} ataca con "${pendingNpcAttack.abilityName}" (${pendingNpcAttack.abilityDescription || 'sin descripción propia'}). ${independentExchangeContextBlock(independent, npcParaIntercambio.name, characterName)} ${utilityNarration}`.trim();
        combatExchangeRoll = independent.defensor;
        npcAbilityUsed = { npcName: npcParaIntercambio.name, abilityName: pendingNpcAttack.abilityName, rol: 'ataque', maxUsesPerCombat: pendingNpcAttack.maxUsesPerCombat };
        // `margen` no tiene sentido en el camino independiente (cada lado se juzga por su cuenta,
        // nunca hay "quién gana" conjunto) — 0 de relleno, el frontend nunca lo lee para
        // `resultado: 'independiente'`.
        combatExchangeDisplay = { atacanteEsJugador: false, atacante: independent.atacante, defensor: independent.defensor, resultado: 'independiente', margen: 0 };
        if (input.selectedAbility) playerAbilityUsed = { ...input.selectedAbility, rol: 'defensa' };
        exchangeHappened = true;
        npcNuevaEnergia = nextEnergia({
          current: npcEnergiaActual,
          max: npcEnergiaMax,
          abilityEnergyCost: pendingNpcAttack.energyCost ?? 0,
          abilityEnergyRegen: pendingNpcAttack.energyRegen ?? 0,
          exchangeHappened: true,
          restSucceeds: false,
          restAttempted: false,
          itemRestoreAmount: null,
        });
      } else {
        const exchange = resolveExchange(
          {
            attributes: npcParaIntercambio.attributes,
            attribute: pendingNpcAttack.attribute,
            difficulty: difficultyHintFor(input.currentLevel, npcParaIntercambio.level).dificultad,
            condicionFisica: npcParaIntercambio.condicionFisica,
            rol: pendingNpcAttack.rol,
          },
          {
            attributes,
            attribute: input.classificationAtributo,
            difficulty: difficultyHintFor(npcParaIntercambio.level, input.currentLevel).dificultad,
            condicionFisica: input.condicionFisicaJugador,
            bonoTirada: defensa,
            rol: defensorRol,
          },
        );
        // `defensor_contragolpea` (bug real jugando en vivo, 2026-08-13, "solo las de ataque hacen
        // daño"): el jugador es el "defensor" aquí — su golpe de propina SOLO cuenta si la
        // habilidad de defensa que eligió tiene de verdad `effect: 'ATAQUE'` (hoy ninguna
        // `rol: 'defensa'` lo tiene, ver classAbilities.ts/genericCombatAbilities.ts/
        // npcCombatAbilities.ts — todas son AGUANTE o sin efecto).
        //
        // `'golpes_mutuos'` ya no existe como desenlace posible (rediseño a check opuesto,
        // 2026-08-21) — con un margen entre dos totales, uno de los dos gana el contraste o hay
        // empate, nunca "los dos ganan a la vez"; el gate gemelo que este outcome necesitaba
        // (2026-08-14, "me hizo daño con una habilidad defensiva") desaparece con él, sin nada que
        // reemplazar.
        const jugadorPuedeContragolpear = abilityEffects.includes('ATAQUE');
        const jugadorContragolpeaAplica = exchange.resultado === 'defensor_contragolpea' && jugadorPuedeContragolpear;
        jugadorRecibeGolpe = exchange.resultado === 'golpe_pleno' || exchange.resultado === 'golpe_normal';
        // `?? []` (auditoría de código 2026-08-17): un `pendingNpcAttack` persistido de antes del
        // rediseño a `effects: AbilityEffect[]` (2026-08-15) no tiene este campo — sin el
        // fallback, `nextCondicionForAttack` revienta con `effects.includes(...)` sobre
        // `undefined` en cuanto ese golpe conecte.
        jugadorGolpeEfectos = pendingNpcAttack.effects ?? [];
        npcAttackHits = jugadorContragolpeaAplica;
        // `nextCondicionForAttack(abilityEffects, ...)` (auditoría 2026-08-17), no
        // `oneStepWorseThan` a secas — mismo criterio que el camino independiente: si la habilidad
        // de defensa del jugador lleva también `LETAL`, el contragolpe debe matar.
        npcTargetNewCondicion = npcAttackHits ? nextCondicionForAttack(abilityEffects, npcParaIntercambio.condicionFisica) : null;
        exchangeNarrationBlock = `${npcParaIntercambio.name} ataca con "${pendingNpcAttack.abilityName}" (${pendingNpcAttack.abilityDescription || 'sin descripción propia'}). ${exchangeContextBlock(exchange, npcParaIntercambio.name, characterName, jugadorPuedeContragolpear)}`;
        combatExchangeRoll = exchange.defensor;
        npcAbilityUsed = { npcName: npcParaIntercambio.name, abilityName: pendingNpcAttack.abilityName, rol: 'ataque', maxUsesPerCombat: pendingNpcAttack.maxUsesPerCombat };
        combatExchangeDisplay = {
          atacanteEsJugador: false,
          atacante: exchange.atacante,
          defensor: exchange.defensor,
          resultado: effectiveExchangeOutcome(exchange.resultado, jugadorPuedeContragolpear),
          margen: exchange.margen,
        };
        if (input.selectedAbility) playerAbilityUsed = { ...input.selectedAbility, rol: 'defensa' };
        exchangeHappened = true;
        // El NPC atacó este intercambio con la habilidad ya elegida el turno anterior — su coste/
        // regen se descuentan/suman AHORA, cuando de verdad se resuelve (ver PendingNpcAttack.
        // energyCost/energyRegen en combatExchange.ts).
        npcNuevaEnergia = nextEnergia({
          current: npcEnergiaActual,
          max: npcEnergiaMax,
          abilityEnergyCost: pendingNpcAttack.energyCost ?? 0,
          abilityEnergyRegen: pendingNpcAttack.energyRegen ?? 0,
          exchangeHappened: true,
          restSucceeds: false,
          restAttempted: false,
          itemRestoreAmount: null,
        });
      }
    } else {
      // CASO ATAQUE: el jugador tiene la iniciativa — el NPC decide su defensa ahora mismo,
      // oculta, nunca se le enseña al jugador qué eligió.
      const npcDefensa = chooseNpcAbility(npcAbilities, 'defensa', npcEnergiaActual, undefined, npcParaIntercambio.abilityUsesThisEncounter);
      // Doble arma (2026-07-31, ver dualWieldAdjustedDifficulty) — con la real de ataque colapsada
      // por llevar la misma categoría en las dos manos, la dificultad del jugador baja (nunca
      // dobla el intercambio).
      const dificultadAtacante = dualWieldAdjustedDifficulty(
        difficultyHintFor(npcParaIntercambio.level, input.currentLevel).dificultad,
        input.dualWieldBonus,
      );
      // Rediseño de combate (2026-08-09) — `jugadorRol` en texto libre sin botón (`abilityRol ===
      // null`) cae a 'ataque' SOLO si `countsAsAttack` de verdad lo confirmó (mismo criterio que
      // decidió `combateActivo`); si no (p.ej. un consumible, que activa `combateActivo` sin
      // contar nunca como golpe propio — ver `tomaAccionDeCombate`), cae a 'defensa', nunca hace
      // daño. Con botón pulsado, `abilityRol` manda siempre, sin tocar este fallback.
      // `npcDefensa.rol` puede ser 'utilidad' (70% de las veces que el NPC tiene alguna
      // disponible, ver chooseNpcAbility) o, más raro, 'ataque'/'defensa'.
      const jugadorRol = abilityRol ?? (input.countsAsAttack ? 'ataque' : 'defensa');
      // `resolveExchange` (tabla cruzada, camino "else" de abajo) solo tiene sentido cuando el
      // jugador de verdad ataca (`jugadorRol === 'ataque'`) — asume implícitamente "atacante vs
      // defensor" y calcula el golpe SOLO de los dados, sin mirar el rol. Si el jugador no está
      // atacando (rol 'defensa' — texto libre sin intención real, o un consumible, que activa
      // `combateActivo` sin ser nunca un ataque, ver `tomaAccionDeCombate`), o si el NPC se
      // defendió con una de utilidad, hace falta el camino independiente — nunca colar un golpe
      // real desde la tabla cruzada cuando el jugador no atacó de verdad.
      const esIndependiente = jugadorRol !== 'ataque' || npcDefensa.rol === 'utilidad';
      if (esIndependiente) {
        const independent = resolveIndependentExchange(
          { attributes, attribute: input.classificationAtributo, difficulty: dificultadAtacante, condicionFisica: input.condicionFisicaJugador, rol: jugadorRol },
          {
            attributes: npcParaIntercambio.attributes,
            attribute: npcDefensa.attribute,
            difficulty: difficultyHintFor(input.currentLevel, npcParaIntercambio.level).dificultad,
            condicionFisica: npcParaIntercambio.condicionFisica,
            rol: npcDefensa.rol,
          },
        );
        // Base: el ataque del jugador conecta si es de verdad rol 'ataque' Y su propia tirada
        // tuvo éxito — si el jugador usó una de utilidad (p.ej. Analizar rival), nunca hay golpe
        // base que aplicar, gane o pierda su tirada.
        npcAttackHits = jugadorRol === 'ataque' && independent.atacante.efectoAplica;
        npcTargetNewCondicion = npcAttackHits ? nextCondicionForAttack(abilityEffects, npcParaIntercambio.condicionFisica) : null;
        jugadorRecibeGolpe = false;
        jugadorGolpeEfectos = [];
        let utilityNarrationJugador = '';
        let utilityNarrationNpc = '';
        if (jugadorRol === 'utilidad') {
          const jugadorDisparo = utilityTriggered(jugadorRol, abilityEffects, independent.atacante.efectoAplica, npcDefensa.rol);
          utilityNarrationJugador = utilityNarrationHint(abilityEffects, jugadorDisparo, characterName, npcParaIntercambio.name);
          if (jugadorDisparo && abilityEffects.includes('ANALISIS')) analizarRivalExito = true;
          // Contraataque/Grito de Guerra/Instinto Salvaje elegidos como acción OFENSIVA (no como
          // defensa a ciegas) son un uso atípico — su gancho reactivo exige que el RIVAL haya
          // atacado con daño, y aquí es el jugador quien tiene la iniciativa — pero la condición
          // se evalúa exactamente igual, sin caso especial (si `npcDefensa.rol` fuese 'ataque', lo
          // que chooseNpcAbility sí puede elegir como defensa, se dispararía igual que en CASO
          // DEFENSA). Independientes (2026-08-15): cada efecto reconocido se aplica por su cuenta.
          if (jugadorDisparo && abilityEffects.includes('ATAQUE')) {
            npcAttackHits = true;
            // `nextCondicionForAttack(abilityEffects, ...)` (auditoría 2026-08-17), no
            // `oneStepWorseThan` a secas — misma razón que el resto de contraataques reactivos.
            npcTargetNewCondicion = nextCondicionForAttack(abilityEffects, npcParaIntercambio.condicionFisica);
          }
          if (jugadorDisparo && abilityEffects.includes('INTIMIDACION')) {
            iniciativaForzadaPorUtilidad = 'jugador';
            npcAttackHits = false;
            npcTargetNewCondicion = null;
          }
          if (jugadorDisparo && abilityEffects.includes('ATURDIMIENTO')) {
            iniciativaForzadaPorUtilidad = 'jugador';
          }
          if (jugadorDisparo && abilityEffects.includes('RECUPERACION')) {
            jugadorRecuperacionExtra = RECUPERACION_ENERGY_BONUS;
          }
        }
        if (npcDefensa.rol === 'utilidad') {
          const npcDisparo = utilityTriggered(npcDefensa.rol, npcDefensa.effects, independent.defensor.efectoAplica, jugadorRol);
          utilityNarrationNpc = utilityNarrationHint(npcDefensa.effects, npcDisparo, npcParaIntercambio.name, characterName);
          if (npcDisparo) {
            if (npcDefensa.effects.includes('ATAQUE')) {
              // Contraataque del NPC: además del golpe base (si lo hubo), el jugador recibe un
              // golpe de vuelta. `npcDefensa.effects` completo (auditoría 2026-08-17), no
              // `['ATAQUE']` hardcodeado — si la habilidad de defensa del NPC también lleva
              // `LETAL`, el contragolpe debe matar, no solo bajar un escalón.
              jugadorRecibeGolpe = true;
              jugadorGolpeEfectos = npcDefensa.effects;
            }
            if (npcDefensa.effects.includes('INTIMIDACION')) {
              iniciativaForzadaPorUtilidad = 'npc';
              npcAttackHits = false;
              npcTargetNewCondicion = null;
            }
            if (npcDefensa.effects.includes('ATURDIMIENTO')) {
              iniciativaForzadaPorUtilidad = 'npc';
            }
            if (npcDefensa.effects.includes('RECUPERACION')) {
              npcRecuperacionExtra = RECUPERACION_ENERGY_BONUS;
            }
          }
        }
        exchangeNarrationBlock =
          `${npcParaIntercambio.name} se defiende con "${npcDefensa.name}" (${npcDefensa.description}). ${independentExchangeContextBlock(independent, characterName, npcParaIntercambio.name)} ${hitSeverityHint(npcParaIntercambio.name, npcTargetNewCondicion)} ${utilityNarrationJugador} ${utilityNarrationNpc}`.trim();
        combatExchangeRoll = independent.atacante;
        npcAbilityUsed = { npcName: npcParaIntercambio.name, abilityName: npcDefensa.name, rol: 'defensa', maxUsesPerCombat: npcDefensa.maxUsesPerCombat };
        combatExchangeDisplay = { atacanteEsJugador: true, atacante: independent.atacante, defensor: independent.defensor, resultado: 'independiente', margen: 0 };
        if (input.selectedAbility) playerAbilityUsed = { ...input.selectedAbility, rol: 'ataque' };
        exchangeHappened = true;
        npcNuevaEnergia = nextEnergia({
          current: npcEnergiaActual,
          max: npcEnergiaMax,
          abilityEnergyCost: npcDefensa.energyCost,
          abilityEnergyRegen: npcDefensa.energyRegen,
          exchangeHappened: true,
          restSucceeds: false,
          restAttempted: false,
          itemRestoreAmount: null,
        });
      } else {
        const exchange = resolveExchange(
          { attributes, attribute: input.classificationAtributo, difficulty: dificultadAtacante, condicionFisica: input.condicionFisicaJugador, rol: jugadorRol },
          {
            attributes: npcParaIntercambio.attributes,
            attribute: npcDefensa.attribute,
            difficulty: difficultyHintFor(input.currentLevel, npcParaIntercambio.level).dificultad,
            condicionFisica: npcParaIntercambio.condicionFisica,
            rol: npcDefensa.rol,
          },
        );
        // `defensor_contragolpea` (mismo fix que el CASO DEFENSA de arriba, 2026-08-13, bug real
        // jugando en vivo, "Lana Espesa" [defensiva, sin effect:'ATAQUE'] seguía haciendo daño de
        // propina): aquí el NPC es el "defensor" — su golpe de propina SOLO cuenta si SU habilidad
        // de defensa tiene de verdad `effect: 'ATAQUE'` (hoy ninguna la tiene, ver
        // npcCombatAbilities.ts).
        //
        // `'golpes_mutuos'` ya no existe (rediseño a check opuesto, 2026-08-21) — mismo motivo que
        // el CASO DEFENSA de arriba: con un margen entre dos totales, nunca "los dos ganan a la vez".
        const npcPuedeContragolpear = npcDefensa.effects.includes('ATAQUE');
        const npcContragolpeaAplica = exchange.resultado === 'defensor_contragolpea' && npcPuedeContragolpear;
        npcAttackHits = exchange.resultado === 'golpe_pleno' || exchange.resultado === 'golpe_normal';
        npcTargetNewCondicion = npcAttackHits ? nextCondicionForAttack(abilityEffects, npcParaIntercambio.condicionFisica) : null;
        jugadorRecibeGolpe = npcContragolpeaAplica;
        // `npcDefensa.effects` completo (auditoría 2026-08-17), no `['ATAQUE']` hardcodeado —
        // mismo criterio que el camino independiente.
        jugadorGolpeEfectos = jugadorRecibeGolpe ? npcDefensa.effects : [];
        exchangeNarrationBlock = `${npcParaIntercambio.name} se defiende con "${npcDefensa.name}" (${npcDefensa.description}). ${exchangeContextBlock(exchange, characterName, npcParaIntercambio.name, npcPuedeContragolpear)}`;
        combatExchangeRoll = exchange.atacante;
        npcAbilityUsed = { npcName: npcParaIntercambio.name, abilityName: npcDefensa.name, rol: 'defensa', maxUsesPerCombat: npcDefensa.maxUsesPerCombat };
        combatExchangeDisplay = {
          atacanteEsJugador: true,
          atacante: exchange.atacante,
          defensor: exchange.defensor,
          resultado: effectiveExchangeOutcome(exchange.resultado, npcPuedeContragolpear),
          margen: exchange.margen,
        };
        if (input.selectedAbility) playerAbilityUsed = { ...input.selectedAbility, rol: 'ataque' };
        exchangeHappened = true;
        // El NPC se defendió este intercambio con la habilidad recién elegida — su coste/regen
        // salen de esa misma habilidad, no de haber "estado defendiendo".
        npcNuevaEnergia = nextEnergia({
          current: npcEnergiaActual,
          max: npcEnergiaMax,
          abilityEnergyCost: npcDefensa.energyCost,
          abilityEnergyRegen: npcDefensa.energyRegen,
          exchangeHappened: true,
          restSucceeds: false,
          restAttempted: false,
          itemRestoreAmount: null,
        });
      }
    }

    if (exchangeHappened) {
      // Iniciativa del PRÓXIMO intercambio — se decide ya para poder guardarla si favorece al NPC.
      // Rediseño de combate (2026-08-09): ATURDIMIENTO/INTIMIDACION ya no llegan nunca por el
      // camino no-independiente (las 4 de clase que los llevan son SIEMPRE rol:'utilidad' desde
      // este rediseño, ver classAbilities.ts) — `iniciativaForzadaPorUtilidad` (calculada dentro
      // de cada rama, arriba) sustituye por completo al viejo `jugadorAturdioAlNpc`/
      // `npcAturdioAlJugador`, que ya no podían dispararse.
      //
      // Ver comentario de `abilityEffectHint` en CombatExchangePhaseResult — LETAL (fusión de
      // REMATE, 2026-08-15: ya no exige que el objetivo esté GRAVE/CONVALECIENTE, mata de un golpe
      // a cualquiera) sigue siendo rol:'ataque', el único efecto que todavía pasa por aquí (solo
      // cuando el jugador ataca, nunca en la defensa a ciegas).
      if (!pendingNpcStillHere && abilityEffects.includes('LETAL')) {
        abilityEffectHint = npcAttackHits
          ? `EFECTO DE HABILIDAD — YA RESUELTO: el golpe letal contra ${npcParaIntercambio.name} conecta y lo mata en el acto, sin importar en qué estado estuviera antes — narra el golpe final, no una herida más.`
          : `EFECTO DE HABILIDAD — YA RESUELTO: el golpe letal no llega a conectar esta vez — narra el intento fallido, nunca su muerte.`;
      }

      // Caza en grupo (2026-08-13, petición explícita: "que el narrador prometa nada que no se
      // realice por acción") — si este golpe deja al individuo ACTUAL convaleciente/muerto y el
      // grupo tiene más miembros, el combate sigue: se le dice al modelo explícitamente que NO
      // narre el grupo entero como derrotado, solo a este individuo. Si era el último, lo
      // contrario — evita que el modelo alargue el combate más de la cuenta o lo cierre antes de
      // tiempo, mismo criterio "YA RESUELTO, no lo cambies" que el resto de hints de combate.
      if (npcAttackHits && npcTargetNewCondicion && (npcTargetNewCondicion === 'CONVALECIENTE' || npcTargetNewCondicion === 'MUERTO') && npcParaIntercambio.groupSize) {
        const restantes = npcParaIntercambio.groupSize - npcParaIntercambio.groupDefeated - 1;
        const groupHint =
          restantes > 0
            ? `GRUPO — YA RESUELTO: caído este individuo, todavía quedan ${restantes} más de su misma especie en la zona. El combate NO ha terminado — narra solo la caída de ESTE, nunca el grupo entero como derrotado.`
            : `GRUPO — YA RESUELTO: este era el último de su especie en la zona — ahora sí puedes narrar el grupo entero como resuelto.`;
        exchangeNarrationBlock = exchangeNarrationBlock ? `${exchangeNarrationBlock} ${groupHint}` : groupHint;
      }

      let iniciativaSiguiente: 'jugador' | 'npc';
      if (iniciativaForzadaPorUtilidad) {
        iniciativaSiguiente = iniciativaForzadaPorUtilidad;
      } else {
        nextInitiativeRoll = rollInitiative(attributes, npcParaIntercambio.attributes);
        iniciativaSiguiente = nextInitiativeRoll.ganador;
      }

      if (iniciativaSiguiente === 'npc') {
        // Filtrado por la energía ACTUAL (antes de la regen de este mismo turno) — una
        // aproximación deliberada: el NPC de verdad tendrá algo más de energía cuando esta
        // habilidad se resuelva el turno siguiente, pero anticipar esa regen exacta aquí no
        // compensa la complejidad frente al mismo criterio "suficientemente determinista, no
        // perfecto" del resto del sistema.
        const npcAtaque = chooseNpcAbility(npcAbilities, 'ataque', npcEnergiaActual, undefined, npcParaIntercambio.abilityUsesThisEncounter);
        nuevoPendingNpcAttack = {
          npcId: npcParaIntercambio.id,
          attribute: npcAtaque.attribute,
          effects: npcAtaque.effects,
          rol: npcAtaque.rol,
          abilityName: npcAtaque.name,
          abilityDescription: npcAtaque.description,
          energyCost: npcAtaque.energyCost,
          energyRegen: npcAtaque.energyRegen,
          maxUsesPerCombat: npcAtaque.maxUsesPerCombat,
        };
      }
    }
  }

  return {
    npcAttackTarget,
    npcAttackHits,
    npcTargetNewCondicion,
    jugadorRecibeGolpe,
    jugadorGolpeEfectos,
    nuevoPendingNpcAttack,
    exchangeNarrationBlock,
    combatExchangeRoll,
    npcAbilityUsed,
    combatExchangeDisplay,
    playerAbilityUsed,
    nextInitiativeRoll,
    exchangeHappened,
    npcEnergiaMax,
    // RECUPERACION (2026-08-17) — sumado aquí mismo (topado al máximo real del NPC), a diferencia
    // del lado jugador cuyo tope solo conoce el caller.
    npcNuevaEnergia: npcNuevaEnergia !== null && npcEnergiaMax !== null ? Math.min(npcEnergiaMax, npcNuevaEnergia + npcRecuperacionExtra) : npcNuevaEnergia,
    abilityEffectHint,
    analizarRivalExito,
    jugadorRecuperacionExtra,
  };
}

/// Tope de usos por combate del lado JUGADOR (2026-08-15, AbilityEffect.LIMITADA/
/// maxUsesPerCombat), extraído de `narrateAndPersistTurn` (auditoría de deuda técnica 2026-08-18:
/// vivía repartido en dos mitades de la misma función, ~1250 líneas de distancia — el chequeo aquí,
/// el incremento junto a `applyCombatExchangeToNpcState`). El contador vive en el `NpcState` del
/// rival (mismo campo que ya cuenta lo que el NPC ha usado contra el jugador, ver comentario en
/// schema.prisma). Si la habilidad pulsada ya agotó sus usos este encuentro, el caller trata el
/// turno como si no se hubiera pulsado ningún botón SOLO de cara al efecto mecánico —
/// `countsAsAttack`/`combateActivo`/`tomaAccionDeCombate` ya se calculan con el `abilityRol` real:
/// intentar un "ultimate" en cooldown sigue contando como acción de combate (cae a ataque/defensa
/// normal), nunca como no hacer nada.
function playerAbilityUsageGate(
  selectedAbilityData: { name: string; maxUsesPerCombat?: number | null } | null | undefined,
  usesThisEncounter: Record<string, number> | undefined,
): { blocked: boolean; hint: string | null } {
  const blocked =
    !!selectedAbilityData?.maxUsesPerCombat && (usesThisEncounter?.[selectedAbilityData.name] ?? 0) >= selectedAbilityData.maxUsesPerCombat;
  const hint = blocked
    ? `El personaje intenta usar "${selectedAbilityData!.name}", pero ya agotó sus ${selectedAbilityData!.maxUsesPerCombat} uso(s) de este combate — narra que lo intenta o recurre a otra cosa, nunca que el efecto especial de esa habilidad se dispara de verdad.`
    : null;
  return { blocked, hint };
}

/// Nombres de habilidad de ESTE intercambio que llevan `maxUsesPerCombat` y de verdad se usaron —
/// la del NPC (si `npcAbilityUsed` trae tope) y la del jugador (si estaba seleccionada, llevaba
/// tope, Y no se bloqueó ya por haberlo agotado, ver `playerAbilityUsageGate` arriba). Extraído
/// junto a esa función por el mismo motivo (auditoría de deuda técnica 2026-08-18) — son las dos
/// mitades del mismo mecanismo, antes separadas ~1250 líneas dentro de `narrateAndPersistTurn`.
function abilityNamesToIncrementFor(
  exchangeHappened: boolean,
  npcAbilityUsed: { abilityName: string; maxUsesPerCombat?: number | null } | null,
  playerAbilityUsageBlocked: boolean,
  selectedAbilityData: { name: string; maxUsesPerCombat?: number | null } | null | undefined,
): string[] {
  const names: string[] = [];
  if (exchangeHappened && npcAbilityUsed?.maxUsesPerCombat) names.push(npcAbilityUsed.abilityName);
  if (exchangeHappened && !playerAbilityUsageBlocked && selectedAbilityData?.maxUsesPerCombat) names.push(selectedAbilityData.name);
  return names;
}

/// Crafteo v1 — bloque de detección/aviso PRE-transacción, extraído de `narrateAndPersistTurn`
/// (refactor de deuda técnica 2026-08-13). Puro (solo lee `inventoryRows`/`catalogBySlug` ya
/// resueltos por el caller, nunca escribe) — `craftPossibleByKey` sigue haciendo falta tal cual
/// más abajo, DENTRO de la transacción (revalidado con `tx`, ver `freshInventoryRows`), así que
/// viaja de vuelta al caller en vez de consumirse aquí.
function resolveCraftIntentContext(
  action: string,
  currentLocationSlug: string | null,
  inventoryRows: InventoryRowLike[],
  catalogBySlug: Map<string, CatalogLookup>,
  attributes: AttributeBlock,
  secondaryAttributes: SecondaryAttributeBlock,
  alivioFor: (oficio: string | undefined) => number,
  unlockedRecipeKeys: string[],
): { craftPossibleByKey: Record<string, boolean>; blocks: string[] } {
  const craftPossibleByKey: Record<string, boolean> = {};
  const blocks: string[] = [];
  for (const recipe of CRAFTING_RECIPES) {
    const wants = detectsCraftIntent(recipe, action);
    const alivio = alivioFor(recipe.oficio);
    const possible = wants && canCraft(recipe, currentLocationSlug, inventoryRows, catalogBySlug, attributes, secondaryAttributes, alivio, unlockedRecipeKeys);
    craftPossibleByKey[recipe.key] = possible;
    if (wants && !possible) {
      blocks.push(recipe.narrationWant);
      const shortfalls = craftRequisitoShortfalls(recipe, attributes, secondaryAttributes, alivio);
      if (shortfalls.length > 0) {
        blocks.push(`Además, al personaje todavía le falta: ${shortfalls.map(shortfallLabel).join(', ')} para poder craftear ${recipe.resultName}.`);
      }
      // Herramienta requerida (2026-08-17) — pista aparte de los shortfalls de atributo, mismo
      // criterio: solo aparece si de verdad es la causa real del bloqueo.
      if (recipe.oficio && OFICIOS_CON_HERRAMIENTA_REQUERIDA.some((p) => recipe.oficio === p || recipe.oficio!.startsWith(`${p}-`)) && !hasToolForOficio(recipe.oficio, inventoryRows, catalogBySlug)) {
        blocks.push(`Además, al personaje le falta encima una herramienta adecuada para poder craftear ${recipe.resultName}.`);
      }
      // Receta bloqueada por misión (2026-08-17) — igual que arriba, solo si es de verdad la
      // causa (una receta desbloqueada por recompensa también puede fallar por materiales, y en
      // ese caso el hint de materiales ya basta).
      if (recipe.requiresUnlock && !unlockedRecipeKeys.includes(recipe.key)) {
        blocks.push(`Además, el personaje todavía no conoce cómo craftear ${recipe.resultName} — hace falta descubrirlo primero.`);
      }
    } else if (possible) {
      blocks.push(recipe.narrationDo);
    }
  }
  return { craftPossibleByKey, blocks };
}

interface BuildIntentContext {
  buildRecipe: ConstructionRecipe | undefined;
  buildRecipeCheck: RecipeCheck | null;
  buildBlockedReason: string | null;
  buildMode: boolean;
  blocks: string[];
}

/// Construcción — bloque de detección/validación/aviso PRE-transacción, extraído de
/// `narrateAndPersistTurn` (refactor de deuda técnica 2026-08-13). Usa `prisma` de solo lectura a
/// propósito (mejor esfuerzo para el aviso al LLM, mismo criterio que tenía inline) — el gate real
/// y obligatorio sigue siendo la segunda llamada a `computeBuildBlockedReason` DENTRO de la
/// transacción, con `tx` (ver ese comentario, bug real de condición de carrera). Los 4 valores
/// calculados aquí se siguen necesitando tal cual en el resto de la función (narración
/// determinista, transacción, respuesta) — viajan de vuelta al caller sin resolverse aquí.
async function resolveBuildIntentContext(params: {
  action: string;
  saveId: string;
  worldId: string;
  activeRegion: string | null;
  currentLocationRecord: { id: string; kind: string; slug: string } | null;
  inventoryRows: InventoryRowLike[];
  catalogBySlug: Map<string, CatalogLookup>;
  attributes: AttributeBlock;
  secondaryAttributes: SecondaryAttributeBlock;
  alivioFor: (oficio: string | undefined) => number;
}): Promise<BuildIntentContext> {
  const { action, saveId, worldId, activeRegion, currentLocationRecord, inventoryRows, catalogBySlug, attributes, secondaryAttributes, alivioFor } = params;
  const buildRecipe: ConstructionRecipe | undefined = CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, action));
  const buildRecipeCheck: RecipeCheck | null = buildRecipe
    ? checkRecipe(buildRecipe, inventoryRows, catalogBySlug, attributes, secondaryAttributes, alivioFor(buildRecipe.oficio))
    : null;
  const buildBlockedReason: string | null =
    buildRecipe && buildRecipeCheck?.met && currentLocationRecord
      ? await computeBuildBlockedReason({ db: prisma, saveId, worldId, buildRecipe, activeRegion, currentLocationRecord })
      : null;
  const buildMode = !!buildRecipe && !!buildRecipeCheck?.met && !buildBlockedReason;
  const blocks: string[] = [];
  if (buildRecipe && buildRecipeCheck && !buildRecipeCheck.met) {
    const faltantes = buildRecipeCheck.missing.map((m) => `${m.label} (tienes ${m.tienes}, necesitas ${m.necesitas})`).join(', ');
    blocks.push(
      `El personaje quiere construir ${buildRecipe.name}, pero todavía no cumple los requisitos: ${faltantes} — narra que lo intenta o lo planea, pero no que lo termina de verdad.`,
    );
  } else if (buildRecipe && buildBlockedReason) {
    blocks.push(
      `El personaje quiere construir ${buildRecipe.name}, pero no puede: ${buildBlockedReason} — narra que lo intenta o lo descubre, pero no que lo termina de verdad.`,
    );
  }
  return { buildRecipe, buildRecipeCheck, buildBlockedReason, buildMode, blocks };
}

/// Log de Reino (2026-08-17), extraído de `narrateAndPersistTurn` (auditoría de deuda técnica
/// 2026-08-18) — canal aparte, alternable con el de mundo en el frontend: solo las 4 recetas de
/// categoría 'reino' (startingAbilities.ts: Campamento + los 3 niveles de Ayuntamiento), nunca
/// Choza/Tótem (esas tienen oficio propio y viven conceptualmente como "profesión", no como hito
/// de reino). Se escribe pase lo que pase (fundación, mejora o primera construcción), con el mismo
/// texto sintético que ya se usa para narrar el turno.
async function writeKingdomLogForBuild(
  tx: Prisma.TransactionClient,
  params: {
    buildValidNow: boolean;
    buildRecipe: ConstructionRecipe | undefined;
    saveId: string;
    characterName: string;
    timeLabel: string;
    fictionalMinutes: number;
  },
): Promise<void> {
  const { buildValidNow, buildRecipe, saveId, characterName, timeLabel, fictionalMinutes } = params;
  const esRecetaDeReino = buildValidNow && buildRecipe && ['campamento', 'ayuntamiento', 'ayuntamiento-mediano', 'ayuntamiento-grande'].includes(buildRecipe.key);
  if (!esRecetaDeReino) return;
  await tx.logEntry.create({
    data: {
      saveId,
      channel: 'KINGDOM',
      text: `${characterName} termina de construir ${buildRecipe!.name}. ${buildRecipe!.description}`,
      isPlayerAction: false,
      timeLabel,
      fictionalMinutes,
    },
  });
}

/// Recuperación de CONVALECIENTE tras 6h de ficción / desaparición de un cadáver tras 48h (docs/19
/// pieza 2, 2026-08-13) — se llama una vez por turno resuelto de verdad (`narrateAndPersistTurn`
/// es el único punto de convergencia entre el turno síncrono y la resolución diferida de un
/// `CharacterTransit`, así que cubre los dos caminos por los que puede avanzar `fictionalMinutes`
/// sin duplicar el cableado). Barre TODOS los `NpcState` CONVALECIENTE/MUERTO de esta partida — en
/// la práctica siempre son pocas filas, no vale la pena acotar por escena.
async function applyCondicionTimeouts(tx: Prisma.TransactionClient, saveId: string, nowMinutes: number): Promise<void> {
  const affected = await tx.npcState.findMany({
    where: { saveId, condicionFisica: { in: ['CONVALECIENTE', 'MUERTO'] } },
    select: { id: true, condicionFisica: true, condicionFisicaSinceMinutes: true },
  });
  for (const state of affected) {
    if (state.condicionFisica === 'CONVALECIENTE' && npcRecoversFromConvaleciente(state.condicionFisicaSinceMinutes, nowMinutes)) {
      await tx.npcState.update({
        where: { id: state.id },
        data: { condicionFisica: 'HERIDO', condicionFisicaSinceMinutes: nowMinutes },
      });
    } else if (state.condicionFisica === 'MUERTO' && npcCorpseShouldDespawn(state.condicionFisicaSinceMinutes, nowMinutes)) {
      await tx.npcState.delete({ where: { id: state.id } });
    }
  }
}

interface LootModeResult {
  actualLootedNames: string[];
  newInventoryItems: NewInventoryItemInfo[];
  createdItemNames: string[];
  partiallyLootedSlugs: string[];
  questRewardXp: number;
  /// null si el número de objetos realmente saqueados coincidió con `lootPreviewCount` (el
  /// preview en streaming, emitido ANTES de esta transacción, seguía siendo honesto) — el caller
  /// solo tiene que sustituir `narration.narration` cuando no es null (auditoría 2026-08-06,
  /// narración mentirosa si se pierde la carrera contra otro "saquear" casi simultáneo).
  narrationOverride: string | null;
}

/// Saqueo (docs/12 § 4.5), extraído de la transacción de `narrateAndPersistTurn` (refactor de
/// deuda técnica 2026-08-13) — entrada/salida acotada: solo toca `NpcState`/`InventoryItem`/
/// `Quest` de los NPCs saqueados este turno, nada del resto del turno. El caller solo tiene que
/// sumar/concatenar el resultado a sus propios acumuladores y aplicar `narrationOverride` si lo
/// hay. La ÚNICA fuente de botín sigue siendo lo que el NPC lleva encima (NpcItem), nunca una
/// invención del modelo.
async function applyLootMode(params: {
  tx: Prisma.TransactionClient;
  lootTargets: NpcInScene[];
  lootItemNames: string[] | null | undefined;
  /// Longitud de `lootPreview` (calculado antes de la transacción, con `prisma`) — solo hace
  /// falta el número para decidir si el preview en streaming sigue siendo honesto, no la lista
  /// entera.
  lootPreviewCount: number;
  currentLocationId: string | null;
  saveId: string;
  characterName: string;
}): Promise<LootModeResult> {
  const { tx, lootTargets, lootItemNames, lootPreviewCount, currentLocationId, saveId, characterName } = params;
  const actualLootedNames: string[] = [];
  const newInventoryItems: NewInventoryItemInfo[] = [];
  const createdItemNames: string[] = [];
  const partiallyLootedSlugs: string[] = [];
  let questRewardXp = 0;
  for (const npc of lootTargets) {
    const scope = scopeFor(npc.kind, currentLocationId);
    // Revalidación anti-carrera (auditoría de deuda técnica 2026-08-04, mismo patrón ya cerrado
    // para construcción/crafteo/despiece): `npc.saqueado`/`npc.lootedItemNames` vienen de
    // `npcsInScene`, leído con `prisma` ANTES de esta transacción — dos turnos de "saqueo" casi
    // simultáneos sobre el mismo NPC (doble clic, reintento de red, dos pestañas) podían pasar
    // ambos el guard con la misma foto ya obsoleta y duplicar el botín de una sola muerte. Se
    // relee fresco con `tx` justo antes de decidir qué llevarse.
    const freshState = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope } } });
    // NpcState: una vez saqueado DEL TODO, no hay nada más que ofrecer — se sigue saltando.
    if (freshState?.saqueado) continue;
    const yaTomados = freshState?.lootedItemNames ?? npc.lootedItemNames;
    const itemsToLoot = (lootItemNames ? npc.items.filter((item) => lootItemNames.includes(item.name)) : npc.items).filter(
      (item) => !yaTomados.includes(item.name),
    );
    for (const item of itemsToLoot) {
      const created = await tx.inventoryItem.create({
        data: {
          saveId,
          name: item.cantidad > 1 ? `${item.name} ×${item.cantidad}` : item.name,
          description: item.notas ?? `Botín de ${npc.name}.`,
          origin: `botín de ${npc.name}`,
          // Los bonificadores de equipo (si el objeto los tenía en el catálogo) viajan con él —
          // un hacha robada sigue dando su bonificador al equiparla.
          statBonuses: item.statBonuses ?? Prisma.JsonNull,
          catalogSlug: item.catalogSlug,
        },
      });
      newInventoryItems.push({ ...created, slot: null, equipSlot: item.equipSlot, effectKey: item.effectKey, tipo: item.tipo });
      createdItemNames.push(created.name);
      actualLootedNames.push(created.name);
    }
    // Bug real (auditoría de código completa, 2026-08-07): el guard `npc.items.length > 0`
    // saltaba ESTE BLOQUE ENTERO para un NPC con loadout vacío — `npc.items.every(...)` sobre un
    // array vacío ya es `true` por definición (nada que tomar = todo tomado), así que quitar el
    // guard basta.
    const nuevosTomados = [...new Set([...yaTomados, ...itemsToLoot.map((item) => item.name)])];
    const todoTomado = npc.items.every((item) => nuevosTomados.includes(item.name));
    if (!todoTomado) partiallyLootedSlugs.push(npc.slug);
    await tx.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope } },
      create: { saveId, npcId: npc.id, scope, saqueado: todoTomado, lootedItemNames: nuevosTomados },
      update: { saqueado: todoTomado, lootedItemNames: nuevosTomados },
    });

    // Recompensa estática de misión al saquear (petición explícita, 2026-07-25): si el NPC
    // saqueado es el objetivo de una misión ACTIVA con XP de recompensa definida, se concede aquí
    // y la misión se cierra como resuelta. Guardado por el `if (freshState?.saqueado) continue`
    // de arriba — un NPC ya saqueado nunca vuelve a pasar por aquí, así que esto solo concede la
    // recompensa una vez, sin importar cuántas veces se intente registrar el cuerpo.
    const rewardQuest = await tx.quest.findFirst({ where: { saveId, targetNpcId: npc.id, status: 'ACTIVA', rewardXp: { not: null } } });
    if (rewardQuest) {
      questRewardXp += rewardQuest.rewardXp!;
      await tx.quest.update({ where: { id: rewardQuest.id }, data: { status: 'COMPLETADA' } });
    }
  }
  const narrationOverride =
    actualLootedNames.length !== lootPreviewCount
      ? actualLootedNames.length > 0
        ? `${characterName} rebusca entre los restos y se hace con lo siguiente: ${actualLootedNames.join(', ')}. ${pickFlavor(LOOT_FLAVOR_SUCCESS)}`
        : `${characterName} rebusca entre los restos, pero alguien se le ha adelantado — no queda nada que llevarse. ${pickFlavor(LOOT_FLAVOR_EMPTY)}`
      : null;
  return { actualLootedNames, newInventoryItems, createdItemNames, partiallyLootedSlugs, questRewardXp, narrationOverride };
}

/// Aplica el resultado YA resuelto del intercambio de combate (`resolveCombatExchangePhase`) al
/// `NpcState` del objetivo — extraído de la transacción de `narrateAndPersistTurn` (refactor de
/// deuda técnica 2026-08-13). Sistema de fatiga simétrico (2026-07-30): `npcNuevaEnergia` viaja
/// en el MISMO upsert que la condición física en vez de uno aparte, porque los dos pueden cambiar
/// en el mismo intercambio (un golpe que además gasta energía) y un NPC solo tiene una fila
/// NpcState por scope. Si el golpe deja al NPC CONVALECIENTE/MUERTO, cierra también su misión
/// asociada, resta reputación de facción y decrementa población — mismo criterio que
/// `applyExecuteTargets` para "Decapitar".
async function applyCombatExchangeToNpcState(params: {
  tx: Prisma.TransactionClient;
  npcAttackTarget: NpcInScene | null;
  npcNuevaEnergia: number | null;
  npcAttackHits: boolean;
  npcTargetNewCondicion: CondicionFisica | null;
  analizarRivalExito: boolean;
  /// Tope de usos por combate (2026-08-15, AbilityEffect.LIMITADA/maxUsesPerCombat) — nombres de
  /// habilidad (jugador y/o NPC) que se usaron DE VERDAD este intercambio y llevan tope; cada
  /// nombre sube +1 en `NpcState.abilityUsesThisEncounter`. El caller ya descarta aquí cualquier
  /// intento bloqueado por haber agotado el tope (nunca se cuenta dos veces).
  abilityNamesToIncrement: string[];
  saveId: string;
  worldId: string;
  currentLocationId: string | null;
  nuevoFictionalMinutes: number;
  nuevaFictionalDateLabel: string;
  activeRegion: string | null;
  /// Ver comentario de `completeNpcTargetQuests` (questResolution.ts) — reloj sintético
  /// "después de mainLogEntry" para que la recompensa de misión se lea en el orden correcto.
  nextAfterMainLogCreatedAt?: () => Date;
}): Promise<{ questCompletedInfo: QuestCompletedInfo | null }> {
  const {
    tx,
    npcAttackTarget,
    npcNuevaEnergia,
    npcAttackHits,
    npcTargetNewCondicion,
    analizarRivalExito,
    abilityNamesToIncrement,
    saveId,
    worldId,
    currentLocationId,
    nuevoFictionalMinutes,
    nuevaFictionalDateLabel,
    activeRegion,
    nextAfterMainLogCreatedAt,
  } = params;
  let questCompletedInfo: QuestCompletedInfo | null = null;
  if (
    !npcAttackTarget ||
    !(npcNuevaEnergia !== null || (npcAttackHits && npcTargetNewCondicion) || analizarRivalExito || abilityNamesToIncrement.length > 0)
  ) {
    return { questCompletedInfo };
  }
  const scope = scopeFor(npcAttackTarget.kind, currentLocationId);
  const esGolpeDeMuerte = npcAttackHits && npcTargetNewCondicion && (npcTargetNewCondicion === 'CONVALECIENTE' || npcTargetNewCondicion === 'MUERTO');
  // Caza en grupo (2026-08-13) — ver el hint gemelo en `resolveCombatExchangePhase` (misma
  // condición exacta, `npcAttackTarget.groupSize`/`.groupDefeated` ya leídos en el mismo turno
  // ANTES de narrar, para que lo que se escribe aquí coincida con lo que se le pidió narrar al
  // modelo). Si quedan más miembros, el individuo ACTUAL "resucita" a ILESO para el siguiente en
  // vez de quedarse en CONVALECIENTE/MUERTO — misma fila, `groupDefeated` sube uno.
  const grupoContinua = !!(esGolpeDeMuerte && npcAttackTarget.groupSize && npcAttackTarget.groupDefeated + 1 < npcAttackTarget.groupSize);
  const condicionAEscribir = grupoContinua ? 'ILESO' : npcTargetNewCondicion;
  // Tope de usos por combate (2026-08-15) — se resetea a `{}` en cuanto el NPC vuelve a ILESO
  // (descanso/curación real entre combates, nunca durante uno; mismo criterio ya documentado en
  // schema.prisma § NpcState.abilityUsesThisEncounter), y suma +1 por cada nombre usado este
  // intercambio que lleve tope. Solo se escribe si de verdad cambia algo, mismo criterio que el
  // resto de este upsert.
  const abilityUsesReset = condicionAEscribir === 'ILESO';
  const abilityUsesNext = abilityUsesReset ? {} : { ...npcAttackTarget.abilityUsesThisEncounter };
  for (const name of abilityNamesToIncrement) abilityUsesNext[name] = (abilityUsesNext[name] ?? 0) + 1;
  const abilityUsesChanged = abilityUsesReset || abilityNamesToIncrement.length > 0;
  await tx.npcState.upsert({
    where: { saveId_npcId_scope: { saveId, npcId: npcAttackTarget.id, scope } },
    create: {
      saveId,
      npcId: npcAttackTarget.id,
      scope,
      ...(npcTargetNewCondicion ? { condicionFisica: condicionAEscribir!, condicionFisicaSinceMinutes: nuevoFictionalMinutes } : {}),
      ...(npcNuevaEnergia !== null ? { energia: npcNuevaEnergia } : {}),
      // Rediseño de combate (2026-08-09, "Analizar rival") — permanente por NPC/scope en esta
      // partida, nunca se vuelve a poner en false (mismo criterio idempotente que `saqueado`).
      ...(analizarRivalExito ? { analizado: true } : {}),
      ...(esGolpeDeMuerte && npcAttackTarget.groupSize ? { groupDefeated: 1, corpsesLooted: 0 } : {}),
      ...(abilityUsesChanged ? { abilityUsesThisEncounter: abilityUsesNext } : {}),
    },
    update: {
      ...(npcAttackHits && npcTargetNewCondicion
        ? { condicionFisica: condicionAEscribir!, condicionFisicaSinceMinutes: nuevoFictionalMinutes, ...(esGolpeDeMuerte && npcAttackTarget.groupSize ? { groupDefeated: { increment: 1 } } : {}) }
        : {}),
      ...(npcNuevaEnergia !== null ? { energia: npcNuevaEnergia } : {}),
      ...(analizarRivalExito ? { analizado: true } : {}),
      ...(abilityUsesChanged ? { abilityUsesThisEncounter: abilityUsesNext } : {}),
    },
  });

  if (esGolpeDeMuerte) {
    // Cierre detectable por backend (roadmap 2026-07-19, mecánicas): si alguna misión ACTIVA
    // apuntaba a este NPC (Quest.targetNpcId, ver newQuest más arriba), derrotarlo la cierra sola
    // en cuanto cae — el modelo nunca tiene que acertar el título EXACTO vía questProgress para
    // el caso más común de misión de combate ("derrotar a X"). También concede rewardItems/
    // rewardXp de verdad y narra la recompensa (docs/19 pieza 3).
    const completedHere = await completeNpcTargetQuests(
      tx,
      saveId,
      worldId,
      npcAttackTarget.id,
      nuevaFictionalDateLabel,
      nuevoFictionalMinutes,
      nextAfterMainLogCreatedAt,
    );
    if (completedHere) questCompletedInfo = completedHere;

    // Reputación de facción determinista (roadmap 2026-07-19, prioridad 4): reutiliza
    // `WorldState.factionsStatus` (gauge 0-5000 por facción, ver reputation.ts — reemplaza el
    // viejo ±1 sin límite). Atacar a un NPC de una facción concreta resta bastante más de lo que
    // se recupera resolviendo algo en paz (deltas asimétricos, "pozo real" para ENEMIGO); sin
    // facción (fauna, NPCs independientes) no afecta a nada.
    if (npcAttackTarget.faction) {
      const currentWorldState = await tx.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true } });
      const updatedFactionsStatus = applyFactionRepDelta(
        parseFactionsStatus(currentWorldState?.factionsStatus),
        npcAttackTarget.faction,
        FACTION_REP_ATTACK_DELTA,
      );
      await tx.worldState.update({ where: { saveId }, data: { factionsStatus: updatedFactionsStatus } });
    }

    // Población dinámica (docs/16-poblacion-dinamica.md): solo MUERTO resta población de verdad
    // — CONVALECIENTE es solo derrotado, no una baja real de la especie/raza.
    if (npcTargetNewCondicion === 'MUERTO') {
      await decrementPopulationOnDeath(tx, worldId, npcAttackTarget.raza, npcAttackTarget.slug, activeRegion);
    }
  }
  return { questCompletedInfo };
}

/// "Decapitar" (petición explícita, 2026-07-30), extraído de la transacción de
/// `narrateAndPersistTurn` (refactor de deuda técnica 2026-08-13) — sin tirada: un enemigo ya
/// convaleciente no puede resistir el golpe de gracia. Uno por uno porque el modal puede marcar
/// varios a la vez (checkbox). Mismo cierre de misión/reputación de facción/población que un
/// golpe normal que deja MUERTO al objetivo — en la práctica la misión ya se cerró al quedar
/// CONVALECIENTE, esto solo cubre el caso raro de que no lo hiciera.
async function applyExecuteTargets(params: {
  tx: Prisma.TransactionClient;
  executeTargets: NpcInScene[];
  saveId: string;
  worldId: string;
  currentLocationId: string | null;
  nuevoFictionalMinutes: number;
  nuevaFictionalDateLabel: string;
  activeRegion: string | null;
  nextAfterMainLogCreatedAt?: () => Date;
}): Promise<{ questCompletedInfo: QuestCompletedInfo | null }> {
  const { tx, executeTargets, saveId, worldId, currentLocationId, nuevoFictionalMinutes, nuevaFictionalDateLabel, activeRegion, nextAfterMainLogCreatedAt } =
    params;
  let questCompletedInfo: QuestCompletedInfo | null = null;
  for (const executeTarget of executeTargets) {
    const scope = scopeFor(executeTarget.kind, currentLocationId);
    // Revalidación anti-carrera (auditoría de deuda técnica 2026-08-04, mismo patrón ya cerrado
    // para construcción/crafteo/despiece/saqueo): `executeTargets` sale de `npcsInScene`, leído
    // con `prisma` ANTES de esta transacción — dos "decapito a X" casi simultáneos podían pasar
    // ambos el filtro `condicionFisica === 'CONVALECIENTE'` con la misma foto obsoleta y aplicar
    // la muerte DOS veces: población mundial restada dos veces por una sola baja, y penalización
    // de reputación de facción duplicada. La escritura de `condicionFisica: 'MUERTO'` en sí es
    // idempotente, pero sus efectos secundarios no lo son — se saltan enteros si el NPC ya
    // estaba MUERTO de verdad justo antes de escribir.
    const freshExecuteState = await tx.npcState.findUnique({
      where: { saveId_npcId_scope: { saveId, npcId: executeTarget.id, scope } },
    });
    if (freshExecuteState?.condicionFisica === 'MUERTO') continue;
    // Caza en grupo (2026-08-13) — mismo criterio que `applyCombatExchangeToNpcState`, pero con
    // el estado FRESCO ya leído arriba (esta función ya revalida contra `tx` por su propia
    // carrera de "decapitar dos veces") en vez de la foto de antes de la transacción.
    const grupoContinuaDecapitar = !!(freshExecuteState?.groupSize && freshExecuteState.groupDefeated + 1 < freshExecuteState.groupSize);
    await tx.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: executeTarget.id, scope } },
      create: { saveId, npcId: executeTarget.id, scope, condicionFisica: 'MUERTO', condicionFisicaSinceMinutes: nuevoFictionalMinutes },
      update: {
        condicionFisica: grupoContinuaDecapitar ? 'ILESO' : 'MUERTO',
        condicionFisicaSinceMinutes: nuevoFictionalMinutes,
        ...(freshExecuteState?.groupSize ? { groupDefeated: { increment: 1 } } : {}),
      },
    });
    // Mismo cierre + recompensa real que un golpe normal que deja MUERTO al objetivo — en la
    // práctica la misión ya se cerró al quedar CONVALECIENTE, esto solo cubre el caso raro de que
    // no lo hiciera.
    const completedByExecute = await completeNpcTargetQuests(
      tx,
      saveId,
      worldId,
      executeTarget.id,
      nuevaFictionalDateLabel,
      nuevoFictionalMinutes,
      nextAfterMainLogCreatedAt,
    );
    if (completedByExecute) questCompletedInfo = completedByExecute;
    if (executeTarget.faction) {
      const currentWorldState = await tx.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true } });
      const updatedFactionsStatus = applyFactionRepDelta(
        parseFactionsStatus(currentWorldState?.factionsStatus),
        executeTarget.faction,
        FACTION_REP_ATTACK_DELTA,
      );
      await tx.worldState.update({ where: { saveId }, data: { factionsStatus: updatedFactionsStatus } });
    }

    // Población dinámica (docs/16-poblacion-dinamica.md) — Decapitar es siempre una muerte real.
    await decrementPopulationOnDeath(tx, worldId, executeTarget.raza, executeTarget.slug, activeRegion);
  }
  return { questCompletedInfo };
}

/// Despiece/recolección (§ 3.3), extraído de la transacción de `narrateAndPersistTurn` (refactor
/// de deuda técnica 2026-08-13) — solo si la acción tuvo éxito (o no requería tirada). Revalida
/// `harvestMatch` (calculado con `prisma`, ANTES de esta transacción) contra `tx` justo aquí,
/// mismo criterio anti-carrera que crafteo/construcción/saqueo: dos turnos de despiece casi
/// simultáneos sobre el mismo cadáver de fauna no pueden duplicar el botín de un solo cuerpo.
async function applyHarvest(params: {
  tx: Prisma.TransactionClient;
  harvestMatch: HarvestMatch | null;
  harvestOutcome: 'sin_presa' | 'ya_despiezada' | 'fallo' | 'exito' | null;
  roll: RollResult | null | undefined;
  saveId: string;
  currentLocationId: string | null;
  characterName: string;
}): Promise<{ newInventoryItems: NewInventoryItemInfo[]; createdItemNames: string[]; narrationOverride: string | null }> {
  const { tx, harvestMatch, harvestOutcome, roll, saveId, currentLocationId, characterName } = params;
  const newInventoryItems: NewInventoryItemInfo[] = [];
  const createdItemNames: string[] = [];
  // Solo aplica a fauna (`npcId` presente, el único caso con tope real); los recursos
  // vegetales/minerales no tienen límite de por sí (renovables, por diseño — ver harvest.ts).
  // Bug real (auditoría de bugs 2026-08-21): este guard solo miraba `.saqueado` — para caza en
  // grupo (`NpcState.groupSize` no nulo), `saqueado` nunca se marca por esta vía (ver más abajo,
  // que ahora incrementa `corpsesLooted` en su lugar, mismo criterio que `recolectar.ts`), así que
  // `harvestStillValid` salía SIEMPRE `true` para un grupo — el despiece narrado por texto libre
  // (a diferencia del panel dedicado "Despiece", que sí usa `corpsesLooted`/`groupDefeated` desde
  // el principio) podía repetirse turno tras turno sobre el mismo cadáver ya aprovechado,
  // duplicando materiales sin límite. `hasPendingLoot` (npcScene.ts) es el único punto de verdad
  // ya compartido por recolectar.ts/harvest.ts/panels.ts para este mismo criterio.
  const freshHarvestState =
    harvestMatch?.npcId && harvestMatch.npcKind
      ? await tx.npcState.findUnique({
          where: { saveId_npcId_scope: { saveId, npcId: harvestMatch.npcId, scope: scopeFor(harvestMatch.npcKind, currentLocationId) } },
        })
      : null;
  const harvestStillValid = harvestMatch?.npcId && harvestMatch.npcKind ? hasPendingLoot(freshHarvestState) : true;
  if (harvestMatch && (!roll || roll.success) && harvestStillValid) {
    for (const y of harvestMatch.yields) {
      const created = await tx.inventoryItem.create({
        data: {
          saveId,
          name: y.cantidad > 1 ? `${y.itemName} (${y.cantidad})` : y.itemName,
          description: `Obtenido despiezando/recolectando: ${harvestMatch.sourceName}.`,
          origin: 'despiece/recolección',
          catalogSlug: y.itemSlug,
        },
      });
      // Materia prima cruda — siempre tipo RECURSO por diseño (nunca EQUIPABLE ni ESPECIAL,
      // equipSlot/effectKey siempre null; ver comentario del enum ItemTipo).
      newInventoryItems.push({ ...created, slot: null, equipSlot: null, effectKey: null, tipo: 'RECURSO' });
      createdItemNames.push(created.name);
    }
    // Bug real (auditoría 2026-07-28): sin esto, el mismo cadáver de fauna ya derrotada se podía
    // despiezar sin límite — marca este NpcState como ya aprovechado, para que harvest.ts lo
    // bloquee la próxima vez. Caza en grupo (auditoría 2026-08-21, ver comentario de
    // `harvestStillValid` arriba): un grupo (`groupSize` no nulo) reclama el cadáver actual subiendo
    // `corpsesLooted` en vez de `saqueado` (booleano, solo tiene sentido para 1 individuo) — mismo
    // criterio exacto que ya usa `recolectar.ts` para el panel dedicado de Despiece.
    if (harvestMatch.npcId && harvestMatch.npcKind && harvestMatch.yields.length > 0) {
      const scope = scopeFor(harvestMatch.npcKind, currentLocationId);
      if (freshHarvestState?.groupSize) {
        await tx.npcState.updateMany({
          where: { saveId, npcId: harvestMatch.npcId, scope, corpsesLooted: { lt: freshHarvestState.groupDefeated } },
          data: { corpsesLooted: { increment: 1 } },
        });
      } else {
        await tx.npcState.upsert({
          where: { saveId_npcId_scope: { saveId, npcId: harvestMatch.npcId, scope } },
          create: { saveId, npcId: harvestMatch.npcId, scope, saqueado: true },
          update: { saqueado: true },
        });
      }
    }
  }
  // Narración mentirosa si se pierde la carrera (auditoría 2026-08-06, mismo patrón que loot/
  // build): `harvestOutcome === 'exito'` (antes de esta transacción) ya fijó y emitió en
  // streaming "despieza/recolecta X y consigue: ...", pero `harvestStillValid` (releído con `tx`)
  // puede decir que otro turno casi simultáneo ya se llevó ese mismo cadáver — sin corregir aquí,
  // el jugador vería en su Diario un botín que nunca recibió.
  const narrationOverride =
    harvestOutcome === 'exito' && harvestMatch && !harvestStillValid
      ? `${characterName} rebusca en los restos de ${harvestMatch.sourceName}, pero ya se llevó antes todo lo aprovechable. ${pickFlavor(HARVEST_FLAVOR_YA_DESPIEZADA)}`
      : null;
  return { newInventoryItems, createdItemNames, narrationOverride };
}

/// Decide con qué NPCs se abre/persiste el popup de combate este turno y sincroniza
/// `Save.pendingCombatNpcSlugs` — extraído de `narrateAndPersistTurn` (refactor de deuda técnica
/// 2026-08-13). Pura salvo el propio `prisma.save.update` final; entrada/salida acotada — todo lo
/// que necesita ya está resuelto por el caller (narración, intercambio de combate, decapitar,
/// saqueo parcial), no dispara ninguna otra lectura/escritura por su cuenta.
async function resolveCombatSlugsAndPersist(params: {
  saveId: string;
  action: string;
  enCombate: boolean | undefined;
  narration: NarrationResult;
  npcsInScene: NpcInScene[];
  npcsInSceneVivos: NpcInScene[];
  factionsStatus: Record<string, number>;
  condicionFisicaJugador: CondicionFisica;
  explicitTarget: NpcInScene | null;
  exchangeHappened: boolean;
  npcAttackTarget: NpcInScene | null;
  npcAttackHits: boolean;
  npcTargetNewCondicion: CondicionFisica | null;
  executeTargets: NpcInScene[];
  partiallyLootedSlugs: string[];
  /// Bug real (auditoría 2026-08-14, "acaba de salir pero en el siguiente turno" — Analizar Rival
  /// con éxito este mismo turno, pero la Ficha del rival seguía vacía hasta el turno siguiente):
  /// mismo bug que ya se documentó y arregló abajo para `condicionFisica` (`npcsInScene` se lee
  /// UNA vez al principio del turno, antes de que `tx.npcState.upsert` escriba `analizado: true`),
  /// pero ese fix nunca se extendió a este campo. `npcAttackTarget` es el mismo NPC que
  /// `npcParaIntercambio` (ver línea ~659), así que sirve igual de identificador aquí.
  analizarRivalExito: boolean;
}): Promise<{ combatSlugs: string[]; combateIniciado: NonNullable<NarrateAndPersistResult['combateIniciado']> | null }> {
  const {
    saveId,
    action,
    enCombate,
    narration,
    npcsInScene,
    npcsInSceneVivos,
    factionsStatus,
    condicionFisicaJugador,
    explicitTarget,
    exchangeHappened,
    npcAttackTarget,
    npcAttackHits,
    npcTargetNewCondicion,
    executeTargets,
    partiallyLootedSlugs,
    analizarRivalExito,
  } = params;

  // Red de seguridad (ver detectsAttackIntent/detectsHostileSearchIntent en npcScene.ts): si el
  // modelo no marcó combateIniciado pero o bien propuso empeorar la condición física (indicio de
  // que sí narró daño real), o el jugador usó un verbo de ataque claro, o declaró intención hostil
  // de búsqueda ("en busca de pelea", "para matarlo"...) contra un NPC ya en escena, se fuerza
  // igualmente — evita que una pelea real narrada por el modelo se quede sin popup de combate
  // por un olvido del campo (bug real jugando, 2026-07-22: justo el caso de búsqueda hostil).
  //
  // Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida" — un
  // "Ataco al Orco Enfurecido" real no abrió el popup): el modelo SÍ rellenó "combateIniciado",
  // pero con un slug que no matcheaba ninguno de `npcsInScene` (inventado o mal escrito). Antes,
  // `combatSlugsFromModel.length === 0` ya daba false (el modelo "sí propuso algo"), así que la
  // red de seguridad NUNCA se activaba — y como el slug no matcheaba nada real, `combatSlugs`
  // acababa vacío igualmente tras el `.filter()` de abajo, dejando un `combateIniciado: {npcs: []}`
  // que el frontend descarta en silencio (`combate.npcs.length > 0`). Ahora se valida el slug
  // ANTES de decidir si hace falta la red de seguridad — si el modelo "propuso" algo que no
  // corresponde a ningún NPC real en escena, cuenta como si no hubiera propuesto nada.
  // Bug real jugando en vivo (2026-08-01, "el orco que metí volvió a aparecer" — auditoría a fondo
  // de "revisa bien en todos los sitios que pendingCombatNpcSlugs se actualiza bien"): TODO este
  // bloque decide con quién se fuerza/persiste combate, y hasta ahora ninguna de sus piezas miraba
  // `condicionFisica` — un NPC ya CONVALECIENTE/MUERTO seguía siendo candidato de
  // `detectNpcsInScene` (tiene `NpcState` propio) y podía matchear en escena vía `sessionFacts`
  // durante turnos sin ninguna relación con él (p.ej. "Exploro la zona"). Su temperamento de
  // catálogo (AGRESIVO/ENEMIGO) no desaparece al morir, así que `agresivoSlugsInScene` lo seguía
  // contando como amenaza y podía reabrir `combateIniciado`/`pendingCombatNpcSlugs` contra un
  // cadáver ya saqueado. `npcsInSceneVivos` es la misma lista sin nadie ya resuelto — se usa en
  // todo lo que decide "hay una amenaza real aquí" de aquí para abajo; `npcsInScene` (sin filtrar)
  // se sigue necesitando tal cual para `explicitTarget`/loot/decapitar/`npcSceneBlockFor`, que sí
  // necesitan poder referirse a un NPC ya derrotado a propósito.
  // Bug real jugando en vivo (2026-08-04, "ronda larga de pruebas"): esto se fiaba a ciegas de
  // `combateIniciado.npcSlugs`, propuesto libremente por el modelo en su JSON — en un turno de
  // descanso totalmente ajeno a combate (`enCombate: false`, sin ningún verbo hostil), el modelo
  // propuso igualmente combate contra Gistera Koh (temperamento CAUTELOSO, nunca hostil), solo
  // porque un hecho de sesión de trasfondo la menciona de pasada. Filtrado solo por "¿está viva y
  // en escena?" no bastaba — ahora también exige que sea de verdad hostil
  // (AGRESIVO/ENEMIGO, con reputación de facción ya aplicada, mismo criterio que
  // `agresivoSlugsInScene` más abajo). Un NPC pacífico solo puede entrar en combate por la vía
  // determinista de siempre (intercambio/ejecución/`shouldForceCombat`), nunca porque el modelo lo
  // proponga sin más.
  const combatSlugsFromModel = (narration.combateIniciado?.npcSlugs ?? []).filter((slug) =>
    npcsInSceneVivos.some((n) => {
      if (n.slug !== slug) return false;
      const t = effectiveTemperamento(n.temperamento, n.faction, factionsStatus);
      return t === 'AGRESIVO' || t === 'ENEMIGO';
    }),
  );
  // Temperamento (2026-07-29, "si me encuentro un NPC 'Agresivo' me va a ser imposible no acabar
  // peleando con él" + "la reputación influirá en los valores de combate"): el temperamento de
  // catálogo (fijo) se desplaza por la reputación de facción de esta partida concreta —
  // `effectiveTemperamento` (reputation.ts) es lo que de verdad decide aquí, no `n.temperamento`
  // a secas. Un NPC con `faction: null` (fauna, independientes) no tiene de qué desplazarse y
  // devuelve su valor de catálogo tal cual.
  //
  // Un modelo local pequeño no siempre sigue bien una instrucción de prompt, así que para
  // AGRESIVO/ENEMIGO no nos fiamos solo del Narrador — cualquier NPC agresivo u hostil detectado
  // en escena fuerza combate él solo, sin depender del verbo del jugador (mismo criterio de "no
  // barrer a inocentes" que el bug del Múrgol de abajo: solo estos slugs, no todo `npcsInScene`).
  const agresivoSlugsInScene = npcsInSceneVivos
    .filter((n) => {
      const t = effectiveTemperamento(n.temperamento, n.faction, factionsStatus);
      return t === 'AGRESIVO' || t === 'ENEMIGO';
    })
    .map((n) => n.slug);
  // Contraparte para AMIGABLE/INOFENSIVO/CAUTELOSO: si TODOS los NPCs en escena son incapaces de
  // haber iniciado la agresión por su cuenta, ninguno de ellos puede haber causado de verdad el
  // empeoramiento de condición que narró el modelo — un giro ambiguo (el modelo "propuso" daño sin
  // que nada en escena pudiera infligirlo) no debe abrir combate contra un Múrgol o un Corredor de
  // Cauce. Los verbos explícitos del jugador (`detectsAttackIntent`/`detectsHostileSearchIntent`,
  // líneas de abajo) siguen funcionando igual — atacar a algo pacífico/cauteloso de propia
  // iniciativa sigue siendo posible, esto solo decide si un NPC pudo haber sido quien atacó.
  //
  // CAUTELOSO incluido (bug real jugando en vivo, 2026-08-20: aceptar ayudar a Gistera Koh — "no
  // habíamos quedado que aceptar ayudar solo crea la misión, nunca abre combate" — forzó combate
  // contra ella igualmente): antes solo AMIGABLE/INOFENSIVO contaban como "no pudo haber sido él",
  // dejando a CAUTELOSO en una tierra de nadie — ni pacífico para este chequeo ni agresivo para
  // `agresivoSlugsInScene` — así que cualquier `condicionFisica` de bajada que el modelo devolviera
  // en su JSON (aunque la propia narración fuera cortés, "pregunta en tono cortés pero firme") le
  // bastaba para forzar combate contra un NPC que, por definición de catálogo (ver comentario del
  // enum `Temperamento`, schema.prisma), "depende de la acción del jugador" — nunca inicia nada por
  // su cuenta, así que jamás pudo ser la causa de una bajada de condición no provocada por el
  // jugador.
  const allNpcsInSceneArePacificos =
    npcsInSceneVivos.length > 0 &&
    npcsInSceneVivos.every((n) => {
      const t = effectiveTemperamento(n.temperamento, n.faction, factionsStatus);
      return t === 'AMIGABLE' || t === 'INOFENSIVO' || t === 'CAUTELOSO';
    });
  // Bug real jugando en vivo (2026-07-24, decisión explícita de la usuaria: "aceptar ayudar solo
  // crea la misión, nunca abre combate"): "Cuenta conmigo. Acabaré con el que te persigue."
  // (aceptando ayudar a Gistera Koh) comparte vocabulario con `detectsHostileSearchIntent`
  // ("acabar(e)? con") — necesario para que el clasificador la trate como instantánea, pero forzaba
  // combate igual contra TODOS los NPCs en escena (Gistera Koh, la propia aliada que pidió ayuda, Y
  // un Múrgol de paso sin relación ninguna) — una promesa a futuro no es un ataque ahora mismo.
  // Nunca suprime `detectsAttackIntent` (un ataque real de verdad sigue abriendo combate).
  const shouldForceCombat =
    !enCombate &&
    combatSlugsFromModel.length === 0 &&
    npcsInSceneVivos.length > 0 &&
    (agresivoSlugsInScene.length > 0 ||
      (isCondicionDowngrade(condicionFisicaJugador, narration.condicionFisica) && !allNpcsInSceneArePacificos) ||
      detectsAttackIntent(action) ||
      (detectsHostileSearchIntent(action) && !detectsVerbalAcceptanceIntent(action)));
  // Bug real (auditoría 2026-07-23, "ha metido un murgol que no pinta nada"): la red de seguridad
  // metía a TODOS los NPCs detectados en escena como participantes de combate (aliados, fauna de
  // paso...), no solo al hostil. Si la acción cita un nombre real entre comillas (`explicitTarget`,
  // ver arriba), el popup arranca solo con ese — y si lo que disparó la red de seguridad fue un
  // NPC agresivo, solo él entra (mismo criterio) — el listado completo de `npcsInScene` queda como
  // último recurso para cuando la acción no nombra a nadie en concreto ("me defiendo").
  //
  // Bug real (2026-08-01, misma auditoría de `npcsInSceneVivos` de arriba): `explicitTarget` no
  // mira `condicionFisica` (a propósito, lo necesita loot/decapitar para citar a un NPC ya
  // derrotado) — pero si el jugador cita entre comillas a alguien YA muerto/convaleciente y esta
  // acción además dispara `shouldForceCombat` por cualquier otro motivo, no tiene sentido "forzar
  // combate" contra un cadáver. Se comprueba aquí, solo para esta decisión.
  const explicitTargetVivo =
    explicitTarget && explicitTarget.condicionFisica !== 'CONVALECIENTE' && explicitTarget.condicionFisica !== 'MUERTO' ? explicitTarget : null;
  const forcedCombatSlugs = explicitTargetVivo
    ? [explicitTargetVivo.slug]
    : agresivoSlugsInScene.length > 0
      ? agresivoSlugsInScene
      : npcsInSceneVivos.map((n) => n.slug);
  const baseCombatSlugs = combatSlugsFromModel.length > 0 ? combatSlugsFromModel : shouldForceCombat ? forcedCombatSlugs : [];
  // Bug real (2026-07-29, jugando en vivo — "sigo sin hacerle daño al enemigo" con `enCombate`
  // ya activo): mientras el combate ya está abierto, `shouldForceCombat` exige `!enCombate`
  // (nunca se cumple) — así que `combatSlugs` dependía SOLO de que el modelo volviera a listar el
  // slug del NPC en su propia `combateIniciado.npcSlugs` cada turno, algo que no garantiza en
  // absoluto (campo narrativo, no determinista). Si esta acción resolvió un intercambio mecánico
  // de verdad (resolveExchange), el NPC de ese intercambio SIEMPRE se incluye aquí — así
  // `combateIniciado` (y con él la condición física fresca del NPC) llega al frontend en CADA
  // turno donde de verdad pasó algo, no solo cuando el modelo se acuerda de repetir el slug.
  const combatSlugsWithAttack =
    exchangeHappened && npcAttackTarget && !baseCombatSlugs.includes(npcAttackTarget.slug)
      ? [...baseCombatSlugs, npcAttackTarget.slug]
      : baseCombatSlugs;
  // "Decapitar" (2026-07-30) — mismo criterio que el golpe normal de arriba: si esta acción
  // ejecutó a uno o varios enemigos de verdad, sus slugs viajan aquí siempre, sin depender de que
  // el modelo se acuerde de repetirlos en su propia propuesta narrativa.
  const executeSlugs = executeTargets.map((n) => n.slug);
  // Saqueo parcial (ver `partiallyLootedSlugs` del caller): un NPC tocado este turno que se queda
  // CON botín pendiente sigue contando como "en combate" para que `pendingCombatNpcSlugs`
  // sobreviva a un resync/recarga — sin esto, un turno de solo-saqueo (sin exchange ni decapitar)
  // vaciaba el campo aunque quedaran objetos por saquear.
  const combatSlugs = [...new Set([...combatSlugsWithAttack, ...executeSlugs, ...partiallyLootedSlugs])];

  // Persistido (bug real, 2026-07-23, "revisar partida" — tercera vuelta sobre este mismo tema):
  // `combateIniciado` viajaba SOLO en la respuesta directa de este turno — si el turno tardaba
  // tanto que el sondeo de reconexión del cliente (GameView.tsx) tenía que recuperar la partida
  // vía `GET /saves/:id` en vez de recibir la respuesta directa, el combate se calculaba bien
  // aquí pero se perdía sin dejar rastro, porque `Save` no lo guardaba en ningún sitio. Se
  // sobrescribe cada turno (vacío si no hay combate ESTE turno) para que `GET /saves/:id` pueda
  // reconstruir el mismo aviso tras cualquier resincronización, no solo en la respuesta directa.
  await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: combatSlugs } });

  const combateIniciado = combatSlugs.length
    ? {
        npcs: combatSlugs
          .map((slug) => npcsInScene.find((n) => n.slug === slug))
          .filter((n): n is (typeof npcsInScene)[number] => !!n)
          // condicionFisica/saqueado reales (auditoría de frontend, 2026-07-19): antes CombatModal
          // no tenía forma de saber si este NPC ya venía herido o ya saqueado de un encuentro
          // anterior en la misma partida — siempre arrancaba el popup asumiendo ILESO/sin saquear.
          //
          // Bug real (auditoría 2026-07-28): `npcsInScene` se lee UNA sola vez al principio del
          // turno (antes de la transacción) y nunca se reescribe en memoria tras el
          // `tx.npcState.upsert` de más arriba — sin este override, el NPC recién golpeado ESTE
          // MISMO turno se devolvía todavía con su condición de ANTES del golpe. El frontend ya
          // no tiene ningún downgrade optimista propio (ver GameView.tsx) que lo tapara, así que
          // esta respuesta tiene que traer la condición fresca ella sola.
          .map((n) => ({
            slug: n.slug,
            name: n.name,
            condicionFisica:
              executeTargets.some((t) => t.id === n.id)
                ? ('MUERTO' as CondicionFisica)
                : npcAttackTarget && npcAttackHits && npcTargetNewCondicion && n.id === npcAttackTarget.id
                  ? npcTargetNewCondicion
                  : n.condicionFisica,
            saqueado: n.saqueado,
            // Bug real (2026-07-31, "saqueé 2 de 3 y la próxima vez me volvía a listar las 3"):
            // este payload nunca mandaba qué objetos concretos ya se habían tomado — el frontend
            // no tenía forma de filtrar el modal aunque `NpcState.lootedItemNames` ya llevaba la
            // cuenta correcta en el backend desde el saqueo parcial (ver npcScene.ts).
            lootedItemNames: n.lootedItemNames,
            // Rediseño de combate (2026-08-09, "Analizar rival") — gatea la ficha del rival en
            // CombatPanel.tsx § EnemyFicha. Override del análisis recién resuelto ESTE turno
            // (auditoría 2026-08-14) — mismo criterio que el override de `condicionFisica` de
            // arriba, `n.analizado` por sí solo es la foto de ANTES de este turno.
            analizado: analizarRivalExito && npcAttackTarget && n.id === npcAttackTarget.id ? true : n.analizado,
          })),
      }
    : null;

  return { combatSlugs, combateIniciado };
}

/// "Adorno" de las ramas deterministas (petición explícita, 2026-08-22: "darle una pasada a todos
/// los prompts deterministas... para adornarlas con texto para que sean mas atractivas... en la
/// partida y en las posteriores narraciones"). Decisión explícita de la usuaria tras preguntarle
/// (justo se acababa de sacar a Curar del LLM para evitar coste/latencia/alucinaciones): NUNCA
/// pasar estos turnos por `narrateAction` — la frase mecánica de siempre (QUÉ pasó, con qué
/// objetos/cantidades EXACTAS) no cambia ni una palabra, sigue siendo puro dato determinista y va
/// SIEMPRE primero; solo se le añade una segunda frase de color/atmósfera de un puñado ya escrito
/// a mano, elegida al azar (nunca generada por IA) — mismo criterio de siempre ("nunca lo decide
/// el modelo"), solo que ahora hay variedad en vez de la misma frase fija turno tras turno. La
/// frase de color persiste en `LogEntry.text`, así que también alimenta `sessionFacts`/narraciones
/// futuras, no es solo cosmética de este turno.
function pickFlavor(variants: readonly string[], random: () => number = Math.random): string {
  return variants[Math.floor(random() * variants.length)];
}

const LOOT_FLAVOR_SUCCESS = [
  'Nada llamativo, pero útil.',
  'El polvo y la sangre seca cubren cada hallazgo.',
  'Guarda cada pieza sin perder tiempo, atento a la zona.',
  'El silencio del lugar hace que cada movimiento se sienta más pesado.',
] as const;
const LOOT_FLAVOR_EMPTY = ['Solo quedan jirones y polvo.', 'Alguien —o algo— se le adelantó.', 'El lugar ya está limpio de todo valor.'] as const;
const BUILD_FLAVOR = [
  'El esfuerzo se nota en cada tabla y cada piedra bien encajada.',
  'Un paso más hacia dejar huella en esta tierra.',
  'El trabajo ha llevado su tiempo, pero el resultado se sostiene firme.',
] as const;
const HARVEST_FLAVOR_SIN_PRESA = ['Solo encuentra tierra removida y silencio.', 'Nada que despiezar, al menos por ahora.'] as const;
const HARVEST_FLAVOR_YA_DESPIEZADA = [
  'No queda ni un jirón que merezca la pena.',
  'Los restos, ya vacíos, no tienen nada más que ofrecer.',
] as const;
const HARVEST_FLAVOR_FALLO = ['El material se resiste más de lo esperado.', 'Puede que con más calma o mejor herramienta salga distinto.'] as const;
const HARVEST_FLAVOR_EXITO = [
  'Un trabajo limpio, sin desperdiciar nada aprovechable.',
  'Cada pieza queda bien guardada antes de seguir camino.',
  'El esfuerzo merece la pena.',
] as const;
const CRAFT_FLAVOR = [
  'El resultado queda listo para usarse de inmediato.',
  'Manos firmes y trabajo bien hecho.',
  'Otra pieza más añadida a lo que ya sabe hacer.',
] as const;
const HEAL_FLAVOR = ['El alivio es inmediato.', 'El cuerpo agradece el descanso, aunque sea breve.', 'Un respiro necesario antes de seguir.'] as const;

/// Narra (retrieval + narrateAction) y persiste el resultado de un turno — hechos, XP/nivel,
/// inventario/compañeros, eventos de Reino, posición/NPCs/despiece (docs/12), condición física
/// y muerte/descanso (docs/14), LogEntry. Compartido entre el turno síncrono (bandas
/// instantánea/corta, `POST /turn/narrate`) y la resolución diferida de un `CharacterTransit`
/// (bandas extendida/larga, `worldTick`) — misma lógica, dos disparadores.
export async function narrateAndPersistTurn(params: NarrateAndPersistParams): Promise<NarrateAndPersistResult> {
  const {
    saveId,
    worldId,
    action,
    characterSummary,
    characterName,
    timeLabel,
    sessionFacts,
    classification,
    roll,
    attributes,
    secondaryAttributes,
    defensa,
    equippedWeapons,
    equippedItems,
    unlockedRecipeKeys = [],
    raza,
    currentLocationId,
    travel,
    minutosDeEsteTurno,
    fictionalMinutesActuales,
    produccion,
    enCombate,
    onNarrationChunk,
    onNarrationReset,
    onExchangeResolved,
    savedActionId,
    isItemUse,
    transitIdToFinalize,
    earlyBuildingId,
    notBefore,
    pendingNpcAttack,
    npcsInScene: npcsInScenePrecomputed,
    lootItemNames,
    healItemUses,
    pendingCombatNpcSlugs,
    travelInterruptionNpcId,
    travelInterruptionOriginalDestinationName,
  } = params;

  // Revisión técnica 2026-07-22: estas 4 consultas no dependen entre sí (retrieveLore es la única
  // que depende de una de ellas, ver más abajo) — antes iban en `await` secuencial, una detrás de
  // otra, cada una su propio viaje de ida y vuelta a Postgres. Agrupadas en Promise.all para pagar
  // solo la más lenta de las 4, no la suma de las 4. Ahorro real pero modesto (decenas-cientos de
  // ms) frente a los 30-220s que domina la generación del modelo — vale la pena por ser gratis y
  // sin riesgo, no porque vaya a notarse en la duración total del turno.
  const regionLocationId = travel ? travel.toLocationId : currentLocationId;
  const [selectedAbilityData, regionLocation, npcsInSceneRaw, harvestMatch, faunaSources, factionsStatus, lastNarration, gisteraQuestYaExiste] = await Promise.all([
    // Efecto y coste de energía de la habilidad pulsada (checklist 2026-07-21/22, puntos 1-2;
    // coste de energía 2026-07-29) — null/0 si el jugador escribió la acción a mano (sin
    // savedActionId) o si esa SavedAction no tiene efecto asignado (habilidades generales, o
    // partidas en curso creadas antes de esta migración).
    // `saveId` en el filtro (auditoría de deuda técnica 2026-08-04, bug real de fuga entre
    // partidas): sin él, un `savedActionId` de OTRA partida seguía resolviendo aquí también.
    savedActionId
      ? prisma.savedAction.findFirst({
          where: { id: savedActionId, saveId },
          select: { name: true, icon: true, description: true, effects: true, rol: true, energyCost: true, energyRegen: true, dualWield: true, maxUsesPerCombat: true },
        })
      : Promise.resolve<{
          name: string;
          icon: string;
          description: string;
          effects: AbilityEffect[];
          rol: AbilityRol | null;
          energyCost: number;
          energyRegen: number;
          dualWield: boolean;
          maxUsesPerCombat: number | null;
        } | null>(null),
    regionLocationId ? prisma.location.findUnique({ where: { id: regionLocationId }, select: { region: true, name: true } }) : Promise.resolve(null),
    // Auditoría de rendimiento 2026-07-28 ("rascar segundos"): si el caller (turn.ts) ya trae el
    // resultado de /turn/classify para esta misma acción, se reutiliza tal cual en vez de repetir
    // el mismo `detectNpcsInScene` (roster completo del mundo + objetos, contra Supabase remoto)
    // por segunda vez en el mismo turno — worldTick.ts (resolución diferida) no lo trae, así que
    // sigue calculándolo fresco como siempre.
    npcsInScenePrecomputed ? Promise.resolve(npcsInScenePrecomputed) : detectNpcsInScene({ action, worldId, sessionFacts, saveId, currentLocationId }),
    travel ? Promise.resolve(null) : detectHarvest({ action, worldId, saveId, currentLocationId }),
    // Distingue fauna (animales, sin habla) de NPCs de verdad dentro de `npcsInScene` — ambos
    // comparten la misma tabla Npc/detección por alias (ver comentario del bloque de diálogo más
    // abajo, bug real 2026-07-23).
    prisma.harvestYield.findMany({ where: { worldId }, select: { sourceSlug: true } }),
    // Reputación de facción (2026-07-29) — necesaria YA aquí (no solo al persistir el delta más
    // abajo) para calcular el temperamento EFECTIVO de cada NPC en escena antes de decidir
    // shouldForceCombat (ver reputation.ts § effectiveTemperamento).
    prisma.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true } }).then((r) => parseFactionsStatus(r?.factionsStatus)),
    // Anti-repetición (2026-07-30, auditoría "revisar partida" — queja explícita: "redundancias
    // con la palabra sombra o cosas de este estilo"): el Narrador nunca veía su propia narración
    // de turnos anteriores, solo `sessionFacts` (hechos discretos, nunca prosa) — sin eso, no
    // tiene forma de saber que ya usó "sombra" dos veces seguidas hace un momento. Se le pasa el
    // último párrafo narrado tal cual, con instrucción explícita de variar el lenguaje.
    prisma.logEntry.findFirst({
      where: { saveId, channel: 'CHARACTER', isPlayerAction: false },
      orderBy: { createdAt: 'desc' },
      select: { text: true },
    }),
    // Petición explícita de la usuaria (2026-08-01): "en cuanto acepto la misión de Gistera que
    // ella se marche... y que no vuelva a aparecer" — hoisted aquí (antes vivía más abajo, junto
    // al resto del bloque Gistera Koh) para poder filtrarla de `npcsInScene` ANTES de que nada la
    // use como objetivo de ataque/diálogo por defecto (`candidateAttackTarget`/`dialogueTarget`,
    // más abajo en este mismo archivo) — dejarlo para después de esos usos la habría dejado
    // disponible como objetivo mecánico un turno más, aunque la narración ya la diera por ida.
    prisma.quest.findFirst({ where: { saveId, title: { contains: 'Orco Enfurecido' } } }),
  ]);

  // Eventos de viaje interactivos (2026-08-05): si este turno resuelve un viaje truncado por una
  // interrupción (turn.ts, pickTravelInterruption), el NPC elegido entra en escena de forma
  // DETERMINISTA — a diferencia del resto de `npcsInScene` (detectado por texto vía
  // detectNpcsInScene), este no depende de que el Narrador narre su nombre. Se resuelve antes del
  // filtro de Gistera para que shouldForceCombat/npcSceneBlockFor/dialogueTarget más abajo lo
  // traten exactamente igual que a cualquier otro NPC ya detectado.
  let npcsInSceneWithInterruption = npcsInSceneRaw;
  if (travelInterruptionNpcId && !npcsInSceneRaw.some((n) => n.id === travelInterruptionNpcId)) {
    const interruptionNpc: NpcWithItems | null = await prisma.npc.findUnique({
      where: { id: travelInterruptionNpcId },
      include: { items: { include: { item: true } } },
    });
    if (interruptionNpc) {
      const interruptionLocationId = travel?.toLocationId ?? currentLocationId;
      const interruptionState = await prisma.npcState.findUnique({
        where: { saveId_npcId_scope: { saveId, npcId: interruptionNpc.id, scope: scopeFor(interruptionNpc.kind, interruptionLocationId) } },
      });
      npcsInSceneWithInterruption = [...npcsInSceneRaw, buildNpcInScene(interruptionNpc, interruptionState ?? undefined)];
    }
  }

  // Búsqueda del perseguidor de Gistera Koh sin nombrarlo (petición explícita, 2026-08-20: "el
  // tema de que el Orco Enfurecido aunque lo busque como 'perseguidor' no aparezca"): la escena lo
  // mantiene A PROPÓSITO sin nombrar (Gistera dice "uno de los suyos me pisa los talones", nunca
  // "Orco Enfurecido" — ver fase 2 más abajo), así que `detectNpcsInScene` (que solo compara texto
  // contra `name`/`aliases` reales de catálogo, y él solo tiene 'orco enfurecido') nunca lo
  // detecta si el jugador busca con vocabulario de "perseguidor". Añadirlo como alias GLOBAL de
  // catálogo sería peligroso: es NPC `PRINCIPAL` (candidato en CUALQUIER escena del juego, ver
  // `candidateNpcs` en `npcScene.ts`), así que una futura trama con un "perseguidor" genérico lo
  // detectaría por error. En su lugar, igual que `travelInterruptionNpcId` arriba, se inyecta de
  // forma determinista y ACOTADA: solo mientras la misión "Acabar con el Orco Enfurecido" sigue
  // ACTIVA (nunca antes de aceptarla, nunca tras completarla/fallarla) y el jugador combina
  // vocabulario real de "perseguidor" con una intención real de buscar/atacar — nunca con una
  // mención de pasada sin verbo activo ("Gistera me contó que fue perseguida" no dispara), porque
  // su temperamento es AGRESIVO y `shouldForceCombat` abre combate contra cualquier AGRESIVO en
  // escena: una inyección demasiado floja abriría combate por error, un problema peor que el
  // original (turno silencioso que no lo encuentra).
  // `pers[ei]g\w*`, no `persegu\w*` (bug propio encontrado minutos después de este mismo fix,
  // 2026-08-20): "perseguir" cambia de raíz en presente (persigo/persigues/persigue/persiguen/
  // persiguiendo/persiguió usan "persig-", no "persegu-") — justo las formas que MÁS se usan en
  // esta escena real ("el que la persigue", "quien me persigue"). `persegu\w*` a secas solo cazaba
  // el sustantivo "perseguidor" y las formas de infinitivo/imperfecto, dejando fuera el verbo en
  // presente casi siempre.
  const PURSUER_REFERENCE_REGEX = /pers[ei]g\w*|pisa(?:n)? los talones/i;
  // Bandera para el añadido determinista de más abajo (junto a las fases de Gistera Koh) — SIN
  // ella, el modelo recibe a este NPC como "PERSONAJE EN ESCENA" en el contexto (mismo bloque
  // informativo que cualquier otro NPC, `npcSceneBlockFor`) pero nada le dice que ESTE es el turno
  // exacto en que se le descubre — bug real jugando en vivo (2026-08-20, confirmado justo después
  // de arreglar la detección): `shouldForceCombat` abrió el combate de verdad (COMBATIR/HUIR en
  // pantalla), pero la narración seguía describiendo solo la búsqueda ("un rastro de sudor y
  // miedo... desviándose hacia una boca de cueva"), sin explicar contra quién se abría el combate.
  // Mismo principio ya aplicado en el resto de esta escena (fases de Gistera Koh, más abajo): un
  // reveal narrativo crítico nunca se deja a que el modelo lo infiera solo del contexto, se
  // garantiza con una frase añadida después de la llamada.
  let pursuerRevealedThisTurn = false;
  if (
    gisteraQuestYaExiste?.status === 'ACTIVA' &&
    PURSUER_REFERENCE_REGEX.test(action) &&
    (detectsSearchIntent(action) || detectsAttackIntent(action) || detectsHostileSearchIntent(action)) &&
    !npcsInSceneWithInterruption.some((n) => n.slug === 'orco-enfurecido-hondonada')
  ) {
    const pursuerNpc: NpcWithItems | null = await prisma.npc.findUnique({
      where: { worldId_slug: { worldId, slug: 'orco-enfurecido-hondonada' } },
      include: { items: { include: { item: true } } },
    });
    if (pursuerNpc) {
      const pursuerState = await prisma.npcState.findUnique({
        where: { saveId_npcId_scope: { saveId, npcId: pursuerNpc.id, scope: scopeFor(pursuerNpc.kind, currentLocationId) } },
      });
      npcsInSceneWithInterruption = [...npcsInSceneWithInterruption, buildNpcInScene(pursuerNpc, pursuerState ?? undefined)];
      pursuerRevealedThisTurn = true;
    }
  }

  // Ver comentario de arriba — `gisteraYaPresentada` también la necesita el bloque Gistera Koh
  // más abajo (se reutiliza tal cual, sin volver a consultar). `gisteraSeHaMarchado` cubre tanto
  // los turnos DESPUÉS de aceptar (el Quest ya existe) como el propio turno en el que se acepta
  // (el Quest todavía no se ha creado en esta misma petición, pero la aceptación ya se detecta).
  const gisteraYaPresentada = sessionFacts.some((f) => f.includes('Gistera Koh')) || !!gisteraQuestYaExiste;
  const gisteraSeHaMarchado = !!gisteraQuestYaExiste || (gisteraYaPresentada && detectsVerbalAcceptanceIntent(action));
  const npcsInScene = gisteraSeHaMarchado ? npcsInSceneWithInterruption.filter((n) => n.slug !== 'gistera-koh') : npcsInSceneWithInterruption;
  const abilityEffects = selectedAbilityData?.effects ?? [];
  // Rediseño de combate (2026-08-09) — rol de la habilidad pulsada, paralelo a `abilityEffects`.
  // null en texto libre sin botón (mismo criterio de siempre). Normalizado (2026-08-15): el motor
  // de intercambio solo sabe resolver ataque/defensa/utilidad — 'pasiva' (y cualquier rol futuro
  // sin comportamiento de turno definido) se trata igual que si no se hubiera pulsado ningún botón,
  // nunca revienta el tipo aguas abajo. En la práctica no debería llegar aquí nunca (las pasivas no
  // se ofrecen como botón de combate), pero falla cerrado si algún día se cuela una.
  const rawAbilityRol = selectedAbilityData?.rol ?? null;
  const abilityRol = rawAbilityRol === 'ataque' || rawAbilityRol === 'defensa' || rawAbilityRol === 'utilidad' ? rawAbilityRol : null;
  // Coste de energía de la habilidad pulsada (2026-07-29, sistema de fatiga) — 0 si la acción no
  // usa ninguna SavedAction con coste (ataque a mano, Defenderse/Esquivar genéricas, habilidades
  // 'general', o partidas anteriores a este campo).
  const abilityEnergyCost = selectedAbilityData?.energyCost ?? 0;
  // Rediseño 2026-07-31 — energía que recupera la habilidad pulsada (Defenderse/Esquivar; 0 en el
  // resto, incluido Ataque Básico). Reemplaza al viejo regen por ROL (¿el jugador atacó o se
  // defendió este turno?), ver energy.ts § nextEnergia.
  const abilityEnergyRegen = selectedAbilityData?.energyRegen ?? 0;
  // Doble arma (2026-07-31) — la habilidad pulsada colapsó por llevar la misma categoría de arma
  // en las dos manos, ver DUAL_WIELD_DIFFICULTY_BONUS/resolveCombatExchangePhase.
  const dualWieldBonus = selectedAbilityData?.dualWield ?? false;
  const faunaSlugs = new Set(faunaSources.map((y) => y.sourceSlug));

  // Excluye lore del continente contrario al de la ubicación actual — mismo bug de contaminación
  // ya corregido en el panel "El mundo" (entorno.ts), pero éste es el camino de narración
  // principal (cada turno jugado), así que importa más aquí que allí. Depende de `regionLocation`
  // (arriba), así que retrieveLore no puede entrar en el mismo Promise.all.
  const continent = regionLocation ? continentForRegion(regionLocation.region) : null;
  const excludeTags: string[] = continent ? [oppositeContinent(continent)] : [];
  // Bug real (auditoría 2026-07-22): el segundo arreglo de entorno.ts para este mismo bug —
  // anclar la propia consulta con el nombre de la región real, porque el embedding premia mucho
  // el solape léxico literal — nunca se aplicó aquí, solo el excludeTags. Este es el camino que
  // más importa (el comentario de arriba ya lo decía), así que se queda anclado igual que
  // entorno.ts, sin perder la acción real del jugador como señal de búsqueda.
  const regionLabel = regionLocation ? `${regionLocation.name}, ${regionLocation.region}` : null;
  // Auditoría de rendimiento 2026-07-28 ("rascar segundos"): en combate, narrador.ts pide
  // explícitamente "1-2 frases, corto y directo... nada de ambientación de relleno" y el
  // CONOCIMIENTO DE FONDO (lore RAG) se ignora en la práctica — pero `retrieveLore` corría igual
  // TODOS los turnos, pagando un embedding (Ollama) + una consulta pgvector contra Supabase remoto
  // (la misma latencia de red ya identificada como cuello de botella real en este hardware) para
  // un bloque que ni el prompt necesita en combate. `[]` se salta la llamada entera; `isWeaklyGrounded([])`
  // ya cae sola al texto genérico correcto ("describe de forma genérica y creíble").
  const retrieved = enCombate ? [] : await retrieveLore(regionLabel ? `${action} — ${regionLabel}` : action, worldId, 4, excludeTags);
  // Bug real del roadmap 2026-07-19: sin exigir `enCombate`, "le compro una ración a Torgash"
  // fuera de combate copiaba TODO su loadout gratis, sin tirada y con el NPC vivo — el regex solo
  // miraba el verbo. No hay estado persistido de "NPC derrotado" (la condición de los NPCs en
  // combate vive solo en memoria del popup, CombatModal.tsx), así que la señal fiable disponible
  // es que la acción venga del propio popup de combate (única vía real con el botón "Registrar",
  // que siempre manda `enCombate:true`) — fuera de combate, como mucho el modelo puede proponer
  // un `newItem` suelto en la narración normal, nunca el inventario completo de un NPC vivo.
  const lootMode = !!enCombate && npcsInScene.length > 0 && detectsLootIntent(action);

  // Ataque del jugador contra el NPC (NpcState, roadmap 2026-07-19): hasta ahora la condición
  // física del NPC nunca se persistía por partida, así que "Torgash resucita" cada vez que
  // vuelve a aparecer en escena. Mismo patrón que el contraataque: la tirada ya la resolvió el
  // backend en /turn/classify (nunca el modelo) — si acierta, el primer NPC en escena empeora
  // un escalón, igual que le pasa al jugador cuando falla su propia tirada de esquiva.
  //
  // Rediseño de combate (2026-08-09, "una habilidad defensiva o de utilidad nunca hará daño
  // directo... las de ataque sí"): el gate de daño incondicional pasa a mirar `abilityRol` en vez
  // de `effect==='AGUANTE'` — cierra el hueco de antes, donde seleccionar CUALQUIER habilidad de
  // efecto no-AGUANTE (incluidas las 4 de clase, hoy 'utilidad') contaba como golpe válido sin más.
  // Con botón pulsado, `abilityRol` manda del todo (ni siquiera hace falta que detectsAttackIntent
  // reconozca el verbo — mismo criterio de siempre para las reales de ataque); sin botón (texto
  // libre, `abilityRol === null`), sigue cayendo en el regex de siempre.
  const countsAsAttack = abilityRol === 'ataque' ? true : abilityRol === null ? detectsAttackIntent(action) : false;
  // Bug real (auditoría 2026-07-23): con varios NPCs en escena (aliado + fauna + enemigo real),
  // esto siempre pegaba al primero de `npcsInScene` sin mirar a quién señalaba de verdad la
  // acción — Gorhorn atacó al Orco Enfurecido pero quien recibía el HERIDO era el Múrgol que
  // pastaba al lado. CombatModal.tsx SIEMPRE manda el nombre real del NPC objetivo entre comillas
  // simples (`handleAttack`), y los enlaces de "Quiero pelear con 'X'" del resto de la app hacen
  // lo mismo — si el nombre citado matchea a alguien real en escena, manda sobre el orden de
  // detección (que no tiene ninguna relación con quién es hostil).
  const quotedNameMatch = action.match(/'([^']+)'/);
  const explicitTarget = quotedNameMatch
    ? (npcsInScene.find((n) => normalizeText(n.name) === normalizeText(quotedNameMatch[1])) ?? null)
    : null;

  // Bug real (auditoría 2026-07-28, "revisar partida"): el saqueo no comprobaba condicionFisica en
  // absoluto (se podía "registrar" a un NPC en ILESO/HERIDO/GRAVE, cuando la progresión de combate
  // ya establecida dice que solo CONVALECIENTE/MUERTO son saqueables) y además saqueaba TODOS los
  // npcsInScene a la vez, no solo al objetivo — un aliado ileso de pie al lado del enemigo derrotado
  // (p. ej. Gistera Koh junto al Orco Enfurecido) se saqueaba igual sin que el jugador lo pidiera.
  // Mismo patrón que `explicitTarget` para el ataque: si la acción cita un nombre entre comillas, el
  // saqueo se limita a ese NPC; si no, se limita a los NPCs realmente derrotados en escena.
  const lootTargets = (explicitTarget ? [explicitTarget] : npcsInScene).filter(
    (n) => n.condicionFisica === 'CONVALECIENTE' || n.condicionFisica === 'MUERTO',
  );
  // "Decapitar" (petición explícita, 2026-07-30, modal con checkbox: "marcar todos aquellos que
  // quieras decapitar") — golpe de gracia determinista contra CADA enemigo YA convaleciente que
  // el modal marcó, sin tirada (no puede resistir). Igual que `lootTargets` "sin objetivo
  // explícito": el modal manda un único prompt mencionando los nombres elegidos (sin comillas),
  // y `npcsInScene` (detectado por alias más arriba) ya queda acotado a justo esos — aquí solo
  // hace falta filtrar por quién de ellos sigue CONVALECIENTE (nunca ya MUERTO, no hay nada que
  // rematar dos veces).
  const executeTargets = !!enCombate && detectsExecuteIntent(action) ? npcsInScene.filter((n) => n.condicionFisica === 'CONVALECIENTE') : [];
  // Bug real (auditoría 2026-07-28): sin comprobar condicionFisica, "atacar" a un NPC ya
  // CONVALECIENTE/MUERTO seguía contando como golpe válido cada turno — oneStepWorseThan() se topa
  // en MUERTO (se queda igual), pero el bloque de cierre de misión/reputación de más abajo solo
  // mira si la condición NUEVA es terminal, no si YA lo era antes de este turno, así que repetía
  // el descuento de reputación de facción sin límite contra un enemigo ya derrotado. Mismo criterio
  // que `lootTargets`: un NPC ya derrotado no es un objetivo de ataque válido.
  // Bug real jugando en vivo (2026-08-04): sin nombre citado, un ataque de seguimiento caía
  // directo a `npcsInScene[0]` sin mirar contra quién ya estaba enfrentado el jugador — un NPC
  // solo mencionado de pasada en un hecho de trasfondo (p.ej. "el Orco persigue a Gistera Koh")
  // podía colarse en escena y robarle el combate entero al enemigo real. Si ya había pelea en
  // marcha (`pendingCombatNpcSlugs`), ese NPC manda sobre el orden de detección, igual que ya
  // hace `explicitTarget` — solo cae a `npcsInScene[0]` cuando no hay ni nombre citado ni combate
  // previo (p.ej. el primer golpe de un encuentro nuevo).
  const ongoingCombatTarget = pendingCombatNpcSlugs?.length
    ? (npcsInScene.find((n) => pendingCombatNpcSlugs.includes(n.slug)) ?? null)
    : null;
  // `npcsInScene` (detectado por alias, sin filtrar) sigue conteniendo a cualquier NPC ya
  // MUERTO/CONVALECIENTE que el alias siga matcheando en hechos de sesión antiguos (un cadáver no
  // deja de "estar en escena" nunca, ver comentario completo de `npcsInSceneVivos` más abajo,
  // donde se define esta misma lista para las decisiones de forzar combate). Adelantada aquí
  // (bug real jugando en vivo, 2026-08-07, auditoría "revisa la partida" en directo): un
  // "Ataco a la corretolva" sin comillas, con el Orco Enfurecido (MUERTO/saqueado hace turnos)
  // todavía en cabeza de `npcsInScene`, resolvía `candidateAttackTarget` al cadáver — `combateActivo`
  // ya bloquea correctamente pelear contra un MUERTO, pero el resultado neto era que NINGÚN
  // intercambio mecánico ocurría contra NADIE, mientras el Narrador seguía narrando un golpe
  // real contra la corretolva (sin NpcState creado, sin XP de combate real, sin nada saqueable
  // después) — "el primer golpe de un encuentro nuevo" (comentario original de este fallback) casi
  // nunca es, de hecho, un cadáver ya resuelto.
  const npcsInSceneVivos = npcsInScene.filter((n) => n.condicionFisica !== 'CONVALECIENTE' && n.condicionFisica !== 'MUERTO');
  const candidateAttackTarget = explicitTarget ?? ongoingCombatTarget ?? npcsInSceneVivos[0] ?? npcsInScene[0] ?? null;
  // Rediseño del turno de combate (2026-07-28, petición explícita: "primero se tiran dados y se
  // ve quien ataca primero... el otro entra en un turno de defensa... con su propia tirada de
  // dados independiente de la de ataque") — sustituye el viejo "el jugador siempre ataca
  // primero, el NPC contraataca con una tirada abstracta" por dos casos posibles, nunca los dos
  // a la vez: `pendingNpcAttack` (Save.pendingNpcAttack, decidido el intercambio anterior) dice
  // si ESTE turno es la defensa a ciegas del jugador contra un ataque de NPC ya resuelto en
  // secreto, o si el jugador tiene la iniciativa y este es su propio ataque de siempre.
  // Auditoría 2026-07-28 ("arregla todo lo que detectaste"): sustituir el atacante pendiente
  // por `npcsInScene[0]` cuando ya no está en escena resolvía la defensa a ciegas contra un NPC
  // sin ninguna relación con el `attribute`/`effect` ya decididos y ocultos en
  // `pendingNpcAttack` — se descarta el ataque pendiente en vez de inventar un enfrentamiento
  // incoherente; este turno se trata como un ataque normal del jugador, si lo hay.
  const pendingNpcStillHere = pendingNpcAttack ? (npcsInScene.find((n) => n.id === pendingNpcAttack.npcId) ?? null) : null;
  const npcParaIntercambio = pendingNpcStillHere ?? candidateAttackTarget;
  // Rediseño de combate (2026-08-09, "si uso un consumible el rival también puede actuar" +
  // habilidades de utilidad reactivas): antes solo un ataque real (`countsAsAttack`) daba pie a
  // que el NPC actuara en tu propio turno de iniciativa — usar un objeto o una habilidad de
  // defensa/utilidad (Analizar rival, Contraataque...) no arriesgaba nada, el NPC nunca llegaba a
  // responder. `tomaAccionDeCombate` amplía el gate a CUALQUIER acción de combate deliberada
  // (atacar, defenderse con una habilidad real, usar una de utilidad, o consumir un objeto) —
  // `countsAsAttack` sigue siendo el ÚNICO que decide si el jugador puede hacer daño, esto solo
  // decide si el turno "cuenta" para que el NPC responda.
  const tomaAccionDeCombate = countsAsAttack || abilityRol === 'defensa' || abilityRol === 'utilidad' || !!isItemUse;
  const combateActivo =
    enCombate &&
    !lootMode &&
    npcsInScene.length > 0 &&
    npcParaIntercambio &&
    npcParaIntercambio.condicionFisica !== 'CONVALECIENTE' &&
    npcParaIntercambio.condicionFisica !== 'MUERTO' &&
    (!!pendingNpcStillHere || tomaAccionDeCombate);

  // Emboscada real del turno de apertura (2026-08-22) — mismo criterio EXACTO que
  // `hostileEngagement` de narrador.ts (`ambushHint`): sin esto, la narración podía decir "el NPC
  // te sorprende a ti" sin que tuviera ningún efecto mecánico real en el primer intercambio.
  const openingAmbush = !enCombate && npcsInScene.length > 0 && (detectsAttackIntent(action) || detectsHostileSearchIntent(action));

  // `playerAbilityUsageGate` (auditoría de deuda técnica 2026-08-18) — ver su doc comment arriba.
  const { blocked: playerAbilityUsageBlocked, hint: playerAbilityUsageBlockedHint } = playerAbilityUsageGate(
    selectedAbilityData,
    npcParaIntercambio?.abilityUsesThisEncounter,
  );
  const abilityEffectsForExchange = playerAbilityUsageBlocked ? [] : abilityEffects;
  const abilityRolForExchange = playerAbilityUsageBlocked ? null : abilityRol;

  const {
    npcAttackTarget,
    npcAttackHits,
    npcTargetNewCondicion,
    jugadorRecibeGolpe,
    jugadorGolpeEfectos,
    nuevoPendingNpcAttack,
    exchangeNarrationBlock,
    combatExchangeRoll,
    npcAbilityUsed,
    nextInitiativeRoll,
    exchangeHappened,
    npcNuevaEnergia,
    abilityEffectHint,
    combatExchangeDisplay,
    playerAbilityUsed,
    analizarRivalExito,
    jugadorRecuperacionExtra,
  } = resolveCombatExchangePhase({
    combateActivo,
    npcParaIntercambio,
    pendingNpcAttack,
    pendingNpcStillHere,
    requiereTirada: classification.requiereTirada,
    classificationAtributo: classification.atributo,
    currentLevel: params.currentLevel,
    condicionFisicaJugador: params.condicionFisica,
    attributes,
    defensa,
    characterName,
    abilityEffects: abilityEffectsForExchange,
    abilityRol: abilityRolForExchange,
    countsAsAttack,
    dualWieldBonus,
    selectedAbility: selectedAbilityData ? { name: selectedAbilityData.name, icon: selectedAbilityData.icon, description: selectedAbilityData.description } : null,
    openingAmbush,
    rollGradoExito: roll?.gradoExito ?? null,
  });

  // Bloque de posición (docs/12 § 1.5): en un turno de viaje, la narración recibe la llegada al
  // destino + la ruta recorrida; en cualquier otro turno, recibe siempre dónde está y hacia
  // dónde puede ir — reduce los casos "weaklyGrounded" al dar siempre algo concreto que describir.
  const contextBlocks: string[] = [];
  if (exchangeNarrationBlock) contextBlocks.push(exchangeNarrationBlock);
  if (abilityEffectHint) contextBlocks.push(abilityEffectHint);
  if (playerAbilityUsageBlockedHint) contextBlocks.push(playerAbilityUsageBlockedHint);
  // Ver `hasFalseTravelClaim` (narrador.ts) — nombres reales de los destinos ambiguos, rellenado
  // solo en el mismo `if` de más abajo que ya decide forzar la pregunta ("EL PERSONAJE QUIERE
  // SEGUIR ADELANTE PERO HAY MÁS DE UN CAMINO POSIBLE").
  let possiblyFalseTravelDestinationNames: string[] = [];
  // Ver `hasFalsePhantomTravel` (narrador.ts) — auditoría 2026-08-11, "pruebas por API": a
  // diferencia del caso de arriba (2+ destinos reales ambiguos), esto cubre cuando el jugador
  // nombra una dirección/destino que NO matchea ningún alias real (p. ej. "hacia el norte") — aquí
  // `travel` sale null sin que haya nada ambiguo que preguntar, pero la narración puede describir
  // de todos modos que el personaje "sale de"/"abandona" la ubicación actual, aunque
  // `currentLocationId` nunca cambia. Nombre real de la ubicación ACTUAL (no de un destino), solo
  // cuando hubo intención de viaje real pero `travel` no se resolvió.
  let phantomTravelLocationNames: string[] = [];

  // Texto determinista de "usar la Aguja de Cardo Brújula" (2026-08-15) — calculado más abajo, en
  // cuanto se sabe `compassMatch`/`inventoryRows`, y se inserta como LogEntry aparte dentro de la
  // transacción (mismo patrón que `questRewardNarrationFor`), nunca a través del Narrador.
  let compassNarrationLine: string | null = null;

  // Ver `hasFalseCombatHit` (narrador.ts) — bug real jugando en vivo (2026-07-31, "sigo sin
  // hacerle daño al enemigo"): el intercambio resolvió 'ataque_falla' (ningún lado conecta) pero
  // la narración describió un golpe limpio de todos modos. Solo este resultado (o `defensor_contragolpea`
  // sin capacidad real de contragolpear, ver `effectiveExchangeOutcome`) deja a AMBOS lados sin
  // golpe — cualquier otro (`golpe_normal`/`golpe_pleno`/`defensor_contragolpea` con contragolpe
  // real) sí tiene un golpe real en algún lado, así que no aplica la red.
  const combatBothMissed = exchangeHappened && !npcAttackHits && !jugadorRecibeGolpe;
  // Ver `hasFalseCombatMiss` (narrador.ts) — inverso del bug de arriba, bug real jugando en vivo
  // (2026-08-15, captura: tirada 30 (Éxito) vs 11 (Fallo), 'golpe_pleno', pero la narración
  // describió al NPC "esquivándola por un pelo"). `npcAttackHits`/`jugadorRecibeGolpe` ya cubren
  // entre los dos CUALQUIER golpe real que haya conectado en este intercambio, en cualquiera de las
  // ramas de arriba (jugador ataca, NPC ataca, o contragolpe) — no hace falta recalcular nada
  // nuevo, solo leer la misma señal desde el otro lado.
  const combatRealHitLanded = exchangeHappened && (npcAttackHits || jugadorRecibeGolpe);

  // Narrar inconsciencia (docs/19-post-combate-y-recompensas-mision.md, pieza 1) — true SOLO en
  // el turno exacto en que el NPC pasa a CONVALECIENTE/MUERTO (no si ya estaba así de antes), para
  // pedirle al Narrador que describa ese momento concreto en vez de dejarlo implícito — hoy el
  // panel de victoria puede aparecer sin que la propia narración del golpe final lo haya narrado.
  const npcFallsUnconsciousThisTurn =
    (npcTargetNewCondicion === 'CONVALECIENTE' || npcTargetNewCondicion === 'MUERTO') &&
    npcParaIntercambio?.condicionFisica !== 'CONVALECIENTE' &&
    npcParaIntercambio?.condicionFisica !== 'MUERTO';
  // Igual que arriba, pero acotado a CONVALECIENTE (nunca MUERTO) — bug real jugando en vivo,
  // 2026-08-22, ver `hasFalseUnconsciousNarration` (narrador.ts): "inerte"/"sin vida" sí es
  // correcto para MUERTO, nunca para CONVALECIENTE (sigue consciente, solo sin fuerzas).
  //
  // Excepción de grupo (mismo bug, segunda vuelta — auditoría "revisa la partida otra vez",
  // 2026-08-22): en caza en grupo, si quedan más miembros (`grupoContinua`, ver el gemelo exacto
  // en `resolveCombatExchangePhase` línea ~1152 y en `applyNpcConditionUpdate` línea ~1568), este
  // individuo concreto NO se queda "convaleciente y rematable" — la fila vuelve a ILESO para el
  // siguiente miembro EN ESTE MISMO TURNO, así que nunca hay ocasión real de rematarlo después.
  // Forzar aquí el "sigue vivo, no lo narres muerto" es la instrucción equivocada: el jugador que
  // le crea y pide "Remato a X" un turno más tarde no encuentra a nadie que rematar (ya es el
  // individuo siguiente, ILESO) y el intercambio normal que se resuelve en su lugar puede acabar
  // narrado como si sí hubiera rematado — ver `hasFalseCombatHit` (narrador.ts), mismo bug real
  // ("corta la garganta... muerte instantánea" sobre un 'parada_en_seco'). Para un grupo que
  // continúa, este individuo cae para siempre — se narra igual que MUERTO, no CONVALECIENTE.
  const grupoContinuaEsteTurno =
    !!npcParaIntercambio?.groupSize && npcParaIntercambio.groupDefeated + 1 < npcParaIntercambio.groupSize;
  const npcFallsConvalecienteThisTurn =
    npcTargetNewCondicion === 'CONVALECIENTE' &&
    !grupoContinuaEsteTurno &&
    npcParaIntercambio?.condicionFisica !== 'CONVALECIENTE' &&
    npcParaIntercambio?.condicionFisica !== 'MUERTO';

  // Ver `jugadorRecibeGolpeEsteTurno` (narrador.ts) — bug real jugando en vivo, 2026-08-15: "acabé
  // con el buitre pero se resistió al final dándome un golpe... la narración no lo ha explicado".
  // Sin esto, un contragolpe/golpes_mutuos en el MISMO turno que remata al rival se pierde porque
  // toda la atención del prompt ya se dirige a narrar la caída del rival (ver el bloque de arriba).
  const jugadorRecibeGolpeEsteTurno = exchangeHappened && jugadorRecibeGolpe;

  // Ver `hasFalseDeathClaim` (narrador.ts) — bug real jugando en vivo (auditoría 2026-08-22, "¿no
  // queda nada más al revisar la partida?"): un golpe real (`npcAttackHits`) que solo dejó al
  // rival GRAVE (no CONVALECIENTE/MUERTO, así que `npcFallsUnconsciousThisTurn` sale false y no
  // protege nada aquí) se narró con prosa honesta ("se desploma hacia atrás, dejando una mancha de
  // sangre en el suelo") pero escribió en `newFacts` "Buitre Cenizo ha sido derrotado y muerto." —
  // un hecho de sesión falso que queda persistido para siempre (`appendSessionFacts`) sin que
  // ningún guard existente lo comprobara (todos estaban gateados por `npcFallsUnconsciousThisTurn`/
  // `npcFallsConvalecienteThisTurn`, que exigen que la muerte SÍ haya pasado este turno — el hueco
  // real es el caso contrario, cuando NO ha pasado y el modelo la reclama de todos modos). True en
  // cualquier turno con un golpe real contra el NPC que NO lo deja MUERTO de verdad.
  const combatNoRealDeathThisTurn = exchangeHappened && !!npcAttackHits && npcTargetNewCondicion !== 'MUERTO';

  // Anti-repetición de vocabulario/imágenes (ver comentario de `lastNarration` más arriba).
  if (lastNarration) {
    contextBlocks.push(
      `TU PROPIA NARRACIÓN DEL TURNO ANTERIOR (no la repitas): "${lastNarration.text}". Varía el vocabulario y las imágenes en este turno — evita reutilizar las mismas palabras o metáforas que acabas de usar ahí.`,
    );
  }

  // Hechos protegidos (roadmap 2026-07-20, mitigación de calidad narrativa): al principio del
  // todo, antes de cualquier otro contexto, para que la prohibición pese más que nada de lo que
  // venga después.
  const protectedFacts = protectedFactsFor(characterName);
  if (protectedFacts.length > 0) {
    contextBlocks.push(`HECHOS PROTEGIDOS (nunca los contradigas ni se los atribuyas a otro personaje):\n${protectedFacts.map((f) => `- ${f}`).join('\n')}`);
  }
  // Roadmap 3 (Fable): nunca se le da al modelo el número exacto de salud, solo esta banda —
  // mitiga la incoherencia "el narrador dice 'un rasguño' mientras la barra cae 25 puntos".
  if (params.condicionFisica !== 'ILESO') {
    contextBlocks.push(`ESTADO ACTUAL DEL PERSONAJE: ${saludBandFor(params.condicionFisica)}.`);
  }
  let currentLocationRecord: { id: string; kind: string; slug: string } | null = null;
  // Región activa este turno (roadmap 2026-07-20, para el lint post-narración) — la del destino
  // si es un turno de viaje, si no la de la ubicación actual.
  let activeRegion: string | null = null;
  if (travel) {
    const destination = await prisma.location.findUnique({ where: { id: travel.toLocationId } });
    activeRegion = destination?.region ?? null;
    const ruta = travel.segments
      .map((s) => `${s.fromName} → ${s.toName} (${s.terreno}${s.riesgo ? `, riesgo conocido: ${s.riesgo}` : ''})`)
      .join('; ');
    // Bug real jugando en vivo (auditoría 2026-08-22, "¿y lo de viajar al pozo pero justo después
    // de una narración de una hondonada?"): un viaje real desde La Hondonada del Eco hasta El Pozo
    // de Cauce Viejo (punto de agua, pozo del clan serhu) se narró entero como "Gorhorn se adentra
    // en la hondonada, pasando entre las rocas resquebrajadas... el eco de su respiración" — puro
    // sabor de RUTA (el origen, una hondonada) sin mencionar nunca el destino real. El bloque ya
    // pasaba ambos datos (LLEGADA A / RUTA RECORRIDA) pero sin pedir explícitamente que la escena
    // TERMINE anclada en el destino — un modelo pequeño bajo presión de longitud corta puede
    // gastar toda la frase en la imagen más vívida del camino y nunca llegar de verdad.
    contextBlocks.push(
      `LLEGADA A ${travel.toLocationName}: ${destination?.description ?? ''}\nRUTA RECORRIDA: ${ruta}\nLa narración de este turno tiene que TERMINAR con el personaje ya en ${travel.toLocationName}, mencionando algo concreto y propio de este lugar (no solo del paisaje del camino) — puedes describir brevemente el trayecto, pero nunca a costa de dejar la llegada implícita o sin situar.`,
    );
  } else if (currentLocationId) {
    const location = await prisma.location.findUnique({ where: { id: currentLocationId } });
    if (location) {
      activeRegion = location.region;
      currentLocationRecord = { id: location.id, kind: location.kind, slug: location.slug };
      const destinations = await destinationsFrom(currentLocationId, attributes);
      const destinosTxt = destinations.length
        ? destinations.map((d) => `${d.name} (${minutesLabel(d.minutos)})`).join(', ')
        : '(sin rutas conocidas desde aquí todavía)';
      contextBlocks.push(`UBICACIÓN ACTUAL: ${location.name} — ${location.description}\nDESDE AQUÍ SE PUEDE IR A: ${destinosTxt}.`);

      // Bug real jugando (docs/revisar-partida-hallazgos.md, 2026-08-01, "bucle" de ambientación
      // sin progreso): "avanzo"/"continúo por la cueva" sin nombrar destino, con 2+ salidas reales
      // desde aquí, no se puede resolver solo (`resolveTravel` ya solo auto-resuelve cuando hay
      // EXACTAMENTE una salida) — sin este aviso, el modelo solía narrar ambientación genérica
      // turno tras turno sin que la ubicación cambiara nunca. Instrucción explícita en vez de
      // dejarlo como una opción más a ignorar: forzar la pregunta rompe el bucle en el turno
      // siguiente, en cuanto el jugador nombre uno real.
      if (!travel && !enCombate && destinations.length > 1 && detectsVagueMovementIntent(action)) {
        contextBlocks.push(
          `EL PERSONAJE QUIERE SEGUIR ADELANTE PERO HAY MÁS DE UN CAMINO POSIBLE (${destinations.map((d) => d.name).join(', ')}): no narres que ha llegado a ningún sitio nuevo ni inventes una ubicación — pregúntale directamente cuál de estos caminos concretos elige.`,
        );
        possiblyFalseTravelDestinationNames = destinations.map((d) => d.name);
      }
      // Ver comentario de `phantomTravelLocationNames` arriba — cualquier intención real de viaje
      // (nombrada o vaga) que no se resolvió mecánicamente este turno es candidata: el jugador
      // sigue en `location`, así que narrar que la abandona es una alucinación.
      if (!travel && !enCombate && (detectsTravelIntent(action) || detectsVagueMovementIntent(action))) {
        // Alias reales además del nombre completo — el modelo suele referirse al sitio por su
        // forma corta ("la hondonada", no "La Hondonada del Eco"), igual que el propio jugador.
        phantomTravelLocationNames = [location.name, ...location.aliases];
      }
    }
  }

  // Sugerencia ambiental de encuentro (checklist 2026-07-21/22, punto 3 — "más NPCs/fauna
  // itinerante para encuentros casuales más frecuentes"): sin esto, el modelo nunca tenía ningún
  // empujón hacia el roster real de itinerantes del catálogo durante viaje/exploración — dependía
  // por completo de que el JUGADOR mencionara un nombre primero (detectNpcsInScene solo detecta,
  // nunca sugiere). No relaja la regla de "el combate solo se dispara contra un NPC/fauna real del
  // catálogo" (petición explícita de la usuaria): al contrario, empuja al modelo a usar un nombre
  // real y reconocible en vez de inventar una amenaza anónima. Solo cuando no hay ya nadie en
  // escena, fuera de combate/saqueo/cosecha, con contexto real de ubicación — 25% de probabilidad
  // (mismo orden que el evento de ambientación de entorno.ts) y siempre opcional para el modelo.
  //
  // Ponderado por población real + filtrado por región (docs/16-poblacion-dinamica.md,
  // 2026-08-03): antes se elegía uniforme entre TODA la fauna itinerante del mundo sin mirar
  // dónde estaba el personaje ni cuánta abundancia real tenía cada especie — cazar mucho una
  // especie en una zona ahora la hace de verdad más rara de encontrar ahí, y una especie extinta
  // (`poblacion === 0`) deja de sugerirse. Solo cuenta la fauna con fila de `WorldPopulation` real
  // y peso > 0 en la región activa — sin datos reales, no se sugiere nada (nunca se inventa).
  if (npcsInScene.length === 0 && !enCombate && !lootMode && !harvestMatch && activeRegion && Math.random() < 0.25) {
    const itinerantCandidates = await prisma.npc.findMany({
      where: { worldId, kind: 'PLANTILLA', homeLocationSlug: null },
      select: { slug: true, name: true, role: true },
    });
    if (itinerantCandidates.length > 0) {
      const populationRows = await prisma.worldPopulation.findMany({
        where: { worldId, targetType: 'FAUNA', targetSlug: { in: itinerantCandidates.map((c) => c.slug) } },
      });
      const populationBySlug = new Map(populationRows.map((row) => [row.targetSlug, row]));
      const weightedCandidates = itinerantCandidates
        .map((c) => {
          const row = populationBySlug.get(c.slug);
          if (!row || row.poblacion <= 0) return null;
          // Bug real jugando en vivo 2026-08-07 (ver stripRegionArticle, population.ts): `distribucion`
          // se siembra sin artículo, `activeRegion` (Location.region) siempre lo lleva completo —
          // esta ponderación fallaba en silencio para Llanuras/Margen/Meseta (3 de 5 regiones).
          const regionWeight = (row.distribucion as Record<string, number> | null)?.[stripRegionArticle(activeRegion!)] ?? 0;
          if (regionWeight <= 0) return null;
          return { slug: c.slug, name: c.name, role: c.role, weight: row.poblacion };
        })
        .filter((c): c is { slug: string; name: string; role: string; weight: number } => c !== null);
      const candidate = pickAmbientEncounterCandidate(weightedCandidates);
      if (candidate) {
        contextBlocks.push(
          `SUGERENCIA OPCIONAL DE ENCUENTRO (úsala solo si encaja de forma natural con la escena, ignórala si no): el personaje podría cruzarse aquí con ${candidate.name} (${candidate.role}). Si decides introducirlo, usa ese nombre exacto para que el motor lo reconozca de verdad.`,
        );
      }
    }
  }

  for (const npc of npcsInScene) {
    contextBlocks.push(npcSceneBlockFor(npc, params.currentLevel));
  }
  // Ver `hasResurrectedDeadNpc` (narrador.ts) — bug real jugando en vivo (2026-08-01, "el orco que
  // maté volvió a aparecer"): con el Orco Enfurecido MUERTO y saqueado desde hacía varios turnos,
  // "Exploro la zona" narró que Gorhorn reconocía "huellas recientes" suyas, como si siguiera vivo
  // y merodeando. `npcSceneBlockFor` (arriba) ya le da al modelo la instrucción de tratarlo solo
  // como recuerdo, pero puede ignorarla igual que el resto de instrucciones "no hagas X" de esta
  // sesión — mismo criterio: comprobar el texto ya generado, no confiar solo en la instrucción.
  const possiblyResurrectedNpcNames = npcsInScene.filter((n) => n.condicionFisica === 'CONVALECIENTE' || n.condicionFisica === 'MUERTO').map((n) => n.name);

  // Réplica de NPC en su propia llamada dedicada (sesión de diseño 2026-07-23, tercer intento —
  // ver `generateNpcReply` en narrador.ts para la explicación completa): pedirle a la MISMA
  // llamada de narración que a la vez narre la escena, decida tirada/objetos/misiones/hechos Y
  // además produzca diálogo en personaje resultó nada fiable con un modelo de 7B — cada intento
  // fallaba en un sitio distinto (lo ignoraba, respondía el NPC equivocado, hacía hablar a un
  // ave). Igual que classify/narrate ya son dos llamadas separadas, la réplica ahora es su propia
  // llamada estrecha, con un único trabajo. `dialoguePartners` excluye fauna (bug real: Cruzavientos,
  // un ave planeadora sin habla, llegó a "hablar" cuando se le pedía responder a la vez que a un
  // NPC real).
  //
  // Bug real (auditoría 2026-07-24, misma familia que npcAttackTarget más arriba): con DOS NPCs
  // reales a la vez en escena (p. ej. Gistera Koh Y el Orco Enfurecido), esto respondía siempre a
  // través del primero detectado, sin mirar a quién se dirigía de verdad el jugador — mismo
  // `explicitTarget` (nombre citado entre comillas) ya resuelto arriba manda si apunta a un NPC
  // real (no fauna); si no hay cita explícita, cae al primero real como hasta ahora.
  const dialoguePartners = npcsInScene.filter((n) => !faunaSlugs.has(n.slug));
  const explicitDialogueTarget = explicitTarget && !faunaSlugs.has(explicitTarget.slug) ? explicitTarget : null;
  const dialogueTarget = detectsDialogueIntent(action) ? (explicitDialogueTarget ?? dialoguePartners[0] ?? null) : null;

  // Atribución de armas determinista (roadmap 2026-07-20, mitigación de calidad narrativa,
  // hallazgo real jugando: el modelo puso "la maza orca" —el arma del enemigo— en manos del
  // propio Gorhorn, dos turnos distintos). Solo cuando hay alguien más en escena con quien
  // pudiera confundirse.
  if (npcsInScene.length > 0) {
    contextBlocks.push(
      equippedWeapons.length > 0
        ? `ARMA DEL PERSONAJE — ${params.characterName} empuña ahora mismo: ${equippedWeapons.join(' y ')}. Nunca le pongas en las manos el arma o el equipo de otro personaje de la escena.`
        : `${params.characterName} va desarmado ahora mismo (sin arma equipada) — no le pongas en las manos ningún arma que no haya cogido o fabricado de verdad en esta escena.`,
    );
  }

  // "Doble descripción" (auditoría 2026-07-30, "revisar partida" — "hay 2, una la que ve el
  // usuario otra la que usa el prompt... para mejorar las narraciones"): antes SOLO el nombre de
  // las armas llegaba aquí (bloque de arriba) — el resto del equipo (ropa/accesorios/abalorios) y
  // la `description` real de CUALQUIER objeto puesto (aspecto/historia concretos, ver
  // equipment.ts § equippedItemsSummary) nunca llegaban al Narrador. Sin `enCombate`/prosa de
  // relleno de por medio: siempre relevante, haya o no alguien más en escena.
  if (equippedItems.length > 0) {
    contextBlocks.push(
      `EQUIPO PUESTO AHORA MISMO (aspecto/historia reales — descríbelo así si aparece en la narración, nunca inventes otro aspecto para estos objetos):\n${equippedItems.map((i) => `- ${i.name}: ${i.description}`).join('\n')}`,
    );
  }

  // Guardia anti-combate-fantasma (roadmap 2026-07-20, hallazgo real jugando: una simple errata
  // del jugador — "orco redazagado" en vez de "rezagado" — hacía que npcsInScene quedara vacío y
  // el modelo narrara un combate entero, incluida una muerte, sin que NINGÚN sistema determinista
  // se enterara: sin NpcState, sin loot, sin reputación, sin aviso de ningún tipo. matchNpcAliases
  // ya tolera erratas ahora, pero esto cubre el resto de casos (NPC de verdad inexistente, alias no
  // registrado) con el mismo patrón que missingItemBlockFor: avisar al modelo en vez de dejarlo
  // narrar un combate "fantasma" que el backend nunca podrá rastrear.
  if (npcsInScene.length === 0 && detectsAttackIntent(action)) {
    contextBlocks.push(
      'El personaje parece atacar a alguien, pero no hay ningún NPC confirmado en esta escena ahora mismo — narra que no encuentra ningún objetivo real (el ataque cae al aire, a una sombra, a nada), nunca inventes un enemigo ni resuelvas un combate contra nadie.',
    );
  }

  // Guardia anti-combate-fantasma, variante 2 (bug real, auditoría 2026-07-30, "revisar
  // partida"): "Yo me ocupo de tu perseguidor, no te preocupes" (aceptar ayudar a Gistera Koh) se
  // clasificó como banda extendida/diferida — por decisión explícita de la usuaria (2026-07-24),
  // aceptar ayudar NUNCA fuerza combate mecánico solo (ver `shouldForceCombat`/
  // `detectsVerbalAcceptanceIntent` más abajo). Pero nada le impedía al modelo, al resolver ese
  // turno diferido con el Orco ya "en escena", narrar una pelea entera y ganada ("golpea la cabeza
  // del Orco en pleno rostro") sin que `resolveCombatExchangePhase` hubiera corrido ni una vez —
  // el NPC se quedó ILESO de verdad en la base de datos pese a la narración. Si hay un NPC real en
  // escena pero este turno no resolvió ningún intercambio mecánico (`exchangeHappened`), se avisa
  // explícitamente — salvo que sea justo un "Decapitar" (`executeTargets`, ver abajo), donde SÍ se
  // pide describir un golpe de gracia a propósito, sin tirada, porque el motor ya lo decidió así.
  const combatNotYetResolved = npcsInScene.length > 0 && !exchangeHappened && executeTargets.length === 0;
  if (combatNotYetResolved) {
    contextBlocks.push(
      'Ningún intercambio de combate mecánico se ha resuelto todavía este turno — puedes narrar tensión, acercamiento, amenaza o preparativos, pero NUNCA un golpe que conecta, una herida infligida, ni el resultado ya decidido de una pelea (ni a favor ni en contra del personaje). Esa resolución solo existe cuando el propio sistema la calcula, en un turno futuro dentro del combate real.',
    );
  }

  // "Decapitar" (2026-07-30) — los enemigos ya están convalecientes y no pueden resistir; se le
  // dice al modelo tal cual para que narre un golpe de gracia definitivo por cada uno, nunca una
  // pelea o resistencia que ya no existe mecánicamente.
  if (executeTargets.length > 0) {
    const nombres = executeTargets.map((n) => n.name).join(', ');
    contextBlocks.push(
      `${characterName} remata a ${nombres}, que yacen convalecientes en el suelo y no pueden oponer ninguna resistencia — describe un golpe de gracia definitivo para cada uno, nunca una pelea o un intento de defensa por su parte.`,
    );
    // Caza en grupo (2026-08-13) — mismo hint gemelo que combate normal, ver comentario en
    // resolveCombatExchangePhase. Aquí puede haber varios objetivos a la vez (checkbox), cada uno
    // con su propio grupo — una línea por objetivo que de verdad tenga grupo.
    for (const target of executeTargets) {
      if (!target.groupSize) continue;
      const restantes = target.groupSize - target.groupDefeated - 1;
      contextBlocks.push(
        restantes > 0
          ? `GRUPO — YA RESUELTO: rematado ${target.name}, todavía quedan ${restantes} más de su misma especie en la zona. El combate NO ha terminado — narra solo la caída de ESTE, nunca el grupo entero como derrotado.`
          : `GRUPO — YA RESUELTO: ${target.name} era el último de su especie en la zona — ahora sí puedes narrar el grupo entero como resuelto.`,
      );
    }
  }

  // Roadmap 2026-07-19: `Companion`/`Quest` se persistían pero nunca entraban en ningún prompt —
  // un compañero ganado se "olvidaría" al turno siguiente, y pedirle al modelo cerrar una misión
  // por título EXACTO (questProgress) sin decirle qué misiones activas existen era casi imposible
  // de acertar para un 7B. Mismo patrón que el resto de contextBlocks: contexto determinista, el
  // modelo solo lo usa para narrar/decidir, nunca lo inventa.
  const [activeQuests, companions, inventoryRows, professionProgressRows] = await Promise.all([
    prisma.quest.findMany({ where: { saveId, status: 'ACTIVA' } }),
    prisma.companion.findMany({ where: { saveId } }),
    prisma.inventoryItem.findMany({ where: { saveId }, select: { id: true, name: true, catalogSlug: true, slot: true } }),
    prisma.professionProgress.findMany({ where: { saveId } }),
  ]);
  const inventoryNames = inventoryRows.map((i) => i.name);
  // Refactor de ingredientes (2026-07-29) — crafting.ts/construction.ts ya no matchean por
  // prefijo de nombre, matchean por tipo/categoría real del catálogo. Se resuelve una sola vez
  // aquí (mismo patrón `catalogItemBySlug` ya usado en saves.ts) a partir de los `catalogSlug`
  // que de verdad lleva el jugador — objetos narrativos sueltos (sin catalogSlug) simplemente no
  // pueden matchear ningún ingrediente por categoría, solo por coincidencia exacta si algún día
  // la tuvieran.
  const inventoryCatalogSlugs = [...new Set(inventoryRows.map((i) => i.catalogSlug).filter((s): s is string => Boolean(s)))];
  const inventoryCatalogRows = inventoryCatalogSlugs.length
    ? await prisma.itemCatalog.findMany({
        where: { worldId, slug: { in: inventoryCatalogSlugs } },
        select: {
          slug: true,
          tipo: true,
          category: true,
          curaHasta: true,
          curaUnPaso: true,
          tipoArma: true,
          curaEnergia: true,
          equipSlot: true,
          effectKey: true,
          aliases: true,
          herramientaParaOficio: true,
        },
      })
    : [];
  const catalogBySlug = new Map(
    inventoryCatalogRows.map((c) => [
      c.slug,
      {
        tipo: c.tipo,
        category: c.category,
        curaHasta: c.curaHasta,
        curaUnPaso: c.curaUnPaso,
        tipoArma: c.tipoArma,
        curaEnergia: c.curaEnergia,
        equipSlot: c.equipSlot,
        effectKey: c.effectKey,
        aliases: c.aliases,
        herramientaParaOficio: c.herramientaParaOficio,
      },
    ]),
  );
  // Sistema de habilidades de arma (2026-07-29) — huecos ARMA_PRINCIPAL/ARMA_SECUNDARIA
  // equipados ahora mismo, con su categoría real (null = sin arma o sin categoría asignada).
  const equippedWeaponSlotsForAbilities: EquippedWeaponSlot[] = inventoryRows
    .filter((i) => i.slot === 'ARMA_PRINCIPAL' || i.slot === 'ARMA_SECUNDARIA')
    .map((i) => ({ slot: i.slot!, tipoArma: (i.catalogSlug ? catalogBySlug.get(i.catalogSlug)?.tipoArma : null) ?? null }));
  // Bug real (auditoría 2026-08-01, "revisar partida"): con las dos manos equipadas (p. ej. hacha
  // en ARMA_PRINCIPAL + cuchillo en ARMA_SECUNDARIA), un "Ataque Básico" (rediseño 2026-07-30: SOLO
  // mano principal, nunca la secundaria) narró "le clava su cuchillo de hielo sílice" — el bloque
  // "ARMA DEL PERSONAJE" de más arriba lista las dos armas juntas ("empuña... Hacha de guerra rota
  // y Cuchillo de hielo sílice") para evitar que el modelo le ponga en las manos el arma de OTRO
  // personaje, pero nunca aclara CUÁL de las dos usa en ESTE golpe concreto — con dos opciones
  // igual de válidas a la vista, el modelo elige mal.
  //
  // Reproducido también en la real por categoría (2026-08-01, misma auditoría, misma partida):
  // "Tajo Horizontal" (real de HACHA) narró "lanza su cuchillo de hielo sílice" — la secundaria,
  // no el hacha. A diferencia del primer intento de este fix (que dejó la real fuera "porque su
  // arma exacta puede vivir en la secundaria y no hay forma barata de saberlo"), sí que la hay:
  // `equippedWeaponSlotsForAbilities` (arriba) ya sabe qué categoría lleva cada mano, y
  // `weaponCategoryForRealAbilityName` (weaponAbilities.ts) hace el camino inverso desde el
  // nombre de la habilidad pulsada — si esa categoría solo vive en UNA mano (nunca en dualWield,
  // donde de verdad se usan las dos), se puede nombrar el arma exacta igual que con Ataque Básico.
  const armaPrincipal = inventoryRows.find((i) => i.slot === 'ARMA_PRINCIPAL') ?? null;
  const armaSecundaria = inventoryRows.find((i) => i.slot === 'ARMA_SECUNDARIA') ?? null;
  if (!pendingNpcStillHere && armaPrincipal && armaSecundaria) {
    if (selectedAbilityData?.name === 'Ataque Básico') {
      contextBlocks.push(
        `ESTE GOLPE EN CONCRETO es con ${armaPrincipal.name} (la que lleva en la mano PRINCIPAL) — nunca con ${armaSecundaria.name} (mano secundaria), aunque lleve las dos encima.`,
      );
    } else if (!dualWieldBonus && selectedAbilityData?.name) {
      const categoria = selectedAbilityData.name ? weaponCategoryForRealAbilityName(selectedAbilityData.name) : null;
      if (categoria) {
        const slotsConEsaCategoria = equippedWeaponSlotsForAbilities.filter((e) => e.tipoArma === categoria).map((e) => e.slot);
        const armaExacta = slotsConEsaCategoria.length === 1 ? (slotsConEsaCategoria[0] === 'ARMA_PRINCIPAL' ? armaPrincipal : armaSecundaria) : null;
        const otraArma = armaExacta === armaPrincipal ? armaSecundaria : armaPrincipal;
        if (armaExacta) {
          contextBlocks.push(`ESTE GOLPE EN CONCRETO es con ${armaExacta.name} — nunca con ${otraArma.name}, aunque lleve las dos encima.`);
        }
      }
    }
  }
  // Reglas de curación (2026-07-29, "si usas material médico sí puedes curarte a Ileso"): objetos
  // médicos QUE de verdad llevas encima ahora mismo, con su tope de curación real del catálogo —
  // detectMedicalItemUse (itemReference.ts) decide determinista si esta acción usa alguno.
  const medicalItemsInInventory = inventoryRows
    .map((i) => ({
      id: i.id,
      name: i.name,
      curaHasta: i.catalogSlug ? (catalogBySlug.get(i.catalogSlug)?.curaHasta ?? null) : null,
      curaUnPaso: i.catalogSlug ? (catalogBySlug.get(i.catalogSlug)?.curaUnPaso ?? false) : false,
    }))
    .filter((i): i is { id: string; name: string; curaHasta: CondicionFisica; curaUnPaso: boolean } => i.curaHasta !== null);
  const medicalItemMatch = detectMedicalItemUse(action, medicalItemsInInventory);
  const medicalCuraHasta = medicalItemMatch?.curaHasta ?? null;
  const medicalCuraUnPaso = medicalItemMatch?.curaUnPaso ?? false;
  // Sistema de fatiga (2026-07-29, "los consumibles se pueden usar también para recuperar... la
  // energía") — mismo patrón que medicalItemsInInventory/detectMedicalItemUse de arriba.
  const energyItemsInInventory = inventoryRows
    .map((i) => ({ id: i.id, name: i.name, curaEnergia: i.catalogSlug ? (catalogBySlug.get(i.catalogSlug)?.curaEnergia ?? null) : null }))
    .filter((i): i is { id: string; name: string; curaEnergia: number } => i.curaEnergia !== null);
  const energyItemMatch = detectEnergyItemUse(action, energyItemsInInventory);
  const energyItemRestoreAmount = energyItemMatch?.curaEnergia ?? null;
  // Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) — camino
  // EXPLÍCITO, en paralelo al de texto libre de arriba (nunca lo sustituye: sin `healItemUses`, el
  // comportamiento de siempre sigue intacto). Cada `itemId` se valida contra
  // `medicalItemsInInventory`/`energyItemsInInventory` (es de verdad un objeto curativo/de energía
  // que el jugador lleva — el modal ya ofrecía los dos tipos mezclados, "Raciones de viaje" solo
  // da energía) y `quantity` se topa a lo que realmente lleva encima (`quantityOf`) — nunca más.
  // La lista PLANA repite cada objeto `quantity` veces, EN EL ORDEN del array recibido (orden de
  // selección real) — solo importa para `curaHasta`/`curaUnPaso` (ver applySequentialHeals,
  // death.ts); la energía se suma sin más, el orden no la afecta.
  const healItemUsesValidated: { id: string; name: string; curaHasta: CondicionFisica | null; curaUnPaso: boolean; curaEnergia: number; quantity: number }[] =
    [];
  for (const use of healItemUses ?? []) {
    const medicalItem = medicalItemsInInventory.find((i) => i.id === use.itemId);
    const energyItem = energyItemsInInventory.find((i) => i.id === use.itemId);
    const row = inventoryRows.find((i) => i.id === use.itemId);
    if (!row || (!medicalItem && !energyItem)) continue;
    const quantity = Math.max(0, Math.min(use.quantity, quantityOf(row.name)));
    if (quantity > 0) {
      healItemUsesValidated.push({
        id: row.id,
        name: row.name,
        curaHasta: medicalItem?.curaHasta ?? null,
        curaUnPaso: medicalItem?.curaUnPaso ?? false,
        curaEnergia: energyItem?.curaEnergia ?? 0,
        quantity,
      });
    }
  }
  const usingExplicitHealList = healItemUsesValidated.length > 0;
  // Brújula (2026-08-15, feature de exploración): NO se consume al usarla (es una herramienta
  // equipable, no un consumible) — solo dispara la narración determinista de rumbos más abajo, ver
  // compassNarrationLine. Único objeto con este comportamiento hoy, así que se filtra por su propio
  // catalogSlug en vez de un campo nuevo en ItemCatalog para un caso de uno solo.
  const compassItemsInInventory = inventoryRows
    .filter((i) => i.catalogSlug === 'aguja-cardo-brujula')
    .map((i) => ({ id: i.id, name: i.name, aliases: catalogBySlug.get(i.catalogSlug!)?.aliases ?? [] }));
  const compassMatch = detectsCompassUse(action, compassItemsInInventory);
  if (compassMatch && !travel && currentLocationId) {
    // Coordenadas reales (docs/13-escala-del-mundo.md, ver comentario de LocationInput en
    // worldCatalog.ts) — sin ellas aquí o en el destino, ese camino simplemente no participa
    // (falla cerrado; `compassNarrationText([])` ya da la frase de reserva si no queda ninguno).
    const compassOrigin = await prisma.location.findUnique({ where: { id: currentLocationId }, select: { x: true, y: true } });
    const linkRows =
      compassOrigin?.x != null && compassOrigin?.y != null
        ? await prisma.locationLink.findMany({
            where: { OR: [{ fromId: currentLocationId }, { toId: currentLocationId }] },
            include: { from: true, to: true },
          })
        : [];
    const compassLinks: CompassLinkInfo[] = linkRows.flatMap((link) => {
      const dest = link.fromId === currentLocationId ? link.to : link.from;
      if (dest.x == null || dest.y == null || compassOrigin?.x == null || compassOrigin?.y == null) return [];
      return [
        {
          direction: cardinalDirectionBetween({ x: compassOrigin.x, y: compassOrigin.y }, { x: dest.x, y: dest.y }),
          toName: dest.name,
          terreno: link.terreno,
          minutosBase: link.minutosBase,
        },
      ];
    });
    const hasMap = inventoryRows.some((i) => i.catalogSlug === 'mapa-de-las-llanuras');
    compassNarrationLine = compassNarrationText(compassLinks, hasMap);
  }
  // Bug real jugando en vivo (2026-08-07, "he consumido una ración de comida y no ha desaparecido
  // del inventario" — también en combate): el efecto mecánico se aplicaba pero la fila de
  // InventoryItem nunca se tocaba. Consumido de verdad más abajo, DENTRO de la transacción (mismo
  // criterio anti-carrera que el resto de consumos de este archivo) — un objeto puede aparecer una
  // sola vez aquí aunque cure Y restaure energía a la vez (p. ej. una ración completa).
  // `usingExplicitHealList`: el consumo del/de los objeto(s) médico(s) lo hace un bucle aparte más
  // abajo (con la cantidad real, no solo 1) — nunca sumar también `medicalItemMatch?.id` aquí, o
  // se consumiría dos veces la misma fila si el texto de la acción también nombrara el objeto.
  const consumedItemIds = [
    ...new Set(
      [usingExplicitHealList ? undefined : medicalItemMatch?.id, usingExplicitHealList ? undefined : energyItemMatch?.id].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  // Ver `hasFalseItemUse` (narrador.ts) — bug real jugando en vivo (2026-08-01, "descansar no
  // curó, y encima consumió un objeto sin pedirlo"): descansar mientras CONVALECIENTE no basta por
  // sí solo (healCeilingFor exige un objeto médico real), pero la narración igualmente describió
  // usar la cataplasma — objeto que ni el jugador nombró en su acción ni se detectó consumido
  // aquí. Solo se manda la lista cuando NINGÚN objeto se detectó de verdad este turno: si alguno
  // sí se usó, mencionarlo (o cualquier otro) en la narración ya no es sospechoso por sí solo.
  const possiblyFalseItemUseNames =
    !usingExplicitHealList && medicalCuraHasta === null && energyItemRestoreAmount === null
      ? [...medicalItemsInInventory, ...energyItemsInInventory].map((i) => i.name)
      : [];
  // Alivio de requisitos por oficio (sesión de diseño 2026-07-23) — el nivel de UN oficio SOLO
  // relaja los requisitos de recetas de ESE oficio, nunca la tirada general (ver requisitos.ts).
  const oficioNivelById = new Map(professionProgressRows.map((p) => [p.professionId, p.nivel]));
  const alivioFor = (oficio: string | undefined) => (oficio ? alivioForLevel(oficioNivelById.get(oficio) ?? 1) : 0);
  if (activeQuests.length) {
    contextBlocks.push(
      `MISIONES ACTIVAS (usa el título EXACTO en "questProgress" si esta escena la cierra):\n${activeQuests
        .map((q) => `- ${q.title}: ${q.description}`)
        .join('\n')}`,
    );
  }
  if (companions.length) {
    contextBlocks.push(
      `COMPAÑEROS ACTUALES (van con el personaje, no los olvides ni los inventes de nuevo):\n${companions
        .map((c) => `- ${c.name} (${c.role}): ${c.notes}`)
        .join('\n')}`,
    );
  }

  // Hilo de sesión determinista (roadmap 2026-07-19, mecánicas): sin ninguna misión activa
  // todavía, el jugador puede pedir CUALQUIER COSA por prompt libre y el modelo tiene que
  // improvisar una historia entera de la nada, turno a turno — la fuente real de que "gestionar
  // la historia" sea difícil para un 7B. En vez de dejarlo a la improvisación total, se sugiere
  // (nunca se fuerza) UN gancho ya escrito y anclado en canon (LoreChunk tipo GANCHO) como columna
  // vertebral de la sesión. Determinista y estable (mismo gancho mientras no haya misión activa),
  // no aleatorio — desaparece solo en cuanto el modelo lo recoge de verdad con "newQuest".
  if (activeQuests.length === 0) {
    const [gancho] = await prisma.loreChunk.findMany({ where: { worldId, type: 'GANCHO' }, orderBy: { title: 'asc' }, take: 1 });
    if (gancho) {
      contextBlocks.push(
        `GANCHO DE SESIÓN (opcional — úsalo solo si encaja de forma natural en esta escena concreta, nunca lo fuerces ni lo menciones si no viene a cuento): ${gancho.text} Si esta escena lo introduce de verdad como un objetivo real, puedes crear la misión correspondiente con "newQuest".`,
      );
    }
  }

  // Encuentro guionizado del primer turno (segunda vuelta de diseño, 2026-07-23: "el usuario
  // lanza su primer prompt y despues de ese prompt... le aparezca un texto tipo 'Ves una sombra a
  // lo lejos...'") — determinista, NO depende de ningún LoreChunk de gancho: se dispara EXACTAMENTE
  // una vez, contando las filas isPlayerAction=true ya persistidas (routes/turn.ts crea la de
  // este turno ANTES de llamar aquí, así que la propia acción de este turno ya cuenta como 1 —
  // por eso se compara con 1, no con 0). La misión de "cazar al Orco Enfurecido" ya NO se siembra
  // al crear partida (ver startingQuests.ts) — nace de esta conversación vía "newQuest" normal,
  // en cuanto Gorhorn acepte ayudar a Gistera Koh, igual que cualquier otra misión propuesta en juego.
  const playerActionCount = await prisma.logEntry.count({ where: { saveId, channel: 'CHARACTER', isPlayerAction: true } });
  const gisteraKoh =
    playerActionCount === 1 ? await prisma.npc.findUnique({ where: { worldId_slug: { worldId, slug: 'gistera-koh' } } }) : null;
  // Determinismo total (segunda vuelta, 2026-07-23: "revisar partida" volvió a encontrar la
  // escena sin disparar en partida real, con `criticalFactsCount` ya protegiendo el bloque de
  // truncamiento) — pedírselo al modelo vía instrucción no bastaba, lo ignoraba de todos modos.
  // Mismo principio que el resto del motor (combate/discoveries/aliases nunca se dejan al
  // criterio del modelo pequeño): el texto se añade tal cual más abajo, después de narrar la
  // acción real del jugador, sin depender de que el modelo lo escriba — garantiza el 100%.
  // Presentación en dos fases (petición explícita de la usuaria, 2026-07-23: "hasta que se
  // presente yo no se su nombre ni tengo la entrada en la enciclopedia... tiene que pedirte que
  // elimines al orco enfurecido con premura"). Fase 1 (arriba, turno 1): la ve acercarse SIN
  // nombre — el hecho que se añade abajo tampoco lo menciona a propósito, para que ni
  // `detectNpcsInScene` ni `entityDiscovery.ts` la reconozcan todavía (ninguno de sus aliases
  // reales aparece en el marcador). Fase 2 (más abajo, tras la narración): en cuanto Gorhorn le
  // habla, se presenta con prisas y de inmediato pide ayuda contra el Orco Enfurecido — ahí SÍ se
  // revela su nombre real, que desbloquea tanto el resto de la conversación como la Enciclopedia.
  // Bug real (auditoría 2026-07-28): `sessionFacts` es una ventana rodante de MAX_FACTS=10
  // (worldFacts.ts) — en una sesión larga, el hecho que marca "Gistera Koh ya presentada" puede
  // ser expulsado por hechos más nuevos, y entonces `gisteraYaPresentada` volvía a leer false,
  // repitiendo el monólogo de presentación entero a mitad de partida. La existencia real de la
  // misión (creada solo tras la presentación + aceptación, nunca antes) es una señal durable que
  // sobrevive a la ventana rodante — no cierra la ventana corta entre "se presentó" y "aceptó
  // todavía no", pero sí evita que se repita indefinidamente pasada esa aceptación.
  // `gisteraQuestYaExiste`/`gisteraYaPresentada` ya se calcularon arriba, justo tras resolver
  // `npcsInScene` (hacía falta antes de tiempo para poder filtrarla de ahí — ver ese comentario).
  const gisteraSinNombreEnEscena = sessionFacts.some((f) => f.includes('sin nombre revelado todavía'));
  const gisteraEnEscena =
    gisteraKoh !== null || gisteraSinNombreEnEscena || gisteraYaPresentada || npcsInScene.some((npc) => npc.slug === 'gistera-koh');
  const gisteraSePresentaEsteTurno = gisteraEnEscena && !gisteraYaPresentada && detectsDialogueIntent(action);
  // Petición explícita de la usuaria (2026-08-01): "en cuanto acepto la misión de Gistera que
  // ella se marche dirección Ciénaga [Troncal] y que no vuelva a aparecer" — una vez se ha ido
  // (este turno de aceptación o cualquiera posterior), la instrucción deja de ser "intenta
  // convencerlo" y pasa a ser la contraria: no volver a traerla a la escena bajo ningún concepto,
  // ni aunque algún hecho de sesión la siga mencionando (son recuerdos de lo ya ocurrido, nunca
  // presencia real). Va ANTES del resto de ramas porque, con el mismo `gisteraEnEscena` a true
  // (su propio Quest cuenta como señal), la rama vieja seguiría disparando si no se excluye aquí.
  if (gisteraSeHaMarchado) {
    contextBlocks.push(
      'GISTERA KOH ya se marchó hacia la Ciénaga Troncal en cuanto Gorhorn aceptó ayudarla — NO vuelve a aparecer en la escena a partir de ahora, bajo ningún concepto: no la menciones presente, no la hagas hablar, no la traigas de vuelta ni la reintroduzcas de ninguna forma. Si algún hecho de fondo la nombra, es solo un recuerdo de lo ya ocurrido, nunca algo que esté pasando ahora.',
    );
  } else if (gisteraEnEscena && gisteraYaPresentada) {
    contextBlocks.push(
      // "no le inventes un nombre propio..." (bug real jugando en vivo, 2026-08-20): en el turno
      // exacto de aceptar ayudarla, el modelo hizo que Gistera nombrara a su perseguidor "Hefrik"
      // — un nombre inventado, sin relación con nada del mundo (no está en ningún NPC, lore ni
      // hecho de sesión), justo en el mismo turno en que "newQuest" crea la misión real con el
      // nombre canónico ("Acabar con el Orco Enfurecido") — el jugador se queda con dos nombres
      // distintos para el mismo NPC a partir de ahí, uno narrado y otro el que usan de verdad la
      // misión/Enciclopedia/combate para siempre. Aclaración de la usuaria tras el primer intento
      // de arreglo: el problema no es que "Orco Enfurecido" sea o no su "nombre real" — es que él
      // no tiene ningún nombre propio conocido para Gistera, así que el modelo nunca debe
      // inventarle uno; puede referirse a él como entidad sin nombre ("el orco que me persigue",
      // "uno de los suyos") o usar "el Orco Enfurecido" tal cual, pero jamás darle un nombre propio
      // distinto que no existe en ningún sitio.
      'GISTERA KOH busca convencer a Gorhorn de que la ayude a acabar con el Orco Enfurecido que la persigue — se ha fijado en la marca/tótem del Clan Maktor que lleva Gorhorn y lo usa a su favor (un expulsado hablando con otro sin clan). Gistera NO conoce ningún nombre propio de ese orco — si lo menciona en el diálogo, refiérete a él solo como entidad ("el orco que me persigue", "el que me sigue desde las cuevas") o como "el Orco Enfurecido" tal cual, pero NUNCA le inventes ni le pongas un nombre propio distinto que no exista en ningún sitio (nada de "Hefrik" ni ningún otro). Si en algún turno Gorhorn acepta ayudarla de verdad (no antes, y no lo fuerces si Gorhorn todavía no se ha decidido), crea la misión con "newQuest" mencionando "Orco Enfurecido" en el título o la descripción, para que derrotarlo la cierre sola.',
    );
  } else if (gisteraEnEscena && !gisteraYaPresentada) {
    // Bug real jugando en vivo (2026-07-24, "revisa la partida, hubo otro error argumental"): sin
    // esta advertencia, el modelo respondía por su cuenta a "¿quién eres?" ANTES del añadido
    // determinista de más abajo — en un caso real, inventó que la figura se llamaba "Múrgol" (el
    // ganado del clan, sin relación ninguna) y la hizo hablar en primera persona huyendo de su
    // granja, un turno entero antes de que la propia Gistera Koh se presentara de verdad justo
    // después en la misma narración — dos identidades distintas para la misma figura, en el mismo
    // turno. Nada le decía al modelo que esta figura YA tiene una revelación programada aparte;
    // sin ese hecho, "¿quién eres?" es una pregunta abierta que el modelo intenta responder como
    // sea, inventando lo que haga falta.
    // Bug real encontrado auditando la partida de Gorhorn (2026-07-24, "revisa también los textos
    // redactados... repite cosas"): la versión anterior de esta instrucción invitaba al modelo a
    // "describirla por su aspecto y comportamiento (se acerca con prisa, sin aliento, mirando
    // atrás)" — exactamente las mismas palabras que el añadido determinista de más abajo (fase 1 Y
    // fase 2) YA dice siempre que se dispara. El modelo narraba su llegada con esas señas, y acto
    // seguido el texto fijo volvía a describir "sin aliento, mirando hacia atrás" — la misma escena
    // narrada dos veces con distintas palabras, en la misma respuesta, turno tras turno mientras
    // ella siga sin nombre. Ahora se le pide lo contrario: no mencionarla en absoluto en su propia
    // narración, dejando el aspecto/comportamiento (y el nombre, y el diálogo) enteramente al
    // añadido determinista, que ya lo cubre por completo.
    contextBlocks.push(
      'Hay una figura sin nombre revelado todavía en escena — su llegada, aspecto, comportamiento y lo que dice se añaden aparte, de forma automática, más adelante en esta misma respuesta. NO la menciones tú en absoluto en tu narración: ni la nombres, ni le inventes una identidad, ni la describas, ni la hagas hablar. Narra únicamente la acción del jugador y lo que le rodea sin ella; su parte ya está resuelta por otro lado.',
    );
  }

  // Roadmap 2026-07-19: "mirar el mapa" sin tener uno se narraba de forma ambigua o directamente
  // inventando que sí lo tenía — determinista, mismo patrón que el resto de contextBlocks.
  const itemRef = detectItemReference(action, inventoryNames);
  if (itemRef && !itemRef.posee) {
    contextBlocks.push(missingItemBlockFor(itemRef));
  }

  // Crafteo v1 (roadmap 2026-07-20 en adelante): intercambio 1:1 de filas de inventario,
  // determinista, tabulado en CRAFTING_RECIPES (auditoría 2026-07-22 — antes eran 5 bloques
  // casi idénticos de detección + comprobación + narración, uno por objeto). Requisitos de
  // atributo (sesión de diseño 2026-07-23): UMBRAL puro, `canCraft` ya los comprueba — aquí solo
  // se añade un aviso dinámico cuando el motivo del bloqueo es de atributo, no de materiales (el
  // texto estático `narrationWant` de cada receta no sabe de atributos).
  const { craftPossibleByKey, blocks: craftBlocks } = resolveCraftIntentContext(
    action,
    currentLocationRecord?.slug ?? null,
    inventoryRows,
    catalogBySlug,
    attributes,
    secondaryAttributes,
    alivioFor,
    unlockedRecipeKeys,
  );
  contextBlocks.push(...craftBlocks);
  // Skip-LLM para crafteo determinista (petición explícita, 2026-08-20: "no habíamos quedado que
  // los crafteos eran deterministas?" — cierto en el RESULTADO, pero hasta ahora igual se
  // esperaba la generación completa del Narrador solo para tirarla a la basura, ver
  // `wasLlmNarrated` más abajo). Mismo criterio que `craftedResultNames` dentro de la transacción
  // (línea ~3800): misma fuente (`craftPossibleByKey`), mismo texto final — se calcula ya aquí
  // para no esperar nada, la transacción solo lo vuelve a fijar por si acaso, no porque cambie.
  const craftedRecipeResultNames = CRAFTING_RECIPES.filter((r) => craftPossibleByKey[r.key]).map((r) => r.resultName);
  const craftMode = craftedRecipeResultNames.length > 0;

  // Construcción con requisitos reales (roadmap 2026-07-20/21, petición explícita de la usuaria:
  // "para construir un campamento necesites x20 leños, 10 piedras y 5 pieles") — mismo patrón
  // narrativo que crafting.ts (avisa si falta algo, nunca lo materializa el modelo), pero con
  // cantidades reales sumadas entre filas de inventario, no solo presencia de un objeto. Ampliado
  // 2026-07-22 (checklist punto 5/6) de una receta fija (Campamento) a CONSTRUCTION_RECIPES: la
  // primera cuyo sustantivo aparece en la acción gana — los nombres no se solapan a propósito.
  // Ampliado 2026-07-23 con requisitos de atributo — `missing[]` ya mezcla materiales y atributos
  // (mismo shape `{label,tienes,necesitas}`), así que el texto vale para ambos sin distinguir.
  const {
    buildRecipe,
    buildMode,
    blocks: buildBlocks,
  } = await resolveBuildIntentContext({
    action,
    saveId,
    worldId,
    activeRegion,
    currentLocationRecord,
    inventoryRows,
    catalogBySlug,
    attributes,
    secondaryAttributes,
    alivioFor,
  });
  contextBlocks.push(...buildBlocks);

  // Slots de compañero (2026-08-04, docs/17-reglas-construcciones-reino.md): 0 de base, cada
  // construcción ACTIVA propia da los suyos (`companionSlotsForRecipeKey`). Aviso al modelo aquí
  // (best-effort, mismo criterio que el resto de contextBlocks) — el tope real y obligatorio se
  // aplica de todos modos al crear el Companion de verdad, más abajo en la transacción.
  //
  // Gate de rendimiento (auditoría de deuda técnica 2026-08-04): esto se calculaba en TODOS los
  // turnos, aunque la inmensa mayoría no tienen nada que ver con reclutar — 2 queries de solo
  // lectura desperdiciadas por turno. Ahora solo se calcula si la acción sugiere reclutar/aliarse.
  // El gate real (dentro de la transacción, solo cuando `narration.newCompanion` llega de verdad)
  // sigue siendo incondicional y no depende de esto — en el peor caso (el modelo decide narrar un
  // reclutamiento a partir de una acción que no matchea este regex) el hard gate lo bloquea igual,
  // solo se pierde el aviso previo al LLM.
  const COMPANION_INTENT_REGEX = /reclut|acompan|companer|se una|unirs|unirt|aliad/;
  if (COMPANION_INTENT_REGEX.test(normalizeText(action))) {
    const [companionCount, companionBuildings] = await Promise.all([
      prisma.companion.count({ where: { saveId } }),
      prisma.building.findMany({ where: { saveId, status: 'ACTIVO' }, select: { recipeKey: true } }),
    ]);
    const maxCompanions = companionBuildings.reduce((sum, b) => sum + companionSlotsForRecipeKey(b.recipeKey), 0);
    if (companionCount >= maxCompanions) {
      contextBlocks.push(
        `El personaje no tiene ningún slot de compañero libre (${companionCount}/${maxCompanions}, hacen falta más construcciones propias para tener sitio) — no rellenes "newCompanion" este turno, aunque la acción sugiera ganar un aliado.`,
      );
    }
  }

  // Bug real (2026-07-31→2026-08-01, "saquear no cita los objetos que has saqueado bien, y no sale
  // el link a la Enciclopedia" — y tras el primer intento de solo AVISAR al modelo del nombre
  // exacto, seguía inventando objetos que no existen, p. ej. "Tótem Maktor"): saquear es un turno
  // puramente mecánico, sin ninguna decisión narrativa real que tomar — pedirle al LLM que lo
  // narre solo añade latencia (queja explícita: "tarda demasiado en narrar") y riesgo de
  // alucinación sin ganar nada. Se calcula aquí (de solo lectura, mismo criterio que `lootTargets`
  // + `lootItemNames` + `lootedItemNames` que usará después el bloque real de la transacción) qué
  // objetos concretos se van a conceder, y se narra a mano — mismo principio que la escena de
  // Gistera Koh más abajo: se le quita al modelo la posibilidad de fallar en vez de reforzar más
  // el prompt.
  const lootPreview = lootMode
    ? lootTargets.flatMap((npc) => {
        if (npc.saqueado) return [];
        const yaTomados = npc.lootedItemNames;
        return (lootItemNames ? npc.items.filter((item) => lootItemNames.includes(item.name)) : npc.items).filter(
          (item) => !yaTomados.includes(item.name),
        );
      })
    : [];

  // Despiece/recolección determinista (ronda de pruebas 2026-08-04, hallazgos 7/7b/7c: la
  // narración libre describía éxito completo — "la carne seca y fría, las pieles finas y
  // suaves" — con tirada fallida y sin crear ningún InventoryItem, y hasta alucinó un "agarre"
  // de un orco muerto y saqueado varios turnos antes). Mismo principio que el saqueo de arriba:
  // esto es un turno puramente mecánico (la condición ya se decidió en `harvestMatch`/`roll` antes
  // de narrar), así que se le quita al modelo la posibilidad de mentir sobre el resultado en vez
  // de perseguir el bug caso a caso con más detectores.
  const harvestOutcome = harvestMatch
    ? harvestMatch.requierePresaPrevia
      ? 'sin_presa'
      : harvestMatch.yaDespiezada
        ? 'ya_despiezada'
        : roll && !roll.success
          ? 'fallo'
          : 'exito'
    : null;

  // Narración final de cada rama determinista, con su frase de color ya elegida (ver
  // `pickFlavor`/pools más arriba) — precomputadas aquí, junto a `lootPreview`/`harvestOutcome`,
  // en vez de inline dentro del switch de `narration` más abajo (que ya es un árbol de ternarios
  // profundo de sobra).
  const lootNarration = lootMode
    ? lootPreview.length > 0
      ? `${characterName} rebusca entre los restos y se hace con lo siguiente: ${lootPreview.map((item) => item.name).join(', ')}. ${pickFlavor(LOOT_FLAVOR_SUCCESS)}`
      : `${characterName} rebusca entre los restos, pero no queda nada más que llevarse. ${pickFlavor(LOOT_FLAVOR_EMPTY)}`
    : null;
  const buildNarration = buildMode ? `${characterName} termina de construir ${buildRecipe!.name}. ${buildRecipe!.description} ${pickFlavor(BUILD_FLAVOR)}` : null;
  const harvestNarration = harvestOutcome
    ? harvestOutcome === 'sin_presa'
      ? `${characterName} busca algo que aprovechar de ${harvestMatch!.sourceName}, pero no hay ningún cadáver o presa derrotada de la que sacar nada. ${pickFlavor(HARVEST_FLAVOR_SIN_PRESA)}`
      : harvestOutcome === 'ya_despiezada'
        ? `${characterName} rebusca en los restos de ${harvestMatch!.sourceName}, pero ya se llevó antes todo lo aprovechable. ${pickFlavor(HARVEST_FLAVOR_YA_DESPIEZADA)}`
        : harvestOutcome === 'fallo'
          ? `${characterName} lo intenta, pero no logra sacar nada de provecho de ${harvestMatch!.sourceName} esta vez. ${pickFlavor(HARVEST_FLAVOR_FALLO)}`
          : `${characterName} despieza/recolecta ${harvestMatch!.sourceName} y consigue: ${harvestMatch!.yields.map((y) => (y.cantidad > 1 ? `${y.itemName} (${y.cantidad})` : y.itemName)).join(', ')}. ${pickFlavor(HARVEST_FLAVOR_EXITO)}`
    : null;
  const craftNarration = craftMode ? `${characterName} craftea: ${craftedRecipeResultNames.join(', ')}. ${pickFlavor(CRAFT_FLAVOR)}` : null;

  // Curación determinista de verdad (petición explícita, 2026-08-22: "la habilidad genérica de
  // curar debería ser determinista no narrada") — el panel "Curar" ya sabía exactamente qué se usó
  // y a qué condición se llega (ver el bloque `usingExplicitHealList` más abajo, que hasta ahora
  // recalculaba esto mismo DESPUÉS de narrar solo para pisar `narration.narration`), pero
  // `wasLlmNarrated` nunca incluyó este turno en la lista de ramas deterministas — a diferencia de
  // Saquear/Construir/Cosechar/Craftear, un turno de Curar SÍ llamaba a `narrateAction` (coste y
  // latencia real de Ollama) y tiraba la respuesta a la basura. Mismo principio que `lootPreview`/
  // `harvestOutcome` de arriba: se calcula aquí, de solo lectura, ANTES de narrar, lo mismo que ya
  // calculaba el bloque de persistencia real más abajo — con `condicionPropuesta` limitado a lo que
  // ya se sabe sin narración (el intercambio de combate resuelto, si lo hay; nunca `narration.*`,
  // que en esta rama nunca se llega a generar).
  const healPreview = usingExplicitHealList
    ? (() => {
        const healCeiling = applySequentialHeals(
          params.condicionFisica,
          healItemUsesValidated
            .filter((u): u is typeof u & { curaHasta: CondicionFisica } => u.curaHasta !== null)
            .flatMap((u) => Array.from({ length: u.quantity }, () => ({ curaHasta: u.curaHasta, curaUnPaso: u.curaUnPaso }))),
        );
        const condicionPropuesta = exchangeHappened ? (jugadorRecibeGolpe ? nextCondicionForAttack(jugadorGolpeEfectos, params.condicionFisica) : null) : undefined;
        const proposedCondicion = nextCondicionFisica(params.condicionFisica, condicionPropuesta, !!enCombate, healCeiling);
        const energyRestore = healItemUsesValidated.reduce((sum, u) => sum + u.curaEnergia * u.quantity, 0);
        const itemsTexto = healItemUsesValidated.map((u) => (u.quantity > 1 ? `${baseNameOf(u.name)} ×${u.quantity}` : baseNameOf(u.name))).join(', ');
        const huboMedico = healItemUsesValidated.some((u) => u.curaHasta !== null);
        const partes: string[] = [];
        if (huboMedico) partes.push(`pasa a estar ${CONDICION_NARRATION_LABEL[proposedCondicion]}`);
        if (energyRestore > 0) partes.push('recupera energía');
        return {
          narration: `${characterName} se cura con ${itemsTexto}${partes.length > 0 ? ` — ${partes.join(' y ')}` : ''}. ${pickFlavor(HEAL_FLAVOR)}`,
        };
      })()
    : null;

  // Escena de Gistera Koh, fase 2 — solución limpia (auditoría 2026-07-30, "revisar partida",
  // tras encontrarlo fallando EN VIVO por segunda vez: la primera vez inventó "Múrgol" como
  // nombre alternativo — 2026-07-24 —, esta vez "Lyria de la Tormenta Negra", llamándola además
  // "el animal"). La instrucción negativa de más abajo ("NO la menciones tú en absoluto") ya
  // existía desde el primer incidente y es tan explícita como razonablemente se puede pedir —
  // pero un modelo pequeño, con una pregunta directa y entrecomillada del jugador delante
  // ("¿quién eres?"), sigue sintiendo la necesidad de responderla él mismo pese a la prohibición.
  // En vez de insistir con MÁS palabras a una instrucción que ya ha fallado dos veces (no hay
  // "instrucción todavía más fuerte" que sea de fiar), se le quita al modelo la posibilidad de
  // fallar: en este turno concreto (uno solo por partida, siempre el mismo patrón determinista)
  // no se le pide en absoluto que resuelva el diálogo — se narra a mano la parte de Gorhorn, y el
  // añadido determinista de siempre (más abajo) resuelve el resto. Mismo principio que la fase 1
  // (ya 100% determinista) llevado un paso más allá.
  // Nombrado aparte (2026-08-11, captura en vivo de pares DPO) — antes vivía inline dentro de la
  // llamada a narrateAction de más abajo; se necesita como variable propia para poder reutilizar
  // EXACTAMENTE el mismo contexto en la captura en segundo plano tras el commit (mismo prompt que
  // vio el modelo local, para que el profesor cloud responda a la misma pregunta).
  // Ver `hasFalseInventoryReview` (narrador.ts) — solo se manda la lista real (sin sufijo de
  // cantidad, `baseNameOf`) cuando la acción de este turno es de verdad una revisión de
  // inventario/equipo; en cualquier otro turno no hay nada que comprobar.
  const possiblyFalseInventoryReviewNames = detectsInventoryReviewIntent(action)
    ? [...new Set(inventoryRows.map((i) => baseNameOf(i.name)))]
    : [];
  // Ver `hasFalseWeaponThrowClaim` (narrador.ts) — solo en combate, este juego no tiene ninguna
  // mecánica de lanzar armas (sin habilidad que la modele, sin forma de recuperarla después).
  const equippedWeaponNamesInCombat = enCombate ? [armaPrincipal, armaSecundaria].filter((i) => i !== null).map((i) => baseNameOf(i.name)) : [];
  // Ver `hasFalseEquipmentChangeClaim` (narrador.ts) — CUALQUIER turno, nunca condicionado a
  // intención: equipar/desequipar es siempre una decisión manual fuera del turno narrado, así que
  // un cambio de equipo narrado es alucinación siempre. Solo objetos EQUIPABLES (con `equipSlot`
  // real en catálogo) — materia prima/recursos nunca se "visten", ver comentario del campo.
  const equippableItemNames = [...new Set(inventoryRows.filter((i) => i.catalogSlug && catalogBySlug.get(i.catalogSlug)?.equipSlot).map((i) => baseNameOf(i.name)))];
  const narrationCtx = {
    worldFacts: [...contextBlocks, ...(await selectRelevantFacts(action, saveId, sessionFacts))],
    // Separado de worldFacts (roadmap 2026-07-24, "revisar partida" — ver comentario en
    // TurnContext.backgroundLore, narrador.ts): el lore RAG es trasfondo del mundo, no hechos
    // de la escena actual — fusionarlos bajo el mismo "HECHOS DEL MUNDO" le daba al modelo
    // licencia para hacer aparecer en persona a cualquier NPC que el RAG trajera por
    // similitud de texto, aunque viviera en otra región o perteneciera a la trama de otro
    // personaje jugable.
    backgroundLore: formatLoreForPrompt(retrieved),
    characterSummary,
    action,
    roll,
    weaklyGrounded: isWeaklyGrounded(retrieved) && sessionFacts.length === 0 && contextBlocks.length === 0,
    enCombate,
    banda: classification.banda,
    npcSlugsInScene: npcsInScene.map((n) => n.slug),
    // `contextBlocks` va SIEMPRE primero en `worldFacts` (línea de arriba) — su longitud es
    // justo el corte que un reintento de emergencia (attempt2, ver narrador.ts) debe respetar
    // para no perder bloques deterministas/obligatorios como la escena de Gistera Koh.
    criticalFactsCount: contextBlocks.length,
    lastNarrationText: lastNarration?.text,
    combatBothMissed,
    combatRealHitLanded,
    npcFallsUnconsciousThisTurn,
    npcFallsConvalecienteThisTurn,
    combatNoRealDeathThisTurn,
    jugadorRecibeGolpeEsteTurno,
    combatNotYetResolved,
    possiblyFalseItemUseNames,
    possiblyResurrectedNpcNames,
    possiblyFalseTravelDestinationNames,
    phantomTravelLocationNames,
    possiblyFalseInventoryReviewNames,
    equippedWeaponNamesInCombat,
    equippableItemNames,
    gisteraSeHaMarchado,
    onNarrationChunk,
    onNarrationReset,
  };

  // Turno narrado de verdad por el LLM local (2026-08-11, captura en vivo de pares DPO) — las 6
  // ramas deterministas de abajo (Gistera guionizada/saqueo/construcción/cosecha/crafteo/curación
  // explícita) nunca llaman a narrateAction, así que no hay ningún prompt/respuesta real que
  // capturar para el profesor cloud.
  const wasLlmNarrated = !(gisteraSePresentaEsteTurno || lootMode || buildMode || harvestOutcome || craftMode || usingExplicitHealList);

  // Animación de dados en paralelo (ver comentario de `onExchangeResolved` en
  // NarrateAndPersistParams) — justo antes de narrar, nunca antes: `combatExchangeDisplay` ya
  // está fijado en este punto para cualquier turno con intercambio real, y esto es lo más cerca
  // posible del arranque real de `narrateAction` (la parte lenta) sin adelantarse a ningún guard
  // de arriba que todavía pudiera descartar el turno entero.
  if (combatExchangeDisplay) onExchangeResolved?.(combatExchangeDisplay, npcAbilityUsed?.npcName ?? null);

  const narration: NarrationResult = gisteraSePresentaEsteTurno
    ? {
        narration: `${characterName} se planta frente a la figura y le exige que hable, sin apartar la mirada.`,
        newFacts: [],
      }
    : lootMode
      ? { narration: lootNarration!, newFacts: [] }
      : buildMode
        ? { narration: buildNarration!, newFacts: [] }
        : harvestOutcome
          ? { narration: harvestNarration!, newFacts: [] }
          : craftMode
            ? { narration: craftNarration!, newFacts: [] }
            : usingExplicitHealList
              ? { narration: healPreview!.narration, newFacts: [] }
              : await narrateAction(narrationCtx);
  // Streaming (2026-07-30): la rama determinista de arriba nunca llama a `onNarrationChunk` (no
  // hay generación en vivo que transmitir) — se manda de una vez aquí para que el frontend siga
  // viendo el mismo patrón de un "chunk" seguido de "done", en vez de quedarse sin nada hasta el
  // final de la respuesta HTTP completa.
  if (!wasLlmNarrated) onNarrationChunk?.(narration.narration);

  // Narración mentirosa si el modelo agota los 3 reintentos (bug real jugando en vivo, 2026-08-06,
  // auditoría "revisa la partida" en directo): `hasFalseTravelClaim` (narrador.ts) ya descarta y
  // reintenta una narración que da por resuelta una llegada ambigua (2+ salidas, `resolveTravel`
  // no pudo elegir sola) — pero un modelo local pequeño puede converger en la MISMA frase las 3
  // veces (confirmado en vivo: intentos 1 y 2 descartados por esto mismo, el 3º por repetir casi
  // verbatim el turno anterior), agotando los reintentos sin corregirse solo. A diferencia del
  // resto de comprobaciones de esta lista (solo prosa de pantalla, se acepta lo que quede tras 3
  // intentos), aquí el riesgo es peor: `newFacts` persiste un hecho de sesión FALSO ("ha dejado la
  // Hondonada...") que turnos futuros recordarían como cierto para siempre, aunque
  // `Save.currentLocationId` nunca cambió. Mismo principio que el candado de `newBuilding` de
  // abajo: si la mecánica ya sabe que la narración es falsa, se corrige aquí en vez de confiar en
  // que la prosa libre no la contradiga.
  if (possiblyFalseTravelDestinationNames.length > 0 && hasFalseTravelClaim(narration, possiblyFalseTravelDestinationNames)) {
    narration.narration = `${characterName} sigue adelante, pero el camino se abre en más de un sentido: ${possiblyFalseTravelDestinationNames.join(', ')}. Antes de escoger uno, se detiene a pensar cuál de los dos tomar.`;
    narration.newFacts = [];
  }

  // Mismo principio que el bloque de arriba, para el caso complementario (auditoría 2026-08-11,
  // "pruebas por API"): un destino/dirección inventado sin alias real (p. ej. "hacia el norte")
  // deja `travel` en null sin nada ambiguo que preguntar, pero el modelo puede agotar los 3
  // reintentos de narrador.ts sin corregirse solo — igual de peligroso que el caso de arriba
  // porque `Save.currentLocationId` nunca cambia pese a que la narración/newFacts describan una
  // salida ya hecha.
  if (phantomTravelLocationNames.length > 0 && hasFalsePhantomTravel(narration, phantomTravelLocationNames)) {
    narration.narration = `${characterName} se detiene: no hay ningún camino conocido en esa dirección desde aquí, y sigue en ${phantomTravelLocationNames[0]}.`;
    narration.newFacts = [];
  }

  // Bug real (ronda de pruebas 2026-08-04, hallazgo 10): al rechazar una construcción por no
  // cumplir requisitos (materiales/atributos insuficientes o una regla de reino, `buildRecipe`
  // detectado pero `buildMode` false) el gate mecánico ya funciona bien — nada se construye,
  // materiales intactos —, pero el modelo seguía grabando en `newFacts` que la construcción SÍ
  // se estaba levantando ("Gorhorn está fundando un pequeño ayuntamiento..."), un hecho de
  // sesión PERMANENTE que turnos futuros "recordarían" como cierto pese a no haber pasado nunca.
  // La instrucción de prompt de arriba ("narra que lo intenta, pero no que lo termina de
  // verdad") ya existía y no bastó — mismo principio que el resto de esta sesión: si la mecánica
  // ya sabe que el intento fracasó, no hace falta confiar en que la prosa libre del modelo no lo
  // contradiga en un campo aparte que ni siquiera se lee al narrar.
  if (buildRecipe && !buildMode) {
    narration.newFacts = [];
    // Bug real (auditoría 2026-08-06): el fix de arriba (newFacts) no bastaba — el modelo podía
    // seguir rellenando `newBuilding` (un campo estructurado APARTE que sí se lee y se actúa, ver
    // más abajo `else if (narration.newBuilding)`) aunque se le dijera que no completara la
    // construcción. Sin este candado, un jugador podía conseguir un `Building` real —sin gastar
    // materiales ni pasar ninguna regla de reino (cupo de región, Ayuntamiento cercano...)— con
    // solo describir la construcción de forma convincente cuando de verdad le faltaban recursos.
    narration.newBuilding = null;
  }

  // "Revisar partida" 2026-07-30 (queja explícita: el jugador terminó CONVALECIENTE sin que la
  // narración reflejara ningún golpe recibido más allá del primero) — cuando el jugador ataca y
  // el intercambio resulta en `defensor_contragolpea` con contragolpe real, ya se le avisa al modelo
  // vía `abilityEffectHint`/`exchangeNarrationBlock` que narre que AMBOS acusan algo, pero un
  // modelo pequeño tiende a narrar solo la victoria limpia del jugador e ignorar el golpe propio
  // — la condición física SÍ baja igual (nextCondicionFisica, determinista), así que sin esta
  // frase el jugador ve su barra de salud caer sin ninguna explicación narrativa. Mismo patrón
  // que la escena de Gistera Koh más abajo: se garantiza con una frase añadida en vez de confiar
  // en que el modelo la recoja del context block. Nunca en la defensa a ciegas (`pendingNpcStillHere`):
  // ahí el golpe recibido YA es el protagonista del turno, el modelo no tiene motivo para omitirlo.
  if (!pendingNpcStillHere && jugadorRecibeGolpe) {
    narration.narration = `${narration.narration} En el fragor del choque, ${characterName} tampoco sale indemne — el golpe recibido se nota de verdad.`;
  }

  // Escena de Gistera Koh, fase 1 — determinista, SIN nombre a propósito (ver comentario más
  // arriba). `newFacts` usa un marcador reconocible por código ("sin nombre revelado todavía")
  // pero que no contiene ninguno de sus aliases reales, para que ni la Enciclopedia ni el resto
  // de NPCs la reconozcan como "Gistera Koh" antes de que ella misma se presente.
  if (gisteraKoh) {
    narration.narration = `${narration.narration} Una sombra se acerca a gran velocidad por la llanura. En cuanto la tiene a la vista, distingue que es una orca con la marca del Clan Serhu — se acerca a toda prisa, sin aliento, mirando constantemente hacia atrás, como si algo la persiguiera.`;
    narration.newFacts = [
      ...narration.newFacts,
      `Una orca marcada del Clan Serhu, sin nombre revelado todavía, se acerca a ${characterName} con prisas — algo la persigue.`,
    ];
  }

  // Escena de Gistera Koh, fase 2 — determinista también (petición explícita de la usuaria,
  // 2026-07-23: se presenta con prisas Y de inmediato pide ayuda contra el Orco Enfurecido,
  // usando la marca del Clan Maktor de Gorhorn como gancho — nunca dejarlo a la improvisación del
  // modelo, visto lo poco fiable que resultó en los intentos anteriores). Se dispara la PRIMERA
  // vez que Gorhorn le dirige la palabra, esté o no ya "vista" desde un turno anterior. Aquí SÍ
  // se revela su nombre real, que a partir de ahora la hace reconocible por el resto del motor
  // (detectNpcsInScene, entityDiscovery.ts) sin necesitar más trato especial.
  if (gisteraSePresentaEsteTurno) {
    narration.narration = `${narration.narration} Con la respiración entrecortada, sin dejar de mirar hacia atrás, se presenta a toda prisa: "Soy Gistera Koh... del Clan Serhu, aunque ya no. No tengo tiempo para explicarte más — uno de los suyos me pisa los talones y quiere verme muerta. Llevas la marca de los Maktor, ¿verdad? Entonces sabes lo que es que un clan entero se vuelva contra los tuyos. ¿No quieres acabar con los Serhu? Empieza por el que me persigue — hazlo antes de que sea tarde para las dos."`;
    // Bug real jugando en vivo (2026-08-20): este hecho se guarda como SessionFact y llega tal
    // cual al bloque AMBIENTE de `generateSuggestions` (suggestions.ts, `sessionFacts.slice(-6)`)
    // — un canal que el filtro de NPCs "stale" (`dropSuggestionsNamingStaleNpc`, narrador.ts) NUNCA
    // toca, porque ese filtro solo mira el texto de las propias sugerencias contra `knownNpcs`. Si
    // aquí se nombra "Orco Enfurecido" tal cual, una sugerencia real lo repitió ("Inspecciono... el
    // Orco Enfurecido que persigue a Gistera") pese a que ni la narración ni el propio diálogo de
    // Gistera lo nombran nunca (dice "uno de los suyos"/"el que me persigue", a propósito, mismo
    // criterio que la fase 1 de arriba). El hecho debe respetar la misma disciplina de "sin nombre
    // revelado todavía" — no hace falta el nombre real para nada downstream (la misión real se crea
    // con el título fijo "Acabar con el Orco Enfurecido" en fase 3, sin leer este texto).
    narration.newFacts = [...narration.newFacts, `Gistera Koh, una orca expulsada del Clan Serhu, le ha pedido a ${characterName} que la ayude a acabar con quien la persigue.`];
  }

  // Escena de Gistera Koh, fase 3 — despedida determinista (petición explícita de la usuaria,
  // 2026-08-01: "en cuanto acepto la misión de Gistera que ella se marche dirección Ciénaga del
  // Pantano y que no vuelva a aparecer" — se usa el nombre real de esa región, Ciénaga Troncal,
  // ver KNOWN_REGIONS en narrationLint.ts, para no inventar un topónimo que no existe en el mundo).
  // `gisteraAceptaEsteTurno` solo es true el turno EXACTO de la aceptación (el Quest todavía no
  // existía al principio de esta petición) — nunca se repite en turnos futuros. A partir de aquí,
  // `npcsInScene` ya la excluye (ver `gisteraSeHaMarchado` arriba) y el contextBlock de más arriba
  // le prohíbe al modelo volver a traerla — esta frase es la única vez que se narra su marcha.
  const gisteraAceptaEsteTurno = gisteraSeHaMarchado && !gisteraQuestYaExiste;
  if (gisteraAceptaEsteTurno) {
    narration.narration = `${narration.narration} Gistera Koh asiente, aliviada, y sin perder ni un segundo más echa a andar hacia el sur, en dirección a la Ciénaga Troncal, perdiéndose pronto entre la maleza.`;
    narration.newFacts = [...narration.newFacts, `Gistera Koh se marchó hacia la Ciénaga Troncal en cuanto ${characterName} aceptó ayudarla — ya no está en escena, no volverá a aparecer.`];
  }

  // Reveal determinista del perseguidor de Gistera Koh (petición explícita, 2026-08-20 — ver
  // `pursuerRevealedThisTurn` más arriba): este es el turno EXACTO en que `shouldForceCombat` (más
  // abajo) va a abrir combate contra él, así que la narración tiene que explicar de verdad contra
  // quién, sin dejarlo a que el modelo lo intuya del contexto. Rasgos físicos tomados tal cual de
  // su bio de catálogo (nunca inventados, mismo criterio ya reforzado en el Modelfile) — aquí SÍ se
  // revela su nombre real, igual que la fase 2 de Gistera Koh revela el suyo al presentarse.
  if (pursuerRevealedThisTurn) {
    narration.narration = `${narration.narration} Entre las sombras de la cueva, una silueta se yergue por fin: un orco calvo y corpulento, la piel beige agrietada, sin pintura de clan visible — el Orco Enfurecido, el mismo que lleva persiguiendo a Gistera Koh. No dice palabra. Se lanza al ataque de inmediato.`;
    narration.newFacts = [...narration.newFacts, `${characterName} encuentra al Orco Enfurecido, el guerrero que persigue a Gistera Koh.`];
  }

  // Réplica de NPC en su propia llamada dedicada (ver comentario de `generateNpcReply` en
  // narrador.ts) — `dialogueTarget` ya viene resuelto de más arriba (detectsDialogueIntent +
  // primer NPC real, sin fauna, detectado en escena). Nunca dispara en el mismo turno que la
  // presentación de fase 2 (antes de presentarse no está en `npcsInScene` todavía, así que
  // `dialoguePartners` sale vacío) — evita una doble réplica del mismo personaje en un turno.
  // Nunca lanza si falla: perder la réplica de un turno es mucho mejor que perder el turno entero
  // por un timeout de esta llamada extra.
  if (dialogueTarget) {
    try {
      const npcReply = await generateNpcReply({
        npc: { name: dialogueTarget.name, personality: dialogueTarget.personality, bio: dialogueTarget.bio, role: dialogueTarget.role },
        characterName,
        action,
        sessionFacts,
      });
      if (npcReply) {
        narration.narration = `${narration.narration} ${npcReply}`;
      }
    } catch (err) {
      console.warn(`[turno] generateNpcReply falló, se omite la réplica de este turno (saveId=${saveId}):`, err);
    }
  }

  // Lint post-narración determinista (roadmap 2026-07-20, P1.4 de Fable) — solo detecta y
  // registra, sin reintento (gastar otra llamada a Ollama por esto no compensa en este hardware).
  // Da visibilidad inmediata en dev-server.log en vez de tener que reconstruir el bug a mano,
  // como pasó con el hallazgo real de Ciénaga Troncal narrada estando en Llanuras.
  if (activeRegion) {
    const regionMismatch = lintRegionMismatch(narration.narration, activeRegion);
    if (regionMismatch) {
      console.warn(
        `[lint] narración menciona "${regionMismatch}" con el personaje en "${activeRegion}" (saveId=${saveId})`,
      );
    }
  }

  // Memoria por capítulos (docs/10 § 3.2/§ 7) — el hito "capitulo" que dispara se añade a `hitos`
  // dentro de la transacción, igual que antes.
  //
  // Desacoplado del turno bloqueante (auditoría 2026-07-24, "revisa todo bien bien"): la versión
  // anterior hacía `await maybeCreateChapterSummary(...)` aquí mismo, añadiendo hasta 90s reales a
  // UN turno de cada 15 solo para generar un resumen que ni siquiera se le muestra al jugador en
  // ese momento (el propio comentario original ya lo situaba "fuera de la transacción porque
  // puede llamar al Cronista (lento)" — pero seguía bloqueando la respuesta HTTP igual). Ahora
  // `claimChapterIfDue` es una comprobación barata (dos consultas indexadas, nunca Ollama) que se
  // sigue esperando aquí porque decide el hito/XP de ESTE turno (usado más abajo, dentro de la
  // transacción). La generación de verdad (`scheduleChapterSummaryGeneration`, la llamada lenta)
  // ya NO se dispara aquí — bug real (auditoría 2026-07-30): disparada antes de la transacción,
  // sobrevivía intacta a un rollback de esa misma transacción (p.ej. TransitCancelledError o un
  // timeout real contra el pool remoto) y dejaba un `SessionSummary` persistido sin que el hito
  // "capitulo"/su XP hubiera llegado a concederse de verdad — se dispara más abajo, solo tras
  // confirmar que la transacción hizo commit (y se libera el reclamo si no lo hace, ver el catch).
  const chapterDue = await claimChapterIfDue(saveId);

  // Condición física (docs/14 § 1) y descanso válido (§ 4.1) — deterministas, calculados antes
  // de la transacción porque no dependen de ella (solo leen el catálogo de mundo).
  //
  // Bug real (auditoría 2026-07-30, "revisar partida" — queja explícita: "la narración dice que
  // le hago daño al orco pero he recibido daño en todos los turnos aunque la narración no lo
  // indica"): cuando SÍ hubo un intercambio de combate real este turno (`exchangeHappened`), antes
  // se combinaba con `worseCondicion` la propuesta LIBRE del modelo (`narration.condicionFisica`
  // — el prompt de combate literalmente invita a "proponer condicionFisica si el personaje sale
  // herido de este intercambio") con el resultado YA resuelto del intercambio determinista
  // (`jugadorRecibeGolpe`), y se quedaba con la PEOR de las dos. Eso dejaba que el modelo empeorara
  // la condición del jugador sin que su propia prosa mencionara ningún golpe recibido (narraba
  // solo al enemigo siendo herido) — la salud bajaba turno tras turno sin ninguna explicación
  // narrativa real. El intercambio determinista ya es la única fuente de verdad del combate
  // (resolveExchange, nunca el modelo) — con exchange real este turno, su resultado manda solo,
  // sin combinar. Sin exchange (fuera de combate, o combate sin intercambio resuelto este turno)
  // sigue confiando en la propuesta del modelo tal cual, como siempre.
  const condicionPropuestaCombinada = exchangeHappened
    ? (jugadorRecibeGolpe ? nextCondicionForAttack(jugadorGolpeEfectos, params.condicionFisica) : null)
    : narration.condicionFisica;
  // `restAttempted` (cualquier sitio) vs `restSucceeds` (además, refugio/asentamiento real) —
  // auditoría 2026-08-11, "la ficha de Descansar promete curar en cualquier sitio pero la
  // mecánica solo curaba con isValidRestLocationKind". Aclarado con la usuaria: SÍ debe curar en
  // cualquier sitio (tope GRAVE, un vivac improvisado ayuda poco), pero solo un refugio/
  // asentamiento real llega a HERIDO — ver el desglose completo en healCeilingFor (death.ts).
  // `restSucceeds` sigue gating el punto de guardado (más abajo, "Punto de guardado") sin cambios.
  // Energía (2026-08-13, mismo síntoma otra vez pero para energía: "he descansado y la energía no
  // se recuperó" en un vivac fuera de refugio/asentamiento) — ahora `restAttempted` TAMBIÉN
  // restaura energía (hasta la mitad del tope), `restSucceeds` sigue siendo el único que llega al
  // tope entero, ver energy.ts § nextEnergia.
  const restAttempted = !!(!travel && currentLocationRecord && detectsRestIntent(action) && (!roll || roll.success));
  const restSucceeds = !!(restAttempted && isValidRestLocationKind(currentLocationRecord!.kind));
  // Reglas de curación (2026-07-29): sin descanso ni objeto médico, el techo es la propia
  // condición actual — ninguna mejora "porque sí" pasa (ver healCeilingFor/death.ts).
  // Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) —
  // `applySequentialHeals` (death.ts) pliega el mismo `healCeilingFor` de siempre sobre la lista
  // ordenada de usos reales, en vez de una única llamada con un solo objeto. El resto del
  // pipeline (`nextCondicionFisica` más abajo) no cambia ni una línea.
  const healCeiling = usingExplicitHealList
    ? applySequentialHeals(
        params.condicionFisica,
        healItemUsesValidated
          .filter((u): u is typeof u & { curaHasta: CondicionFisica } => u.curaHasta !== null)
          .flatMap((u) => Array.from({ length: u.quantity }, () => ({ curaHasta: u.curaHasta, curaUnPaso: u.curaUnPaso }))),
      )
    : healCeilingFor(params.condicionFisica, restAttempted, restSucceeds, medicalCuraHasta, medicalCuraUnPaso);
  const proposedCondicion = nextCondicionFisica(params.condicionFisica, condicionPropuestaCombinada, !!enCombate, healCeiling);
  // Suma total de energía de los objetos explícitos (2026-08-18) — a diferencia de curaHasta, el
  // orden no importa: cada objeto restaura lo suyo, `nextEnergia` (energy.ts) ya topa el resultado
  // final al máximo real.
  const explicitHealEnergyRestore = usingExplicitHealList ? healItemUsesValidated.reduce((sum, u) => sum + u.curaEnergia * u.quantity, 0) : 0;
  // El texto de narración YA se fijó de forma determinista arriba, en el propio switch de
  // `narration` (`healPreview`, rediseño 2026-08-22) — antes se pisaba aquí, DESPUÉS de haber
  // llamado igualmente a `narrateAction` para nada (ver comentario de `wasLlmNarrated`). Este
  // bloque solo queda para la persistencia real (`healCeiling`/`proposedCondicion`/
  // `explicitHealEnergyRestore`, ambos arriba), coherente por construcción con `healPreview`: la
  // misma fórmula, sobre los mismos datos ya validados.

  // Sistema de fatiga (2026-07-29) — gasto/regen de energía de este turno, siempre determinista
  // (ver energy.ts § nextEnergia): coste de la habilidad pulsada, regen propio de esa misma
  // habilidad (2026-07-31, ya no por rol), descanso válido restaura al tope, objeto consumido
  // suma su restauración.
  const energiaMax = energiaMaxFor(attributes.constitucion);
  // RECUPERACION (2026-08-17) — topado al máximo real aparte, DESPUÉS de `nextEnergia` (que ya
  // topa el resto de fuentes): sumarlo dentro de `abilityEnergyRegen` habría dejado que
  // `itemRestoreAmount`/regen normal lo pisaran en algún combinación rara de `nextEnergia`.
  const nuevaEnergia = Math.min(
    energiaMax,
    nextEnergia({
      current: params.energia,
      max: energiaMax,
      abilityEnergyCost,
      abilityEnergyRegen,
      exchangeHappened,
      restSucceeds,
      restAttempted,
      itemRestoreAmount: usingExplicitHealList ? explicitHealEnergyRestore || null : energyItemRestoreAmount,
    }) + jugadorRecuperacionExtra,
  );

  // Reloj ficticio (worldClock.ts): avanza siempre, aunque este turno no traiga hechos nuevos —
  // antes "fictionalDateLabel" era un placeholder fijo que nunca se tocaba.
  const nuevoFictionalMinutes = advanceFictionalMinutes(fictionalMinutesActuales, minutosDeEsteTurno);
  const nuevaFictionalDateLabel = formatFictionalDate(nuevoFictionalMinutes);

  // Envuelto en try/catch (auditoría 2026-07-30) SOLO para poder liberar el reclamo de capítulo
  // (`releaseChapterClaim`) si la transacción no llega a comprometerse — ver el comentario de
  // `chapterDue` más arriba. El resto de callers (turn.ts/worldTick.ts) siguen viendo exactamente
  // el mismo error propagado que antes, este catch nunca lo absorbe.
  let transactionResult: {
    progression: ProgressionResult;
    condicionFisica: CondicionFisica;
    energia: number;
    energiaMax: number;
    finDePartida: boolean;
    justDied: boolean;
    newInventoryItems: NewInventoryItemInfo[];
    removedInventoryItemIds: string[];
    updatedInventoryItems: { id: string; name: string }[];
    logEntryId: string;
    newQuestObjetivos: string[];
    newQuestInfo: { title: string; objetivo: string } | null;
    questCompletedInfo: QuestCompletedInfo | null;
    newKingdomFounded: KingdomFoundedInfo | null;
    companionCreated: { id: string; name: string; role: string; notes: string } | null;
    partiallyLootedSlugs: string[];
    /// Auditoría 2026-08-06 — ver comentario de `deathCount` en NarrateAndPersistResult. Calculado
    /// DENTRO de la transacción (`finalDeathCount`), tiene que salir de aquí igual que el resto de
    /// campos de este objeto, no se puede releer después: no hay ninguna tabla que lo persista
    /// aparte de `Save.deathCount`, ya escrito por la propia transacción.
    deathCount: number;
  };
  // Espera de viaje precalculada (ver comentario de `notBefore` en NarrateAndPersistParams) — el
  // cómputo (narración incluida) ya terminó en este punto; si venía adelantado a propósito, aquí
  // es donde se retiene ANTES de comprometer nada en BD, nunca antes de narrar.
  if (notBefore) {
    const waitMs = notBefore.getTime() - Date.now();
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  try {
    transactionResult = await prisma.$transaction(async (tx) => {
    // `now()` de Postgres es fijo durante TODA la transacción (auditoría "revisar partida",
    // 2026-08-13, bug real jugando en vivo: "Misión completada" se leía ANTES que la narración
    // del propio turno que la resolvió) — sin `createdAt` explícito, dos filas creadas en
    // momentos distintos del código pueden caer con el MISMO timestamp de Postgres, y el orden de
    // lectura (`orderBy: createdAt asc`, `/saves/:id` y `/saves/:id/diario`) deja de reflejar el
    // orden narrativo real.
    //
    // Checkpoint fijo (no un contador de "reloj real + tick", que rompería el orden si dos
    // llamadas quedan separadas por trabajo real de por medio — probado y descartado: reservar el
    // primer tick de `mainLogEntry` aquí arriba con `Date.now()+0` y dejar que el aviso de "viaje
    // interrumpido" (más abajo) pidiera el suyo con `Date.now()` FRESCO en su propio punto del
    // código habría quedado por ENCIMA del de `mainLogEntry`, invirtiendo su orden ya correcto, en
    // cuanto pasara más de 0ms de trabajo real entre ambas llamadas — que es siempre). En su
    // lugar: un único `turnStartTime` fijo, y tres franjas de offset relativas a él — negativa
    // para lo que debe leerse ANTES de la narración principal (viaje interrumpido), `+1000` fijo
    // para la narración principal, y por encima de `+1000` para lo que debe leerse DESPUÉS
    // (recompensas de misión resueltas durante el intercambio de combate/decapitar) — sin
    // importar en qué punto real del código se cree cada fila.
    const turnStartTime = Date.now();
    let beforeMainLogSeq = 0;
    const nextBeforeMainLogCreatedAt = () => new Date(turnStartTime - 1000 + beforeMainLogSeq++);
    const mainLogEntryCreatedAt = new Date(turnStartTime);
    let afterMainLogSeq = 1;
    const nextAfterMainLogCreatedAt = () => new Date(turnStartTime + afterMainLogSeq++);

    // Ver TransitCancelledError arriba: si esta resolución viene de worldTick.ts, intenta borrar
    // el CharacterTransit YA, al principio de la transacción — si otra transacción (el cancelar
    // del jugador) ya lo borró primero, `count` es 0 y se aborta todo sin aplicar ningún efecto.
    if (transitIdToFinalize) {
      const finalized = await tx.characterTransit.deleteMany({ where: { id: transitIdToFinalize } });
      if (finalized.count === 0) throw new TransitCancelledError();
    }

    // docs/19-post-combate-y-recompensas-mision.md pieza 2 — recuperación de CONVALECIENTE a las 6h
    // de ficción / desaparición de un cadáver a las 48h. Antes de nada más este turno, con el
    // `fictionalMinutes` ya avanzado: cualquier NPC afectado debe verse ya actualizado en el resto
    // de este mismo turno (p. ej. si vuelve a estar HERIDO, `npcsInScene` de este turno ya debería
    // reflejarlo si se recalculara — no se recalcula aquí, pero al menos la DB queda consistente
    // para el turno SIGUIENTE sin depender de que pase algo más).
    await applyCondicionTimeouts(tx, saveId, nuevoFictionalMinutes);

    const newInventoryItems: NewInventoryItemInfo[] = [];
    // Ver el comentario de `removedInventoryItemIds` en NarrateAndPersistResult — se rellenan en
    // crafteo/construcción, los dos únicos caminos que de verdad borran/reducen filas existentes.
    const removedInventoryItemIds: string[] = [];
    const updatedInventoryItems: { id: string; name: string }[] = [];
    // Saqueo parcial: NPCs tocados este turno que se quedan CON botín pendiente (auditoría
    // "ronda larga de pruebas" 2026-08-04, hallazgo real jugando en vivo) — sin esto, `combatSlugs`
    // más abajo se queda vacío en cualquier turno de solo-saqueo (ni intercambio ni decapitar), así
    // que `Save.pendingCombatNpcSlugs` se sobrescribía a `[]` aunque quedaran objetos por saquear:
    // un refresco de página justo ahí perdía el aviso de "sigue en combate/saqueable" para el resto
    // del botín, aunque los datos reales (`NpcState.saqueado`/`lootedItemNames`) fueran correctos.
    const partiallyLootedSlugs: string[] = [];
    // Nombres de todo lo materializado este turno (roadmap 2026-07-20, P1 de Fable) — para cerrar
    // solo la misión "conseguir Z" (Quest.targetItemName) al final de la transacción, sin repetir
    // el chequeo en cada uno de los 5 sitios que crean InventoryItem.
    const createdItemNames: string[] = [];
    // Nombres de lo crafteado ESTE turno, en el mismo orden en que se resuelve cada receta
    // (auditoría 2026-08-14, petición explícita repetida: "la habilidad de crafteo debe ser
    // determinista no narrada") — el resultado en sí (qué se crea, qué se consume) ya era
    // determinista desde 2026-07-22 (CRAFTING_RECIPES/planCraftConsumption), pero el TEXTO seguía
    // siendo prosa libre del modelo; esto permite sustituirlo por una frase fija, mismo criterio
    // que loot/harvest (`narrationOverride`) más abajo.
    const craftedResultNames: string[] = [];
    // XP de recompensa de misión concedida este turno (petición explícita, 2026-07-25) — se suma
    // a xpTurno más abajo, junto a xpTirada/xpHito, para que la subida de nivel/progresión de la
    // respuesta ya la refleje en el mismo turno en que se concede (ver bloque `lootMode`).
    let questRewardXp = 0;
    // Objetivo de cualquier misión creada este turno (petición explícita, 2026-07-25) — se añade
    // al texto que escanea `recordEntityDiscoveries` al final de la función, para que si el
    // objetivo cita un elemento real del catálogo (NPC, fauna, objeto), se desbloquee en la
    // Enciclopedia igual que si lo hubiera mencionado la narración.
    const newQuestObjetivos: string[] = [];
    // Notificación de misión aceptada (ver NarrateAndPersistResult.newQuestInfo más arriba) — se
    // rellena en los dos sitios que crean una Quest de verdad, más abajo.
    let newQuestInfo: { title: string; objetivo: string } | null = null;
    // Notificación de misión completada (ver NarrateAndPersistResult.questCompletedInfo más
    // arriba) — se rellena en completeNpcTargetQuests (derrota normal/Decapitar) y en la rama
    // orcoYaResuelto (aceptar la misión con el objetivo ya resuelto de antes), los 3 sitios que
    // conceden recompensa de verdad. Si dos misiones se completaran en el mismo turno (caso raro),
    // gana la última — la recompensa real de ambas se concede igual, solo la tarjeta es una sola.
    let questCompletedInfo: QuestCompletedInfo | null = null;
    // Notificación de fundación de reino (2026-08-04, ver NarrateAndPersistResult.newKingdomFounded
    // más arriba) — se rellena solo al construir el Ayuntamiento tier 1 desde cero (nunca en una
    // mejora de tier), para que el frontend abra el popup de fundación de facción.
    let newKingdomFounded: KingdomFoundedInfo | null = null;
    // Consolidación de territorio (2026-08-23, Grupo 3 § Territory.control) — capturado aquí,
    // antes de que exista `reinoXp` (se declara mucho más abajo), para poder sumarle sus 300 XP
    // (docs/10-niveles-xp-reino.md § 5.4) en el mismo punto que el resto de eventos de Reino.
    let territoryConsolidatedThisTurn = false;
    // Compañero REALMENTE creado este turno (2026-08-04, ver el tope de slots más abajo) — null
    // si no hubo ninguna propuesta o si se rechazó por falta de hueco. El frontend debe usar esto,
    // nunca `narration.newCompanion` directo, para no mostrar en la UI a alguien que el backend
    // acabó de rechazar en silencio.
    let companionCreated: { id: string; name: string; role: string; notes: string } | null = null;

    await tx.worldState.update({
      where: { saveId },
      data: {
        fictionalMinutes: nuevoFictionalMinutes,
        fictionalDateLabel: nuevaFictionalDateLabel,
      },
    });

    // Tick diario de Reino (sesión de diseño 2026-07-23, kingdomTick.ts) — solo si ya existe una
    // fila KingdomStats (se crea al fundar el primer Territory, más abajo) y este turno cruza al
    // menos un día de ficción completo (un viaje largo puede cruzar varios de golpe). Determinista,
    // cero IA — el modelo nunca decide estos números.
    const diasCruzados = daysCrossed(fictionalMinutesActuales, nuevoFictionalMinutes);
    if (diasCruzados > 0) {
      const kingdomStats = await tx.kingdomStats.findUnique({ where: { saveId } });
      if (kingdomStats) {
        const { poblacion, felicidad, comida, bebida, riqueza, soldados, trabajadores, visitantes, diasFelicidadAlta, diasFelicidadBaja } = kingdomStats;
        const ticked = tickKingdom(
          { poblacion, felicidad, comida, bebida, riqueza, soldados, trabajadores, visitantes, diasFelicidadAlta, diasFelicidadBaja },
          diasCruzados,
        );
        await tx.kingdomStats.update({ where: { saveId }, data: ticked });

        // Territory.control/population (2026-08-23, Grupo 3 — docs/10-niveles-xp-reino.md § 5.4,
        // nunca implementado hasta ahora) — misma cadencia que el tick de arriba, felicidad
        // sostenida decide si el reino se asienta o se rebela. Rebelión primero: si un territorio
        // se pierde ESTE mismo tick, su población cae a 0 de golpe (huida, no decadencia gradual)
        // y sus edificios quedan fuera del reparto de crecimiento de abajo.
        const territories = await tx.territory.findMany({ where: { saveId } });
        if (territories.length > 0) {
          let perdiendoIds: string[] = [];
          if (ticked.diasFelicidadBaja >= DIAS_PARA_REBELION) {
            perdiendoIds = territories.filter((t) => t.control !== 'PERDIDO').map((t) => t.id);
            if (perdiendoIds.length > 0) {
              // Se conserva la fila (docs/10 § 5.4: "es historia del reino") — nunca se borra.
              await tx.territory.updateMany({ where: { id: { in: perdiendoIds } }, data: { control: 'PERDIDO', population: 0 } });
              await tx.building.updateMany({ where: { territoryId: { in: perdiendoIds }, status: 'ACTIVO' }, data: { status: 'ABANDONADO' } });
            }
          } else if (ticked.diasFelicidadAlta >= DIAS_PARA_CONSOLIDAR) {
            const { count } = await tx.territory.updateMany({ where: { saveId, control: { in: ['RECLAMADO', 'DISPUTADO'] } }, data: { control: 'CONSOLIDADO' } });
            territoryConsolidatedThisTurn = count > 0;
          }

          const popDelta = territoryPopulationDelta(ticked.felicidad, diasCruzados);
          if (popDelta !== 0) {
            for (const t of territories) {
              if (perdiendoIds.includes(t.id)) continue; // ya en 0 por la rebelión de arriba
              const nuevaPoblacion = Math.max(0, t.population + popDelta);
              if (nuevaPoblacion !== t.population) {
                await tx.territory.update({ where: { id: t.id }, data: { population: nuevaPoblacion } });
              }
            }
          }
        }
      }
    }

    // Loot (docs/12 § 4.5) — la ÚNICA fuente de botín es lo que el NPC lleva encima (NpcItem),
    // nunca una invención del modelo. `lootTargets` (ver más arriba) ya filtra por objetivo
    // explícito y por condicionFisica CONVALECIENTE/MUERTO — aquí ya no hace falta volver a
    // comprobar nada de eso.
    //
    // Saqueo selectivo (2026-07-30, sustituye la decisión original de "copiar siempre todo el
    // loadout"): si `lootItemNames` viene informado (el modal de saqueo con checkboxes lo manda),
    // solo se copian los objetos marcados — el resto del loadout se queda con el cadáver. Sin
    // esa lista (el "Registrar"/"Saquear todo" de toda la vida), se sigue copiando todo.
    //
    // Saqueo PARCIAL de verdad (2026-07-31, petición explícita: "si no saqueas todo el botón sigue
    // para poder saquear lo que dejaste") — antes `saqueado` se marcaba `true` en cuanto se tocaba
    // CUALQUIER objeto del NPC, así que dejar algo sin marcar en el modal lo perdía para siempre
    // (`if (npc.saqueado) continue` de abajo bloqueaba cualquier visita posterior). Ahora
    // `NpcState.lootedItemNames` lleva la cuenta exacta de qué te has llevado ya — `itemsToLoot`
    // excluye lo ya tomado (nunca duplica si vuelves a marcarlo sin querer) y `saqueado` solo pasa
    // a `true` cuando `lootedItemNames` cubre el 100% del loadout conocido del NPC.
    // Narración mentirosa si se pierde la carrera (auditoría 2026-08-06, mismo patrón que
    // buildMode más abajo): `lootPreview` (arriba, antes de esta transacción) ya decidió y emitió
    // en streaming el texto "se hace con lo siguiente: X, Y" a partir de una foto de `npcsInScene`
    // que puede estar obsoleta — dos "saquear" casi simultáneos sobre el mismo NPC (doble clic,
    // reintento de red, dos pestañas) hacían que el segundo no creara ningún InventoryItem
    // (bloqueado por `freshState?.saqueado`, ya cerrado como bug mecánico) pero su narración ya
    // fijada seguía afirmando el saqueo igualmente. Se corrige aquí, con lo que de verdad se creó.
    if (lootMode) {
      const lootResult = await applyLootMode({
        tx,
        lootTargets,
        lootItemNames,
        lootPreviewCount: lootPreview.length,
        currentLocationId,
        saveId,
        characterName,
      });
      newInventoryItems.push(...lootResult.newInventoryItems);
      createdItemNames.push(...lootResult.createdItemNames);
      partiallyLootedSlugs.push(...lootResult.partiallyLootedSlugs);
      questRewardXp += lootResult.questRewardXp;
      if (lootResult.narrationOverride) narration.narration = lootResult.narrationOverride;
    }

    // `abilityNamesToIncrementFor` (auditoría de deuda técnica 2026-08-18) — ver su doc comment
    // junto a `playerAbilityUsageGate`.
    const abilityNamesToIncrement = abilityNamesToIncrementFor(exchangeHappened, npcAbilityUsed, playerAbilityUsageBlocked, selectedAbilityData);

    // Sistema de fatiga simétrico (2026-07-30) — `npcNuevaEnergia` viaja aquí en el MISMO upsert
    // que la condición física en vez de uno aparte: los dos pueden cambiar en el mismo intercambio
    // (un golpe que además gasta energía) y un NPC solo tiene una fila NpcState por scope.
    // Aplica el intercambio de combate ya resuelto al NpcState del objetivo — ver
    // `applyCombatExchangeToNpcState` más arriba.
    const combatExchangeResult = await applyCombatExchangeToNpcState({
      tx,
      npcAttackTarget,
      npcNuevaEnergia,
      npcAttackHits,
      npcTargetNewCondicion,
      analizarRivalExito,
      abilityNamesToIncrement,
      saveId,
      worldId,
      currentLocationId,
      nuevoFictionalMinutes,
      nuevaFictionalDateLabel,
      activeRegion,
      nextAfterMainLogCreatedAt,
    });
    if (combatExchangeResult.questCompletedInfo) questCompletedInfo = combatExchangeResult.questCompletedInfo;
    // Bug real (auditoría "revisar partida" 2026-08-14): la recompensa de misión se narraba
    // ("+100 XP" en el texto de `completeNpcTargetQuests`) pero nunca se sumaba al XP real del
    // turno — a diferencia del camino de saqueo (más abajo, `lootResult.questRewardXp`), que sí lo
    // hacía bien. Cerrar la misión matando/incapacitando al objetivo (el camino más común) daba XP
    // fantasma: el jugador veía el número pero `Save.xp` nunca subía.
    questRewardXp += combatExchangeResult.questCompletedInfo?.rewardXp ?? 0;

    // "Decapitar" (petición explícita, 2026-07-30) — ver `applyExecuteTargets` más arriba.
    const executeResult = await applyExecuteTargets({
      tx,
      executeTargets,
      saveId,
      worldId,
      currentLocationId,
      nuevoFictionalMinutes,
      nuevaFictionalDateLabel,
      activeRegion,
      nextAfterMainLogCreatedAt,
    });
    if (executeResult.questCompletedInfo) questCompletedInfo = executeResult.questCompletedInfo;
    // Mismo bug gemelo que arriba, para el cierre de misión vía "Decapitar"/"Matar".
    questRewardXp += executeResult.questCompletedInfo?.rewardXp ?? 0;

    // Despiece/recolección (§ 3.3) — ver `applyHarvest` más arriba.
    const harvestResult = await applyHarvest({ tx, harvestMatch, harvestOutcome, roll, saveId, currentLocationId, characterName });
    newInventoryItems.push(...harvestResult.newInventoryItems);
    createdItemNames.push(...harvestResult.createdItemNames);
    if (harvestResult.narrationOverride) narration.narration = harvestResult.narrationOverride;

    // Producción de acciones por tiempo (docs/08 § 4) — hasta ahora "debería conseguir 60 de
    // leña" era solo texto de aviso y nunca se materializaba de verdad (roadmap 2026-07-19).
    // Mismo criterio que el despiece: solo si la acción tuvo éxito o no requería tirada.
    if (produccion && (!roll || roll.success)) {
      const created = await tx.inventoryItem.create({
        data: {
          saveId,
          name: `${produccion.itemName} (${produccion.cantidad})`,
          description: `Conseguido en la acción: "${action}".`,
          origin: 'producción',
        },
      });
      // Producción de acción por tiempo — sin catalogSlug (objeto narrativo puro), tipo null igual
      // que newItem del modelo más abajo; nunca EQUIPABLE ni ESPECIAL, equipSlot/effectKey null.
      newInventoryItems.push({ ...created, slot: null, equipSlot: null, effectKey: null, tipo: null });
      createdItemNames.push(created.name);
    }

    // Nivel de oficio (sesión de diseño 2026-07-23): se otorga en cuanto la receta se materializa
    // de verdad (no solo se comprueba posible) — un solo upsert, la profesión ya es dato estático
    // de la receta, cero coste de IA.
    //
    // Habilidades de oficio (retomado 2026-08-07, idea aplazada desde el 2026-07-28 — ver
    // professionAbilities.ts): se registran aquí los niveles de oficio CRUZADOS por este turno,
    // pero las filas de SavedAction/LogEntry se crean más abajo (después de nextAfterMainLogCreatedAt,
    // igual que el desbloqueo de habilidades de clase) — esta función se invoca demasiado pronto en
    // la transacción para usar ese contador de orden todavía.
    const unlockedProfessionAbilities: { oficio: string; nivel: number; ability: StartingAbility }[] = [];
    async function awardProfessionXp(oficio: string | undefined, tier: number | undefined): Promise<void> {
      if (!oficio) return;
      const xpDelta = xpForCraftSuccess(tier);
      // Auditoría 2026-08-07 (bug real, mismo patrón que population.ts/pendingAttributePoints ya
      // fijado en este archivo): la versión anterior leía `existing` con `findUnique` y luego
      // escribía un `nivel`/`xp` ABSOLUTO calculado en JS — dos turnos casi simultáneos otorgando
      // XP del mismo oficio (doble clic, dos pestañas, mismo vector ya documentado en otros sitios
      // de este archivo) podían leer el mismo valor obsoleto y pisarse: se perdía XP en silencio y,
      // peor con el desbloqueo de habilidades de oficio nuevo, se podía duplicar la propia
      // habilidad si ambos turnos cruzaban el mismo nivel a la vez. `{ increment: xpDelta }` es
      // atómico de verdad en Postgres — nunca pierde ni duplica, sea cual sea el orden real de los
      // dos turnos. `nivel: 0` como base de una fila nueva es a propósito (nunca se lee así fuera
      // de esta función: se corrige más abajo, dentro de la MISMA transacción, antes de que nada
      // pueda leer el estado intermedio).
      const afterIncrement = await tx.professionProgress.upsert({
        where: { saveId_professionId: { saveId, professionId: oficio } },
        create: { saveId, professionId: oficio, nivel: 0, xp: xpDelta },
        update: { xp: { increment: xpDelta } },
      });
      const previousLevel = afterIncrement.nivel;
      const newLevel = professionLevelForXp(afterIncrement.xp);
      if (newLevel > previousLevel) {
        await tx.professionProgress.update({ where: { saveId_professionId: { saveId, professionId: oficio } }, data: { nivel: newLevel } });
      }
      for (let lvl = previousLevel + 1; lvl <= newLevel; lvl++) {
        for (const ability of professionAbilityUnlocksFor(oficio, lvl)) {
          unlockedProfessionAbilities.push({ oficio, nivel: lvl, ability });
        }
      }
    }

    // Foto fresca del inventario, DENTRO de la transacción (auditoría 2026-07-30, bug real de
    // condición de carrera): `inventoryRows` (arriba, fuera de la transacción) se leyó ANTES de
    // narrar — un hueco de 30-220s en el que una acción duplicada (doble clic antes de que se
    // bloquee el composer, dos pestañas) podía planear consumo de materiales dos veces contra la
    // MISMA foto vieja. La primera transacción en comprometerse consume de verdad; sin esto, la
    // segunda recalculaba su plan sobre datos ya obsoletos, encontraba "suficiente" material que
    // ya no existía, y el `deleteMany` por id simplemente no borraba nada (0 filas afectadas, sin
    // error) — pero seguía creando el objeto crafteado igual, dando un objeto gratis sin gastar
    // nada. Recalculando aquí, con datos leídos DENTRO de esta misma transacción, la segunda
    // pasada ve la foto ya consumida y `planCraftConsumption`/`canCraft` fallan de verdad.
    const freshInventoryRows = await tx.inventoryItem.findMany({
      where: { saveId },
      select: { id: true, name: true, catalogSlug: true, slot: true },
    });

    // Consumo real de objetos médicos/de energía (bug real jugando en vivo, 2026-08-07: "he
    // consumido una ración y no ha desaparecido del inventario", también en combate) —
    // `consumedItemIds` se calculó ANTES de esta transacción; se revalida aquí contra
    // `freshInventoryRows` (mismo criterio anti-carrera que crafteo/construcción: un turno casi
    // simultáneo pudo consumir/perder esa misma fila entretanto) y se descuenta 1 unidad real —
    // borra la fila si era la última, reduce el sufijo de cantidad si quedan más.
    for (const itemId of consumedItemIds) {
      const row = freshInventoryRows.find((r) => r.id === itemId);
      if (!row) continue;
      const quantity = quantityOf(row.name);
      if (quantity <= 1) {
        await tx.inventoryItem.delete({ where: { id: itemId } });
        removedInventoryItemIds.push(itemId);
      } else {
        const newName = `${baseNameOf(row.name)} (${quantity - 1})`;
        await tx.inventoryItem.update({ where: { id: itemId }, data: { name: newName } });
        updatedInventoryItems.push({ id: itemId, name: newName });
      }
    }

    // Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) — mismo
    // criterio anti-carrera que el bucle de arriba (releído de `freshInventoryRows`), pero
    // descuenta la CANTIDAD real usada (`u.quantity`), no solo 1. Nunca se solapa con el bucle de
    // arriba: `usingExplicitHealList` ya evitó que este mismo itemId entrara en `consumedItemIds`.
    for (const u of healItemUsesValidated) {
      const row = freshInventoryRows.find((r) => r.id === u.id);
      if (!row) continue;
      const disponible = quantityOf(row.name);
      const aConsumir = Math.min(u.quantity, disponible);
      if (aConsumir <= 0) continue;
      const restante = disponible - aConsumir;
      if (restante <= 0) {
        await tx.inventoryItem.delete({ where: { id: u.id } });
        removedInventoryItemIds.push(u.id);
      } else {
        const newName = `${baseNameOf(row.name)} (${restante})`;
        await tx.inventoryItem.update({ where: { id: u.id }, data: { name: newName } });
        updatedInventoryItems.push({ id: u.id, name: newName });
      }
    }

    // Resuelve equipSlot/effectKey/tipo del RESULTADO de una receta por su propio catalogSlug
    // (auditoría 2026-08-11, ver comentario junto a newInventoryItems.push más abajo) — memoizado
    // dentro del turno, nunca más de una consulta por slug distinto aunque dispare varias recetas.
    const resultCatalogRowCache = new Map<string, { equipSlot: string | null; effectKey: string | null; tipo: string | null } | null>();
    async function resultCatalogRowFor(slug: string) {
      if (resultCatalogRowCache.has(slug)) return resultCatalogRowCache.get(slug)!;
      const row = await tx.itemCatalog.findUnique({
        where: { worldId_slug: { worldId, slug } },
        select: { equipSlot: true, effectKey: true, tipo: true },
      });
      resultCatalogRowCache.set(slug, row);
      return row;
    }

    // Crafteo v1: tabulado en CRAFTING_RECIPES (auditoría 2026-07-22 — antes 5 bloques casi
    // idénticos, uno por objeto). Refactor de ingredientes (2026-07-29): ya no es siempre "una
    // fila entera por ingrediente" — un plan por ingrediente (borrar filas + reducir remanente),
    // mismo mecanismo exacto que ya usa la construcción de más abajo.
    for (const recipe of CRAFTING_RECIPES) {
      if (!craftPossibleByKey[recipe.key]) continue;
      const plans = planCraftConsumption(recipe, freshInventoryRows, catalogBySlug);
      if (!plans) continue;
      for (const plan of plans) {
        if (plan.deleteIds.length > 0) {
          await tx.inventoryItem.deleteMany({ where: { id: { in: plan.deleteIds } } });
          removedInventoryItemIds.push(...plan.deleteIds);
        }
        if (plan.updateRemainder) {
          const row = freshInventoryRows.find((r) => r.id === plan.updateRemainder!.id);
          if (row) {
            const newName = `${baseNameOf(row.name)} (${plan.updateRemainder.newQuantity})`;
            await tx.inventoryItem.update({
              where: { id: plan.updateRemainder.id },
              data: { name: newName },
            });
            updatedInventoryItems.push({ id: plan.updateRemainder.id, name: newName });
          }
        }
      }
      const created = await tx.inventoryItem.create({
        data: {
          saveId,
          name: recipe.resultName,
          description: recipe.resultDescription,
          origin: 'crafteo',
          catalogSlug: recipe.resultCatalogSlug,
          statBonuses: recipe.statBonuses ?? Prisma.JsonNull,
        },
      });
      // Bug real (auditoría 2026-08-11, "pruebas por API"): `catalogBySlug` (arriba) solo trae los
      // catalogSlug que el jugador YA tenía en inventario ANTES de este turno (por diseño, para
      // comprobar materiales) — el RESULTADO de una receta es, casi siempre, algo que el jugador NO
      // tenía todavía, así que reutilizar ese mismo mapa aquí dejaba `equipSlot`/`effectKey`/`tipo`
      // en null salvo que ya tuviera otra unidad del mismo objeto. Se resuelve con una consulta
      // directa al catálogo por el propio `resultCatalogSlug` (memoizada más abajo, barata: como
      // mucho una fila por receta distinta que se dispare en el mismo turno).
      const resultCatalogRow = recipe.resultCatalogSlug ? await resultCatalogRowFor(recipe.resultCatalogSlug) : null;
      newInventoryItems.push({
        ...created,
        slot: null,
        equipSlot: resultCatalogRow?.equipSlot ?? null,
        effectKey: resultCatalogRow?.effectKey ?? null,
        tipo: resultCatalogRow?.tipo ?? null,
      });
      createdItemNames.push(created.name);
      craftedResultNames.push(created.name);
      await awardProfessionXp(recipe.oficio, recipe.tier);
    }
    // Sustituye la prosa libre del modelo por una frase fija (auditoría 2026-08-14, ver comentario
    // de `craftedResultNames` más arriba) — mismo criterio que `lootResult.narrationOverride`/
    // `harvestResult.narrationOverride`: nunca dejar que el modelo "cuente" algo que ya se decidió
    // por código, ni con matices que la mecánica no respalda.
    if (craftedResultNames.length > 0) {
      narration.narration = `${characterName} craftea: ${craftedResultNames.join(', ')}. ${pickFlavor(CRAFT_FLAVOR)}`;
    }

    // Construcción (roadmap 2026-07-20/21, ampliado 2026-07-22): a diferencia del resto de
    // crafteo (una fila entera 1:1), aquí se consumen CANTIDADES reales repartidas entre las
    // filas que hagan falta (planConsumption), dejando un remanente reducido en la última fila
    // si sobra. Mismo criterio anti-carrera que el crafteo de arriba: `freshInventoryRows`, no la
    // foto de antes de narrar.
    //
    // Revalidación anti-carrera completa (auditoría 2026-08-04, bug real): `buildMode`/
    // `buildRecipeCheck`/`buildBlockedReason` de más arriba se calcularon con `prisma`, ANTES de
    // esta transacción — un hueco de segundos en el que un doble envío del mismo turno (doble
    // clic, reintento de red, dos pestañas) podía colar dos construcciones sobre la misma foto ya
    // obsoleta. `buildRecipeConsumptionPlans` (null si algún material ya no alcanza, mismo criterio
    // que `planCraftConsumption`) y una segunda pasada de `computeBuildBlockedReason` con `tx`
    // (releyendo cupo por región/Ayuntamiento/unicidad de verdad) son la fuente de verdad real —
    // sin esto, dos "construyo un ayuntamiento" casi simultáneos podían crear dos `Building` +
    // `Territory` para la misma partida, o levantar la construcción sin gastar nada.
    const buildRecipeConsumptionPlans =
      buildMode && buildRecipe ? planRecipeConsumption(buildRecipe, freshInventoryRows, catalogBySlug) : null;
    const buildStillBlockedReason =
      buildMode && buildRecipe && buildRecipeConsumptionPlans && currentLocationRecord
        ? await computeBuildBlockedReason({ db: tx, saveId, worldId, buildRecipe, activeRegion, currentLocationRecord })
        : null;
    const buildValidNow = !!buildRecipeConsumptionPlans && !buildStillBlockedReason;
    // Narración mentirosa si se pierde la carrera (auditoría 2026-08-04, cierre del hallazgo de
    // arriba): el texto sintético "termina de construir X" (más arriba, antes de esta transacción,
    // ver `buildMode` cerca de la narración) ya se decidió y hasta se transmitió por streaming
    // ANTES de saber si `buildValidNow` iba a ser true — mismo riesgo de "la narración dice algo
    // que la DB no respalda" que hasFalseCombatHit/hasFalseItemUse ya cierran para otros casos.
    // No se puede deshacer el chunk ya emitido, pero SÍ se corrige aquí el texto final que de
    // verdad se persiste en LogEntry y se devuelve en el `done` — el frontend descarta el preview
    // en streaming en cuanto llega `done` y pinta este texto, así que el resultado visible/
    // guardado siempre es honesto aunque el hueco de streaming, rarísimo, no lo sea por un instante.
    if (buildMode && buildRecipe && !buildValidNow) {
      narration.narration = `${characterName} lo intenta, pero justo en ese instante se da cuenta de que ya no dispone de lo necesario para terminarlo.`;
      // La fila EN_CONSTRUCCION ya existía (turn.ts, planDeterministicBuild) — si la carrera se
      // pierde aquí, se borra en vez de dejarla huérfana para siempre en ese estado (guard de
      // status por si acaso, aunque nada más pueda haberla completado ya a estas alturas).
      if (earlyBuildingId) {
        await tx.building.deleteMany({ where: { id: earlyBuildingId, status: 'EN_CONSTRUCCION' } });
      }
    }
    if (buildRecipe && buildValidNow) {
      for (const plan of buildRecipeConsumptionPlans!) {
        if (plan.deleteIds.length > 0) {
          await tx.inventoryItem.deleteMany({ where: { id: { in: plan.deleteIds } } });
          removedInventoryItemIds.push(...plan.deleteIds);
        }
        if (plan.updateRemainder) {
          const row = freshInventoryRows.find((r) => r.id === plan.updateRemainder!.id);
          if (row) {
            const newName = `${baseNameOf(row.name)} (${plan.updateRemainder.newQuantity})`;
            await tx.inventoryItem.update({
              where: { id: plan.updateRemainder.id },
              data: { name: newName },
            });
            updatedInventoryItems.push({ id: plan.updateRemainder.id, name: newName });
          }
        }
      }
      await awardProfessionXp(buildRecipe.oficio, buildRecipe.tier);
    }

    if (narration.newItem && !lootMode && !harvestMatch) {
      const created = await tx.inventoryItem.create({
        data: { saveId, name: narration.newItem.name, description: narration.newItem.description, origin: 'partida' },
      });
      createdItemNames.push(created.name);
      // Bug real (auditoría de deuda técnica 2026-08-04, mismo patrón que companionCreated): a
      // diferencia de los otros 4 sitios que crean InventoryItem en este archivo (saqueo,
      // despiece, producción, crafteo/construcción), este era el único que no empujaba a
      // `newInventoryItems` — el frontend solo se enteraba vía `narration.newItem` (name+
      // description sueltos del LLM, sin id real) y se veía obligado a inventarse un id de
      // cliente (`item-${Date.now()}`) que el backend no reconoce, rompiendo equipar ese objeto
      // hasta la siguiente recarga completa. Objeto libre, sin catalogSlug de por medio →
      // equipSlot/effectKey/tipo siempre null, mismo criterio que el resto de creaciones sin catálogo.
      newInventoryItems.push({ ...created, slot: null, equipSlot: null, effectKey: null, tipo: null });
    }
    if (narration.newCompanion) {
      // Tope real de slots (2026-08-04, ver el aviso de contextBlocks más arriba) — reconsultado
      // fresco dentro de la transacción, mismo criterio que `freshInventoryRows`: el modelo puede
      // ignorar el aviso, esto es lo que garantiza que nunca se cree un compañero sin hueco.
      const [freshCompanionCount, freshCompanionBuildings] = await Promise.all([
        tx.companion.count({ where: { saveId } }),
        tx.building.findMany({ where: { saveId, status: 'ACTIVO' }, select: { recipeKey: true } }),
      ]);
      const freshMaxCompanions = freshCompanionBuildings.reduce((sum, b) => sum + companionSlotsForRecipeKey(b.recipeKey), 0);
      if (freshCompanionCount < freshMaxCompanions) {
        const created = await tx.companion.create({
          data: {
            saveId,
            name: narration.newCompanion.name,
            role: narration.newCompanion.role,
            notes: narration.newCompanion.notes,
          },
        });
        // Bug real introducido por el tope de arriba (2026-08-04): el frontend añadía
        // `narration.newCompanion` a su lista de compañeros de forma optimista, sin saber que el
        // backend podía rechazarlo en silencio por falta de hueco — devolver el registro REAL
        // (o null si se rechazó) es lo único fiable, mismo criterio que `newInventoryItems`.
        companionCreated = created;
      }
    }

    // Eventos de Reino (docs/10-niveles-xp-reino.md § 5) — necesitan enlazar por nombre de
    // territorio y contar súbditos existentes, por eso van en la transacción interactiva.
    let reinoXp = territoryConsolidatedThisTurn ? REINO_XP.consolidado : 0;
    let territoryId: string | undefined;

    // Contador para nudges deterministas de KingdomStats (abajo) — increment-only, se salta en
    // silencio si todavía no hay fila (sin Territory fundado, "el vacío es un estado válido").
    async function bumpKingdomStats(delta: Partial<import('./kingdomTick.js').KingdomStatsBlock>): Promise<void> {
      const entries = Object.entries(delta).filter(([, v]) => v);
      if (entries.length === 0) return;
      const exists = await tx.kingdomStats.findUnique({ where: { saveId }, select: { saveId: true } });
      if (!exists) return;
      await tx.kingdomStats.update({
        where: { saveId },
        data: Object.fromEntries(entries.map(([k, v]) => [k, { increment: v as number }])),
      });
    }

    if (narration.newTerritory) {
      const existingTerritories = await tx.territory.count({ where: { saveId } });
      const territory = await tx.territory.create({
        data: {
          saveId,
          name: narration.newTerritory.name,
          region: narration.newTerritory.region,
          description: narration.newTerritory.description,
          population: TERRITORIO_POBLACION_INICIAL,
        },
      });
      territoryId = territory.id;
      reinoXp = Math.max(reinoXp, REINO_XP.territory);
      // Primer territorio (sesión de diseño 2026-07-23): momento real en el que "empieza a haber
      // reino" — se crea la fila de economía aquí, con los valores por defecto (todo a 0 salvo
      // felicidad neutral en 50), nunca antes.
      if (existingTerritories === 0) {
        await tx.kingdomStats.upsert({ where: { saveId }, create: { saveId, ...DEFAULT_KINGDOM_STATS }, update: {} });
      }
    }

    async function resolveTerritoryId(name?: string): Promise<string | undefined> {
      if (territoryId) return territoryId;
      if (!name) return undefined;
      const found = await tx.territory.findFirst({ where: { saveId, name } });
      return found?.id;
    }

    // Building determinista (2026-08-04, ver `buildMode` más arriba, "el campamento" — primera
    // construcción anclada al mapa): nombre/descripción/receta salen de CONSTRUCTION_RECIPES,
    // nunca de `narration.newBuilding` (que en este turno ni siquiera existe — el LLM no se llegó
    // a llamar). Anclado a `currentLocationId` para que el mapa (InteractiveMap.tsx) pueda pintar
    // su icono en el mismo nodo — null si el personaje está en tránsito o en un punto sin Location
    // conocida, igual de válido, solo sin icono. Gate real `buildValidNow` (no `buildMode`, ver
    // comentario junto a su cálculo más arriba) — si se pierde la carrera contra otro turno
    // concurrente, este bloque entero se salta sin crear/mejorar nada.
    // `writeKingdomLogForBuild` (auditoría de deuda técnica 2026-08-18) — ver su doc comment.
    await writeKingdomLogForBuild(tx, {
      buildValidNow,
      buildRecipe,
      saveId,
      characterName,
      timeLabel: nuevaFictionalDateLabel,
      fictionalMinutes: nuevoFictionalMinutes,
    });

    if (buildValidNow && buildRecipe) {
      if (buildRecipe.upgradesRecipeKey) {
        // Mejora de Ayuntamiento (2026-08-04): actualiza el MISMO `Building.id`, nunca crea uno
        // nuevo — "no se acumulan, mejoras el actual" (docs/17-reglas-construcciones-reino.md).
        // El objetivo ya se verificó arriba (`buildBlockedReason`), pero se re-busca fresco dentro
        // de la transacción por si acaso, mismo criterio que `freshInventoryRows`.
        const target = await tx.building.findFirst({ where: { saveId, recipeKey: buildRecipe.upgradesRecipeKey } });
        if (target) {
          await tx.building.update({
            where: { id: target.id },
            data: { name: buildRecipe.name, description: buildRecipe.description, tier: buildRecipe.ayuntamientoNivel, status: 'ACTIVO' },
          });
        }
      } else {
        // Completa la fila EN_CONSTRUCCION ya creada en turn.ts en vez de crear una nueva
        // (2026-08-23, Grupo 3 § Building.status) — `earlyBuildingId` solo falta si esta
        // construcción se resolvió por el turno síncrono de /turn/narrate (nunca pasa hoy, todas
        // las recetas son banda larga, pero se cubre el caso por si acaso) o si `turn.ts` no llegó
        // a detectarla a tiempo (mismo "mejor esfuerzo" que el resto de esta revalidación).
        const created = earlyBuildingId
          ? await tx.building.update({ where: { id: earlyBuildingId }, data: { status: 'ACTIVO' } })
          : await tx.building.create({
              data: {
                saveId,
                locationId: currentLocationId ?? undefined,
                recipeKey: buildRecipe.key,
                name: buildRecipe.name,
                kind: buildRecipe.key,
                description: buildRecipe.description,
                status: 'ACTIVO',
                tier: buildRecipe.ayuntamientoNivel ?? undefined,
              },
            });
        // Fundación de reino (2026-08-04): solo al construir el Ayuntamiento tier 1 desde cero,
        // nunca en una mejora (esa rama ni pasa por aquí). Resuelve contra la(s) facción(es) dueña
        // de la región (reputation.ts) y crea el Territory correspondiente — mismo criterio que
        // `narration.newTerritory` de abajo (primer Territory = primera vez que "hay reino").
        if (buildRecipe.key === 'ayuntamiento') {
          const worldStateForFounding = await tx.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true } });
          const foundingFactionsStatus = parseFactionsStatus(worldStateForFounding?.factionsStatus);
          const outcome = resolveFoundingOutcome(activeRegion, foundingFactionsStatus);
          const existingTerritoriesForFounding = await tx.territory.count({ where: { saveId } });
          const founded = await tx.territory.create({
            data: {
              saveId,
              name: activeRegion ?? 'Territorio sin nombre',
              region: activeRegion,
              description: `Territorio fundado al construir ${buildRecipe.name}.`,
              control: outcome === 'CONFLICTO' ? 'DISPUTADO' : 'RECLAMADO',
              population: TERRITORIO_POBLACION_INICIAL,
            },
          });
          await tx.building.update({ where: { id: created.id }, data: { territoryId: founded.id } });
          if (existingTerritoriesForFounding === 0) {
            await tx.kingdomStats.upsert({ where: { saveId }, create: { saveId, ...DEFAULT_KINGDOM_STATS }, update: {} });
          }
          reinoXp = Math.max(reinoXp, REINO_XP.territory);
          // Gorhorn (2026-08-04, petición explícita): nombre de reino precargado y BLOQUEADO —
          // "Maktor". Cualquier otro personaje: formulario en blanco, todo editable (verificado
          // también en el backend al fundar de verdad, no solo en el frontend — ver ruta nueva
          // POST /saves/:id/reino/fundar).
          newKingdomFounded = {
            title: buildRecipe.name,
            region: activeRegion ?? '',
            outcome,
            suggestedName: characterName === 'Gorhorn' ? 'Maktor' : null,
            nameLocked: characterName === 'Gorhorn',
          };
        }
      }
      reinoXp = Math.max(reinoXp, REINO_XP.buildingActive);
    } else if (narration.newBuilding) {
      await tx.building.create({
        data: {
          saveId,
          territoryId: await resolveTerritoryId(narration.newBuilding.territoryName),
          name: narration.newBuilding.name,
          kind: narration.newBuilding.kind,
          description: narration.newBuilding.description,
          status: 'ACTIVO',
        },
      });
      reinoXp = Math.max(reinoXp, REINO_XP.buildingActive);
      // Nudge determinista por palabra clave (sesión de diseño 2026-07-23, mismo criterio que
      // tabulatedAttackAttribute en npcScene.ts) — sin campo nuevo en el JSON del modelo: el
      // `kind` libre que ya propone es la única señal que hace falta.
      const kindNormalized = normalizeText(narration.newBuilding.kind);
      if (/granja|cultivo|huerta|establo/.test(kindNormalized)) await bumpKingdomStats({ comida: 20 });
      else if (/taller|mina|forja|comercio|mercado/.test(kindNormalized)) await bumpKingdomStats({ riqueza: 20 });
      else if (/pozo|cisterna|aljibe/.test(kindNormalized)) await bumpKingdomStats({ bebida: 20 });
    }

    if (narration.newSubject) {
      const existingSubjects = await tx.subject.count({ where: { saveId } });
      await tx.subject.create({
        data: {
          saveId,
          territoryId: await resolveTerritoryId(narration.newSubject.territoryName),
          name: narration.newSubject.name,
          role: narration.newSubject.role,
          notes: narration.newSubject.notes,
        },
      });
      reinoXp = Math.max(reinoXp, existingSubjects === 0 ? REINO_XP.firstSubject : REINO_XP.subject);
      // Nudge determinista por palabra clave (sesión de diseño 2026-07-23) — todo súbdito con
      // nombre cuenta como población; su rol libre decide además si suma a soldados/visitantes/
      // trabajadores (mano de obra por defecto si no matchea ninguna palabra clave concreta).
      const roleNormalized = normalizeText(narration.newSubject.role);
      if (/soldad|guerrer|guardia|centinela|vigia/.test(roleNormalized)) {
        await bumpKingdomStats({ poblacion: 1, soldados: 1 });
      } else if (/visitante|viajero|huesped|forastero/.test(roleNormalized)) {
        await bumpKingdomStats({ poblacion: 1, visitantes: 1 });
      } else {
        await bumpKingdomStats({ poblacion: 1, trabajadores: 1 });
      }
    }

    // Misiones (docs/09-panel-personaje.md) — mismo patrón que Reino: el modelo propone, el
    // backend valida y materializa. questProgress solo actúa si matchea una misión ACTIVA real.
    if (narration.newQuest) {
      // Cierre detectable por backend (roadmap 2026-07-19, mecánicas): si el título/descripción
      // menciona a un NPC ya confirmado en npcsInScene, se guarda como objetivo — en cuanto ese
      // NPC caiga (CONVALECIENTE/MUERTO, ver npcAttackTarget más abajo), la misión se cierra sola,
      // sin depender de que el modelo repita el título EXACTO en "questProgress".
      const questText = normalizeText(`${narration.newQuest.title} ${narration.newQuest.description}`);
      let targetNpcId = npcsInScene.find((npc) => questText.includes(normalizeText(npc.name)))?.id;
      // Fallback a todo el mundo (segunda vuelta de diseño, 2026-07-23): una misión de "cazar a
      // X" puede aceptarse hablando con alguien QUE NO ES X (p. ej. Gistera Koh pidiendo ayuda
      // contra el Orco Enfurecido, que no está físicamente presente en esa conversación) — sin
      // esto, targetNpcId se quedaba sin resolver y la misión nunca se cerraba sola al derrotarlo.
      // Mismo criterio que ya usan targetLocationId/targetItemName más abajo (buscan en TODO el
      // mundo, no solo en escena) — se extiende aquí por consistencia.
      if (!targetNpcId) {
        const worldNpcs = await tx.npc.findMany({ where: { worldId } });
        targetNpcId = worldNpcs.find((npc) => questText.includes(normalizeText(npc.name)))?.id;
      }

      // Mismo patrón, extendido (roadmap 2026-07-20, P1 de Fable) — "llegar a Y": mismo matcher
      // que travel.ts usa para resolver destinos, contra TODAS las Location del mundo (no solo
      // las de la escena, a diferencia de targetNpcId: un objetivo de viaje puede estar lejos de
      // donde se acepta la misión).
      const worldLocations = await tx.location.findMany({ where: { worldId } });
      const targetLocationId = matchDestination(questText, worldLocations)?.id;

      // "conseguir Z": mismo patrón contra el catálogo de objetos del mundo — se guarda el
      // NOMBRE (no id), porque el InventoryItem real que la cierre no siempre coincide 1:1 con
      // una fila de catálogo (botín/despiece/crafteo pueden personalizar el nombre final).
      const worldItems = await tx.itemCatalog.findMany({ where: { worldId } });
      const targetItemName = worldItems.find((item) => questText.includes(normalizeText(item.name)))?.name;

      await tx.quest.create({
        data: {
          saveId,
          title: narration.newQuest.title,
          description: narration.newQuest.description,
          targetNpcId,
          targetLocationId,
          targetItemName,
        },
      });
      // Este camino nunca rellena `objetivo` (solo la misión determinista de abajo lo hace) — cae
      // a `description`, para que la notificación siempre tenga algo real que mostrar.
      newQuestInfo = { title: narration.newQuest.title, objetivo: narration.newQuest.description };
    }

    // Misión determinista de "acabar con el Orco Enfurecido" (segunda vuelta de diseño,
    // 2026-07-23, "revisar partida": el jugador aceptó con claridad — "Gorhorn ha aceptado ayudar
    // a Gistera Koh" ya estaba hasta en `new_facts` — pero el "newQuest" del modelo nunca se
    // disparó, pese a la instrucción explícita de más arriba. Mismo principio que el resto de
    // esta sesión: no confiar en que el modelo cumpla una condición de "si acepta, crea la
    // misión" — se detecta la aceptación de forma determinista y se crea aquí directamente).
    // Solo dispara si Gistera Koh ya se presentó (nunca antes de que pida ayuda de verdad) y no
    // existe ya esta misión para no duplicarla en turnos futuros con lenguaje similar.
    if (gisteraYaPresentada && detectsVerbalAcceptanceIntent(action)) {
      const existingOrcoQuest = await tx.quest.findFirst({ where: { saveId, title: { contains: 'Orco Enfurecido' } } });
      if (!existingOrcoQuest) {
        const orcoEnfurecido = await tx.npc.findUnique({ where: { worldId_slug: { worldId, slug: 'orco-enfurecido-hondonada' } } });
        // Bug real (ronda de pruebas 2026-08-04, hallazgo 9): si el jugador ya había derrotado y
        // saqueado al Orco Enfurecido por su cuenta ANTES de aceptar la ayuda de Gistera, esta
        // misión se creaba igual como ACTIVA apuntando a un NPC ya resuelto — como nunca vuelve a
        // producirse ni un ataque (está muerto) ni un saqueo (el guard `if (freshState?.saqueado)
        // continue` del bloque `lootMode` ya lo descarta, `saqueado` sigue en `true`), ninguno de
        // los dos caminos que cierran la misión (arriba, al incapacitar/matar; en `lootMode`, al
        // saquear) llegaba a dispararse nunca — quedaba ACTIVA para siempre, sin recompensa
        // posible. Se comprueba aquí su estado real (scope '' — es PRINCIPAL, ver scopeFor) y, si
        // ya está resuelto, la misión nace ya COMPLETADA con su XP concedido en el acto, en vez de
        // quedar como contenido roto e imposible de terminar.
        const orcoState = orcoEnfurecido
          ? await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: orcoEnfurecido.id, scope: '' } } })
          : null;
        const orcoYaResuelto = orcoState?.condicionFisica === 'CONVALECIENTE' || orcoState?.condicionFisica === 'MUERTO';
        await tx.quest.create({
          data: {
            saveId,
            title: 'Acabar con el Orco Enfurecido',
            description: orcoYaResuelto
              ? 'Gistera Koh, expulsada del Clan Serhu, pidió ayuda para acabar con el guerrero que la persigue — Gorhorn ya se había ocupado de él antes de que ella lo pidiera.'
              : 'Gistera Koh, expulsada del Clan Serhu, pidió ayuda para acabar con el guerrero que la persigue — Gorhorn ha aceptado. Derrotarlo la pondrá a salvo.',
            objetivo: 'Derrotar al Orco Enfurecido que persigue a Gistera Koh.',
            targetNpcId: orcoEnfurecido?.id,
            status: orcoYaResuelto ? 'COMPLETADA' : 'ACTIVA',
            // Recompensa estática (petición explícita, 2026-07-25). "Maza orca"/"Amuleto de hueso"
            // siguen viniendo del loot normal del cadáver (siguen en su `loadout`, worldCatalog.ts)
            // — NO van aquí, porque desde la pieza 3 (docs/19, 2026-08-13) `rewardItems` entrega el
            // objeto de verdad al completarse la misión, y listar algo que también da el loot lo
            // adelantaría al momento de derrotarlo, saltándose el propio saqueo. El mapa sí va aquí
            // a propósito (petición explícita, 2026-08-13: "el mapa se te dará como resultado de
            // dejar inconsciente al orco") — se quitó de su `loadout`, ya no se puede saquear.
            rewardXp: 100,
            rewardItems: ['Mapa de las Llanuras'],
          },
        });
        if (orcoYaResuelto) {
          questRewardXp += 100;
          // La misión nace ya COMPLETADA (nunca pasa por `completeNpcTargetQuests`, que solo
          // actúa sobre misiones que YA estaban ACTIVA) — hay que conceder el mapa aquí mismo o
          // se perdería para siempre en este camino concreto (orco ya resuelto antes de aceptar).
          const grantedItems = await grantQuestRewardItems(tx, saveId, worldId, ['Mapa de las Llanuras']);
          if (grantedItems.length > 0) {
            const rewardText = questRewardNarrationFor('Acabar con el Orco Enfurecido', grantedItems, 100);
            const rewardEntry = await tx.logEntry.create({
              data: {
                saveId,
                channel: 'CHARACTER',
                text: rewardText,
                isPlayerAction: false,
                timeLabel: nuevaFictionalDateLabel,
                fictionalMinutes: nuevoFictionalMinutes,
                // Auditoría "revisar partida" 2026-08-13 — ver comentario al principio de la
                // transacción: esta fila se crea ANTES que `mainLogEntry` en el código, pero debe
                // LEERSE después (es la recompensa de un turno que aún no se ha narrado).
                createdAt: nextAfterMainLogCreatedAt(),
              },
            });
            questCompletedInfo = { logEntryId: rewardEntry.id, text: rewardText, title: 'Acabar con el Orco Enfurecido', grantedItems, rewardXp: 100 };
          }
        } else {
          newQuestObjetivos.push('Derrotar al Orco Enfurecido que persigue a Gistera Koh.');
        }
        newQuestInfo = { title: 'Acabar con el Orco Enfurecido', objetivo: 'Derrotar al Orco Enfurecido que persigue a Gistera Koh.' };
      }
    }

    if (narration.questProgress) {
      const matchingQuests = await tx.quest.findMany({
        where: { saveId, title: narration.questProgress.title, status: 'ACTIVA' },
      });
      await tx.quest.updateMany({
        where: { saveId, title: narration.questProgress.title, status: 'ACTIVA' },
        data: { status: narration.questProgress.status },
      });

      // Reputación positiva de facción (roadmap 2026-07-20, P1 de Fable): cerrar con COMPLETADA
      // una misión que apuntaba a un NPC (Quest.targetNpcId) que sigue SIN derrotar es la señal
      // determinista de "se resolvió sin combate" — mismo WorldState.factionsStatus que ya resta
      // al derrotar (bloque de arriba), aquí suma. Si el NPC cae derrotado en ESTE MISMO turno,
      // ese bloque ya resta por su cuenta — no sumar también aquí.
      if (narration.questProgress.status === 'COMPLETADA') {
        // Bug real jugando en vivo (auditoría "revisar partida", 2026-08-15: "he acabado con el
        // orco y no ha saltado la narración en amarillo con la recompensa... no tengo el mapa") —
        // este camino (el modelo propone el cierre directamente, `questProgress`, en vez de que
        // el sistema determinista lo cierre solo al derrotar al objetivo) cambiaba `status` a
        // COMPLETADA pero nunca llamaba a `grantQuestRewardItems` ni narraba nada — a diferencia
        // de `completeNpcTargetQuests` (el camino "normal", derrotar a X), que sí hace las dos
        // cosas. Mismo criterio aquí: cualquier misión que se cierre COMPLETADA por esta vía
        // también concede de verdad sus `rewardItems`/`rewardXp` y deja una LogEntry real.
        for (const quest of matchingQuests) {
          const grantedItems = await grantQuestRewardItems(tx, saveId, worldId, quest.rewardItems);
          if (grantedItems.length > 0 || quest.rewardXp) {
            const rewardText = questRewardNarrationFor(quest.title, grantedItems, quest.rewardXp);
            const rewardEntry = await tx.logEntry.create({
              data: {
                saveId,
                channel: 'CHARACTER',
                text: rewardText,
                isPlayerAction: false,
                timeLabel: nuevaFictionalDateLabel,
                fictionalMinutes: nuevoFictionalMinutes,
                ...(nextAfterMainLogCreatedAt ? { createdAt: nextAfterMainLogCreatedAt() } : {}),
              },
            });
            questCompletedInfo = { logEntryId: rewardEntry.id, text: rewardText, title: quest.title, grantedItems, rewardXp: quest.rewardXp ?? 0 };
          }
          if (!quest.targetNpcId) continue;
          const npc = await tx.npc.findUnique({ where: { id: quest.targetNpcId } });
          if (!npc?.faction) continue;
          const derrotadoEsteTurno =
            npcAttackTarget?.id === quest.targetNpcId &&
            npcAttackHits &&
            (npcTargetNewCondicion === 'CONVALECIENTE' || npcTargetNewCondicion === 'MUERTO');
          if (derrotadoEsteTurno) continue;
          const state = await tx.npcState.findUnique({
            where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: scopeFor(npc.kind, currentLocationId) } },
          });
          const yaDerrotado = state?.condicionFisica === 'CONVALECIENTE' || state?.condicionFisica === 'MUERTO';
          if (yaDerrotado) continue;
          const currentWorldState = await tx.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true } });
          const updatedFactionsStatus = applyFactionRepDelta(
            parseFactionsStatus(currentWorldState?.factionsStatus),
            npc.faction,
            FACTION_REP_PEACE_DELTA,
          );
          await tx.worldState.update({ where: { saveId }, data: { factionsStatus: updatedFactionsStatus } });
        }
      }
    }

    // Cierre de misión "conseguir Z" (roadmap 2026-07-20, P1 de Fable, Quest.targetItemName):
    // cualquier objeto materializado ESTE turno (loot/despiece/producción/crafteo/newItem, ver
    // createdItemNames más arriba) que mencione el nombre objetivo cierra la misión sola.
    await closeItemQuests({
      tx,
      saveId,
      worldId,
      createdItemNames,
      timeLabel: nuevaFictionalDateLabel,
      fictionalMinutes: nuevoFictionalMinutes,
      createdAt: nextAfterMainLogCreatedAt,
    });

    // Posición (docs/12 § 1.4 paso 7): al llegar, currentLocationId cambia al destino y se
    // registran visitas (destino + nodos intermedios), sin XP salvo la primera vez en el destino.
    let isFirstVisitToDestination = false;
    if (travel) {
      // Auditoría 2026-07-22: antes era un `findUnique` + `create` condicional POR nodo del
      // camino (N+1) — una sola consulta para ver qué nodos ya están visitados y un solo
      // `createMany` para el resto, sin cambiar el resultado (mismo criterio de "primera visita
      // real al destino").
      const existingVisits = await tx.locationVisit.findMany({
        where: { saveId, locationId: { in: travel.pathIds } },
        select: { locationId: true },
      });
      const alreadyVisited = new Set(existingVisits.map((v) => v.locationId));
      const newLocationIds = travel.pathIds.filter((locId) => !alreadyVisited.has(locId));
      if (newLocationIds.length > 0) {
        await tx.locationVisit.createMany({ data: newLocationIds.map((locationId) => ({ saveId, locationId })) });
        isFirstVisitToDestination = newLocationIds.includes(travel.toLocationId);
      }
      // Cierre de misión "llegar a Y" (roadmap 2026-07-20, P1 de Fable, Quest.targetLocationId):
      // llegar de verdad al destino (no solo pasar por un nodo intermedio del camino) cierra sola
      // cualquier misión ACTIVA que lo tuviera como objetivo.
      await tx.quest.updateMany({
        where: { saveId, targetLocationId: travel.toLocationId, status: 'ACTIVA' },
        data: { status: 'COMPLETADA' },
      });
    }

    // Bug real jugando en vivo (revisión de partida 2026-08-08, "+525 XP" en un simple golpe de
    // combate, dos veces en dos partidas distintas, siempre justo al subir de nivel): `narration.hito`
    // viene de `JSON.parse(text) as NarrationResult` — una ASERCIÓN de tipo, nunca una validación
    // real en tiempo de ejecución. El propio comentario de `narrador.ts` § HitoTipo ya dice
    // "'capitulo' no está aquí porque ese lo emite el backend, no el modelo" — pero nada lo
    // impedía de verdad: si el modelo alucinaba igualmente la cadena "capitulo" en el JSON, este
    // `if` la aceptaba sin más, y `xpForHitos` se queda con el valor MÁS ALTO de todos los hitos de
    // este turno (500, el tope absoluto del juego) — un simple "ataco a un buitre" podía
    // autoconcederse la recompensa reservada para cerrar un capítulo entero de la historia.
    // Lista blanca explícita: solo los 3 tipos que de verdad puede proponer el modelo (ver
    // `narrador.ts` § HitoTipo) — "capitulo" solo puede entrar más abajo, vía `chapterDue`
    // (`claimChapterIfDue`, determinista, nunca decidido por el modelo).
    const HITOS_QUE_PUEDE_PROPONER_EL_MODELO: HitoTipo[] = ['descubrimiento', 'objetivo_menor', 'objetivo_mayor'];
    const hitos: HitoTipo[] = [];
    if (narration.hito && HITOS_QUE_PUEDE_PROPONER_EL_MODELO.includes(narration.hito)) hitos.push(narration.hito);
    if (isFirstVisitToDestination) hitos.push('descubrimiento');
    if (chapterDue) hitos.push('capitulo');

    // Auditoría 2026-07-28: en un turno de combate, `roll` (la tirada tabulada de
    // /turn/classify) ya no tiene relación con lo que de verdad pasó — eso lo decide
    // resolveExchange. `combatExchangeRoll` (el lado del jugador en el intercambio) manda
    // siempre que exista; `roll` solo se usa como estaba fuera de combate.
    const effectiveRoll: RollResult | null = combatExchangeRoll ?? roll ?? null;
    const xpTirada = effectiveRoll ? xpForRollSuccess(effectiveRoll.difficulty, effectiveRoll.success) : 0;
    const xpHito = Math.max(xpForHitos(hitos), reinoXp);
    const xpTurno = xpTirada + xpHito + questRewardXp;
    const result = applyXp(params.currentXp, params.currentLevel, xpTurno);

    // Eventos de viaje interactivos (2026-08-05): aviso determinista, ANTES de la narración de
    // llegada — nunca lo escribe el LLM (no sabe a dónde iba el jugador, y no debe inventarlo).
    // Sin esto, el jugador podía acabar en una ubicación distinta a la pedida sin ninguna señal
    // más allá de leer con atención la narración de llegada. `nextBeforeMainLogCreatedAt` (ver
    // comentario al principio de la transacción) — offset fijo respecto a `mainLogEntry`, no reloj
    // real, para que el orden sea correcto sin importar cuánto trabajo real pase entre ambas filas.
    if (travelInterruptionOriginalDestinationName) {
      await tx.logEntry.create({
        data: {
          saveId,
          channel: 'CHARACTER',
          text: `El camino hacia ${travelInterruptionOriginalDestinationName} se corta antes de tiempo — algo te sale al paso.`,
          timeLabel,
          fictionalMinutes: nuevoFictionalMinutes,
          createdAt: nextBeforeMainLogCreatedAt(),
          travelInterrupted: true,
        },
      });
    }

    const mainLogEntry = await tx.logEntry.create({
      data: {
        saveId,
        channel: 'CHARACTER',
        text: narration.narration,
        roll: effectiveRoll ? (effectiveRoll as unknown as Prisma.InputJsonValue) : undefined,
        // Bug real jugando en vivo (2026-08-13): sin persistir esto, recargar la partida perdía
        // el lado "Enemigo" del intercambio — `roll` de arriba solo guarda el lado del jugador.
        combatExchange: combatExchangeDisplay ? (combatExchangeDisplay as unknown as Prisma.InputJsonValue) : undefined,
        // Bug gemelo del de arriba (2026-08-14, encontrado al pedir que CombatExchangeBadge
        // mostrara el nombre real del NPC en vez de "el enemigo" — tras recargar, caía al
        // genérico porque esto tampoco se guardaba, solo viajaba en la respuesta HTTP del turno).
        npcAbilityUsed: npcAbilityUsed ? (npcAbilityUsed as unknown as Prisma.InputJsonValue) : undefined,
        playerAbilityUsed: playerAbilityUsed ? (playerAbilityUsed as unknown as Prisma.InputJsonValue) : undefined,
        // Tercer bug gemelo de la misma familia (2026-08-21, jugando en vivo: "al recargar la
        // página se está perdiendo el mensaje de la iniciativa y la tirada de los dados") — sin
        // persistir esto, recargar durante un combate abierto perdía el banner de quién tiene la
        // iniciativa para el próximo intercambio.
        initiativeRoll: nextInitiativeRoll ? (nextInitiativeRoll as unknown as Prisma.InputJsonValue) : undefined,
        timeLabel,
        xpDelta: xpTurno > 0 ? xpTurno : undefined,
        fictionalMinutes: nuevoFictionalMinutes,
        createdAt: mainLogEntryCreatedAt,
        // Rediseño de la vista de combate (2026-07-28): marca solo la narración PRINCIPAL de este
        // turno (no los logs secundarios de subida de nivel/desbloqueo de habilidad de más abajo,
        // que no son "narración de combate" en sí) — el frontend la pinta con fondo rojo.
        combate: !!enCombate,
      },
    });

    if (compassNarrationLine) {
      // Brújula (2026-08-15) — LogEntry aparte, construido a mano, NUNCA pasado por el Narrador:
      // todo el contenido (dirección/destino/terreno) ya se sabe con certeza mecánica. Mismo
      // patrón que la recompensa de misión de arriba, orden garantizado tras `mainLogEntry` vía
      // `nextAfterMainLogCreatedAt`.
      await tx.logEntry.create({
        data: {
          saveId,
          channel: 'CHARACTER',
          text: compassNarrationLine,
          isPlayerAction: false,
          timeLabel,
          fictionalMinutes: nuevoFictionalMinutes,
          createdAt: nextAfterMainLogCreatedAt(),
        },
      });
    }

    if (result.leveledUp) {
      const attributeNote =
        result.attributePointsGained > 0 ? ` Gana ${result.attributePointsGained} puntos de atributo para repartir.` : '';
      await tx.logEntry.create({
        data: {
          saveId,
          channel: 'CHARACTER',
          text: `${characterName} sube a nivel ${result.newLevel}.${attributeNote}`,
          timeLabel,
          fictionalMinutes: nuevoFictionalMinutes,
          createdAt: nextAfterMainLogCreatedAt(),
        },
      });

      // Habilidades de clase por nivel (roadmap de Fable, 2026-07-21) — se itera cada nivel
      // cruzado en este turno (no solo el final) para no saltarse un desbloqueo si una subida
      // de XP grande adelanta varios niveles de golpe. `isStarting: true`: son de diseño, no
      // creadas por la jugadora, así que no son editables ni borrables (mismo criterio que el
      // kit inicial — ver DetailModal.tsx/HabilidadesPanel.tsx).
      for (let lvl = params.currentLevel + 1; lvl <= result.newLevel; lvl++) {
        for (const ability of classAbilityUnlocksFor(characterName, lvl)) {
          await tx.savedAction.create({
            data: {
              saveId,
              name: ability.name,
              promptText: ability.promptText,
              icon: ability.icon,
              description: ability.description,
              category: ability.category,
              isStarting: true,
              effects: ability.effects ?? [],
              rol: ability.rol ?? null,
              preferredAttribute: ability.preferredAttribute ?? null,
              energyCost: ability.energyCost ?? 0,
              energyRegen: ability.energyRegen ?? 0,
              maxUsesPerCombat: ability.maxUsesPerCombat ?? null,
            },
          });
          await tx.logEntry.create({
            data: {
              saveId,
              channel: 'CHARACTER',
              text: `${characterName} desbloquea la habilidad de clase "${ability.name}".`,
              timeLabel,
              fictionalMinutes: nuevoFictionalMinutes,
              createdAt: nextAfterMainLogCreatedAt(),
            },
          });
        }
      }

      // Habilidades de arma "avanzada" (2026-07-29) — se desbloquean al cruzar el nivel máximo
      // (WEAPON_ABILITY_LEVEL_AVANZADA), sumándose a la básica sin reemplazarla. Resincroniza
      // TODAS las dinámicas (racial + arma) por simplicidad — mismo resultado que dejaría el
      // endpoint de equipar, solo que aquí dispara por nivel en vez de por cambio de equipo.
      if (params.currentLevel < WEAPON_ABILITY_LEVEL_AVANZADA && result.newLevel >= WEAPON_ABILITY_LEVEL_AVANZADA) {
        await syncDynamicCombatAbilities(tx, saveId, raza, result.newLevel, equippedWeaponSlotsForAbilities);
      }
    }

    // Habilidades de oficio (professionAbilities.ts) — independiente de si el PERSONAJE subió de
    // nivel este turno (es el nivel del OFICIO el que importa, ver awardProfessionXp más arriba).
    // isStarting:true (mismo criterio que las de clase): son de diseño, no creadas a mano por la
    // jugadora, así que no son editables ni borrables desde el panel de Habilidades.
    for (const { oficio, nivel, ability } of unlockedProfessionAbilities) {
      await tx.savedAction.create({
        data: {
          saveId,
          name: ability.name,
          promptText: ability.promptText,
          icon: ability.icon,
          description: ability.description,
          category: ability.category,
          isStarting: true,
        },
      });
      await tx.logEntry.create({
        data: {
          saveId,
          channel: 'CHARACTER',
          text: `${characterName} desbloquea la habilidad de oficio "${ability.name}" (nivel ${nivel} de ${oficio}).`,
          timeLabel,
          fictionalMinutes: nuevoFictionalMinutes,
          createdAt: nextAfterMainLogCreatedAt(),
        },
      });
    }

    // Condición física, descanso y muerte (docs/14 § 1, § 4) — en este orden: primero se fija
    // si esta acción cuenta como descanso válido, luego se resuelve la transición de condición
    // física (que puede sobreescribir la posición si el personaje muere y reaparece).
    let finalCondicion: CondicionFisica = proposedCondicion;
    let finalCurrentLocationId: string | undefined = travel ? travel.toLocationId : undefined;
    let finalLastRestLocationId: string | undefined;
    let finalDeathCount = params.deathCount;
    let finalEndedAt: Date | undefined;
    let finDePartidaResult = false;
    // Sistema de fatiga: un respawn sobrevivible reaparece con la energía llena, mismo criterio
    // que la condición física vuelve a ILESO.
    let finalEnergia = nuevaEnergia;

    // Punto de guardado (2026-08-04, docs/17-reglas-construcciones-reino.md): solo descansar en
    // una construcción PROPIA activa mueve el respawn — un refugio/asentamiento ajeno sigue
    // curando igual (`restSucceeds` ya lo cubre arriba), pero ya no actualiza dónde reapareces.
    if (restSucceeds && currentLocationRecord) {
      const ownBuildingHere = await tx.building.findFirst({
        where: { saveId, locationId: currentLocationRecord.id, status: 'ACTIVO' },
        select: { id: true },
      });
      if (ownBuildingHere) {
        finalLastRestLocationId = currentLocationRecord.id;
      }
    }

    if (proposedCondicion === 'MUERTO') {
      const outcome = resolveDeathOutcome(params.dificultad, params.deathCount);
      finalDeathCount = outcome.deathCount;
      if (outcome.finDePartida) {
        finDePartidaResult = true;
        finalEndedAt = new Date();
        finalCondicion = 'MUERTO';
      } else {
        const respawnLocationId =
          params.lastRestLocationId ?? (await resolveInitialLocationId(tx, worldId, characterName)) ?? currentLocationId ?? undefined;
        const respawnLocation = respawnLocationId ? await tx.location.findUnique({ where: { id: respawnLocationId } }) : null;
        // Recupera la construcción propia (2026-08-04, petición explícita: "vuelve al último
        // momento que descansaste en el campamento, recuperando el campamento si fuese así") — si
        // era tu punto de guardado y quedó DANADO/ABANDONADO mientras tanto, reaparecer aquí la
        // devuelve a ACTIVO en el mismo momento, nunca te deja "sin base" tras morir una vez.
        if (respawnLocationId) {
          await tx.building.updateMany({
            where: { saveId, locationId: respawnLocationId, status: { in: ['DANADO', 'ABANDONADO'] } },
            data: { status: 'ACTIVO' },
          });
        }
        await tx.logEntry.create({
          data: {
            saveId,
            channel: 'CHARACTER',
            text: whisperText(characterName, respawnLocation?.name ?? 'un lugar que reconoce', outcome.avisoUltimaVez),
            timeLabel,
            fictionalMinutes: nuevoFictionalMinutes,
            createdAt: nextAfterMainLogCreatedAt(),
          },
        });
        finalCondicion = 'ILESO';
        finalCurrentLocationId = respawnLocationId;
        finalEnergia = energiaMax;
      }
    }

    await tx.save.update({
      where: { id: saveId },
      data: {
        lastPlayedAt: new Date(),
        xp: result.newXp,
        level: result.newLevel,
        pendingAttributePoints: { increment: result.attributePointsGained },
        currentLocationId: finalCurrentLocationId,
        condicionFisica: finalCondicion,
        salud: saludForCondicion(finalCondicion),
        energia: finalEnergia,
        lastRestLocationId: finalLastRestLocationId,
        deathCount: finalDeathCount,
        endedAt: finalEndedAt,
        // Rediseño del turno de combate (2026-07-28): guarda el ataque de NPC decidido para el
        // PRÓXIMO intercambio (si la iniciativa lo favorece) o limpia el de este turno, ya
        // consumido — nunca sobrevive más de un intercambio sin resolverse.
        pendingNpcAttack: nuevoPendingNpcAttack ? (nuevoPendingNpcAttack as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    return {
      progression: result,
      condicionFisica: finalCondicion,
      energia: finalEnergia,
      energiaMax,
      finDePartida: finDePartidaResult,
      justDied: proposedCondicion === 'MUERTO',
      newInventoryItems,
      removedInventoryItemIds,
      updatedInventoryItems,
      logEntryId: mainLogEntry.id,
      newQuestObjetivos,
      newQuestInfo,
      questCompletedInfo,
      newKingdomFounded,
      companionCreated,
      partiallyLootedSlugs,
      deathCount: finalDeathCount,
    };
    },
    // `timeout`/`maxWait` explícitos (auditoría 2026-07-30: mismo bug real de partida ya
    // encontrado y arreglado en saves/creation.ts — el pool de Supabase, eu-west-3, pgbouncer=true,
    // más la latencia real desde la Steam Deck superan de sobra el timeout por defecto de Prisma
    // [5s] en cuanto una transacción interactiva encadena varios awaits secuenciales, cerrándola a
    // mitad de camino con `PrismaClientKnownRequestError P2028: Transaction not found`). Esta es la
    // transacción MÁS pesada de todo el motor — corre en cada turno y puede encadenar saqueo,
    // despiece, producción, crafteo, construcción, cierre de misión, XP/progresión de nivel y
    // reputación de facción, todo secuencial — y era la única sin este margen ya aplicado en
    // /saves y /saves/:id/restart.
    { maxWait: 10_000, timeout: 30_000 },
    );
  } catch (err) {
    if (chapterDue) releaseChapterClaim(saveId);
    throw err;
  }
  const {
    progression,
    condicionFisica,
    energia,
    energiaMax: energiaMaxResult,
    finDePartida,
    justDied,
    newInventoryItems,
    removedInventoryItemIds,
    updatedInventoryItems,
    logEntryId,
    newQuestObjetivos,
    newQuestInfo,
    questCompletedInfo,
    newKingdomFounded,
    companionCreated,
    partiallyLootedSlugs,
    deathCount: finalDeathCountResult,
  } = transactionResult;
  // La transacción hizo commit de verdad — ahora sí se dispara la generación lenta de fondo (ver
  // el comentario de `chapterDue` más arriba).
  if (chapterDue) {
    void scheduleChapterSummaryGeneration(saveId, characterName);
  }
  // Captura en vivo para el pipeline DPO (plan "IA local propia", fase 2, 2026-08-11) — nunca
  // bloquea el turno, dispara DESPUÉS del commit, mismo patrón que scheduleChapterSummaryGeneration
  // de arriba. Solo en turnos narrados de verdad por el LLM (wasLlmNarrated) — las ramas
  // deterministas de saqueo/construcción/cosecha/Gistera-guionizada no tienen ningún prompt real
  // que comparar contra un profesor cloud. Cubre también el camino diferido de worldTick.ts sin
  // cableado aparte: ambos convergen en esta misma función.
  if (wasLlmNarrated) {
    void captureLiveTeacherExample({ saveId, worldId, ctx: narrationCtx, localNarration: narration, localModel: env.ollamaModelNarrador });
  }
  // Persistencia de hechos nuevos (2026-07-30, ver worldFacts.ts): fuera de la transacción a
  // propósito — embebe cada hecho nuevo vía Ollama, mismo criterio que `narrateAction`/`retrieveLore`
  // de no bloquear una transacción de DB con una llamada externa lenta.
  if (narration.newFacts.length) {
    await appendSessionFacts(saveId, sessionFacts, narration.newFacts);
  }

  // Decide con qué NPCs se abre/persiste el popup de combate este turno — ver
  // `resolveCombatSlugsAndPersist` más arriba (red de seguridad contra un `combateIniciado` que
  // el modelo olvida o propone mal, temperamento AGRESIVO/ENEMIGO forzando combate solo,
  // decapitar/saqueo parcial siempre incluidos, y la persistencia en `Save.pendingCombatNpcSlugs`
  // para sobrevivir a una resincronización).
  const { combateIniciado } = await resolveCombatSlugsAndPersist({
    saveId,
    action,
    enCombate,
    narration,
    npcsInScene,
    npcsInSceneVivos,
    factionsStatus,
    condicionFisicaJugador: params.condicionFisica,
    explicitTarget,
    exchangeHappened,
    npcAttackTarget,
    npcAttackHits,
    npcTargetNewCondicion,
    executeTargets,
    partiallyLootedSlugs,
    analizarRivalExito,
  });

  // Log de diagnóstico por turno (roadmap 2026-07-20, prioridad P0 de Fable): una línea
  // estructurada con qué detectores dispararon y con qué resultado. Los 3 bugs reales de hoy
  // (worker de tránsitos a 20 min, una errata saltándose matchNpcAliases, el RAG de "El mundo"
  // trayendo otra región) habrían sido visibles al instante con esto, en vez de tener que
  // reconstruirlos a mano leyendo LogEntry/NpcState directamente en la base de datos.
  console.log(
    '[turno]',
    JSON.stringify({
      saveId,
      action,
      enCombate: !!enCombate,
      npcsInScene: npcsInScene.map((n) => n.slug),
      lootMode,
      harvestSource: harvestMatch?.sourceSlug ?? null,
      harvestRequierePresaPrevia: harvestMatch?.requierePresaPrevia ?? false,
      itemRefNoun: itemRef?.noun ?? null,
      itemRefPosee: itemRef?.posee ?? null,
      npcAttackTarget: npcAttackTarget?.slug ?? null,
      npcAttackHits,
      combateIniciado: combateIniciado ? combateIniciado.npcs.map((n) => n.slug) : null,
      gradoExito: combatExchangeRoll?.gradoExito ?? roll?.gradoExito ?? null,
      newInventoryItemsCount: newInventoryItems.length,
    }),
  );

  // Enciclopedia progresiva (sesión de diseño 2026-07-23) — se escanea SOLO lo nuevo de este
  // turno (narración + new_facts); lo de turnos anteriores ya quedó en DiscoveredEntity.
  await recordEntityDiscoveries({
    saveId,
    worldId,
    mentionedText: [narration.narration, ...narration.newFacts, ...newQuestObjetivos].join('\n'),
  });

  // Ver comentario de `quests` en NarrateAndPersistResult — se consulta la lista completa ya
  // fuera de la transacción (que a estas alturas ya ha hecho commit), en vez de rastrear un
  // delta a mano por los varios sitios de este archivo que pueden crear/cerrar una misión.
  const questRows = await prisma.quest.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } });
  // Mismo cruce Location/Npc que routes/saves/detail.ts (GET /saves/:id) — la marca de misión en
  // el mapa (MapaPanel.tsx) necesita el mismo `targetLocationSlug` real aquí, no solo tras una
  // recarga completa.
  const questTargetLocationIds = questRows.map((q) => q.targetLocationId).filter((id): id is string => Boolean(id));
  const questTargetNpcIds = questRows.map((q) => q.targetNpcId).filter((id): id is string => Boolean(id));
  const [questTargetLocations, questTargetNpcs] = await Promise.all([
    questTargetLocationIds.length ? prisma.location.findMany({ where: { id: { in: questTargetLocationIds } } }) : Promise.resolve([]),
    questTargetNpcIds.length ? prisma.npc.findMany({ where: { id: { in: questTargetNpcIds } } }) : Promise.resolve([]),
  ]);
  const locationSlugById = new Map(questTargetLocations.map((l) => [l.id, l.slug]));
  const npcHomeLocationSlugById = new Map(questTargetNpcs.map((n) => [n.id, n.homeLocationSlug]));
  const quests = questRows.map((q) => {
    // Dos pasos en vez de un único `??` anidado en tres niveles (bug real, auditoría 2026-07-30:
    // TS 6.0.2 marca la versión de una sola expresión como "always nullish" — falso positivo del
    // checker sobre este patrón concreto, confirmado con un repro aislado; mismo arreglo que
    // routes/saves/detail.ts).
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
  });

  // Ver comentario de `territories`/`buildings`/`subjects`/`kingdomStats` en NarrateAndPersistResult
  // — mismo criterio que `quests`: listas completas ya fuera de la transacción, no un delta a mano.
  const [territoryRows, buildingRows, subjectRows, kingdomStatsRow, freshWorldState, freshProfessionProgress] = await Promise.all([
    prisma.territory.findMany({ where: { saveId }, orderBy: { acquiredAt: 'asc' } }),
    prisma.building.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } }),
    prisma.subject.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } }),
    prisma.kingdomStats.findUnique({ where: { saveId } }),
    // deathCount/factionsStatus/professionProgress (auditoría 2026-08-06, bug real): las tres se
    // mutan dentro de la transacción de este mismo turno (combate/decapitar/crafteo) pero nunca
    // viajaban de vuelta al frontend — GameView.tsx solo las actualizaba en `syncFromSave`, así que
    // el jugador veía el contador de muertes, la pestaña Reputación o Profesiones desactualizados
    // hasta recargar del todo. Mismo criterio que quests/territories: se releen ya fuera de la
    // transacción (que a estas alturas ya hizo commit), nunca se rastrea el delta a mano.
    prisma.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true, fictionalDateLabel: true } }),
    prisma.professionProgress.findMany({ where: { saveId } }),
  ]);
  const freshFactionsStatus = parseFactionsStatus(freshWorldState?.factionsStatus);
  const professionProgress = freshProfessionProgress.map((p) => ({ professionId: p.professionId, nivel: p.nivel, xp: p.xp }));
  const territories = territoryRows.map((t) => ({
    id: t.id,
    name: t.name,
    region: t.region,
    description: t.description,
    control: t.control,
    population: t.population,
  }));
  const buildings = buildingRows.map((b) => ({
    id: b.id,
    territoryId: b.territoryId,
    locationId: b.locationId,
    recipeKey: b.recipeKey,
    tier: b.tier,
    name: b.name,
    kind: b.kind,
    status: b.status,
    description: b.description,
  }));
  const subjects = subjectRows.map((s) => ({ id: s.id, territoryId: s.territoryId, name: s.name, role: s.role, notes: s.notes }));
  const kingdomStats = kingdomStatsRow
    ? {
        poblacion: kingdomStatsRow.poblacion,
        felicidad: kingdomStatsRow.felicidad,
        comida: kingdomStatsRow.comida,
        bebida: kingdomStatsRow.bebida,
        riqueza: kingdomStatsRow.riqueza,
        soldados: kingdomStatsRow.soldados,
        trabajadores: kingdomStatsRow.trabajadores,
        visitantes: kingdomStatsRow.visitantes,
      }
    : null;

  return {
    narration,
    progression,
    condicionFisica,
    energia,
    energiaMax: energiaMaxResult,
    // Reloj de ficción (bug real, petición explícita 2026-08-14: "se logea mal la hora" + "un
    // combate... sin narrarlo ni avisarlo" justo después de una acción sin coste de tiempo) — hasta
    // ahora `/turn/narrate` nunca devolvía la hora nueva tras avanzar el reloj (`nuevaFictionalDateLabel`,
    // calculado arriba y ya persistido en `WorldState` dentro de la transacción): el frontend
    // (`GameView.tsx`) solo fijaba su `fictionalDate` una vez, al cargar la partida (`syncFromSave`),
    // y sellaba CADA entrada de log nueva con ese mismo valor congelado el resto de la sesión en
    // vivo — turnos posteriores que sí avanzaban tiempo de verdad en la BD se mostraban con una hora
    // vieja, haciendo parecer que dos sucesos muy separados en el tiempo pasaron "a la vez" o en
    // orden incoherente. Releído fresco tras el commit (igual que `factionsStatus` arriba) en vez de
    // threading manual desde dentro de la transacción — misma fuente de verdad que ya persiste ahí.
    timeLabel: freshWorldState?.fictionalDateLabel ?? nuevaFictionalDateLabel,
    combateIniciado,
    finDePartida,
    justDied,
    newInventoryItems,
    removedInventoryItemIds,
    updatedInventoryItems,
    logEntryId,
    quests,
    newQuestInfo,
    questCompletedInfo,
    newKingdomFounded,
    companionCreated,
    esperandoDefensaJugador: !!nuevoPendingNpcAttack,
    npcAbilityUsed,
    combatExchangeDisplay,
    playerAbilityUsed,
    nextInitiativeRoll,
    territories,
    buildings,
    subjects,
    kingdomStats,
    deathCount: finalDeathCountResult,
    factionsStatus: freshFactionsStatus,
    professionProgress,
  };
}
