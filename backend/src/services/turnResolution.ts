import { registrarFinDeMision, registrarSucesoDeNpc } from './cronista/emisores.js';
import { env } from '../config/env.js';
import { applyLootMode, applyCombatExchangeToNpcState, applyKillSideEffects, applyHarvest, applyFactionRepDeltaForResolution, goirnosDeBotin, pickFlavor, LOOT_FLAVOR_SUCCESS, LOOT_FLAVOR_EMPTY, HARVEST_FLAVOR_YA_DESPIEZADA } from './turnLootKill.js';

// Re-export: estos símbolos vivían aquí antes del corte de la Fase 12 (los importan otros módulos y tests).
export { applyFactionRepDeltaForResolution, applyKillSideEffects, goirnosDeBotin };
import { narrateAction, generateNpcReply, hasFalseTravelClaim, hasFalsePhantomTravel, type ClassificationResult, type NarrationResult } from './narrador.js';
import { retrieveLore, formatLoreForPrompt, isWeaklyGrounded } from './retrieval.js';
import { xpForRollSuccess, xpForHitos, labelForHitos, applyXp, type ProgressionResult, type HitoTipo } from './progression.js';
import { alivioForLevel, xpForCraftSuccess, professionLevelForXp } from './professionProgress.js';
import { DEFAULT_KINGDOM_STATS } from './kingdomTick.js';
import { runDailyTick } from './dailyTick.js';
import { assertExactlyOneOwner, ownerKeyFor } from './reinoOwner.js';
import { recordFactionEvent } from './factionRelations.js';
import { slugify } from '../lib/slugify.js';
import { appendSessionFacts, selectRelevantFacts } from './worldFacts.js';
import { closeItemQuests, completeNpcTargetQuests, grantQuestRewardItems, questRewardNarrationFor, GISTERA_DESPEDIDA_NARRATION, type QuestCompletedInfo } from './questResolution.js';
import { applyFactionRepDelta, effectiveTemperamento, resolveFoundingOutcome, parseFactionsStatus, FACTION_REP_PEACE_DELTA, REGION_OWNING_FACTIONS, type FoundingOutcome, type FactionRepChangeInfo } from './reputation.js';
import { regionControlActual, parseAgenda } from './worldAgenda.js';
import { opcionesDisponiblesPara } from './npcInteraction.js';
import { detectNpcsInScene, npcSceneBlockFor, npcSceneLineFor, difficultyHintFor, utilityDifficultyFor, detectsAttackIntent, detectsHostileSearchIntent, detectsDialogueIntent, detectsVerbalAcceptanceIntent, detectsLootIntent, detectsInventoryReviewIntent, scopeFor, pickAmbientEncounterCandidate, buildNpcInScene, candidateNpcNamesNotInScene, type NpcInScene, type NpcWithItems } from './npcScene.js';
import { resolveExchange, resolveIndependentExchange, rollInitiative, exchangeContextBlock, effectiveExchangeOutcome, independentExchangeContextBlock, hitSeverityHint, utilityTriggered, isReactiveUtility, type PendingNpcAttack, type PendingCanalizacion, type InitiativeResult, type CombatExchangeDisplay } from './combatExchange.js';
import { npcCombatAbilitiesFor, chooseNpcAbility } from './npcCombatAbilities.js';
import { detectHarvest } from './harvest.js';
import { detectItemReference, detectMedicalItemUse, detectEnergyItemUse, detectsCompassUse, missingItemBlockFor } from './itemReference.js';
import { compassNarrationText, type CompassLinkInfo } from './compassNarration.js';
import { energiaMaxFor, energiaPasivaEntre, nextEnergia, restCooldownActivo } from './energy.js';
import { WEAPON_ABILITY_LEVEL_AVANZADA, dualWieldAdjustedDifficulty, weaponCategoryForRealAbilityName, type EquippedWeaponSlot } from './weaponAbilities.js';
import { syncDynamicCombatAbilities } from './dynamicAbilities.js';
import { CRAFTING_RECIPES, detectsCraftIntent, canCraft, craftRequisitoShortfalls, planCraftConsumption, hasToolForOficio, OFICIOS_CON_HERRAMIENTA_REQUERIDA } from './crafting.js';
import { detectsBuildIntent, checkRecipe, planRecipeConsumption, baseNameOf, quantityOf, CONSTRUCTION_RECIPES, companionSlotsForRecipeKey, computeBuildBlockedReason, buildingTierFor, type ConstructionRecipe, type RecipeCheck } from './construction.js';
import { shortfallLabel } from './requisitos.js';
import { inventorySummaryFor, type CatalogLookup, type InventoryRowLike } from './ingredients.js';
import { abilityUnlocksAlSubirANivel, savedActionDataFromAbility } from './classAbilities.js';
import { professionAbilityUnlocksFor } from './professionAbilities.js';
import type { StartingAbility } from './startingAbilities.js';
import { protectedFactsFor } from './protectedFacts.js';
import { lintRegionMismatch } from './narrationLint.js';
import { stripRegionArticle } from './population.js';
import { startEagerTransitResolution } from '../workers/worldTick.js';
import { destinationsFrom, normalizeText, matchDestination, detectsTravelIntent, detectsVagueMovementIntent, cardinalDirectionBetween, resolveTravelToLocationId, segundosRealesPorTramos, type TravelResolution } from './travel.js';
import { detectsRestIntent, type Produccion } from './timedActions.js';
import { puntoDeEntradaParaDireccion, posicionesDeSalidas, direccionDeEntrada, posicionDeObjetivo, minutoDeReaparicion, moverJugadorA, volverAEntrada, celdaDePixel, mismaCelda, celdaAdyacenteOMisma } from './zonaPosicion.js';
import { claimChapterIfDue, scheduleChapterSummaryGeneration, releaseChapterClaim } from './chapterSummary.js';
import { captureLiveTeacherExample } from './liveTeacherCapture.js';
import { recordEntityDiscoveries } from './entityDiscovery.js';
import { detectsSearchIntent } from './discovery.js';
import { PURSUER_REFERENCE_REGEX, PURSUER_NAME_REFERENCE_REGEX } from './playerActionValidation.js';
import { nextCondicionFisica, resolveDeathOutcome, whisperText, isValidRestLocationKind, isCondicionDowngrade, nextCondicionForAttack, saludForCondicion, saludBandFor, healCeilingFor, applySequentialHeals, npcRecoversFromConvaleciente, npcCorpseShouldDespawn } from './death.js';
import { capturaEnInventarioExpiro, lastAtMinutesForGanancia, comidaPct, aguaPct, COMIDA_MINUTOS_POR_TRAMO, AGUA_MINUTOS_POR_TRAMO } from './companionSupervivencia.js';
import { ownRacialAdvantageFor, rivalRacialDisadvantageAgainst } from './racialPassives.js';
import { continentForRegion, oppositeContinent } from '../lib/continent.js';
import { advanceFictionalMinutes, formatFictionalDate, entornoTemporalFor, momentoDelDiaFor, type EntornoTemporal } from './worldClock.js';
import { faunaMomentoDelDia } from '../scripts/worldCatalog.js';
import { recalcularZonePointsDeLocation, zonePointsSummaryFor } from './zonePoints.js';
import { decideOfertaModoDinamico, dynamicModeCandidateNameFor, COOLDOWN_MODO_DINAMICO_MINUTOS } from './dynamicMode.js';
import { resolverTurnoJugador, resolverTurnosAutonomosHastaJugadora, fijarEleccionRondaJugador, type AccionJugadorCombate } from './combateMultipleOrquestacion.js';
import { invalidateCarcassRollCache } from '../routes/saves/recolectar.js';
import { instanceNumbersByParticipantId, resolverObjetivoPorTexto, type HabilidadParaIntercambio } from './combateMultiple.js';
import { prisma } from '../lib/prisma.js';
import { registrarSuceso } from './cronista/sucesos.js';
import { effectiveAttributesConDuracion, pushActiveEffect, decrementActiveEffects, type ActiveEffect } from './activeEffects.js';
import type { RollResult, AttributeBlock, Attribute, GradoExito } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';
import { Prisma } from '@prisma/client';
import type { CondicionFisica, Dificultad, AbilityEffect, AbilityRol, Clase, Especializacion } from '@prisma/client';
import { ambitoFacciones, ambitoPoblacion, asegurarMundoDePartida } from './mundoPartida.js';

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

interface NarrateAndPersistParams {
  saveId: string;
  worldId: string;
  action: string;
  characterSummary: string;
  characterName: string;
  /// Fuente real para `classAbilityUnlocksFor` (2026-08-29) — puede ser `null` en partidas que
  /// todavía no fijaron su clase (`PATCH /saves/:id/clase`, progression.ts).
  clase: Clase | null;
  /// B19 (pruebas 2026-09-28): las habilidades de ESPECIALIZACIÓN nunca se concedían al subir de
  /// nivel (solo al elegirla). Opcional: `undefined`/`null` = sin especialización elegida.
  especializacion?: Especializacion | null;
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
  /// Punto del jugador en el mapa de Zona (2026-09-04) — punto de ENTRADA ya guardado
  /// (`Save.zonaPosEntradaX/Y`), usado como destino al construir ("ocurre donde ya estás
  /// plantado"). `null`/`undefined` en partidas previas a esta pieza — el movimiento se omite.
  jugadorZonaPosEntradaX?: number | null;
  jugadorZonaPosEntradaY?: number | null;
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
  /// docs/mecanicas/14-combate-y-muerte.md § 1, § 4.
  condicionFisica: CondicionFisica;
  /// Sistema de fatiga (2026-07-29) — valor ACTUAL de energía antes de este turno; el tope real
  /// se deriva de `attributes.constitucion` (energy.ts § energiaMaxFor), nunca viaja aquí.
  energia: number;
  /// Habilidad "Comer/Beber" (2026-09-04) — timestamps ACTUALES de última comida/bebida
  /// (`Save.lastAteAtMinutes`/`lastDrankAtMinutes`), mismo criterio que `energia`: el caller ya
  /// tiene el `Save` cargado, no se vuelve a leer aquí. Ver `comidaPct`/`aguaPct`/
  /// `lastAtMinutesForGanancia` (companionSupervivencia.ts).
  lastAteAtMinutes: number | null;
  lastDrankAtMinutes: number | null;
  /// Cooldown de Descansar (2026-09-06, hallazgo 11) — `Save.lastRestAtMinutes` ACTUAL, mismo
  /// criterio que `lastAteAtMinutes`/`lastDrankAtMinutes`: el caller ya tiene el `Save` cargado.
  /// Null = nunca ha descansado en esta partida, sin cooldown que aplicar.
  lastRestAtMinutes: number | null;
  /// Fase 2 de efectos de clase (2026-08-26, docs/producto/21-roadmap.md) — AUMENTO/DEBILIDAD activos del
  /// jugador ahora mismo (Save.activeEffects, ya parseado por el caller con `parseActiveEffects`).
  /// `[]` en partidas previas a este campo o sin ningún efecto activo.
  activeEffects: ActiveEffect[];
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
  /// CANALIZAR real (2026-09-09) — `Save.pendingCanalizacion` leído por el caller (turn.ts), mismo
  /// criterio de origen que `pendingNpcAttack` de arriba.
  pendingCanalizacion?: PendingCanalizacion | null;
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
  /// Panel "Comer/Beber" (2026-09-04), mismo patrón exacto que `healItemUses` — lista ORDENADA de
  /// qué objetos de comida/bebida usar, validados contra `curaHambre`/`curaAgua` real del
  /// catálogo. `undefined`/vacío deja el comportamiento de siempre intacto (Hambre/Sed solo
  /// derivan del tiempo, nunca suben). El viejo booleano `beberAgua` (fijo, sin ítem, repone Sed
  /// al 100% en cualquier sitio) se retira con el hallazgo 13 (revisar-partida-hallazgos.md
  /// 2026-09-06, "el consumo de agua pasa a depender de un ítem odre") — reponer sed ahora exige
  /// de verdad un ítem con `curaAgua` (el odre lleno da 100, igual que el botón fijo daba antes).
  hambreSedItemUses?: { itemId: string; quantity: number }[];
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
  /// Franja 3 (2026-09-08, "Interactuar" motor unificado de eventos de escena) — posición real del
  /// jugador en el lienzo de Zona (`Save.zonaPosX/Y`, ambos call-sites ya la cargan sin `select`
  /// explícito, dato gratis) — usada para decidir si un agresivo detectado por texto está lo
  /// bastante cerca del `ZonePoint` real como para que el combate sea inevitable, o si hay margen
  /// para un preámbulo de Interactuar (`zonePointMasCercano`, zonaPosicion.ts). `null` = partida sin
  /// posición conocida (previa a esa pieza) — fallback seguro: combate directo, comportamiento
  /// idéntico al de siempre, nunca se activa el preámbulo sin dato real.
  zonaPosX?: number | null;
  zonaPosY?: number | null;
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
  /// Fase 2 de efectos de clase (2026-08-27, indicador de combate en CombatPanel.tsx) — AUMENTO/
  /// DEBILIDAD activos del JUGADOR tras este turno (ya con push/decremento aplicado, ver
  /// `resolveCombatExchangePhase`). Los del NPC viajan dentro de `combateIniciado.npcs[].
  /// activeEffects`, no aquí — el jugador no tiene una fila propia en ese array.
  activeEffects: ActiveEffect[];
  /// Estación/clima (2026-08-27, auditoría backend↔frontend) — recalculado fresco cada turno,
  /// mismo criterio que `timeLabel`.
  entorno: EntornoTemporal;
  /// Sistema de fatiga (2026-07-29) — energía real tras este turno y su tope actual (deriva de
  /// Constitución, ver energy.ts § energiaMaxFor), para que el frontend pinte la barra sin tener
  /// que recalcularlo por su cuenta.
  energia: number;
  energiaMax: number;
  /// Habilidad "Comer/Beber" (2026-09-04) — % de Hambre/Sed tras este turno, mismo criterio que
  /// `energia`/`energiaMax`: para que el frontend pinte las barras sin recalcularlo por su cuenta
  /// y sin esperar a la siguiente carga de partida.
  hambre: number;
  sed: number;
  /// Hora ficticia real tras este turno (worldClock.ts) — ver el comentario en el `return` de
  /// `narrateAndPersistTurn` para el bug que cierra: sin esto, el frontend no tenía forma de saber
  /// que el reloj había avanzado dentro de una sesión en vivo, y seguía sellando cada entrada nueva
  /// del log con la hora del último `syncFromSave` completo.
  timeLabel: string;
  /// Enriquecido con nombres y estado real (el modelo solo propone slugs, § 2.5) para que el
  /// frontend pueda mostrar el popup de combate ya sincronizado con `NpcState`, sin una consulta
  /// adicional ni asumir que todo NPC arranca ILESO/sin saquear.
  combateIniciado?: {
    npcs: {
      slug: string;
      name: string;
      condicionFisica: CondicionFisica;
      saqueado: boolean;
      lootedItemNames: string[];
      analizado: boolean;
      capturable: boolean;
      /// Fase 2 de efectos de clase (2026-08-27, indicador de combate en CombatPanel.tsx).
      activeEffects: ActiveEffect[];
    }[];
  } | null;
  finDePartida: boolean;
  /// Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — true cuando este turno mató al
  /// jugador pero NO agotó las vidas (`finDePartida` false): el frontend debe mostrar el susurro
  /// ya narrado junto a un botón, sin dejar seguir jugando, hasta que POST /saves/:id/death/resolve
  /// se llame. Mutuamente excluyente con `finDePartida` — nunca ambos true a la vez.
  pendingDeathResolution: boolean;
  /// Bug real (2026-07-29, "si muero no hace lo que fijamos que haría" en combate): cuando la
  /// muerte es sobrevivible (no dispara fin de partida), `condicionFisica` de abajo ya vuelve
  /// resuelta a ILESO (el respawn ya ocurrió en esta misma transacción, § 4.3 de
  /// docs/mecanicas/14-combate-y-muerte.md) — el frontend nunca podía distinguir "moriste y reapareciste
  /// este turno" de "no pasó nada", así que el combate en curso nunca se cerraba tras una muerte
  /// no definitiva (seguía el mismo combate como si el jugador no hubiera muerto). true siempre
  /// que este turno propuso MUERTO, sobreviva o no a `finDePartida`.
  ///
  /// Actualización 2026-08-31: con el botón Aceptar/Reintentar, `condicionFisica` YA NO vuelve a
  /// ILESO en este mismo turno cuando la muerte es sobrevivible — se queda en MUERTO hasta
  /// resolver. `justDied` sigue cumpliendo el mismo papel (cerrar el combate en curso), ahora
  /// coincidiendo siempre con `pendingDeathResolution || finDePartida`.
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
  /// Oferta de misión SIN aceptar todavía (2026-08-26, petición explícita: "botones Aceptar/
  /// Cancelar cuando un NPC ofrece una misión, en vez de depender de que la jugadora escriba texto
  /// libre para aceptar") — a diferencia de `newQuestInfo` (la misión YA se creó de verdad), esto
  /// solo marca que el modelo propuso una con anclaje real al mundo (mismo filtro que antes exigía
  /// para crearla) — la `Quest` no se crea hasta `POST /saves/:id/quests/aceptar`. `null` en la
  /// inmensa mayoría de turnos.
  newQuestOfferInfo: { title: string; description: string } | null;
  /// Menú contextual de interacción con NPC (2026-09-06, "Aprender oficio" deja de depender de una
  /// habilidad suelta) — solo para NPC con `Npc.interactionTypes` no vacío en el catálogo, al
  /// detectarse diálogo con ellos (`detectsDialogueIntent`). Mismo patrón que `newQuestOfferInfo`:
  /// tarjeta que CONVIVE con el resto de la UI, `null` en la inmensa mayoría de turnos.
  npcInteractionOffer: { npcSlug: string; npcName: string; options: string[] } | null;
  /// "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — oferta opcional de un
  /// botón "Interactuar" al FINAL de este turno (nunca lo interrumpe ni lo sustituye). El motor
  /// ya decidió determinista quién es el candidato (`decideOfertaModoDinamico`, dynamicMode.ts);
  /// la narración de la primera vuelta solo ocurre si el jugador pulsa Interactuar
  /// (`POST /saves/:id/modo-dinamico/interactuar`), para no gastar una llamada a Ollama en
  /// ofertas que nunca se aceptan. `null` en la inmensa mayoría de turnos — nunca se ofrece si
  /// este turno terminó en combate o si ya hay un modo dinámico en curso.
  dynamicModeOffer: { tipo: 'NPC' | 'FAUNA' | 'RECURSO'; targetSlug: string; targetName: string } | null;
  /// Retomar viaje truncado por un evento de interrupción (ronda de correcciones 2026-08-28, P3.2)
  /// — cuando este turno resuelve el evento sin dejar combate activo, el motor dispara solo la
  /// continuación del viaje original (nuevo `CharacterTransit`, mismo mecanismo diferido de
  /// siempre). `null` en la inmensa mayoría de turnos — solo se rellena el turno exacto en el que
  /// el viaje se retoma, informativo para el frontend (mismo criterio que `dynamicModeOffer`).
  travelResumed: { toLocationName: string; duracionMinutosResumen: number } | null;
  /// Notificación de misión COMPLETADA (2026-08-13, hallazgo real jugando: la narración de
  /// recompensa — questRewardNarrationFor — se persistía bien como LogEntry aparte, pero
  /// `/turn/narrate` nunca avisaba de que existía, así que ese turno el jugador solo veía la
  /// narración normal de combate; la entrada de recompensa aparecía sin más, sin destacar, y solo
  /// tras la siguiente recarga completa). Mismo criterio que `newQuestInfo`: `null` en la inmensa
  /// mayoría de turnos, que no completan ninguna.
  questCompletedInfo: QuestCompletedInfo | null;
  /// Feedback de UX (2026-08-30, petición explícita: "falta que la suma de repu o la perdida se
  /// refleje en la UX de alguna forma, sino el usuario ni se entera") — el delta de reputación de
  /// facción ya se aplicaba y persistía desde 2026-07-19 (matar/dejar convaleciente a un NPC de
  /// facción), pero nunca llegaba al jugador. `null` en la inmensa mayoría de turnos (solo se
  /// rellena cuando este turno mató/incapacitó a un NPC con `faction` real).
  factionRepChange: FactionRepChangeInfo | null;
  /// Feedback de UX (2026-09-04, misma petición que `factionRepChange` de arriba, ver auditoría
  /// "representar siempre XP/profesión/reputación") — crafteo/construcción exitosos con `oficio`
  /// asignado ya subían XP/nivel de oficio de verdad, pero ese delta nunca llegaba estructurado al
  /// frontend, solo en un snapshot silencioso de `professionProgress` completo. `[]` en la
  /// inmensa mayoría de turnos (solo se rellena cuando este turno craftea/construye algo con
  /// oficio real de por medio) — un array porque, aunque hoy nunca ocurren dos a la vez, nada
  /// impide que un turno futuro dispare más de una ganancia (p.ej. una receta compuesta).
  professionXpGains: { oficio: string; xpDelta: number; newLevel: number; leveledUp: boolean }[];
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
  npcAbilityUsed: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa'; maxUsesPerCombat?: number | null; inofensivo?: true } | null;
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
  /// Saqueo/desuello de CombatEncounter (2026-08-25, Grupo 3 § Mundo determinista, Capa 4) —
  /// especies que quedaron caídas al RESOLVERSE ESTE turno un `CombatEncounter` real (`null` en la
  /// inmensa mayoría de turnos, que no cierran ningún combate múltiple). El frontend lo usa para
  /// mostrar el resumen de combate con el saqueo/desuello ya precargado — los datos reales (qué
  /// objetos hay de verdad) siguen viniendo del mismo `GET /saves/:id/recolectar/desollador` de
  /// siempre, este campo solo avisa de que hay algo nuevo que mirar y qué especie/cuántos.
  combatEncounterLootSummary: { npcId: string; slug: string; name: string; cantidad: number }[] | null;
  /// Hallazgo 38 (revisar-partida-hallazgos.md 2026-09-07) — el banner del log hoy lo decide
  /// siempre el FRONTEND por prioridad de mención en el TEXTO de la narración
  /// (`mentionedEntityBanner.ts`), así que un turno de llegada que también menciona a un NPC
  /// presente pierde el banner de la Location (prioridad NPC > Location, ver `TYPE_PRIORITY`).
  /// `null` en la inmensa mayoría de turnos (no viaje, o viaje pero no primera visita al destino)
  /// — cuando sí es la primera visita, el frontend debe forzar el banner de esta Location con
  /// prioridad absoluta sobre cualquier mención del texto, mismo criterio que "descubrimiento"
  /// merece más peso que cualquier otra entidad citada de pasada en la misma narración.
  discoveredLocationSlug: string | null;
}

export interface CombatExchangePhaseInput {
  combateActivo: boolean | null | undefined;
  npcParaIntercambio: NpcInScene | null;
  /// Pasivas raciales (2026-08-28, pendiente 2026-08-27 punto 4) — raza del JUGADOR (null =
  /// personaje sin raza asignada, partidas previas). La del NPC ya viaja en `npcParaIntercambio.raza`.
  jugadorRaza: string | null;
  /// Faerus ("ventaja en el primer intercambio de este combate") — mismo criterio EXACTO que
  /// `openingAmbush`: `!enCombate` en el turno de apertura de un combate nuevo. Un combate YA en
  /// marcha (`enCombate: true`) nunca vuelve a dar la ventaja, aunque cambie de NPC objetivo.
  isFirstExchangeOfCombat: boolean;
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
  /// Bonus de atributo fijo de la habilidad elegida por el jugador este turno (2026-08-24, ver
  /// comentario de `ExchangeParticipant.attributeBonus`, combatExchange.ts) — 0 en texto libre sin
  /// botón o si la habilidad elegida no lleva ninguno.
  abilityAttributeBonus: number;
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
  /// Fase 2 de efectos de clase (2026-08-26) — AUMENTO/DEBILIDAD activos de cada lado ahora
  /// mismo, ya parseados por el caller. `attributes`/`npcParaIntercambio.attributes` de arriba
  /// siguen siendo la base SIN estos efectos — `resolveCombatExchangePhase` calcula los
  /// "atributos efectivos" (base + suma con signo) antes de construir cualquier
  /// `ExchangeParticipant`, nunca al revés.
  jugadorActiveEffects: ActiveEffect[];
  npcActiveEffects: ActiveEffect[];
  /// Bonus/turnos de duración de la habilidad elegida este turno (2026-08-26, ver
  /// `SavedAction.durationEffectMagnitude/Turns`) — null si no lleva ninguno o en texto libre sin
  /// botón. Solo tiene efecto si `abilityEffects` incluye `AUMENTO`/`DEBILIDAD` Y el golpe base
  /// conecta de forma decisiva (`exchange.resultado === 'golpe_pleno'`, mismo margen ±10 que
  /// CONTRA/REFRACTAR) — camino no-independiente únicamente (ver comentario de aplicación más
  /// abajo, junto a `nextCondicionForAttack`).
  abilityDurationEffectMagnitude: number | null;
  abilityDurationEffectTurns: number | null;
  /// CANALIZAR real (2026-09-09, ver `PendingCanalizacion` en combatExchange.ts) — canalización
  /// del jugador ya en curso de un turno anterior, o `null`/`undefined` si no hay ninguna.
  pendingCanalizacion: PendingCanalizacion | null | undefined;
}

export interface CombatExchangePhaseResult {
  npcAttackTarget: NpcInScene | null;
  npcAttackHits: boolean;
  npcTargetNewCondicion: CondicionFisica | null;
  jugadorRecibeGolpe: boolean;
  jugadorGolpeEfectos: AbilityEffect[];
  nuevoPendingNpcAttack: PendingNpcAttack | null;
  /// CANALIZAR real (2026-09-09) — ver comentario largo junto a `nuevoPendingCanalizacion` (scope
  /// de la función) y `PendingCanalizacion` (combatExchange.ts).
  nuevoPendingCanalizacion: PendingCanalizacion | null;
  exchangeNarrationBlock: string | null;
  combatExchangeRoll: RollResult | null;
  npcAbilityUsed: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa'; maxUsesPerCombat?: number | null; inofensivo?: true } | null;
  /// Cara visible de las dos tiradas del intercambio (jugador y NPC), ver
  /// `CombatExchangeDisplay` (combatExchange.ts) — null si no hubo intercambio real este turno.
  combatExchangeDisplay: CombatExchangeDisplay | null;
  /// Habilidad del JUGADOR usada en este intercambio (nombre/icono/descripción de catálogo, ver
  /// `CombatExchangePhaseInput.selectedAbility`) — null en texto libre sin botón o sin intercambio.
  playerAbilityUsed: { name: string; icon: string; description: string; rol: 'ataque' | 'defensa' } | null;
  nextInitiativeRoll: InitiativeResult | null;
  exchangeHappened: boolean;
  /// Ver `hasFalseDefenseNarration` (narrador.ts) — true cuando este intercambio fue el bloque
  /// "CASO DEFENSA" (el jugador respondió a ciegas a un ataque del NPC ya decidido). El caller
  /// reenvía esto tal cual al `TurnContext` del narrador, sin recalcular nada.
  playerActedAsDefenderThisExchange: boolean;
  /// Ver `hasInoffensiveNpcNarratedAttacking` (narrador.ts) — true cuando `npcParaIntercambio`
  /// tiene `ataqueNatural` empezando por "No ataca" (mismo criterio exacto que bloquea el daño
  /// real más abajo en esta función). El caller reenvía esto tal cual al `TurnContext` del
  /// narrador, sin recalcular nada.
  npcAttackerIsInoffensive: boolean;
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
  /// Fase 2 de efectos de clase (2026-08-26) — `CombatExchangePhaseInput.jugadorActiveEffects/
  /// npcActiveEffects` ya con los nuevos AUMENTO/DEBILIDAD de este intercambio empujados (si los
  /// hubo) y decrementados un turno (si `exchangeHappened`) — listos para persistir tal cual. El
  /// caller los sobreescribe a `[]` si la condición de ese lado vuelve a ILESO este mismo turno
  /// (mismo criterio de reset que `NpcState.abilityUsesThisEncounter`), no esta función.
  jugadorActiveEffectsNext: ActiveEffect[];
  npcActiveEffectsNext: ActiveEffect[];
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
  // CONTROL en 1vs1 (2026-08-26) — simplificado a robar la iniciativa (mismo efecto mecánico que
  // ATURDIMIENTO): sin un segundo rival real al que redirigir, "tomar el control" se narra como
  // desorientar/imponerse un instante, nunca como una posesión de varios turnos.
  CONTROL: (triggered, userName, rivalName) =>
    triggered
      ? `${userName} impone su voluntad sobre ${rivalName} por un instante — ${userName} se queda con la iniciativa del próximo intercambio. Narra la imposición momentánea, sin que esto por sí solo hiera a nadie.`
      : `${userName} intenta imponer su voluntad sobre ${rivalName} pero no lo consigue esta vez (no atacó con daño, o el intento falla).`,
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
/// Pasivas raciales (2026-08-28) — combina "mi propia pasiva" (Goirntes/Faerus, depende de mi raza)
/// y "penalización que le impongo al rival" (Orcos/Nabieus, depende de SU raza + los efectos de MI
/// propia habilidad) para un lado del intercambio. Con el roster actual (cada pasiva es exclusiva
/// de su raza) las dos fuentes nunca coinciden a la vez sobre el mismo lado — la propia pasiva
/// gana si algún día sí colisionaran, por ser más específica de "quién soy" que "qué me ataca".
function racialAdvantageFor(
  ownRaza: string | null,
  ownRol: 'ataque' | 'defensa' | 'utilidad',
  ownEffects: AbilityEffect[],
  rivalAttribute: Attribute,
  rivalRaza: string | null,
  isFirstExchangeOfCombat: boolean,
): { rollMode: 'normal' | 'ventaja' | 'desventaja'; racialAdvantageReason?: string } {
  const own = ownRacialAdvantageFor(ownRaza, ownRol, rivalAttribute, isFirstExchangeOfCombat);
  if (own.rollMode !== 'normal') return own;
  return rivalRacialDisadvantageAgainst(rivalRaza, ownEffects);
}

function resolveCombatExchangePhase(input: CombatExchangePhaseInput): CombatExchangePhaseResult {
  const { npcParaIntercambio, pendingNpcAttack, pendingNpcStillHere, attributes, defensa, characterName, abilityEffects, abilityRol, jugadorRaza, isFirstExchangeOfCombat } = input;

  let npcAttackTarget: NpcInScene | null = null;
  let npcAttackHits = false;
  let npcTargetNewCondicion: CondicionFisica | null = null;
  // El jugador puede recibir un golpe en CUALQUIERA de los dos casos: si el NPC tiene la
  // iniciativa (ataque directo), o incluso atacando él mismo, si su ataque falla del todo y la
  // defensa del NPC es tan buena que de propina replica (`defensor_contragolpea`).
  let jugadorRecibeGolpe = false;
  let jugadorGolpeEfectos: AbilityEffect[] = [];
  // Fase 2 de efectos de clase (2026-08-26) — arrancan como los efectos YA activos de entrada (sin
  // intercambio real este turno, se quedan intactos tal cual). Los efectos NUEVOS de ESTE turno
  // (empujados dentro de las ramas no-independientes de abajo) viajan aparte en
  // `nuevosJugador/NpcActiveEffects` a propósito — si se empujaran directo sobre
  // `jugadorActiveEffectsNext`, el decremento de más abajo (`if (exchangeHappened)`) los envejecería
  // en el MISMO turno en que nacen, y un efecto de 1 turno (p.ej. Golpe Runa de Cólera, "se
  // mantiene para el siguiente turno") expiraría antes de que el turno siguiente llegara a leerlo.
  let jugadorActiveEffectsNext: ActiveEffect[] = input.jugadorActiveEffects;
  let npcActiveEffectsNext: ActiveEffect[] = input.npcActiveEffects;
  let nuevosJugadorActiveEffects: ActiveEffect[] = [];
  let nuevosNpcActiveEffects: ActiveEffect[] = [];
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
  // CANALIZAR (2026-09-09) — arranca conservando la canalización de entrada (caso normal: ningún
  // camino de este turno la afecta, sigue viva sin más). Se pone a `null` explícitamente cuando un
  // golpe decisivo la corta (CASO DEFENSA, más abajo), y se sustituye por una nueva cuando el
  // jugador empieza a canalizar (CASO ATAQUE) — el CASO CANALIZACIÓN (dispara el ataque diferido)
  // también la limpia a `null` tras resolverse, con éxito o sin él.
  let nuevoPendingCanalizacion: PendingCanalizacion | null = input.pendingCanalizacion ?? null;
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
  let npcAbilityUsed: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa'; maxUsesPerCombat?: number | null; inofensivo?: true } | null = null;
  // Tirada real de iniciativa que decide QUIÉN actúa en el próximo intercambio (2026-07-29, "quiero
  // que sea más claro cuando es turno de ataque... indicándome qué salió en los dados") — null
  // cuando la iniciativa se fuerza sin dados (aturdimiento/intimidación del turno anterior, ver
  // más abajo) o cuando no hubo intercambio de combate este turno.
  let nextInitiativeRoll: InitiativeResult | null = null;
  // Sistema de fatiga (2026-07-29) — hoisted fuera del bloque de abajo: hace falta después, al
  // calcular la energía de este turno, sepa o no haber intercambio real de combate.
  let exchangeHappened = false;
  // Ver `hasFalseDefenseNarration` (narrador.ts) — true cuando el jugador está en el bloque "CASO
  // DEFENSA" de más abajo (responde a ciegas a un ataque del NPC ya decidido el intercambio
  // anterior, `defensorRol === 'defensa'`) — señal para detectar si el modelo narra una escena de
  // búsqueda/reconocimiento del enemigo en vez de bloquear/esquivar el golpe recibido.
  let playerActedAsDefenderThisExchange = false;
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
  //
  // Hallazgo 17 (revisar-partida-hallazgos.md 2026-09-07) — un ataque de apertura fallido contra
  // fauna no agresiva (INOFENSIVO/CAUTELOSO) no debe sembrar `pendingNpcAttack` tampoco: la presa
  // escapa de verdad, no tiene sentido dejar al jugador "esperando defender" contra un NPC que ni
  // siquiera abrió combate (`resolveCombatSlugsAndPersist` ya no abre el panel en este caso) y que
  // además nunca ataca de verdad (`ataqueNatural: 'No ataca.'`, ya protegido aparte por
  // `npcAttackerIsInoffensive`). Temperamento de catálogo puro (sin reputación de facción, a
  // diferencia de `attackMissedNonAggressiveTarget` en `resolveCombatSlugsAndPersist`) — esta
  // función no recibe `factionsStatus`, y la fauna real afectada (Ruptidar y similares) no tiene
  // facción de todas formas.
  const npcTemperamentoNoAgresivo = npcParaIntercambio?.temperamento === 'INOFENSIVO' || npcParaIntercambio?.temperamento === 'CAUTELOSO';
  if (!input.combateActivo && input.openingAmbush && input.rollGradoExito === 'fallo' && npcParaIntercambio && !npcTemperamentoNoAgresivo) {
    const npcWeaponNames = npcParaIntercambio.items.filter((i) => i.category === 'arma').map((i) => i.name);
    const npcAbilities = npcCombatAbilitiesFor(npcParaIntercambio, npcWeaponNames);
    const npcEnergiaMaxAmbush = energiaMaxFor(npcParaIntercambio.attributes.constitucion);
    const npcEnergiaActualAmbush = npcParaIntercambio.energia ?? npcEnergiaMaxAmbush;
    const npcAtaque = chooseNpcAbility(npcAbilities, 'ataque', npcEnergiaActualAmbush, undefined, npcParaIntercambio.abilityUsesThisEncounter);
    nuevoPendingNpcAttack = {
      npcId: npcParaIntercambio.id,
      attribute: npcAtaque.attribute,
      attributeBonus: npcAtaque.attributeBonus ?? null,
      effects: npcAtaque.effects,
      rol: npcAtaque.rol,
      abilityName: npcAtaque.name,
      abilityDescription: npcAtaque.description,
      energyCost: npcAtaque.energyCost,
      energyRegen: npcAtaque.energyRegen,
      maxUsesPerCombat: npcAtaque.maxUsesPerCombat,
      durationEffectMagnitude: npcAtaque.durationEffectMagnitude ?? null,
      durationEffectTurns: npcAtaque.durationEffectTurns ?? null,
    };
    // Bug real jugando en vivo (2026-08-28, confirmado por la usuaria): el bloque de texto
    // "Iniciativa: tú X vs Y del enemigo" no salía en la ronda de apertura de combate — solo en
    // las siguientes. Causa: este camino sembraba `nuevoPendingNpcAttack` pero nunca calculaba
    // `nextInitiativeRoll`, así que el `LogEntry` de este turno quedaba sin `initiativeRoll` y el
    // frontend (`lastInitiativeRoll`, GameView.tsx) no tenía nada que mostrar hasta el segundo
    // intercambio. La emboscada YA decide que el NPC actúa primero (por eso siembra un ataque
    // pendiente) — tirar aquí también deja constancia de esa iniciativa con los mismos dados que
    // usa cualquier otro intercambio, en vez de dejarla implícita y sin narrar.
    const attributesEfectivosAmbush = effectiveAttributesConDuracion(attributes, input.jugadorActiveEffects);
    const npcAttributesEfectivosAmbush = effectiveAttributesConDuracion(npcParaIntercambio.attributes, input.npcActiveEffects);
    nextInitiativeRoll = rollInitiative(
      { attributes: attributesEfectivosAmbush, attribute: 'destreza', difficulty: 0, condicionFisica: input.condicionFisicaJugador, rol: 'utilidad' },
      { attributes: npcAttributesEfectivosAmbush, attribute: 'destreza', difficulty: 0, condicionFisica: npcParaIntercambio.condicionFisica, rol: 'utilidad' },
    );
  } else if (!input.combateActivo && input.openingAmbush && input.rollGradoExito !== 'fallo' && npcParaIntercambio) {
    // Hallazgo 14 (revisar-partida-hallazgos.md 2026-09-06, "la primera tirada de iniciativa de
    // un combate debe ser tirada del jugador vs tirada del enemigo, no una comparación contra una
    // dificultad fija") — hasta ahora, un ataque de apertura CON ÉXITO garantizaba la iniciativa
    // al jugador sin ninguna tirada real: sin `pendingNpcAttack` sembrado, el intercambio real del
    // turno siguiente caía directo en CASO ATAQUE (más abajo, `else` del `if
    // (pendingNpcAttack && pendingNpcStillHere)`) por simple ausencia de ataque pendiente — "quién
    // empieza" se decidía solo por si el propio ataque de apertura superaba `difficultyHintFor`
    // (dificultad fija por nivel del NPC), nunca por una tirada-vs-tirada Destreza real. Mismo
    // mecanismo que el bloque de fallo justo arriba (`rollInitiative` + `chooseNpcAbility`
    // sembrando `nuevoPendingNpcAttack`) — si el NPC gana esta tirada, el intercambio real del
    // turno siguiente entra en CASO DEFENSA aunque el jugador haya sido quien "atacó" primero en
    // el texto; si el jugador gana, no se hace nada (mismo comportamiento de siempre, CASO
    // ATAQUE). Alcance deliberadamente acotado a la apertura — rondas posteriores del combate
    // siguen igual (quien gana un intercambio mantiene la iniciativa hasta perderla, mismo
    // criterio ya existente).
    const attributesEfectivosAmbush = effectiveAttributesConDuracion(attributes, input.jugadorActiveEffects);
    const npcAttributesEfectivosAmbush = effectiveAttributesConDuracion(npcParaIntercambio.attributes, input.npcActiveEffects);
    const initiativeCheck = rollInitiative(
      { attributes: attributesEfectivosAmbush, attribute: 'destreza', difficulty: 0, condicionFisica: input.condicionFisicaJugador, rol: 'utilidad' },
      { attributes: npcAttributesEfectivosAmbush, attribute: 'destreza', difficulty: 0, condicionFisica: npcParaIntercambio.condicionFisica, rol: 'utilidad' },
    );
    nextInitiativeRoll = initiativeCheck;
    if (initiativeCheck.ganador === 'npc') {
      const npcWeaponNames = npcParaIntercambio.items.filter((i) => i.category === 'arma').map((i) => i.name);
      const npcAbilities = npcCombatAbilitiesFor(npcParaIntercambio, npcWeaponNames);
      const npcEnergiaMaxAmbush = energiaMaxFor(npcParaIntercambio.attributes.constitucion);
      const npcEnergiaActualAmbush = npcParaIntercambio.energia ?? npcEnergiaMaxAmbush;
      const npcAtaque = chooseNpcAbility(npcAbilities, 'ataque', npcEnergiaActualAmbush, undefined, npcParaIntercambio.abilityUsesThisEncounter);
      nuevoPendingNpcAttack = {
        npcId: npcParaIntercambio.id,
        attribute: npcAtaque.attribute,
        attributeBonus: npcAtaque.attributeBonus ?? null,
        effects: npcAtaque.effects,
        rol: npcAtaque.rol,
        abilityName: npcAtaque.name,
        abilityDescription: npcAtaque.description,
        energyCost: npcAtaque.energyCost,
        energyRegen: npcAtaque.energyRegen,
        maxUsesPerCombat: npcAtaque.maxUsesPerCombat,
        durationEffectMagnitude: npcAtaque.durationEffectMagnitude ?? null,
        durationEffectTurns: npcAtaque.durationEffectTurns ?? null,
      };
    }
  }

  if (input.combateActivo && npcParaIntercambio) {
    npcAttackTarget = npcParaIntercambio;
    const npcWeaponNames = npcParaIntercambio.items.filter((i) => i.category === 'arma').map((i) => i.name);
    const npcAbilities = npcCombatAbilitiesFor(npcParaIntercambio, npcWeaponNames);
    npcEnergiaMax = energiaMaxFor(npcParaIntercambio.attributes.constitucion);
    const npcEnergiaActual = npcParaIntercambio.energia ?? npcEnergiaMax;
    // Fase 2 de efectos de clase (2026-08-26) — atributos EFECTIVOS (base + AUMENTO/DEBILIDAD
    // activos), calculados UNA vez aquí y usados en las 4 ramas de abajo en vez de `attributes`/
    // `npcParaIntercambio.attributes` a secas. `attributes` (el parámetro base, ya con equipo
    // aplicado por el caller) se queda intacto para todo lo que no sea un intercambio real
    // (`rollInitiative` del PRÓXIMO intercambio sí debe usar la versión efectiva — un AUMENTO de
    // Fuerza cambia quién gana la iniciativa igual que cambiaría un golpe).
    const attributesEfectivos = effectiveAttributesConDuracion(attributes, input.jugadorActiveEffects);
    const npcAttributesEfectivos = effectiveAttributesConDuracion(npcParaIntercambio.attributes, input.npcActiveEffects);

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
      if (defensorRol === 'defensa') playerActedAsDefenderThisExchange = true;
      // Hallazgo 12 (revisar-partida-hallazgos.md 2026-09-06) — una utilidad del jugador que PARA
      // el ataque entrante (ATAQUE/ATURDIMIENTO/INTIMIDACION/CONTROL, ver isReactiveUtility) deja
      // de resolverse contra su propia dificultad fija: pasa a la tirada-vs-tirada directa de
      // `resolveExchange` (rama `else` de abajo), igual que una defensa normal — la dificultad de
      // utilidad no tiene sentido para "parar un golpe", eso siempre fue un contraste directo.
      const defensorParaAtaque = defensorRol === 'utilidad' && isReactiveUtility('utilidad', abilityEffects, pendingNpcAttack.rol);
      const esIndependiente = (pendingNpcAttack.rol === 'utilidad' || defensorRol === 'utilidad') && !defensorParaAtaque;
      if (esIndependiente) {
        const npcRacial = racialAdvantageFor(npcParaIntercambio.raza, pendingNpcAttack.rol, pendingNpcAttack.effects, input.classificationAtributo, jugadorRaza, isFirstExchangeOfCombat);
        const jugadorRacial = racialAdvantageFor(jugadorRaza, defensorRol, abilityEffects, pendingNpcAttack.attribute, npcParaIntercambio.raza, isFirstExchangeOfCombat);
        const independent = resolveIndependentExchange(
          {
            attributes: npcAttributesEfectivos,
            attribute: pendingNpcAttack.attribute,
            attributeBonus: pendingNpcAttack.attributeBonus ?? 0,
            difficulty: difficultyHintFor(input.currentLevel, npcParaIntercambio.level).dificultad,
            condicionFisica: npcParaIntercambio.condicionFisica,
            rol: pendingNpcAttack.rol,
            rollMode: npcRacial.rollMode,
            racialAdvantageReason: npcRacial.racialAdvantageReason,
          },
          {
            attributes: attributesEfectivos,
            attribute: input.classificationAtributo,
            attributeBonus: input.abilityAttributeBonus,
            // Hallazgo 12 — una utilidad NO reactiva del jugador (ANALISIS/RECUPERACION, las
            // reactivas ya se desviaron a `defensorParaAtaque` arriba) usa la escala nueva por
            // diferencia de atributos, no la de nivel — solo tiene sentido de verdad cuando
            // `defensorRol==='utilidad'`; si se defiende con 'defensa' normal, este lado no llega
            // aquí (cae directo a la rama `else`, más abajo).
            difficulty:
              defensorRol === 'utilidad'
                ? utilityDifficultyFor(npcParaIntercambio.attributes, attributesEfectivos).dificultad
                : difficultyHintFor(npcParaIntercambio.level, input.currentLevel).dificultad,
            condicionFisica: input.condicionFisicaJugador,
            // Bono de equipo de defensa (rediseño a check opuesto, 2026-08-21) — antes reducía la
            // propia dificultad vía `contraataqueDifficultyFor`; ahora se suma directo a la tirada
            // (`ExchangeParticipant.bonoTirada`, combatExchange.ts), como cualquier modificador
            // normal de D&D.
            bonoTirada: defensa,
            rol: defensorRol,
            rollMode: jugadorRacial.rollMode,
            racialAdvantageReason: jugadorRacial.racialAdvantageReason,
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
            // CONTROL en 1vs1 (2026-08-26, petición explícita: "si es 1vs1 CONTROL pasa a ser un
            // aturdimiento") — sin un segundo rival real al que redirigir ("controla al rival para
            // que ataque a sus aliados"), se simplifica al mismo gancho que ATURDIMIENTO: roba la
            // iniciativa un intercambio, en vez de los "2 turnos" reales de la habilidad. El
            // CONTROL real con redirección SÍ está construido desde 2026-08-27, pero solo en
            // combate múltiple (`combateMultipleOrquestacion.ts`, `CONTROL_RONDAS`) — este camino
            // 1v1 sigue con la simplificación de arriba a propósito, no por hueco sin cerrar.
            if (abilityEffects.includes('CONTROL')) {
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
        // Solo la pasiva PROPIA (Goirntes/Faerus) aplica en este camino — Orcos/Nabieus resisten
        // CONTROL/INTIMIDACION cuando llegan por el camino independiente de utilidad NO reactiva
        // (`resolveIndependentExchange`, arriba); aquí (hallazgo 12, revisar-partida-hallazgos.md
        // 2026-09-06) SÍ puede haber una utilidad reactiva del jugador (`defensorParaAtaque`,
        // desviada aquí desde arriba) con ATAQUE/ATURDIMIENTO/INTIMIDACION/CONTROL de por medio —
        // el resto de este camino (una defensa normal sin efecto) sigue igual.
        const jugadorRacialAtaqueCruzado = racialAdvantageFor(jugadorRaza, defensorRol, [], pendingNpcAttack.attribute, npcParaIntercambio.raza, isFirstExchangeOfCombat);
        const exchange = resolveExchange(
          {
            attributes: npcAttributesEfectivos,
            attribute: pendingNpcAttack.attribute,
            attributeBonus: pendingNpcAttack.attributeBonus ?? 0,
            difficulty: difficultyHintFor(input.currentLevel, npcParaIntercambio.level).dificultad,
            condicionFisica: npcParaIntercambio.condicionFisica,
            rol: pendingNpcAttack.rol,
          },
          {
            attributes: attributesEfectivos,
            attribute: input.classificationAtributo,
            attributeBonus: input.abilityAttributeBonus,
            difficulty: difficultyHintFor(npcParaIntercambio.level, input.currentLevel).dificultad,
            condicionFisica: input.condicionFisicaJugador,
            bonoTirada: defensa,
            rol: defensorRol,
            rollMode: jugadorRacialAtaqueCruzado.rollMode,
            racialAdvantageReason: jugadorRacialAtaqueCruzado.racialAdvantageReason,
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
        //
        // CONTRA/REFRACTAR (2026-08-26) — mismo gancho que ATAQUE, pero solo si el golpe entrante
        // era del tipo que cada una contesta: CONTRA solo físico (atributo del ataque del NPC
        // distinto de magia), REFRACTAR solo mágico (magia). El motor no distingue tipos de daño
        // de verdad (ver comentario del enum en schema.prisma) — se usa el atributo de la tirada
        // como proxy, tal como ya apuntaba ese mismo comentario. Cifra de margen: se reutiliza el
        // umbral decisivo ya existente (`defensor_contragolpea`, margen ±10) en vez de un umbral
        // propio por habilidad (6/8 según clases.md) — mismo criterio de simplificación que ya usa
        // LETAL (nextCondicionForAttack ignora el "diferencia de 8 vs 12" del doc, es binario).
        const jugadorPuedeContragolpear =
          abilityEffects.includes('ATAQUE') ||
          (abilityEffects.includes('CONTRA') && pendingNpcAttack.attribute !== 'magia') ||
          (abilityEffects.includes('REFRACTAR') && pendingNpcAttack.attribute === 'magia');
        const jugadorContragolpeaAplica = exchange.resultado === 'defensor_contragolpea' && jugadorPuedeContragolpear;
        // Hallazgo 12 — utilidad reactiva SIN daño propio (ATURDIMIENTO/INTIMIDACION/CONTROL,
        // `defensorParaAtaque` de arriba): con el mismo margen decisivo que exige un contragolpe
        // real, interrumpe al NPC en vez de golpearlo — INTIMIDACION además cancela el golpe base
        // entrante del todo (mismo comportamiento que ya tenía en el camino independiente).
        const jugadorInterrumpeAplica =
          exchange.resultado === 'defensor_contragolpea' &&
          (abilityEffects.includes('ATURDIMIENTO') || abilityEffects.includes('INTIMIDACION') || abilityEffects.includes('CONTROL'));
        if (jugadorInterrumpeAplica) iniciativaForzadaPorUtilidad = 'jugador';
        jugadorRecibeGolpe =
          !(jugadorInterrumpeAplica && abilityEffects.includes('INTIMIDACION')) &&
          (exchange.resultado === 'golpe_pleno' || exchange.resultado === 'golpe_normal');
        // `?? []` (auditoría de código 2026-08-17): un `pendingNpcAttack` persistido de antes del
        // rediseño a `effects: AbilityEffect[]` (2026-08-15) no tiene este campo — sin el
        // fallback, `nextCondicionForAttack` revienta con `effects.includes(...)` sobre
        // `undefined` en cuanto ese golpe conecte.
        jugadorGolpeEfectos = pendingNpcAttack.effects ?? [];
        // CANALIZAR (2026-09-09) — un golpe DECISIVO (`golpe_pleno`, no cualquier golpe) mientras
        // el jugador tenía una canalización en curso la corta: "si te golpean se corta la
        // canalización" (diseño confirmado por la usuaria) — se pierde el turno de canalizar por
        // completo, sin disparar el ataque diferido nunca.
        if (exchange.resultado === 'golpe_pleno' && input.pendingCanalizacion) {
          nuevoPendingCanalizacion = null;
        }
        // AUMENTO/DEBILIDAD (2026-09-09) — mismo umbral decisivo y misma cifra que el camino
        // simétrico del jugador atacando (línea ~1549): `golpe_pleno`, con el atributo de la
        // tirada de ESTA habilidad (`pendingNpcAttack.attribute`, no el del jugador). AUMENTO se
        // aplica a quien usó la habilidad (el NPC, aquí), DEBILIDAD a quien la recibió (el
        // jugador) — cierra el hueco real documentado en `classAbilities.ts` (ningún atacante
        // autónomo, NPC o Companion, podía generar estos efectos hasta ahora).
        if (exchange.resultado === 'golpe_pleno' && pendingNpcAttack.durationEffectMagnitude != null && pendingNpcAttack.durationEffectTurns != null) {
          const nuevoEfectoNpc: ActiveEffect = {
            attribute: pendingNpcAttack.attribute,
            magnitude: pendingNpcAttack.durationEffectMagnitude,
            turnsRemaining: pendingNpcAttack.durationEffectTurns,
            sourceAbility: pendingNpcAttack.abilityName,
          };
          if (pendingNpcAttack.effects.includes('AUMENTO')) nuevosNpcActiveEffects = pushActiveEffect(nuevosNpcActiveEffects, nuevoEfectoNpc);
          if (pendingNpcAttack.effects.includes('DEBILIDAD')) nuevosJugadorActiveEffects = pushActiveEffect(nuevosJugadorActiveEffects, nuevoEfectoNpc);
        }
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
      // CANALIZAR (2026-09-09, cierre de hueco de motor — bloqueaba capstones nv.40 de Tirador/
      // Rúnico/Convocador/Maestro Arquero/Maestro Ballestero/Berserker, todos ATAQUE+CANALIZAR+
      // LETAL). Diseño confirmado por la usuaria: "no da nada por sí solo, solo implica que la
      // habilidad tarda X turnos (1 si la ficha no especifica) — si te golpean se corta; el
      // bonus a la tirada final solo vendría de un AUMENTO explícito, ninguna ficha real lo
      // combina hoy" + "iniciativa normal, turno normal — si pierdo la iniciativa el turno de
      // canalizar, ahí es donde el NPC puede golpearme y cortarla". Aquí el jugador GANÓ la
      // iniciativa de este intercambio (CASO ATAQUE) — canalizar consume su turno de ataque sin
      // tirar ningún golpe (ni él ataca, ni el NPC contragolpea: no hay tabla cruzada que
      // resolver), pero la iniciativa del PRÓXIMO intercambio se decide con normalidad más abajo
      // (bloque `if (exchangeHappened)`), exactamente igual que un intercambio real — por eso
      // `exchangeHappened=true` aquí pese a no haber tirada de daño.
      if (input.pendingCanalizacion && input.pendingCanalizacion.npcId === npcParaIntercambio.id) {
        // CASO CANALIZACIÓN: el jugador ganó la iniciativa de este intercambio con una
        // canalización viva de un turno anterior (no se cortó en el CASO DEFENSA intermedio, ver
        // arriba) — se dispara el ataque real diferido con SU tirada normal (mismo camino
        // `resolveExchange` que un ataque directo, mismo umbral `golpe_pleno` para AUMENTO/
        // DEBILIDAD/CONTRA/etc.), ignorando la acción que mandó el frontend este turno.
        const canalizacion = input.pendingCanalizacion;
        const npcRacialCanalizacion = racialAdvantageFor(npcParaIntercambio.raza, npcDefensa.rol, [], canalizacion.attribute, jugadorRaza, isFirstExchangeOfCombat);
        const exchange = resolveExchange(
          {
            attributes: attributesEfectivos,
            attribute: canalizacion.attribute,
            attributeBonus: canalizacion.attributeBonus ?? undefined,
            difficulty: dificultadAtacante,
            condicionFisica: input.condicionFisicaJugador,
            rol: 'ataque',
          },
          {
            attributes: npcAttributesEfectivos,
            attribute: npcDefensa.attribute,
            attributeBonus: npcDefensa.attributeBonus ?? 0,
            difficulty: difficultyHintFor(input.currentLevel, npcParaIntercambio.level).dificultad,
            condicionFisica: npcParaIntercambio.condicionFisica,
            rol: npcDefensa.rol,
            rollMode: npcRacialCanalizacion.rollMode,
            racialAdvantageReason: npcRacialCanalizacion.racialAdvantageReason,
          },
        );
        const npcPuedeContragolpearCanalizacion =
          npcDefensa.effects.includes('ATAQUE') ||
          (npcDefensa.effects.includes('CONTRA') && canalizacion.attribute !== 'magia') ||
          (npcDefensa.effects.includes('REFRACTAR') && canalizacion.attribute === 'magia');
        npcAttackHits = exchange.resultado === 'golpe_pleno' || exchange.resultado === 'golpe_normal';
        npcTargetNewCondicion = npcAttackHits ? nextCondicionForAttack(canalizacion.effects, npcParaIntercambio.condicionFisica) : null;
        jugadorRecibeGolpe = exchange.resultado === 'defensor_contragolpea' && npcPuedeContragolpearCanalizacion;
        jugadorGolpeEfectos = jugadorRecibeGolpe ? npcDefensa.effects : [];
        if (!pendingNpcStillHere && canalizacion.effects.includes('LETAL')) {
          abilityEffectHint = npcAttackHits
            ? `EFECTO DE HABILIDAD — YA RESUELTO: la canalización se completa y el golpe letal contra ${npcParaIntercambio.name} conecta, matándolo en el acto sin importar en qué estado estuviera antes — narra el golpe final, no una herida más.`
            : `EFECTO DE HABILIDAD — YA RESUELTO: la canalización se completa pero el golpe letal no llega a conectar esta vez — narra el intento fallido, nunca su muerte.`;
        }
        exchangeNarrationBlock = `${characterName} completa su canalización de "${canalizacion.abilityName}" contra ${npcParaIntercambio.name}. ${exchangeContextBlock(exchange, characterName, npcParaIntercambio.name, npcPuedeContragolpearCanalizacion)}`;
        combatExchangeRoll = exchange.atacante;
        npcAbilityUsed = { npcName: npcParaIntercambio.name, abilityName: npcDefensa.name, rol: 'defensa', maxUsesPerCombat: npcDefensa.maxUsesPerCombat };
        combatExchangeDisplay = {
          atacanteEsJugador: true,
          atacante: exchange.atacante,
          defensor: exchange.defensor,
          resultado: exchange.resultado,
          margen: exchange.margen,
        };
        playerAbilityUsed = { name: canalizacion.abilityName, icon: '🌀', description: 'Habilidad canalizada.', rol: 'ataque' };
        nuevoPendingCanalizacion = null;
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
      } else if (jugadorRol === 'ataque' && abilityEffects.includes('CANALIZAR') && !input.pendingCanalizacion) {
        nuevoPendingCanalizacion = {
          abilityName: input.selectedAbility?.name ?? 'habilidad canalizada',
          attribute: input.classificationAtributo,
          attributeBonus: input.abilityAttributeBonus ?? null,
          effects: abilityEffects,
          npcId: npcParaIntercambio.id,
        };
        exchangeNarrationBlock = `${characterName} empieza a canalizar "${input.selectedAbility?.name ?? 'su habilidad'}" contra ${npcParaIntercambio.name} — el golpe se completará el próximo turno si nada lo interrumpe antes.`;
        if (input.selectedAbility) playerAbilityUsed = { ...input.selectedAbility, rol: 'ataque' };
        exchangeHappened = true;
      } else {
      // `resolveExchange` (tabla cruzada, camino "else" de abajo) solo tiene sentido cuando el
      // jugador de verdad ataca (`jugadorRol === 'ataque'`) — asume implícitamente "atacante vs
      // defensor" y calcula el golpe SOLO de los dados, sin mirar el rol. Si el jugador no está
      // atacando (rol 'defensa' — texto libre sin intención real, o un consumible, que activa
      // `combateActivo` sin ser nunca un ataque, ver `tomaAccionDeCombate`), o si el NPC se
      // defendió con una de utilidad, hace falta el camino independiente — nunca colar un golpe
      // real desde la tabla cruzada cuando el jugador no atacó de verdad.
      // Hallazgo 12 (revisar-partida-hallazgos.md 2026-09-06) — una utilidad del NPC que PARA el
      // ataque del jugador (ATAQUE/ATURDIMIENTO/INTIMIDACION/CONTROL, ver isReactiveUtility) deja
      // de resolverse contra su propia dificultad fija: pasa a la tirada-vs-tirada directa de
      // `resolveExchange` (rama `else` de abajo), mismo criterio simétrico que CASO DEFENSA.
      const npcParaAtaque = jugadorRol === 'ataque' && npcDefensa.rol === 'utilidad' && isReactiveUtility('utilidad', npcDefensa.effects, 'ataque');
      const esIndependiente = (jugadorRol !== 'ataque' || npcDefensa.rol === 'utilidad') && !npcParaAtaque;
      if (esIndependiente) {
        const jugadorRacial = racialAdvantageFor(jugadorRaza, jugadorRol, abilityEffects, npcDefensa.attribute, npcParaIntercambio.raza, isFirstExchangeOfCombat);
        const npcRacial = racialAdvantageFor(npcParaIntercambio.raza, npcDefensa.rol, npcDefensa.effects, input.classificationAtributo, jugadorRaza, isFirstExchangeOfCombat);
        const independent = resolveIndependentExchange(
          {
            attributes: attributesEfectivos,
            attribute: input.classificationAtributo,
            attributeBonus: input.abilityAttributeBonus,
            // Hallazgo 12 — una utilidad NO reactiva del JUGADOR (ANALISIS/RECUPERACION, p.ej.
            // "Analizar rival" — las reactivas ya se desviaron a `npcParaAtaque` arriba) usa la
            // escala nueva por diferencia de atributos, no la de nivel/`dificultadAtacante` —
            // solo cuando `jugadorRol==='utilidad'`; si ataca de verdad, se queda con
            // `dificultadAtacante` (ese caso nunca llega aquí de todas formas: `esIndependiente`
            // exige `jugadorRol!=='ataque'` para entrar por este lado salvo cuando quien es
            // utilidad es el NPC).
            difficulty: jugadorRol === 'utilidad' ? utilityDifficultyFor(npcParaIntercambio.attributes, attributesEfectivos).dificultad : dificultadAtacante,
            condicionFisica: input.condicionFisicaJugador,
            rol: jugadorRol,
            rollMode: jugadorRacial.rollMode,
            racialAdvantageReason: jugadorRacial.racialAdvantageReason,
          },
          {
            attributes: npcAttributesEfectivos,
            attribute: npcDefensa.attribute,
            attributeBonus: npcDefensa.attributeBonus ?? 0,
            // Hallazgo 12 — mismo criterio simétrico para el lado NPC (ANALISIS/RECUPERACION del
            // NPC, las reactivas ya se desviaron a `npcParaAtaque` arriba).
            difficulty:
              npcDefensa.rol === 'utilidad'
                ? utilityDifficultyFor(npcParaIntercambio.attributes, attributesEfectivos).dificultad
                : difficultyHintFor(input.currentLevel, npcParaIntercambio.level).dificultad,
            condicionFisica: npcParaIntercambio.condicionFisica,
            rol: npcDefensa.rol,
            rollMode: npcRacial.rollMode,
            racialAdvantageReason: npcRacial.racialAdvantageReason,
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
          // CONTROL en 1vs1 — mismo criterio que el CASO DEFENSA de arriba (simplificado a robar
          // la iniciativa, sin segundo rival real al que redirigir).
          if (jugadorDisparo && abilityEffects.includes('CONTROL')) {
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
            if (npcDefensa.effects.includes('CONTROL')) {
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
        // Solo la pasiva PROPIA del NPC (Goirntes/Faerus) — mismo criterio que el `resolveExchange`
        // del CASO DEFENSA, arriba: puede haber una utilidad reactiva del NPC (`npcParaAtaque`,
        // hallazgo 12, desviada aquí desde arriba) con ATAQUE/ATURDIMIENTO/INTIMIDACION/CONTROL de
        // por medio — el resto de este camino (una defensa normal sin efecto) sigue igual.
        const npcRacialAtaqueCruzado = racialAdvantageFor(npcParaIntercambio.raza, npcDefensa.rol, [], input.classificationAtributo, jugadorRaza, isFirstExchangeOfCombat);
        const exchange = resolveExchange(
          {
            attributes: attributesEfectivos,
            attribute: input.classificationAtributo,
            attributeBonus: input.abilityAttributeBonus,
            difficulty: dificultadAtacante,
            condicionFisica: input.condicionFisicaJugador,
            rol: jugadorRol,
          },
          {
            attributes: npcAttributesEfectivos,
            attribute: npcDefensa.attribute,
            attributeBonus: npcDefensa.attributeBonus ?? 0,
            difficulty: difficultyHintFor(input.currentLevel, npcParaIntercambio.level).dificultad,
            condicionFisica: npcParaIntercambio.condicionFisica,
            rol: npcDefensa.rol,
            rollMode: npcRacialAtaqueCruzado.rollMode,
            racialAdvantageReason: npcRacialAtaqueCruzado.racialAdvantageReason,
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
        //
        // CONTRA/REFRACTAR (2026-08-26) — mismo criterio que el CASO DEFENSA de arriba, espejado:
        // aquí es el ataque del JUGADOR el que se contesta, así que el atributo relevante es
        // `input.classificationAtributo` (el suyo), no el del NPC.
        const npcPuedeContragolpear =
          npcDefensa.effects.includes('ATAQUE') ||
          (npcDefensa.effects.includes('CONTRA') && input.classificationAtributo !== 'magia') ||
          (npcDefensa.effects.includes('REFRACTAR') && input.classificationAtributo === 'magia');
        const npcContragolpeaAplica = exchange.resultado === 'defensor_contragolpea' && npcPuedeContragolpear;
        // Hallazgo 12 — utilidad reactiva del NPC SIN daño propio (ATURDIMIENTO/INTIMIDACION/
        // CONTROL, `npcParaAtaque` de arriba): con el mismo margen decisivo que exige un
        // contragolpe real, interrumpe al jugador en vez de golpearlo — INTIMIDACION además
        // cancela el golpe base entrante del jugador del todo (mismo comportamiento que ya tenía
        // en el camino independiente).
        const npcInterrumpeAplica =
          exchange.resultado === 'defensor_contragolpea' &&
          (npcDefensa.effects.includes('ATURDIMIENTO') || npcDefensa.effects.includes('INTIMIDACION') || npcDefensa.effects.includes('CONTROL'));
        if (npcInterrumpeAplica) iniciativaForzadaPorUtilidad = 'npc';
        npcAttackHits =
          !(npcInterrumpeAplica && npcDefensa.effects.includes('INTIMIDACION')) &&
          (exchange.resultado === 'golpe_pleno' || exchange.resultado === 'golpe_normal');
        npcTargetNewCondicion = npcAttackHits ? nextCondicionForAttack(abilityEffects, npcParaIntercambio.condicionFisica) : null;
        jugadorRecibeGolpe = npcContragolpeaAplica;
        // `npcDefensa.effects` completo (auditoría 2026-08-17), no `['ATAQUE']` hardcodeado —
        // mismo criterio que el camino independiente.
        jugadorGolpeEfectos = jugadorRecibeGolpe ? npcDefensa.effects : [];
        // AUMENTO/DEBILIDAD (2026-08-26, Fase 2) — mismo umbral decisivo que CONTRA/REFRACTAR
        // (`golpe_pleno`, margen ≥10) en vez del propio de cada habilidad, y solo cuando el golpe
        // BASE del jugador de verdad conecta (nunca sobre una tirada perdida). AUMENTO se aplica a
        // quien usó la habilidad (el jugador, aquí), DEBILIDAD a quien la recibió (el NPC) — el
        // atributo afectado es siempre `input.classificationAtributo` (el mismo que la tirada de
        // esta habilidad, ver comentario de `StartingAbility.durationEffectMagnitude`).
        if (exchange.resultado === 'golpe_pleno' && input.abilityDurationEffectMagnitude != null && input.abilityDurationEffectTurns != null) {
          const nuevoEfecto: ActiveEffect = {
            attribute: input.classificationAtributo,
            magnitude: input.abilityDurationEffectMagnitude,
            turnsRemaining: input.abilityDurationEffectTurns,
            sourceAbility: input.selectedAbility?.name ?? 'habilidad',
          };
          if (abilityEffects.includes('AUMENTO')) nuevosJugadorActiveEffects = pushActiveEffect(nuevosJugadorActiveEffects, nuevoEfecto);
          if (abilityEffects.includes('DEBILIDAD')) nuevosNpcActiveEffects = pushActiveEffect(nuevosNpcActiveEffects, nuevoEfecto);
        }
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
    }

    if (exchangeHappened) {
      // Fase 2 de efectos de clase (2026-08-26) — un turno de duración menos por cada intercambio
      // real resuelto (nunca en un turno sin intercambio, mismo criterio que condicion/energía),
      // aplicado solo a los efectos que YA estaban activos al entrar a este turno — los nuevos de
      // ESTE turno (`nuevosJugador/NpcActiveEffects`) se añaden SIN decrementar, listos para
      // leerse a plena fuerza en el próximo intercambio (ver comentario de la declaración, arriba).
      jugadorActiveEffectsNext = [...decrementActiveEffects(input.jugadorActiveEffects), ...nuevosJugadorActiveEffects];
      npcActiveEffectsNext = [...decrementActiveEffects(input.npcActiveEffects), ...nuevosNpcActiveEffects];

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

      // Remate (hallazgo 18, revisar-partida-hallazgos.md 2026-09-07) — un golpe NORMAL (no LETAL,
      // ese caso ya tiene su propio texto arriba) que remata a un NPC que YA venía CONVALECIENTE
      // (un paso de morir) no debe narrarse como un golpe más: `hitSeverityHint`
      // (combatExchange.ts) devuelve vacío para CONVALECIENTE/MUERTO, así que sin este hint el
      // Narrador no tenía ninguna instrucción de que este golpe concreto acaba con la vida del
      // rival — solo `OUTCOME_NARRATION_HINT` genérico por margen ("narra el golpe"). La habilidad
      // concreta usada ya llega al Narrador por otra vía (`ctx.action`, el `promptText` de la
      // habilidad elegida — confirmado que ya trae su propio lore, p.ej. fuego/físico), así que
      // este hint solo añade la instrucción de REMATE, sin repetir el nombre de la habilidad.
      if (npcAttackHits && npcParaIntercambio.condicionFisica === 'CONVALECIENTE' && npcTargetNewCondicion === 'MUERTO' && !abilityEffects.includes('LETAL')) {
        const remateHint = `REMATE — YA RESUELTO: ${npcParaIntercambio.name} ya estaba al borde de la muerte (convaleciente) y este golpe acaba con su vida — narra explícitamente que es el golpe final a través de la habilidad concreta usada, nunca como un impacto más de combate normal.`;
        exchangeNarrationBlock = exchangeNarrationBlock ? `${exchangeNarrationBlock} ${remateHint}` : remateHint;
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
        // Bug real jugando en vivo (2026-09-04, captura real: el Orco Enfurecido ya GRAVE seguía
        // restando -2sal en la iniciativa, el malus de HERIDO — debería restar -5, el de GRAVE) —
        // `input.condicionFisicaJugador`/`npcParaIntercambio.condicionFisica` son la condición de
        // ANTES de este mismo golpe (parámetros de entrada, capturados al empezar el turno). El
        // malus de condición física de la iniciativa del PRÓXIMO intercambio debe reflejar el
        // golpe que ACABA de resolverse aquí mismo, no el estado de antes de recibirlo — mismo
        // criterio ya aplicado a `npcTargetNewCondicion` unas líneas arriba, replicado aquí para
        // el lado del jugador con la misma función (`nextCondicionForAttack`).
        const condicionJugadorParaIniciativa = jugadorRecibeGolpe
          ? nextCondicionForAttack(jugadorGolpeEfectos, input.condicionFisicaJugador)
          : input.condicionFisicaJugador;
        const condicionNpcParaIniciativa = npcTargetNewCondicion ?? npcParaIntercambio.condicionFisica;
        nextInitiativeRoll = rollInitiative(
          { attributes: attributesEfectivos, attribute: 'destreza', difficulty: 0, condicionFisica: condicionJugadorParaIniciativa, rol: 'utilidad' },
          { attributes: npcAttributesEfectivos, attribute: 'destreza', difficulty: 0, condicionFisica: condicionNpcParaIniciativa, rol: 'utilidad' },
        );
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
          attributeBonus: npcAtaque.attributeBonus ?? null,
          effects: npcAtaque.effects,
          rol: npcAtaque.rol,
          abilityName: npcAtaque.name,
          abilityDescription: npcAtaque.description,
          energyCost: npcAtaque.energyCost,
          energyRegen: npcAtaque.energyRegen,
          maxUsesPerCombat: npcAtaque.maxUsesPerCombat,
          durationEffectMagnitude: npcAtaque.durationEffectMagnitude ?? null,
          durationEffectTurns: npcAtaque.durationEffectTurns ?? null,
        };
      }
    }
  }

  // Bug real jugando en vivo (revisión de partida, 2026-08-23/26, "Ruptidar 'ataca' en combate pese
  // a ser INOFENSIVO/'No ataca'"): `ataqueNatural: 'No ataca.'` es una declaración explícita del
  // catálogo (`ruptidar`/`jusha-esmeralda`/`quio`, los 3 únicos INOFENSIVO sin ataque real), pero
  // nada de las 6 ramas de arriba la comprobaba — `chooseNpcAbility` siempre puede "elegir" ALGUNA
  // habilidad como su ataque (cae al roster entero si no hay ninguna 'ataque' afrontable, ver su
  // propio comentario), así que el NPC seguía pudiendo conectar un golpe real contra la jugadora.
  // Único punto de verdad al final de la función, cubre las 6 ramas a la vez (incluida la
  // resolución de un `pendingNpcAttack` sembrado en un turno anterior contra este mismo NPC).
  // `npcAttackerIsInoffensive` (guard de narración `hasInoffensiveNpcNarratedAttacking`) — mismo
  // criterio EXACTO que el chequeo de daño de abajo, a propósito: hay NPCs `temperamento:
  // 'INOFENSIVO'` con `ataqueNatural` real y débil (Gargantúa de Ceniza "embiste con la cabeza",
  // Corretolvas "picotea y araña", Múrgol "topetazo torpe" — animales de manada que sí reaccionan
  // si se les acorrala, aunque su temperamento general sea pacífico), y esos SÍ deben poder
  // narrarse golpeando — usar solo `temperamento` aquí los habría bloqueado también, un falso
  // positivo. Solo `ataqueNatural` empezando por "No ataca" (bug real, 2026-08-23/26, Ruptidar)
  // es señal fiable de que ni el daño ni la prosa de ataque deberían producirse.
  const npcAttackerIsInoffensive = !!npcParaIntercambio && /^no ataca\b/i.test(npcParaIntercambio.ataqueNatural ?? '');
  if (npcAttackerIsInoffensive) {
    jugadorRecibeGolpe = false;
    jugadorGolpeEfectos = [];
    // B23 (pruebas 2026-09-28): el daño ya se anulaba, pero la UI seguía presentando "RUPTIDAR ATACA
    // CON ..." y "Gana Ruptidar — el golpe conecta" con el jugador Ileso. Se marca para que el
    // frontend lo presente como lo que es: un animal que se revuelve, sin ataque real.
    if (npcAbilityUsed?.rol === 'ataque') npcAbilityUsed = { ...npcAbilityUsed, inofensivo: true };
    if (combatExchangeDisplay && !combatExchangeDisplay.atacanteEsJugador) combatExchangeDisplay = { ...combatExchangeDisplay, atacanteInofensivo: true };
  }

  return {
    npcAttackTarget,
    npcAttackHits,
    npcTargetNewCondicion,
    jugadorRecibeGolpe,
    jugadorGolpeEfectos,
    nuevoPendingNpcAttack,
    nuevoPendingCanalizacion,
    exchangeNarrationBlock,
    combatExchangeRoll,
    npcAbilityUsed,
    combatExchangeDisplay,
    playerAbilityUsed,
    nextInitiativeRoll,
    exchangeHappened,
    playerActedAsDefenderThisExchange,
    npcAttackerIsInoffensive,
    npcEnergiaMax,
    // RECUPERACION (2026-08-17) — sumado aquí mismo (topado al máximo real del NPC), a diferencia
    // del lado jugador cuyo tope solo conoce el caller.
    npcNuevaEnergia: npcNuevaEnergia !== null && npcEnergiaMax !== null ? Math.min(npcEnergiaMax, npcNuevaEnergia + npcRecuperacionExtra) : npcNuevaEnergia,
    abilityEffectHint,
    analizarRivalExito,
    jugadorRecuperacionExtra,
    jugadorActiveEffectsNext,
    npcActiveEffectsNext,
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
  tieneOficioFor: (oficio: string | undefined) => boolean;
  /// Bug real (auditoría en vivo, 2026-09-01, camino DIFERIDO — ver comentario completo en
  /// `computeBuildBlockedReason`, construction.ts): mismo motivo que la exclusión de la segunda
  /// llamada (dentro de la transacción, más abajo) — sin esto, esta PRIMERA comprobación (fuera de
  /// transacción, la que decide `buildMode` de entrada) ya bloqueaba con "ya tiene X activo en
  /// esta región" contra su propia fila `EN_CONSTRUCCION`, antes de llegar siquiera a la
  /// revalidación de materiales.
  earlyBuildingId?: string;
}): Promise<BuildIntentContext> {
  const { action, saveId, worldId, activeRegion, currentLocationRecord, inventoryRows, catalogBySlug, attributes, secondaryAttributes, alivioFor, tieneOficioFor, earlyBuildingId } =
    params;
  const buildRecipe: ConstructionRecipe | undefined = CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, action));
  const buildRecipeCheck: RecipeCheck | null = buildRecipe
    ? checkRecipe(buildRecipe, inventoryRows, catalogBySlug, attributes, secondaryAttributes, alivioFor(buildRecipe.oficio), tieneOficioFor(buildRecipe.oficio))
    : null;
  const buildBlockedReason: string | null =
    buildRecipe && buildRecipeCheck?.met && currentLocationRecord
      ? await computeBuildBlockedReason({ db: prisma, saveId, worldId, buildRecipe, activeRegion, currentLocationRecord, excludeBuildingId: earlyBuildingId })
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
    select: { id: true, npcId: true, condicionFisica: true, condicionFisicaSinceMinutes: true },
  });
  for (const state of affected) {
    if (state.condicionFisica === 'CONVALECIENTE' && npcRecoversFromConvaleciente(state.condicionFisicaSinceMinutes, nowMinutes)) {
      await tx.npcState.update({
        where: { id: state.id },
        data: { condicionFisica: 'HERIDO', condicionFisicaSinceMinutes: nowMinutes },
      });
      await registrarSucesoDeNpc(tx, { saveId, npcId: state.npcId, tipo: 'RECUPERACION_NPC', fictionalMinutes: nowMinutes });
    } else if (state.condicionFisica === 'MUERTO' && npcCorpseShouldDespawn(state.condicionFisicaSinceMinutes, nowMinutes)) {
      await tx.npcState.delete({ where: { id: state.id } });
      await registrarSucesoDeNpc(tx, { saveId, npcId: state.npcId, tipo: 'CADAVER_DESAPARECE', fictionalMinutes: nowMinutes });
    }
  }
}

/// Expiración de capturas en el inventario, sin depositar en Jaula (rediseño de captura,
/// 2026-08-28, docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md § 4) — mismo patrón EXACTO que
/// `applyCondicionTimeouts` de arriba (barre todas las filas afectadas de esta partida, llamado una
/// vez por turno resuelto de verdad). Si el plazo (ligado al tier de la cuerda usada al atar) ya
/// pasó, la captura se escapa sola: el InventoryItem en tránsito se borra, sin rastro — no hay
/// mecanismo de "aviso previo", coherente con el resto de timeouts silenciosos del proyecto.
async function applyCapturaEnInventarioTimeouts(tx: Prisma.TransactionClient, saveId: string, nowMinutes: number): Promise<void> {
  const capturas = await tx.inventoryItem.findMany({
    where: { saveId, capturaNpcId: { not: null } },
    select: { id: true, capturaExpiraAtMinutes: true },
  });
  for (const captura of capturas) {
    if (capturaEnInventarioExpiro(captura.capturaExpiraAtMinutes, nowMinutes)) {
      await tx.inventoryItem.delete({ where: { id: captura.id } });
    }
  }
}



/// Decide con qué NPCs se abre/persiste el popup de combate este turno y sincroniza
/// `Save.pendingCombatNpcSlugs` — extraído de `narrateAndPersistTurn` (refactor de deuda técnica
/// 2026-08-13). Pura salvo el propio `prisma.save.update` final; entrada/salida acotada — todo lo
/// que necesita ya está resuelto por el caller (narración, intercambio de combate, decapitar,
/// saqueo parcial), no dispara ninguna otra lectura/escritura por su cuenta.
/// Posición (lienzo 800×600) del icono de salida de la zona `locationId` que lleva a `haciaId` —
/// mismo cálculo que `salidasDeRegionPara` (zona.ts) sobre sus vecinos reales del grafo. `null` si
/// `haciaId` no es vecino directo o le faltan coordenadas de mundo.
async function posicionDeSalidaHacia(locationId: string, coords: { x: number; y: number }, haciaId: string): Promise<{ x: number; y: number } | null> {
  const links = await prisma.locationLink.findMany({
    where: { OR: [{ fromId: locationId }, { toId: locationId }] },
    select: { from: { select: { id: true, x: true, y: true } }, to: { select: { id: true, x: true, y: true } } },
  });
  const vecinos = links
    .map((l) => (l.from.id === locationId ? l.to : l.from))
    .filter((v): v is { id: string; x: number; y: number } => v.x != null && v.y != null);
  return posicionesDeSalidas(coords, vecinos).get(haciaId) ?? null;
}

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
  partiallyLootedSlugs: string[];
  /// Bug real (auditoría 2026-08-14, "acaba de salir pero en el siguiente turno" — Analizar Rival
  /// con éxito este mismo turno, pero la Ficha del rival seguía vacía hasta el turno siguiente):
  /// mismo bug que ya se documentó y arregló abajo para `condicionFisica` (`npcsInScene` se lee
  /// UNA vez al principio del turno, antes de que `tx.npcState.upsert` escriba `analizado: true`),
  /// pero ese fix nunca se extendió a este campo. `npcAttackTarget` es el mismo NPC que
  /// `npcParaIntercambio` (ver línea ~659), así que sirve igual de identificador aquí.
  analizarRivalExito: boolean;
  /// Fase 2 de efectos de clase (2026-08-27, indicador de combate) — `npcActiveEffectsNext` YA
  /// resuelto por `resolveCombatExchangePhase` este turno, mismo criterio que
  /// `npcTargetNewCondicion`: `npcsInScene` se lee UNA vez antes de la transacción, así que sin
  /// este override el NPC recién golpeado se devolvería con sus efectos ACTIVOS DE ANTES del golpe.
  npcActiveEffectsNext: ActiveEffect[];
  /// Bug real jugando en vivo (ronda de pruebas 2026-08-28) — true cuando ESTE turno propuso MUERTO
  /// y el jugador respawneó de forma sobrevivible: fuerza `combatSlugs` a vaciarse del todo, sin
  /// importar qué agresor calcularía el resto de esta función. El jugador acaba de reaparecer en su
  /// campamento, físicamente lejos de donde murió — el combate no puede seguir "esperándolo" ahí.
  justDied?: boolean;
  /// Combate "fantasma" (bug real confirmado 2 veces en vivo, causa raíz aislada 2026-08-29) —
  /// región de la ubicación ACTUAL del jugador este turno (`regionLocation.region` del caller,
  /// null si no se pudo resolver). Ver `npcCanForceCombat` más abajo para el porqué.
  regionActual: string | null;
  /// Hallazgo 17 (revisar-partida-hallazgos.md 2026-09-07) — resultado real de la tirada de
  /// ataque de ESTE turno (`roll?.gradoExito` del caller), y el NPC real al que apunta la acción
  /// (`candidateAttackTarget`, ya resuelto por el caller) — ambos necesarios para decidir si un
  /// ataque de APERTURA que falla contra fauna no agresiva debe abrir combate igualmente o no
  /// (ver `attackMissedNonAggressiveTarget` más abajo). `null` fuera de ese escenario concreto.
  attackerRollGradoExito: GradoExito | null;
  attackTarget: NpcInScene | null;
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
    partiallyLootedSlugs,
    npcActiveEffectsNext,
    analizarRivalExito,
    justDied,
    regionActual,
    attackerRollGradoExito,
    attackTarget,
  } = params;

  // Combate "fantasma" (bug real confirmado 2 veces en vivo, causa raíz aislada 2026-08-29,
  // reproducido en test de integración): `detectNpcsInScene` trata a un NPC "ya establecido en
  // esta partida" (tiene NpcState propio) como candidato SIEMPRE, sin importar la región actual —
  // comportamiento INTENCIONAL (ver su propio comentario de cabecera y los tests que lo cubren:
  // mencionar a alguien conocido lejos de su territorio no debe hacerlo desaparecer del todo, p.ej.
  // para diálogo/misiones/loot de un cadáver ya resuelto). El problema real es más específico:
  // combinado con el matching fuzzy de alias (mismo mecanismo que ya causó el bug histórico "res"
  // dentro de "presas"/"interesante", Levenshtein 2) y sin ningún estado de "se calmó tras huir"
  // para fauna sin facción, un NPC agresivo podía volver a FORZAR combate en cualquier región con
  // solo que la acción o los `sessionFacts` recientes (p.ej. el propio hecho de la huida, que narra
  // su nombre) lo mencionaran de pasada — reproducido con un Kirelon Arenoso "reapareciendo" en una
  // región completamente distinta, con un turno de descanso totalmente neutral. Un NPC agresivo
  // solo puede FORZAR combate (`agresivoSlugsInScene`/`combatSlugsFromModel` más abajo) cerca de su
  // propio territorio — sigue siendo válido para el resto de usos de `npcsInScene`/`npcsInSceneVivos`
  // en esta función (loot/decapitar/objetivo de intercambio ya en curso), solo se acota aquí.
  const homeSlugsInScene = [...new Set(npcsInSceneVivos.map((n) => n.homeLocationSlug).filter((s): s is string => !!s))];
  const homeRegionBySlug = homeSlugsInScene.length
    ? new Map(
        (await prisma.location.findMany({ where: { slug: { in: homeSlugsInScene } }, select: { slug: true, region: true } })).map((l) => [
          l.slug,
          l.region,
        ]),
      )
    : new Map<string, string>();
  const npcCanForceCombat = (n: NpcInScene): boolean => {
    if (n.homeLocationSlug === null) return true; // itinerante, sin territorio que lo acote
    if (regionActual === null) return true; // ubicación actual sin resolver — no se puede acotar
    return homeRegionBySlug.get(n.homeLocationSlug) === regionActual;
  };

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
      return (t === 'AGRESIVO' || t === 'ENEMIGO') && npcCanForceCombat(n);
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
  // Hallazgo 17 (revisar-partida-hallazgos.md 2026-09-07, "la narración indica que Gorhorn huye
  // del combate, pero el combate se abre igualmente" — el Ruptidar, INOFENSIVO, "se gira... apenas
  // rozan las escamas... dejando a Gorhorn solo"): un ataque de APERTURA (`!enCombate`, antes de
  // que exista ningún intercambio mecánico real, ver `openingAmbush`) que FALLA
  // (`attackerRollGradoExito === 'fallo'`) contra fauna no agresiva no debe abrir combate — la
  // presa escapa de verdad, coherente con que este temperamento "nunca inicia combate" (comentario
  // del enum `Temperamento`, más arriba) ya se protege como AGRESOR (`agresivoSlugsInScene`) pero
  // no como VÍCTIMA de un ataque fallido, que es justo el hueco real. Si el ataque ACIERTA, sigue
  // abriendo combate con normalidad (fauna inofensiva sí es cazable si el golpe conecta) — solo se
  // toca la rama `detectsAttackIntent` de `shouldForceCombat`, ninguna de las otras 3.
  const attackMissedNonAggressiveTarget =
    !enCombate &&
    attackerRollGradoExito === 'fallo' &&
    attackTarget !== null &&
    (() => {
      const t = effectiveTemperamento(attackTarget.temperamento, attackTarget.faction, factionsStatus);
      return t === 'INOFENSIVO' || t === 'CAUTELOSO';
    })();
  // Bug real jugando en vivo (2026-07-24, decisión explícita de la usuaria: "aceptar ayudar solo
  // crea la misión, nunca abre combate"): "Cuenta conmigo. Acabaré con el que te persigue."
  // (aceptando ayudar a Gistera Koh) comparte vocabulario con `detectsHostileSearchIntent`
  // ("acabar(e)? con") — necesario para que el clasificador la trate como instantánea, pero forzaba
  // combate igual contra TODOS los NPCs en escena (Gistera Koh, la propia aliada que pidió ayuda, Y
  // un Múrgol de paso sin relación ninguna) — una promesa a futuro no es un ataque ahora mismo.
  // Nunca suprime `detectsAttackIntent` (un ataque real de verdad sigue abriendo combate) salvo el
  // caso concreto del hallazgo 17 de arriba (`attackMissedNonAggressiveTarget`).
  const shouldForceCombat =
    !enCombate &&
    combatSlugsFromModel.length === 0 &&
    npcsInSceneVivos.length > 0 &&
    (agresivoSlugsInScene.length > 0 ||
      (isCondicionDowngrade(condicionFisicaJugador, narration.condicionFisica) && !allNpcsInSceneArePacificos) ||
      (detectsAttackIntent(action) && !attackMissedNonAggressiveTarget) ||
      (detectsHostileSearchIntent(action) && !detectsVerbalAcceptanceIntent(action)));
  // Bug real (auditoría 2026-07-23, "ha metido un murgol que no pinta nada"): la red de seguridad
  // metía a TODOS los NPCs detectados en escena como participantes de combate (aliados, fauna de
  // paso...), no solo al hostil. Si la acción cita un nombre real entre comillas (`explicitTarget`,
  // ver arriba), el popup arranca solo con ese — y si lo que disparó la red de seguridad fue un
  // NPC agresivo, solo él entra (mismo criterio) — el listado completo de `npcsInScene` queda como
  // último recurso para cuando la acción no nombra a nadie en concreto ("me defiendo").
  //
  // Bug real (2026-08-01, misma auditoría de `npcsInSceneVivos` de arriba): `explicitTarget` no
  // mira `condicionFisica` (a propósito, lo necesita loot/saqueo para citar a un NPC ya derrotado)
  // — pero si el jugador cita entre comillas a alguien YA muerto y esta acción además dispara
  // `shouldForceCombat` por cualquier otro motivo, no tiene sentido "forzar combate" contra un
  // cadáver. Se comprueba aquí, solo para esta decisión.
  //
  // CONVALECIENTE SÍ cuenta como "vivo" a estos efectos desde el rediseño de "Matar" (2026-08-30,
  // petición explícita: "matar tiene que abrir el combate de nuevo, no resolverse") — antes se
  // excluía a propósito porque el remate vivía en un atajo determinista aparte; ahora un
  // convaleciente citado con intención de ataque (`detectsAttackIntent`, `shouldForceCombat` más
  // abajo) es exactamente el caso que debe forzar un intercambio real, con su malus de condición
  // (`CONDICION_MALUS.CONVALECIENTE`, death.ts) como riesgo bajo pero real.
  const explicitTargetVivo = explicitTarget && explicitTarget.condicionFisica !== 'MUERTO' ? explicitTarget : null;
  // Bug real (auditoría de integridad de estado, 2026-09-01, "nuente" enganchado en
  // `pendingCombatNpcSlugs` sin haber sido nunca `CombatParticipant` de ningún `CombatEncounter`
  // real): el comentario de arriba ("ha metido un murgol que no pinta nada", 2026-07-23) documenta
  // que el fallback ya NO debía barrer con todo `npcsInScene` sin filtrar — pero solo se corrigió
  // el caso `agresivoSlugsInScene.length > 0`. Cuando ni hay `explicitTarget` ni ningún agresivo
  // detectado (p.ej. `shouldForceCombat` se disparó por `detectsAttackIntent`/
  // `detectsHostileSearchIntent` sobre un NPC agresivo que el matching de alias NO reconoció como
  // tal, o por una bajada de condición), este ÚLTIMO fallback seguía usando
  // `npcsInSceneVivos.map((n) => n.slug)` tal cual — cualquier NPC pacífico detectado en la MISMA
  // escena (aunque sea un falso positivo de fuzzy-match de alias, Levenshtein≤2, el mismo mecanismo
  // que ya causó el bug histórico "presas"/"brasas") se arrastraba a `pendingCombatNpcSlugs` junto
  // con el agresor real. Caso confirmado en partida real: "nuente" (CAUTELOSO, sin relación con la
  // escena) coló por matchear "cuenta" ("el canizor se da cuenta...") a distancia 2 del alias
  // "nuente" — el combate real que se abrió después solo enganchó a "canizor", dejando a "nuente"
  // huérfano para siempre en el array (nada más lo retira). Mismo criterio que
  // `allNpcsInSceneArePacificos` más arriba: un NPC AMIGABLE/INOFENSIVO/CAUTELOSO no puede ser el
  // objetivo de un forzado de combate por esta vía — si tras excluirlos no queda ningún candidato
  // plausible, no se fuerza combate contra nadie (mejor no abrir popup que abrirlo contra quien no
  // pinta nada).
  const npcsInSceneHostilesCandidatos = npcsInSceneVivos.filter((n) => {
    const t = effectiveTemperamento(n.temperamento, n.faction, factionsStatus);
    return t !== 'AMIGABLE' && t !== 'INOFENSIVO' && t !== 'CAUTELOSO';
  });
  const forcedCombatSlugs = explicitTargetVivo
    ? [explicitTargetVivo.slug]
    : agresivoSlugsInScene.length > 0
      ? agresivoSlugsInScene
      : npcsInSceneHostilesCandidatos.map((n) => n.slug);
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
  // Saqueo parcial (ver `partiallyLootedSlugs` del caller): un NPC tocado este turno que se queda
  // CON botín pendiente sigue contando como "en combate" para que `pendingCombatNpcSlugs`
  // sobreviva a un resync/recarga — sin esto, un turno de solo-saqueo (sin exchange) vaciaba el
  // campo aunque quedaran objetos por saquear.
  //
  // `justDied` manda sobre todo lo anterior (bug real 2026-08-28): un respawn sobrevivible ESTE
  // turno cierra el combate del todo, incluso si el modelo/el intercambio de este mismo turno
  // seguían apuntando al agresor — el jugador ya no está donde murió.
  const combatSlugs = justDied ? [] : [...new Set([...combatSlugsWithAttack, ...partiallyLootedSlugs])];

  // Bug real (2026-09-08, reproducido en vivo con Playwright y confirmado con curl directo:
  // "Ya hay un combate en curso — resuélvelo antes de salir a cazar" tras haber matado ya al
  // objetivo): `combatSlugs` de arriba incluye A PROPÓSITO al NPC recién MUERTO este mismo turno
  // (comentario de `combatSlugsWithAttack`, más arriba) para que `combateIniciado` — la respuesta
  // de ESTE turno — traiga su condición fresca al popup de resultado. Pero eso mismo se
  // persistía tal cual en `Save.pendingCombatNpcSlugs`, y nada en un turno futuro lo volvía a
  // filtrar: el motor de combate múltiple sí tiene su propio bloque de limpieza basado en
  // `combatEncounterTerminado` (más abajo en este archivo), pero este camino 1v1 clásico no tenía
  // ningún equivalente. Si el jugador nunca vuelve a mandar un turno de texto libre normal contra
  // ese mismo NPC (p.ej. porque intenta "Cazar" de nuevo, una ruta HTTP aparte que solo LEE este
  // campo para bloquear, nunca lo limpia), el campo queda sucio para siempre — un combate
  // "fantasma" que ningún botón de la UI puede resolver (el guard de detail.ts ya excluye
  // correctamente al MUERTO de `combateIniciado`, así que el aviso "Combatir" tampoco reaparece).
  // Lo que se PERSISTE excluye cualquier slug cuyo NpcState real sea MUERTO Y sin botín pendiente
  // — un MUERTO con loot todavía por saquear (`partiallyLootedSlugs`) SIGUE necesitando quedarse,
  // mismo criterio que el comentario de arriba (sobrevivir a un resync/recarga hasta que el
  // saqueo termine del todo). Lo que se devuelve en `combateIniciado` de la respuesta de este
  // turno (más abajo) sigue usando `combatSlugs` sin filtrar, para no perder el display fresco de
  // ESTE turno. Mismo override que `combateIniciado` más abajo: `npcsInScene` se lee UNA vez al
  // principio del turno (antes de que la transacción escriba el golpe de ESTE turno), así que el
  // NPC recién muerto necesita `npcTargetNewCondicion` en vez de su condición ya obsoleta — el
  // resto de NPCs (turnos anteriores) sí tiene la condición real en `npcsInScene`.
  const combatSlugsToPersist = combatSlugs.filter((slug) => {
    if (partiallyLootedSlugs.includes(slug)) return true;
    const npc = npcsInScene.find((n) => n.slug === slug);
    const condicionReal = npcAttackTarget && npcAttackHits && npcTargetNewCondicion && npc?.id === npcAttackTarget.id ? npcTargetNewCondicion : npc?.condicionFisica;
    return condicionReal !== 'MUERTO';
  });

  // Persistido (bug real, 2026-07-23, "revisar partida" — tercera vuelta sobre este mismo tema):
  // `combateIniciado` viajaba SOLO en la respuesta directa de este turno — si el turno tardaba
  // tanto que el sondeo de reconexión del cliente (GameView.tsx) tenía que recuperar la partida
  // vía `GET /saves/:id` en vez de recibir la respuesta directa, el combate se calculaba bien
  // aquí pero se perdía sin dejar rastro, porque `Save` no lo guardaba en ningún sitio. Se
  // sobrescribe cada turno (vacío si no hay combate ESTE turno) para que `GET /saves/:id` pueda
  // reconstruir el mismo aviso tras cualquier resincronización, no solo en la respuesta directa.
  await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: combatSlugsToPersist } });

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
              npcAttackTarget && npcAttackHits && npcTargetNewCondicion && n.id === npcAttackTarget.id ? npcTargetNewCondicion : n.condicionFisica,
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
            capturable: n.capturable,
            // Fase 2 de efectos de clase (2026-08-27) — mismo override que condicionFisica/
            // analizado de arriba: solo el NPC de ESTE intercambio tiene efectos frescos.
            activeEffects: npcAttackTarget && n.id === npcAttackTarget.id ? npcActiveEffectsNext : n.activeEffects,
            // "Matar" persistido (2026-09-05) — mismo criterio que analizado/condicionFisica de
            // arriba, se resetea a false por el reset-on-ILESO ya aplicado al escribir NpcState.
            targetedForKill: n.targetedForKill,
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

const BUILD_FLAVOR = [
  'El esfuerzo se nota en cada tabla y cada piedra bien encajada.',
  'Un paso más hacia dejar huella en esta tierra.',
  'El trabajo ha llevado su tiempo, pero el resultado se sostiene firme.',
] as const;
const HARVEST_FLAVOR_SIN_PRESA = ['Solo encuentra tierra removida y silencio.', 'Nada que despiezar, al menos por ahora.'] as const;
const HARVEST_FLAVOR_FALLO = ['El material se resiste más de lo esperado.', 'Puede que con más calma o mejor herramienta salga distinto.'] as const;
/// Cooldown de Descansar (2026-09-06, hallazgo 11) — rechazo determinista, nunca decidido por el
/// LLM: mismo criterio que el resto de ramas de `narration` (LOOT_FLAVOR_*/BUILD_FLAVOR/etc.),
/// primera frase mecánica fija + una de estas de color, elegida al azar.
const REST_COOLDOWN_FLAVOR = [
  'No hace tanto que se detuvo a recuperar fuerzas — todavía no lo necesita de verdad.',
  'El cuerpo aguanta bien por ahora, sin pedir tregua.',
  'No hay ganas reales de tumbarse otra vez tan pronto.',
] as const;
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
const EAT_DRINK_FLAVOR = ['El estómago se calma, al menos por ahora.', 'Las fuerzas vuelven un poco más firmes.', 'Un momento de calma antes de seguir el camino.'] as const;

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
    clase,
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
    pendingCanalizacion,
    npcsInScene: npcsInScenePrecomputed,
    lootItemNames,
    healItemUses,
    hambreSedItemUses,
    pendingCombatNpcSlugs,
    travelInterruptionNpcId,
    travelInterruptionOriginalDestinationName,
  } = params;

  // CR-6 (hito 0.2): partidas anteriores al mundo por partida (o reiniciadas) reciben aquí su copia
  // del mundo; una vez hecha, es una sola lectura.
  await asegurarMundoDePartida(prisma, saveId);

  // Revisión técnica 2026-07-22: estas 4 consultas no dependen entre sí (retrieveLore es la única
  // que depende de una de ellas, ver más abajo) — antes iban en `await` secuencial, una detrás de
  // otra, cada una su propio viaje de ida y vuelta a Postgres. Agrupadas en Promise.all para pagar
  // solo la más lenta de las 4, no la suma de las 4. Ahorro real pero modesto (decenas-cientos de
  // ms) frente a los 30-220s que domina la generación del modelo — vale la pena por ser gratis y
  // sin riesgo, no porque vaya a notarse en la duración total del turno.
  const regionLocationId = travel ? travel.toLocationId : currentLocationId;
  const [selectedAbilityData, regionLocation, npcsInSceneRaw, harvestMatch, faunaSources, worldStateForFactionsAndAgenda, lastNarration, gisteraQuestYaExiste] = await Promise.all([
    // Efecto y coste de energía de la habilidad pulsada (checklist 2026-07-21/22, puntos 1-2;
    // coste de energía 2026-07-29) — null/0 si el jugador escribió la acción a mano (sin
    // savedActionId) o si esa SavedAction no tiene efecto asignado (habilidades generales, o
    // partidas en curso creadas antes de esta migración).
    // `saveId` en el filtro (auditoría de deuda técnica 2026-08-04, bug real de fuga entre
    // partidas): sin él, un `savedActionId` de OTRA partida seguía resolviendo aquí también.
    savedActionId
      ? prisma.savedAction.findFirst({
          where: { id: savedActionId, saveId },
          select: {
            name: true,
            icon: true,
            description: true,
            effects: true,
            rol: true,
            energyCost: true,
            energyRegen: true,
            dualWield: true,
            maxUsesPerCombat: true,
            attributeBonus: true,
            durationEffectMagnitude: true,
            durationEffectTurns: true,
            durationEffectTarget: true,
          },
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
          attributeBonus: number | null;
          durationEffectMagnitude: number | null;
          durationEffectTurns: number | null;
          durationEffectTarget: string | null;
        } | null>(null),
    // `slug` añadido (2026-09-05) — ver comentario de `gisteraEnEscena` más abajo: el gancho
    // guionizado de Gistera Koh necesita saber si la escena de ESTE turno sigue en La Hondonada
    // del Eco, su `homeLocationSlug` real.
    regionLocationId ? prisma.location.findUnique({ where: { id: regionLocationId }, select: { region: true, name: true, slug: true } }) : Promise.resolve(null),
    // Auditoría de rendimiento 2026-07-28 ("rascar segundos"): si el caller (turn.ts) ya trae el
    // resultado de /turn/classify para esta misma acción, se reutiliza tal cual en vez de repetir
    // el mismo `detectNpcsInScene` (roster completo del mundo + objetos, contra Supabase remoto)
    // por segunda vez en el mismo turno — worldTick.ts (resolución diferida) no lo trae, así que
    // sigue calculándolo fresco como siempre.
    // Bug real jugando en vivo (ronda de pruebas 2026-08-28): un viaje resuelto vía worldTick.ts
    // (banda extendida/larga) llegaba con `currentLocationId` = ORIGEN (worldTick.ts lee
    // `save.currentLocationId`, que solo se actualiza al DESTINO más abajo, dentro de esta misma
    // transacción) — así que la escena que "recibía" al jugador en el turno de llegada seguía
    // siendo la del punto de partida. Con un NPC agresivo en el origen (`shouldForceCombat`), el
    // turno de llegada al DESTINO abría/mantenía un combate fantasma contra un enemigo que ya
    // había quedado atrás, físicamente en otra ubicación. `regionLocationId` (arriba) ya calcula
    // el destino real cuando hay `travel` — reutilizarlo aquí en vez del origen crudo.
    npcsInScenePrecomputed ? Promise.resolve(npcsInScenePrecomputed) : detectNpcsInScene({ action, worldId, sessionFacts, saveId, currentLocationId: regionLocationId, fictionalMinutes: fictionalMinutesActuales }),
    travel ? Promise.resolve(null) : detectHarvest({ action, worldId, saveId, currentLocationId }),
    // Distingue fauna (animales, sin habla) de NPCs de verdad dentro de `npcsInScene` — ambos
    // comparten la misma tabla Npc/detección por alias (ver comentario del bloque de diálogo más
    // abajo, bug real 2026-07-23).
    prisma.harvestYield.findMany({ where: { worldId }, select: { sourceSlug: true } }),
    // Reputación de facción (2026-07-29) — necesaria YA aquí (no solo al persistir el delta más
    // abajo) para calcular el temperamento EFECTIVO de cada NPC en escena antes de decidir
    // shouldForceCombat (ver reputation.ts § effectiveTemperamento).
    // `agenda` (2026-08-30, auditoría "narrador vs. catálogo del mundo", hallazgo 2) añadido al
    // mismo `select` — `regionControlFor` (control regional) ya se exponía al frontend
    // (GET /saves/:id/zona) pero nunca llegaba al narrador, así que la prosa podía describir calma
    // en una región que el propio mapa ya mostraba en disputa/conquistada.
    prisma.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true, agenda: true } }),
    // Anti-repetición (2026-07-30, auditoría "revisar partida" — queja explícita: "redundancias
    // con la palabra sombra o cosas de este estilo"): el Narrador nunca veía su propia narración
    // de turnos anteriores, solo `sessionFacts` (hechos discretos, nunca prosa) — sin eso, no
    // tiene forma de saber que ya usó "sombra" dos veces seguidas hace un momento. Se le pasa el
    // último párrafo narrado tal cual, con instrucción explícita de variar el lenguaje.
    // `isSystemMessage: false` (bug real, sesión autónoma de pruebas 2026-09-04: "Gorhorn asume su
    // clase: GUERRERO." — un mensaje de sistema determinista, no narración del LLM — se pasó como
    // "tu propia narración del turno anterior" y el modelo lo repitió literalmente al inicio del
    // turno siguiente) — sin este filtro, cualquier LogEntry construido a mano (elegir clase,
    // subir de nivel, "se pone a ello: ...", recompensa de misión...) podía colarse aquí igual que
    // una narración real, engañando tanto la instrucción de variar lenguaje como `isTooSimilarToLast`.
    prisma.logEntry.findFirst({
      where: { saveId, channel: 'CHARACTER', isPlayerAction: false, isSystemMessage: false },
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
  const factionsStatus = parseFactionsStatus(worldStateForFactionsAndAgenda?.factionsStatus);

  // Grupo 3 § Mundo determinista, Capa 4 (docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25) —
  // disparo real: si esta partida tiene un `CombatEncounter` real EN_CURSO y jugable (Combate
  // múltiple), el turno se resuelve por ese motor en vez del 1v1 clásico de siempre — ver el
  // bloque de resolución más abajo (tras `abilityAttributeBonus`). Detectado aquí, pronto, para
  // poder desactivar `lootMode`/`combateActivo` del sistema antiguo y que los dos motores nunca
  // compitan por el mismo turno.
  const activeCombatEncounter = await prisma.combatEncounter.findFirst({ where: { saveId, estado: 'EN_CURSO', jugable: true } });

  // Eventos de viaje interactivos (2026-08-05): si este turno resuelve un viaje truncado por una
  // interrupción (turn.ts, pickTravelInterruption/pickStationaryInterruption), el NPC elegido
  // entra en escena de forma DETERMINISTA — a diferencia del resto de `npcsInScene` (detectado
  // por texto vía detectNpcsInScene), este no depende de que el Narrador narre su nombre. Se
  // resuelve antes del filtro de Gistera para que shouldForceCombat/npcSceneBlockFor/
  // dialogueTarget más abajo lo traten exactamente igual que a cualquier otro NPC ya detectado.
  //
  // Grupo 3 § Mundo determinista, Capa 3, pieza A (2026-08-25) — `upsert` en vez de `findUnique`:
  // hasta ahora esto solo LEÍA el `NpcState`, nunca lo creaba — si el turno no incluía golpe/
  // saqueo real contra este NPC (p.ej. el jugador dialoga, huye, o simplemente ignora el
  // encuentro), la fila nunca llegaba a existir, y la única forma de que este NPC "siguiera en
  // escena" turnos después era que el modelo lo repitiera en `newFacts` — exactamente el mecanismo
  // sin control que esta sesión está cerrando. Mismo patrón ya probado en `cazar.ts` (caza en
  // grupo, upsert a ILESO antes de cualquier combate real).
  let npcsInSceneWithInterruption = npcsInSceneRaw;
  // Franja 1b (2026-09-08, "Interactuar" motor unificado de eventos de escena) — slug/nombre del
  // NPC/fauna de la interrupción, capturados aquí para armar la oferta de Interactuar más abajo
  // (línea ~6475) en vez del aviso de texto fijo de antes. `pickTravelInterruption` (travelInterruption.ts)
  // solo elige entre `homeLocationSlug: null` (fauna itinerante sin asentamiento) — nunca un NPC con
  // nombre propio, esos siempre tienen Location de origen fija — así que `tipo: 'FAUNA'` siempre es
  // correcto aquí, sin ambigüedad que resolver.
  //
  // Bug real detectado en revisión (2026-09-08, ANTES de llegar a jugarlo en vivo, gracias al test
  // de integración ya existente "el viaje se trunca... el combate se fuerza SIN que el mock del LLM
  // mencione al agresor"): `pickTravelInterruption` NO filtra por temperamento (a diferencia de
  // `decideOfertaModoDinamico`, que sí excluye AGRESIVO) — un NPC agresivo de interrupción fuerza
  // combate real vía `agresivoSlugsInScene`/`resolveCombatSlugsAndPersist` más abajo, calculado a
  // partir de `npcsInScene` YA con la interrupción incluida. Ofrecer "Interactuar" (charla tranquila)
  // contra alguien que en el MISMO turno ya te está atacando sería incoherente — mismo criterio que
  // ya aplica `decideOfertaModoDinamico`, aquí replicado con `effectiveTemperamento`.
  let interruptionCandidateForOffer: { targetSlug: string; targetName: string } | null = null;
  if (travelInterruptionNpcId) {
    const alreadyInScene = npcsInSceneRaw.find((n) => n.id === travelInterruptionNpcId);
    if (alreadyInScene) {
      const t = effectiveTemperamento(alreadyInScene.temperamento, alreadyInScene.faction, factionsStatus);
      if (t !== 'AGRESIVO' && t !== 'ENEMIGO') {
        interruptionCandidateForOffer = { targetSlug: alreadyInScene.slug, targetName: alreadyInScene.name };
      }
    } else {
      const interruptionNpc: NpcWithItems | null = await prisma.npc.findUnique({
        where: { id: travelInterruptionNpcId },
        include: { items: { include: { item: true } } },
      });
      if (interruptionNpc) {
        const interruptionLocationId = travel?.toLocationId ?? currentLocationId;
        const interruptionScope = scopeFor(interruptionNpc.kind, interruptionLocationId);
        const interruptionState = await prisma.npcState.upsert({
          where: { saveId_npcId_scope: { saveId, npcId: interruptionNpc.id, scope: interruptionScope } },
          create: { saveId, npcId: interruptionNpc.id, scope: interruptionScope, condicionFisica: 'ILESO' },
          update: {},
        });
        npcsInSceneWithInterruption = [...npcsInSceneRaw, buildNpcInScene(interruptionNpc, interruptionState)];
        const t = effectiveTemperamento(interruptionNpc.temperamento, interruptionNpc.faction, factionsStatus);
        if (t !== 'AGRESIVO' && t !== 'ENEMIGO') {
          interruptionCandidateForOffer = { targetSlug: interruptionNpc.slug, targetName: interruptionNpc.name };
        }
      }
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
  // presente casi siempre. Bug real jugando en vivo (2026-09-06): sin una segunda vía por nombre
  // propio directo ("Busco al Orco enfurecido"), el reveal determinista de más abajo nunca se
  // disparaba tras el primer encuentro. `PURSUER_REFERENCE_REGEX`/`PURSUER_NAME_REFERENCE_REGEX`
  // ahora viven en playerActionValidation.ts (2026-09-07) — el validador de `turn.ts`, que corre
  // ANTES que este bloque, necesita el MISMO vocabulario para no rechazar un turno que este bloque
  // sí habría resuelto un instante después (ver `isPursuerOrcoInScene`, mismo archivo).
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
    (PURSUER_REFERENCE_REGEX.test(action) || PURSUER_NAME_REFERENCE_REGEX.test(action)) &&
    (detectsSearchIntent(action) || detectsAttackIntent(action) || detectsHostileSearchIntent(action)) &&
    !npcsInSceneWithInterruption.some((n) => n.slug === 'orco-enfurecido-hondonada')
  ) {
    const pursuerNpc: NpcWithItems | null = await prisma.npc.findFirst({
      where: { worldId, slug: 'orco-enfurecido-hondonada', saveId: null },
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
  // Bonus de atributo fijo por habilidad (2026-08-24, Grupo 3 § Sistema de clases, clases.md §
  // "Habilidad de daño vs ataque básico") — antes ninguna habilidad se diferenciaba mecánicamente
  // de un Ataque Básico salvo el atributo/multiplicador de tipo. Se suma al valor CRUDO del
  // atributo antes del multiplicador de tipo (ver `ExchangeParticipant.attributeBonus`,
  // combatExchange.ts) — sube el mismo modificador que subiría el atributo en sí, no un bono
  // plano a la tirada como `bonoTirada` (equipo de defensa).
  const abilityAttributeBonus = selectedAbilityData?.attributeBonus ?? 0;
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
  // Bug real (2026-08-31, auditoría de cuelgues de turno): sin este try/catch, un timeout real de
  // `retrieveLore` (Postgres/Supabase remoto colgado — ver el comentario de `withQueryTimeout` en
  // retrieval.ts) rompía el turno ENTERO con un error no capturado, arrastrando consigo el candado
  // de `turnLock.ts` (nunca se libera si `narrateAndPersistTurn` nunca llega al `finally`). Degradar
  // a `[]` (mismo resultado que ya maneja bien `isWeaklyGrounded`, "sin lore relevante") es
  // preferible a colgar la partida entera por un problema de red ajeno a la propia narración.
  const retrieved = enCombate
    ? []
    : await retrieveLore(regionLabel ? `${action} — ${regionLabel}` : action, worldId, 4, excludeTags).catch((err) => {
        console.warn(`[retrieveLore] fallo o timeout, continuando sin lore RAG: ${err instanceof Error ? err.message : err}`);
        return [];
      });
  // Bug real del roadmap 2026-07-19: sin exigir `enCombate`, "le compro una ración a Torgash"
  // fuera de combate copiaba TODO su loadout gratis, sin tirada y con el NPC vivo — el regex solo
  // miraba el verbo. No hay estado persistido de "NPC derrotado" (la condición de los NPCs en
  // combate vive solo en memoria del popup, CombatModal.tsx), así que la señal fiable disponible
  // es que la acción venga del propio popup de combate (única vía real con el botón "Registrar",
  // que siempre manda `enCombate:true`) — fuera de combate, como mucho el modelo puede proponer
  // un `newItem` suelto en la narración normal, nunca el inventario completo de un NPC vivo.
  const lootMode = !activeCombatEncounter && !!enCombate && npcsInScene.length > 0 && detectsLootIntent(action);

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
  // absoluto (se podía "registrar" a un NPC en ILESO/HERIDO/GRAVE) y además saqueaba TODOS los
  // npcsInScene a la vez, no solo al objetivo — un aliado ileso de pie al lado del enemigo derrotado
  // (p. ej. Gistera Koh junto al Orco Enfurecido) se saqueaba igual sin que el jugador lo pidiera.
  // Mismo patrón que `explicitTarget` para el ataque: si la acción cita un nombre entre comillas, el
  // saqueo se limita a ese NPC; si no, se limita a los NPCs realmente derrotados en escena.
  //
  // CONVALECIENTE deja de ser saqueable (2026-08-26, decisión explícita junto con el rediseño
  // Matar/Capturar/Clemente) — solo MUERTO. Antes se podía saquear a alguien todavía vivo.
  const lootTargets = (explicitTarget ? [explicitTarget] : npcsInScene).filter((n) => n.condicionFisica === 'MUERTO');
  // "Matar"/"Decapitar" DEJA de ser un remate determinista sin tirada (REDISEÑADO 2026-08-30,
  // petición explícita: "matar tiene que abrir el combate de nuevo, no resolverse...lo de
  // resolverse es antiguo y ya no encaja") — antes `executeTargets`/`applyExecuteTargets`
  // interceptaban aquí y escribían MUERTO directo sin pasar por ningún intercambio; ahora el botón
  // (`useCombatFlow.ts § handleDecapitarSeleccion`) manda un ataque normal citando al NPC entre
  // comillas simples, y se resuelve por el mismo camino que cualquier otro ataque —
  // `npcParaIntercambio` ya NO excluye CONVALECIENTE (ver `combateActivo` más abajo), así que el
  // intercambio real cae sobre él con su malus de condición (`CONDICION_MALUS.CONVALECIENTE`,
  // el peor de la tabla, `death.ts`) aplicado como riesgo real pero bajo.
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
  // Bug real jugando en vivo (2026-08-29, "el combate contra el Kirelon Arenoso redirigió el golpe
  // a Gistera Koh" — mismo síntoma exacto que el bug de 2026-08-04 de arriba, pero en el PRIMER
  // golpe de un encuentro nuevo, no en un ataque de seguimiento): el jugador citó "Kirelon Arenoso"
  // con comillas DOBLES (formato que el composer de texto libre permite escribir a mano, pero que
  // `explicitTarget` no reconoce — solo comillas simples, el único formato que genera el mecanismo
  // real de citar por nombre, ver `ChatComposer.tsx`). Sin `explicitTarget` ni `ongoingCombatTarget`
  // resueltos, y con Gistera Koh presentándose en la MISMA narración de este turno (ahora en
  // `npcsInScene`, sin ninguna relación con el orden de detección), el fallback caía en ella —
  // pacífica por diseño (CAUTELOSO), nunca debería recibir un golpe mecánico sin que el jugador la
  // citara de verdad. El fallback ahora prioriza un NPC realmente hostil (mismo criterio de
  // `effectiveTemperamento` que decide `agresivoSlugsInScene`/`shouldForceCombat`) sobre uno
  // pacífico — un NPC pacífico solo puede ser objetivo real de un golpe si el jugador lo cita
  // explícitamente (comillas simples) o ya había combate en marcha contra él.
  const npcsHostilesEnEscena = npcsInSceneVivos.filter((n) => {
    const t = effectiveTemperamento(n.temperamento, n.faction, factionsStatus);
    return t === 'AGRESIVO' || t === 'ENEMIGO';
  });
  // Auditoría "narrador vs. motor determinista" (2026-08-30, bug real jugando: "Exploro la zona"
  // narró a Quio — INOFENSIVO por catálogo — comportándose como agresor, mientras el combate REAL
  // que el motor abrió más abajo (`resolveCombatSlugsAndPersist`, mismas ~1850 líneas después) fue
  // contra Kirelon Arenoso, el único de verdad AGRESIVO en la escena). Causa raíz: el narrador
  // nunca sabía quién de los NPC en escena podía ser agresor real — la instrucción de prompt
  // dejaba "combateIniciado" totalmente libre para cualquier slug de `npcSlugsInScene`, y los
  // guards existentes (`hasFalseCombatTargetName`/`hasWrongNpcName`) solo se activan si YA hubo un
  // intercambio de combate resuelto este turno (`exchangeHappened`), nunca en la APERTURA de
  // combate desde una acción pasiva. Mismo patrón ya usado con éxito en este archivo para
  // `restAttemptedForGuard`/`restHealCeilingBelowIleso` (ver más abajo): duplicar aquí, antes de
  // narrar, un dato que de otro modo solo estaría disponible ~1850 líneas después.
  const npcsNoHostilesEnEscena = npcsInSceneVivos.filter((n) => !npcsHostilesEnEscena.includes(n));
  const nonHostileNpcNamesInScene = npcsNoHostilesEnEscena.map((n) => n.name);
  // Slugs (no nombres) para el guard estructurado `hasWrongAggressorName` — compara directamente
  // contra `combateIniciado.npcSlugs` (campo estructurado que el propio LLM devuelve, sin depender
  // de parsear texto libre con regex).
  const nonHostileNpcSlugsInScene = npcsNoHostilesEnEscena.map((n) => n.slug);
  const candidateAttackTarget =
    explicitTarget ?? ongoingCombatTarget ?? npcsHostilesEnEscena[0] ?? npcsInSceneVivos[0] ?? npcsInScene[0] ?? null;
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
  // REDISEÑO 2026-08-30 (ver comentario largo de `executeTargets`/`lootTargets` más arriba): el
  // guard `condicionFisica !== 'CONVALECIENTE'` se retira — antes bloqueaba a propósito que
  // "Matar" cayera aquí (el remate vivía en el atajo determinista ya retirado), ahora un NPC
  // CONVALECIENTE es un objetivo de intercambio real como cualquier otro, con su malus de
  // condición aplicado en `rollSide` (combatExchange.ts). Sigue sin poder atacarse a un MUERTO —
  // ese sí es terminal de verdad, nada que resolver contra un cadáver.
  const combateActivo =
    !activeCombatEncounter &&
    enCombate &&
    !lootMode &&
    npcsInScene.length > 0 &&
    npcParaIntercambio &&
    npcParaIntercambio.condicionFisica !== 'MUERTO' &&
    // CANALIZAR real (2026-09-09) — una canalización pendiente exige entrar al intercambio de
    // combate igual que un ataque/defensa deliberados, mismo criterio que `pendingNpcStillHere`:
    // el turno siguiente SIEMPRE debe resolver (disparar o cortar) la canalización, sin importar
    // qué texto/habilidad mande el frontend.
    (!!pendingNpcStillHere || tomaAccionDeCombate || !!pendingCanalizacion);

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
  // Mismo gate que effects/rol de arriba (2026-08-24) — una habilidad que ya agotó su
  // `maxUsesPerCombat` no debería seguir dando su bonus de atributo tampoco.
  const abilityAttributeBonusForExchange = playerAbilityUsageBlocked ? 0 : abilityAttributeBonus;

  const {
    npcAttackTarget,
    npcAttackHits,
    npcTargetNewCondicion,
    jugadorRecibeGolpe,
    jugadorGolpeEfectos,
    nuevoPendingNpcAttack,
    nuevoPendingCanalizacion,
    exchangeNarrationBlock,
    combatExchangeRoll,
    npcAbilityUsed,
    nextInitiativeRoll,
    exchangeHappened,
    playerActedAsDefenderThisExchange,
    npcAttackerIsInoffensive,
    npcNuevaEnergia,
    abilityEffectHint,
    combatExchangeDisplay,
    playerAbilityUsed,
    analizarRivalExito,
    jugadorRecuperacionExtra,
    jugadorActiveEffectsNext,
    npcActiveEffectsNext,
  } = resolveCombatExchangePhase({
    combateActivo,
    npcParaIntercambio,
    jugadorRaza: params.raza,
    isFirstExchangeOfCombat: !enCombate,
    pendingNpcAttack,
    pendingCanalizacion,
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
    abilityAttributeBonus: abilityAttributeBonusForExchange,
    selectedAbility: selectedAbilityData ? { name: selectedAbilityData.name, icon: selectedAbilityData.icon, description: selectedAbilityData.description } : null,
    openingAmbush,
    rollGradoExito: roll?.gradoExito ?? null,
    jugadorActiveEffects: params.activeEffects,
    npcActiveEffects: npcParaIntercambio?.activeEffects ?? [],
    abilityDurationEffectMagnitude: playerAbilityUsageBlocked ? null : (selectedAbilityData?.durationEffectMagnitude ?? null),
    abilityDurationEffectTurns: playerAbilityUsageBlocked ? null : (selectedAbilityData?.durationEffectTurns ?? null),
  });

  // Mutable aparte de `combatExchangeDisplay` (2026-09-04, auditoría "buscar tiradas de dados sin
  // representar") — `combatExchangeDisplay` viene desestructurado como `const` de
  // `resolveCombatExchangePhase` (solo cubre el 1v1 clásico); el bloque de combate múltiple de
  // más abajo (`if (activeCombatEncounter)`) también puede producir un intercambio real con
  // tirada, y necesita poder fijarlo. Inicializada con el valor del 1v1 para que los 3 usos
  // posteriores (animación en vivo, persistencia en LogEntry, `return` final) sigan funcionando
  // igual cuando NO hay combate múltiple de por medio.
  let combatExchangeDisplayFinal: CombatExchangeDisplay | null = combatExchangeDisplay;

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
  // Ver `hasFalseCombatMiss` (narrador.ts) — mismo bug que `combatRealHitLanded`, pero para un
  // ataque que NUNCA pasó por `resolveCombatExchangePhase` (bug real jugando en vivo, sesión
  // autónoma 2026-09-05: "Ataco al Quio con otro tajo" contra fauna sin combate formal todavía
  // abierto — tirada de Destreza genérica, roll 17+5=22 vs 15, `success:true`/`gradoExito:'claro'`,
  // pero la narración dijo "su objetivo evita el golpe ágilmente"). `exchangeHappened` exige que el
  // NPC ya esté en un intercambio de combate real — un ataque contra fauna/NPC pasivo antes de que
  // se abra combate formal se resuelve como tirada de acción libre (`roll` de `classification`),
  // camino que ningún guard de honestidad narrativa cubría hasta ahora.
  const nonExchangeAttackHitLanded = !exchangeHappened && countsAsAttack && roll?.success === true;

  // Narrar inconsciencia (docs/mecanicas/19-post-combate-y-recompensas-mision.md, pieza 1) — true SOLO en
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
  // sangre en el suelo") pero escribió en `newFacts` "Zense Ceniza ha sido derrotado y muerto." —
  // un hecho de sesión falso que queda persistido para siempre (`appendSessionFacts`) sin que
  // ningún guard existente lo comprobara (todos estaban gateados por `npcFallsUnconsciousThisTurn`/
  // `npcFallsConvalecienteThisTurn`, que exigen que la muerte SÍ haya pasado este turno — el hueco
  // real es el caso contrario, cuando NO ha pasado y el modelo la reclama de todos modos). True en
  // cualquier turno con un golpe real contra el NPC que NO lo deja MUERTO de verdad.
  //
  // Ampliado con `combatBothMissed` (bug real jugando en vivo, 2026-09-03, "narración de muerte
  // falsa tras un Fallo"): la condición original exigía `npcAttackHits` (el golpe del jugador
  // conectó de verdad) — un turno con tirada Fallo total (`combatBothMissed`, ningún lado conecta)
  // quedaba completamente fuera de este guard, así que un remate narrado con pleno detalle
  // ("emite un ruido lastimero antes de quedarse inmóvil") sobre una tirada real de Fallo (🎲3+5=8
  // vs 15, NpcState nunca creado) nunca se detectaba. Mismo criterio exacto que ya usa
  // `hasFalseCombatHit` para este mismo `combatBothMissed` — si nadie conectó, nadie puede haber
  // muerto de verdad.
  const combatNoRealDeathThisTurn = exchangeHappened && (!!npcAttackHits || combatBothMissed) && npcTargetNewCondicion !== 'MUERTO';

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
  // Punto del jugador en el mapa de Zona (2026-09-04) — al llegar a una Location nueva, aparece en
  // el borde del lienzo correspondiente a la dirección por la que se entra (nunca el centro). Se
  // calcula aquí (fuera de la transacción de escritura, con `destination` ya cargado para el
  // prompt) y se persiste más abajo en el mismo `tx.save.update` final. `null` = sin coordenadas
  // reales de mundo en origen/destino (Location.x/y opcional) — fallback al centro del lienzo.
  let zonaEntradaCoords: { x: number; y: number } | null = null;
  if (travel) {
    const destination = await prisma.location.findUnique({ where: { id: travel.toLocationId } });
    activeRegion = destination?.region ?? null;
    if (destination?.x != null && destination?.y != null) {
      const origenLoc = currentLocationId ? await prisma.location.findUnique({ where: { id: currentLocationId }, select: { x: true, y: true } }) : null;
      const origenX = origenLoc?.x;
      const origenY = origenLoc?.y;
      // Entrada = la salida de la zona destino que lleva al ÚLTIMO tramo recorrido (2026-09-28, bug
      // real jugando en vivo con Playwright): antes se usaba el sector cardinal de origen→destino
      // del viaje ENTERO — en un viaje de varios tramos (A→B→C) el jugador podía aparecer en C por un
      // borde sin ninguna salida hacia B, y las salidas se colocaban con otro criterio distinto
      // (varias apiladas en el mismo píxel). Mismo cálculo exacto que los iconos de salida de
      // `GET /zona` (`posicionesDeSalidas`), así que llegas justo sobre la salida por la que vuelves.
      const previoId = travel.pathIds.length >= 2 ? travel.pathIds[travel.pathIds.length - 2] : null;
      const entradaPorSalida = previoId ? await posicionDeSalidaHacia(destination.id, { x: destination.x, y: destination.y }, previoId) : null;
      if (entradaPorSalida) {
        zonaEntradaCoords = entradaPorSalida;
      } else if (origenX != null && origenY != null) {
        const direccionDeViaje = cardinalDirectionBetween({ x: origenX, y: origenY }, { x: destination.x, y: destination.y });
        zonaEntradaCoords = puntoDeEntradaParaDireccion(direccionDeEntrada(direccionDeViaje));
      } else {
        // Sin origen con coordenadas de mundo (p.ej. primera Location de la partida) — no hay
        // dirección real que calcular, pero el jugador SÍ necesita un punto: centro del lienzo.
        zonaEntradaCoords = { x: 400, y: 300 };
      }
    }
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
    // Narración de viaje tramo a tramo (diseño 2026-08-28, "retomar viaje tras evento" — pendiente
    // aparte — más esta pieza: la ruta ya se calculaba y pasaba entera al narrador, pero sin pedir
    // explícitamente que nombrara las zonas intermedias, así que solía perderse en la primera o
    // saltar directa al destino. Solo aplica con 2+ tramos reales (viaje directo de 1 tramo no
    // tiene zona intermedia que nombrar, pedirlo ahí sería una instrucción vacía).
    const zonasIntermedias = travel.segments.slice(0, -1).map((s) => s.toName);
    const tramoHint =
      zonasIntermedias.length > 0
        ? ` El trayecto pasa por ${zonasIntermedias.length === 1 ? 'una zona intermedia real' : `${zonasIntermedias.length} zonas intermedias reales`} (${zonasIntermedias.join(', ')}) — nómbra${zonasIntermedias.length === 1 ? 'la' : 'las'} de pasada en la narración, con algo breve y propio de cada una (terreno, un detalle sensorial), no como una simple lista.`
        : '';
    contextBlocks.push(
      `LLEGADA A ${travel.toLocationName}: ${destination?.description ?? ''}\nRUTA RECORRIDA: ${ruta}\nLa narración de este turno tiene que TERMINAR con el personaje ya en ${travel.toLocationName}, mencionando algo concreto y propio de este lugar (no solo del paisaje del camino) — puedes describir brevemente el trayecto, pero nunca a costa de dejar la llegada implícita o sin situar.${tramoHint}`,
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

      // Bug real jugando (docs/registros/revisar-partida-hallazgos.md, 2026-08-01, "bucle" de ambientación
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

  // Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 2): `regionControlFor` ya
  // se exponía al frontend (`GET /saves/:id/zona`, ver `zona.ts`) para pintar "Territorio de
  // X"/"En disputa" bajo el nombre de la zona, pero nunca llegaba al narrador — la prosa podía
  // describir calma en una región que el propio mapa del jugador ya mostraba en guerra abierta.
  // Mismos inputs que `zona.ts` (duenoOriginal de `REGION_OWNING_FACTIONS`, agenda parseada) —
  // solo se anota cuando hay conflicto real (nunca en el caso neutro, para no inflar contexto).
  if (activeRegion) {
    const duenoOriginal = REGION_OWNING_FACTIONS[activeRegion]?.[0] ?? null;
    if (duenoOriginal) {
      // Fase D (hito 0.1) — de la relación real Serhu→defensor (worldAgenda.ts § regionControlActual).
      const regionControl = await regionControlActual(prisma, await ambitoFacciones(prisma, saveId), activeRegion, parseAgenda(worldStateForFactionsAndAgenda?.agenda), duenoOriginal);
      if (regionControl.estado === 'CONQUISTADA') {
        contextBlocks.push(`CONTROL DE LA REGIÓN (${activeRegion}): conquistada por ${regionControl.duenoActual} — refleja este dominio en la ambientación (patrullas, banderas, tensión propia de territorio ocupado), no la narres como si siguiera en calma neutral.`);
      } else if (regionControl.estado === 'EN_DISPUTA') {
        contextBlocks.push(`CONTROL DE LA REGIÓN (${activeRegion}): en disputa abierta entre ${regionControl.agresor} y ${regionControl.duenoActual} — refleja esta tensión de guerra en la ambientación (patrullas nerviosas, rastros de conflicto reciente), no la narres como si fuera una zona tranquila.`);
      }
    }
  }

  // Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 5): `Territory`/`Building`/
  // `Subject` solo se releían DESPUÉS de toda la transacción del turno (más abajo, solo para la
  // respuesta HTTP al frontend) — el narrador nunca sabía que el jugador ya fundó un territorio
  // aquí, con qué edificios/súbditos reales, así que podía describir un campamento vacío o
  // inventar edificios/súbditos distintos a los reales en cualquier turno posterior al de fundar/
  // construir. Acotado a lo relevante a ESTA escena: territorios de la región activa (o
  // edificios/súbditos "libres" anclados a la ubicación exacta, sin territorio) — nunca el reino
  // entero, para no inflar contexto con dominios lejanos que no pintan nada aquí.
  if (activeRegion || currentLocationId) {
    const territoriosAqui = await prisma.territory.findMany({
      where: { saveId, ...(activeRegion ? { region: activeRegion } : {}) },
      select: { id: true, name: true, control: true, population: true },
    });
    const territorioIds = territoriosAqui.map((t) => t.id);
    const [edificiosAqui, subditosAqui] = await Promise.all([
      prisma.building.findMany({
        where: {
          saveId,
          OR: [...(territorioIds.length > 0 ? [{ territoryId: { in: territorioIds } }] : []), ...(currentLocationId ? [{ locationId: currentLocationId, territoryId: null }] : [])],
        },
        select: { name: true, kind: true, status: true },
      }),
      territorioIds.length > 0 ? prisma.subject.findMany({ where: { saveId, territoryId: { in: territorioIds } }, select: { name: true, role: true } }) : Promise.resolve([]),
    ]);
    if (territoriosAqui.length > 0 || edificiosAqui.length > 0) {
      const territoriosTxt = territoriosAqui.map((t) => `${t.name} (${t.control}, población ${t.population})`).join('; ') || 'ninguno fundado aquí todavía';
      const edificiosTxt = edificiosAqui.length > 0 ? edificiosAqui.map((b) => `${b.name} (${b.kind}, ${b.status})`).join(', ') : 'ninguno';
      const subditosTxt = subditosAqui.length > 0 ? subditosAqui.map((s) => `${s.name} (${s.role})`).join(', ') : 'ninguno';
      contextBlocks.push(
        `TU DOMINIO AQUÍ: Territorio(s): ${territoriosTxt}. Edificios reales: ${edificiosTxt}. Súbditos reales: ${subditosTxt}. Esto es TODO lo que existe de verdad — no inventes edificios/súbditos distintos, ni describas el lugar como vacío si ya hay algo fundado aquí.`,
      );
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
  // Ponderado por población real + filtrado por región (docs/mecanicas/16-poblacion-dinamica.md,
  // 2026-08-03): antes se elegía uniforme entre TODA la fauna itinerante del mundo sin mirar
  // dónde estaba el personaje ni cuánta abundancia real tenía cada especie — cazar mucho una
  // especie en una zona ahora la hace de verdad más rara de encontrar ahí, y una especie extinta
  // (`poblacion === 0`) deja de sugerirse. Solo cuenta la fauna con fila de `WorldPopulation` real
  // y peso > 0 en la región activa — sin datos reales, no se sugiere nada (nunca se inventa).
  // Bug real jugando en vivo (2026-09-03, "atacar resuelto sin combate real"): un ataque EXPLÍCITO
  // contra algo sin nombre todavía ("ataco a lo que sea que me observa desde dentro") nunca podía
  // abrir combate — `detectNpcsInScene` solo resuelve por matching de alias, sin ningún candidato
  // que atacar el turno se resolvía como una tirada genérica (aquí, Destreza/aproximación), dejando
  // la amenaza sin identificar para siempre. `attackWithoutIdentifiedTarget` fuerza esta sugerencia
  // (antes 25% de probabilidad, "opcional para el modelo") a dispararse siempre que haga falta, y
  // el texto deja de sonar a sugerencia libre — el turno SIGUIENTE, ya con el nombre real
  // mencionado y matcheable, sí puede abrir combate por el camino normal (mismo criterio que
  // shouldForceCombat/tabulatedTarget, sin tocarlos: se resuelve un turno antes, en el reveal).
  const attackWithoutIdentifiedTarget = npcsInScene.length === 0 && !enCombate && !lootMode && !harvestMatch && detectsAttackIntent(action);
  if (npcsInScene.length === 0 && !enCombate && !lootMode && !harvestMatch && activeRegion && (attackWithoutIdentifiedTarget || Math.random() < 0.25)) {
    // `orderBy` explícito (bug de testabilidad real encontrado 2026-09-09): sin él, Postgres no
    // garantiza ningún orden estable — `pickAmbientEncounterCandidate` con `random()` mockeado a un
    // valor fijo (tests deterministas) depende del orden de esta lista para decidir el candidato, y
    // ese orden podía cambiar sin ningún cambio de comportamiento real (p.ej. tras un
    // upsert/reinserción del seed). El peso ponderado real (`WorldPopulation.poblacion`) sigue
    // siendo lo único que importa en producción con `Math.random()` real — esto solo fija el orden
    // de iteración para que sea reproducible en pruebas.
    const itinerantCandidates = await prisma.npc.findMany({
      where: { worldId, kind: 'PLANTILLA', homeLocationSlug: null, muertoEnMundo: false },
      select: { slug: true, name: true, role: true, temperamento: true, faction: true },
      orderBy: { slug: 'asc' },
    });
    if (itinerantCandidates.length > 0) {
      const populationRows = await prisma.worldPopulation.findMany({
        where: { ...(await ambitoPoblacion(prisma, saveId)), targetType: 'FAUNA', targetSlug: { in: itinerantCandidates.map((c) => c.slug) } },
      });
      const populationBySlug = new Map(populationRows.map((row) => [row.targetSlug, row]));
      // Fauna diurna/nocturna real (2026-09-02) — mismo criterio "sin dato = sin filtrar" que
      // terreno/estación/clima: un candidato SIN entrada en `faunaMomentoDelDia` nunca se descarta
      // aquí. Con entrada, solo sigue siendo candidato si el momento del día real del turno
      // (`momentoDelDiaFor`, worldClock.ts) coincide — un Nuente no se sugiere de día.
      const momentoActual = momentoDelDiaFor(fictionalMinutesActuales);
      const itinerantCandidatesDeHora = itinerantCandidates.filter((c) => {
        const requerido = faunaMomentoDelDia[c.slug];
        return !requerido || requerido === momentoActual;
      });
      const weightedCandidates = itinerantCandidatesDeHora
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
        // Auditoría "narrador vs. motor determinista" (2026-08-30, Hallazgo 3): antes esta
        // sugerencia no decía si el candidato es pacífico u hostil por catálogo — el modelo podía
        // "aceptar" la sugerencia y narrarlo agresivo aunque fuera INOFENSIVO por diseño, mismo
        // hueco exacto que el bug de Quio/Kirelon, aquí en la puerta de entrada de aparición
        // ambiental en vez de en la decisión de combate. `pickAmbientEncounterCandidate` devuelve
        // el tipo compartido `AmbientEncounterCandidate` (sin temperamento/facción, usado también
        // por travelInterruption.ts/stationaryInterruption.ts) — se busca el candidato completo
        // por slug en vez de ampliar ese tipo compartido.
        const fullCandidate = itinerantCandidates.find((c) => c.slug === candidate.slug)!;
        const t = effectiveTemperamento(fullCandidate.temperamento, fullCandidate.faction, factionsStatus);
        const temperamentoHint = t === 'AGRESIVO' || t === 'ENEMIGO' ? 'es hostil por naturaleza' : 'es pacífico por naturaleza — no lo narres iniciando un ataque';
        contextBlocks.push(
          attackWithoutIdentifiedTarget
            ? `EL PERSONAJE ACABA DE ATACAR ALGO QUE TODAVÍA NO TIENE NOMBRE ("${action}") — el motor no puede resolver un combate contra una amenaza sin identificar. Narra este turno la REVELACIÓN de a qué se enfrenta: es ${candidate.name} (${candidate.role}), que ${temperamentoHint}. Usa ese nombre exacto y real en tu narración — no dejes al personaje golpeando algo anónimo, y no resuelvas el desenlace del ataque todavía: el combate en sí se librará en el turno siguiente, una vez el nombre ya es conocido.`
            : `SUGERENCIA OPCIONAL DE ENCUENTRO (úsala solo si encaja de forma natural con la escena, ignórala si no): el personaje podría cruzarse aquí con ${candidate.name} (${candidate.role}), que ${temperamentoHint}. Si decides introducirlo, usa ese nombre exacto para que el motor lo reconozca de verdad.`,
        );
      }
    }
  }

  // Tope de bloque completo por NPC (2026-08-28, "cuelgue con modelo grande" — `contextBlocks` sin
  // límite crecía con CADA NPC en escena, bio+personalidad+items completos por cada uno; medido en
  // 1104 tokens para solo 3 NPCs reales de una partida real). `npcParaIntercambio` (ya calculado
  // arriba como el objetivo real de combate/intercambio de ESTE turno) va siempre con prioridad
  // máxima al bloque completo — es el único NPC del que el modelo necesita matiz narrativo real
  // este turno. El resto, hasta completar el tope, entra por orden de aparición; los que sobran
  // reciben solo `npcSceneLineFor` (línea corta que preserva estado/género/fauna-sin-habla, sin
  // bio/personalidad/items) — evita que un NPC de fondo "desaparezca" del contexto (reintroduciría
  // el bug de aparición/resurrección no autorizada) sin pagar el coste completo de tokens.
  const NPC_BLOQUE_COMPLETO_TOPE = 3;
  const npcsConBloqueCompleto = [
    ...(npcParaIntercambio ? [npcParaIntercambio] : []),
    ...npcsInScene.filter((npc) => npc !== npcParaIntercambio),
  ].slice(0, NPC_BLOQUE_COMPLETO_TOPE);
  for (const npc of npcsInScene) {
    contextBlocks.push(npcsConBloqueCompleto.includes(npc) ? npcSceneBlockFor(npc, params.currentLevel, factionsStatus) : npcSceneLineFor(npc, params.currentLevel));
  }
  // Ver `hasResurrectedDeadNpc` (narrador.ts) — bug real jugando en vivo (2026-08-01, "el orco que
  // maté volvió a aparecer"): con el Orco Enfurecido MUERTO y saqueado desde hacía varios turnos,
  // "Exploro la zona" narró que Gorhorn reconocía "huellas recientes" suyas, como si siguiera vivo
  // y merodeando. `npcSceneBlockFor` (arriba) ya le da al modelo la instrucción de tratarlo solo
  // como recuerdo, pero puede ignorarla igual que el resto de instrucciones "no hagas X" de esta
  // sesión — mismo criterio: comprobar el texto ya generado, no confiar solo en la instrucción.
  const possiblyResurrectedNpcNamesEnEscena = npcsInScene.filter((n) => n.condicionFisica === 'CONVALECIENTE' || n.condicionFisica === 'MUERTO').map((n) => n.name);
  // Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 7): el bloque de arriba solo
  // cubre NPCs que YA entraron en `npcsInScene` por matching de texto/alias — un NPC muerto/
  // convaleciente que nunca entra ahí, pero SÍ aparece en el `backgroundLore` recuperado por RAG
  // (por similitud semántica con la acción actual, sin que su nombre esté en la acción ni en
  // `sessionFacts` recientes), quedaba sin ningún guard que lo cazara si el modelo lo narraba como
  // amenaza activa. Ampliado a cualquier NPC MUERTO/CONVALECIENTE de esta partida (`NpcState`) cuyo
  // nombre aparezca en el propio texto del lore recuperado — acotado a lo relevante de este turno,
  // no el historial completo de la partida, para no inflar la lista con NPCs sin relación.
  const loreText = retrieved.map((r) => `${r.title} ${r.text}`).join(' ');
  const possiblyResurrectedNpcNamesFueraDeEscena =
    loreText.length > 0
      ? (await prisma.npcState.findMany({ where: { saveId, condicionFisica: { in: ['CONVALECIENTE', 'MUERTO'] } }, select: { npc: { select: { name: true } } } }))
          .map((s) => s.npc.name)
          .filter((name) => !possiblyResurrectedNpcNamesEnEscena.includes(name) && loreText.includes(name))
      : [];
  const possiblyResurrectedNpcNames = [...possiblyResurrectedNpcNamesEnEscena, ...possiblyResurrectedNpcNamesFueraDeEscena];

  // Ver `hasFalseNpcAppearance` (narrador.ts) — Grupo 3 § Mundo determinista, Capa 3, pieza B
  // (2026-08-25): candidatos geográficamente plausibles (mismo filtro que `detectNpcsInScene`)
  // que NINGÚN mecanismo determinista puso en `npcsInScene` este turno — si el modelo los hace
  // "aparecer" en prosa o en `newFacts`, es exactamente el hueco sin control que investigó esta
  // sesión (`newFacts` libre → `sessionFacts` → detectado en un turno futuro sin ningún gatillo
  // real de juego).
  const possiblyUnauthorizedNpcNames = await candidateNpcNamesNotInScene(
    worldId,
    saveId,
    currentLocationId,
    new Set(npcsInScene.map((n) => n.id)),
  );

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

  // Menú contextual de interacción con NPC (2026-09-06, "Aprender oficio" deja de depender de una
  // habilidad suelta) — solo para NPC con `interactionTypes` sembrado a mano en el catálogo (la
  // inmensa mayoría de NPC sigue con interacción libre de siempre, sin este menú de por medio).
  // Deliberadamente excluye a Gistera Koh: su oferta de misión sigue un guion propio de 2 fases con
  // su propia tarjeta (`newQuestOfferInfo` más abajo) — mezclar ambas tarjetas para el mismo NPC
  // sería peor UX, no mejor. `hayMisionOfertadaDeEsteNpc` se resuelve más abajo, tras calcular
  // `newQuestOfferInfo` de este turno (necesita su valor definitivo).
  const npcInteractionCandidate =
    dialogueTarget && dialogueTarget.slug !== 'gistera-koh' && dialogueTarget.interactionTypes.length > 0 ? dialogueTarget : null;

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
  // explícitamente. "Decapitar"/"Matar" (REDISEÑADO 2026-08-30) ya no tiene un camino aparte aquí —
  // es un ataque normal como cualquier otro, así que si resolvió un intercambio real,
  // `exchangeHappened` ya es `true` y este aviso no se dispara (mismo criterio que el resto de
  // combate); si no llegó a resolver ninguno, sí debe avisarse igual que cualquier otro ataque sin
  // intercambio mecánico todavía.
  const combatNotYetResolved = npcsInScene.length > 0 && !exchangeHappened;
  if (combatNotYetResolved) {
    contextBlocks.push(
      'Ningún intercambio de combate mecánico se ha resuelto todavía este turno — puedes narrar tensión, acercamiento, amenaza o preparativos, pero NUNCA un golpe que conecta, una herida infligida, ni el resultado ya decidido de una pelea (ni a favor ni en contra del personaje). Esa resolución solo existe cuando el propio sistema la calcula, en un turno futuro dentro del combate real.',
    );
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
  // Inventario del jugador al narrador (2026-08-27, auditoría: "el modelo narra sin lista real de
  // objetos... corregido después con 4-5 guards hasFalse* distintos" en vez de dársela de
  // antemano). Contexto determinista, mismo criterio que el resto de `contextBlocks`.
  contextBlocks.push(`INVENTARIO ACTUAL: ${inventorySummaryFor(inventoryRows)}`);
  // `ZonePoint` como instancia viva (2026-08-27, Pieza 3 de "Dinamismo del mundo") — recalculado
  // al vuelo en CADA turno real (nunca pre-cómputo, decisión explícita de sesión), proporcional al
  // tiempo de ficción que este turno YA va a consumir. `regionLocationId`/`regionLocation` son el
  // mismo criterio ya establecido en este archivo para "dónde está el jugador ahora mismo" (línea
  // ~4878: contempla viaje en curso, usa el destino si lo hay).
  if (regionLocationId) {
    await recalcularZonePointsDeLocation(
      prisma,
      worldId,
      saveId,
      regionLocationId,
      regionLocation?.region ?? null,
      advanceFictionalMinutes(fictionalMinutesActuales, minutosDeEsteTurno),
    );
    // Bloques separados por tipo (2026-09-15, bug real jugando en vivo) — antes una única lista
    // plana bajo "QUIÉN ESTÁ AQUÍ AHORA MISMO" mezclaba NPC/fauna/recursos sin distinguirlos, y el
    // modelo confundió una fauna ("Colmena de Lebude") con el apellido de una persona inventada
    // ("el pescador de Lebude"). Solo NPC son personas reales con las que se puede hablar — el
    // resto se etiqueta explícitamente como NO personas.
    const zonePointsSummary = await zonePointsSummaryFor(prisma, regionLocationId, saveId);
    if (zonePointsSummary?.npc) contextBlocks.push(`PERSONAJES AQUÍ AHORA MISMO (son gente real, puedes hablar con ellos): ${zonePointsSummary.npc}`);
    if (zonePointsSummary?.fauna) contextBlocks.push(`FAUNA AQUÍ AHORA MISMO (animales, NO son personas): ${zonePointsSummary.fauna}`);
    if (zonePointsSummary?.recurso) contextBlocks.push(`RECURSOS AQUÍ AHORA MISMO (materiales, NO son personas ni animales): ${zonePointsSummary.recurso}`);
    if (zonePointsSummary?.edificio) contextBlocks.push(`CONSTRUCCIONES AQUÍ AHORA MISMO: ${zonePointsSummary.edificio}`);
  }
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
          curaHambre: true,
          curaAgua: true,
          emptyContainerCatalogSlug: true,
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
        curaHambre: c.curaHambre,
        curaAgua: c.curaAgua,
        emptyContainerCatalogSlug: c.emptyContainerCatalogSlug,
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
  // Panel "Comer/Beber" (2026-09-04) — mismo patrón EXACTO que el bloque de Curar de arriba, pero
  // sin camino de texto libre en paralelo (Hambre/Sed nunca se detectaron por texto libre, solo
  // derivan del tiempo — ver companionSupervivencia.ts): la única vía de reponerlas es este panel.
  // Rediseño 2026-09-06 (hallazgo 11 de la sesión de pruebas, decisión explícita de la usuaria) —
  // `curaEnergia` (ya poblado en el catálogo para varios ítems de comida, ej. raciones) se ignoraba
  // por completo aquí, aunque "Curar" (bloque de arriba) sí lo aplicaba. Con Descansar ya sin curar
  // condición física y con cooldown de 3h, hace falta que comer/beber SÍ pueda completar la energía
  // que falte — mismo criterio que healItemUsesValidated, sin duplicar catalogBySlug.get() por ítem.
  // `curaAgua` (hallazgo 13) amplía el filtro — antes solo entraban ítems que curan HAMBRE
  // (`curaHambre !== null`), dejando fuera cualquier cosa que solo repusiera Sed (el odre lleno,
  // sin `curaHambre`). Ahora entra cualquier ítem con `curaHambre` O `curaAgua`.
  const hungerItemsInInventory = inventoryRows
    .map((i) => ({
      id: i.id,
      name: i.name,
      curaHambre: i.catalogSlug ? (catalogBySlug.get(i.catalogSlug)?.curaHambre ?? null) : null,
      curaAgua: i.catalogSlug ? (catalogBySlug.get(i.catalogSlug)?.curaAgua ?? null) : null,
      curaEnergia: i.catalogSlug ? (catalogBySlug.get(i.catalogSlug)?.curaEnergia ?? 0) : 0,
      emptyContainerCatalogSlug: i.catalogSlug ? (catalogBySlug.get(i.catalogSlug)?.emptyContainerCatalogSlug ?? null) : null,
    }))
    .filter(
      (i): i is { id: string; name: string; curaHambre: number | null; curaAgua: number | null; curaEnergia: number; emptyContainerCatalogSlug: string | null } =>
        i.curaHambre !== null || i.curaAgua !== null,
    );
  const hambreSedItemUsesValidated: {
    id: string;
    name: string;
    curaHambre: number;
    curaAgua: number;
    curaEnergia: number;
    emptyContainerCatalogSlug: string | null;
    quantity: number;
  }[] = [];
  for (const use of hambreSedItemUses ?? []) {
    const hungerItem = hungerItemsInInventory.find((i) => i.id === use.itemId);
    const row = inventoryRows.find((i) => i.id === use.itemId);
    if (!row || !hungerItem) continue;
    const quantity = Math.max(0, Math.min(use.quantity, quantityOf(row.name)));
    if (quantity > 0) {
      hambreSedItemUsesValidated.push({
        id: row.id,
        name: row.name,
        curaHambre: hungerItem.curaHambre ?? 0,
        curaAgua: hungerItem.curaAgua ?? 0,
        curaEnergia: hungerItem.curaEnergia,
        emptyContainerCatalogSlug: hungerItem.emptyContainerCatalogSlug,
        quantity,
      });
    }
  }
  const usingExplicitHungerThirstList = hambreSedItemUsesValidated.length > 0;
  // Brújula (2026-08-15, feature de exploración): NO se consume al usarla (es una herramienta
  // equipable, no un consumible) — solo dispara la narración determinista de rumbos más abajo, ver
  // compassNarrationLine. Único objeto con este comportamiento hoy, así que se filtra por su propio
  // catalogSlug en vez de un campo nuevo en ItemCatalog para un caso de uno solo.
  const compassItemsInInventory = inventoryRows
    .filter((i) => i.catalogSlug === 'aguja-cardo-brujula')
    .map((i) => ({ id: i.id, name: i.name, aliases: catalogBySlug.get(i.catalogSlug!)?.aliases ?? [] }));
  const compassMatch = detectsCompassUse(action, compassItemsInInventory);
  if (compassMatch && !travel && currentLocationId) {
    // Coordenadas reales (docs/mecanicas/13-escala-del-mundo.md, ver comentario de LocationInput en
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
  // Bloqueo real de oficio de construcción (2026-08-24, Grupo 3 § materiales procesados, ver
  // OFICIOS_CONSTRUCCION_REQUERIDOS en construction.ts) — a diferencia de `alivioFor` (que solo
  // relaja el requisito), esto distingue "no tiene el oficio en absoluto" de "lo tiene a nivel 1".
  const tieneOficioFor = (oficio: string | undefined) => (oficio ? oficioNivelById.has(oficio) : true);
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
  // lo lejos...'") — determinista, NO depende de ningún LoreChunk de gancho.
  //
  // Reconectado al sistema de posición en Zona (auditoría de pruebas en vivo, 2026-09-16: bug real
  // jugando — antes se disparaba solo en el turno EXACTO donde `playerActionCount === 1`; si la
  // primera acción del jugador no era diálogo, esa ventana se consumía igual sin haber mostrado
  // nunca la fase 1, y el segundo intento de hablar quedaba sin ningún guardarraíl determinista:
  // el modelo narró libremente y le inventó a Gistera Koh una tribu y un aspecto físico que no
  // existen en su catálogo real). Mismo criterio que Franja 3 (fauna/NPC agresivo,
  // `npcsInSceneVivosParaCombate` más abajo): se dispara cuando el jugador está en la misma celda
  // o en una adyacente al `ZonePoint` real de Gistera Koh en la Hondonada del Eco, sin importar
  // qué turno sea ni qué haya hecho antes — coherente con "no puedes encontrarte con algo que no
  // está físicamente donde tú estás". `gisteraYaPresentada` (calculado más abajo con los mismos
  // `sessionFacts`) sigue siendo la única guarda de "ya ocurrió, no se repite" — aquí solo se
  // decide si la fase 1 debe dispararse ESTE turno.
  const gisteraKoh =
    regionLocation?.slug === 'hondonada-del-eco' && regionLocationId && params.zonaPosX != null && params.zonaPosY != null
      ? await (async () => {
          const [zp] = await prisma.zonePoint.findMany({
            where: { saveId, locationId: regionLocationId, targetSlug: 'gistera-koh', tipo: 'NPC', activo: true },
            select: { x: true, y: true },
            take: 1,
          });
          if (!zp || !celdaAdyacenteOMisma(celdaDePixel(zp), celdaDePixel({ x: params.zonaPosX!, y: params.zonaPosY! }))) return null;
          return prisma.npc.findFirst({ where: { worldId, slug: 'gistera-koh', saveId: null } });
        })()
      : null;
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
  // Bug real, sesión autónoma de pruebas con Playwright (2026-09-04): Gistera Koh es `PRINCIPAL`
  // (npcScene.ts § `candidateNpcs`, cualquier PRINCIPAL es candidato en CUALQUIER ubicación del
  // mundo, sin mirar su `homeLocationSlug` — criterio deliberado y compartido con otros PRINCIPAL
  // como Sella Marn) — sin ninguna restricción propia, el gancho guionizado de su huida se disparó
  // dentro de Karot Veku, el campamento fortificado del Clan Serhu del que ella dice estar
  // escapando, sin sentido narrativo. Petición explícita de la usuaria: debe aparecer nada más
  // Gorhorn se mueva por La Hondonada del Eco, como de las primeras cosas que ve al empezar el
  // juego — nunca en otra ubicación mientras siga sin presentarse del todo (antes de aceptar
  // ayudarla; una vez el Quest existe, `gisteraSeHaMarchado`/`gisteraYaPresentada` ya no dependen
  // de la ubicación, es historia pasada que puede mencionarse desde cualquier sitio).
  const enHondonadaDelEco = regionLocation?.slug === 'hondonada-del-eco';
  const gisteraEnEscena =
    gisteraYaPresentada ||
    (enHondonadaDelEco && (gisteraKoh !== null || gisteraSinNombreEnEscena || npcsInScene.some((npc) => npc.slug === 'gistera-koh')));
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
      'GISTERA KOH busca convencer a Gorhorn de que la ayude a acabar con el Orco Enfurecido que la persigue — se ha fijado en la marca/tótem del Clan Maktor que lleva Gorhorn y lo usa a su favor (un expulsado hablando con otro sin clan). Gistera NO conoce ningún nombre propio de ese orco — si lo menciona en el diálogo, refiérete a él solo como entidad ("el orco que me persigue", "el que me sigue desde las cuevas") o como "el Orco Enfurecido" tal cual, pero NUNCA le inventes ni le pongas un nombre propio distinto que no exista en ningún sitio (nada de "Hefrik" ni ningún otro). "Orco Enfurecido" es solo el nombre TÉCNICO/canónico que usan la misión y el catálogo del juego — Gorhorn NUNCA ha oído ese nombre y no debe pronunciarlo ni conocerlo en su diálogo o sus pensamientos: si acepta ayudar a Gistera, responde solo en términos de lo que ella le ha contado ("acabemos con ese perseguidor tuyo", "iré a por quien te sigue"), nunca con el nombre "Orco Enfurecido" en su propia boca. Si en algún turno Gorhorn acepta ayudarla de verdad (no antes, y no lo fuerces si Gorhorn todavía no se ha decidido), crea la misión con "newQuest" mencionando "Orco Enfurecido" en el título o la descripción, para que derrotarlo la cierre sola.',
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
    tieneOficioFor,
    earlyBuildingId,
  });
  contextBlocks.push(...buildBlocks);

  // Slots de compañero (2026-08-04, docs/mecanicas/17-reglas-construcciones-reino.md): 0 de base, cada
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

  // Habilidad "Comer/Beber" (2026-09-04) — mismo principio EXACTO que `healPreview` justo arriba:
  // se calcula aquí, de solo lectura, ANTES de narrar. `advanceFictionalMinutes` es pura y barata
  // — se recalcula aquí en vez de esperar a `nuevoFictionalMinutes` (declarado más abajo, después
  // de donde `narration` ya se decide) para no invertir el orden del resto del archivo.
  //
  // Hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06) — el viejo booleano `beberAgua` (fijo,
  // sin ítem, repone Sed al 100% de un tirón en cualquier sitio) se retira: Sed ahora sube por
  // `curaAgua` de los ítems usados, mismo patrón EXACTO que `hungerGanancia`/`curaHambre` de
  // abajo. El odre de agua lleno (`curaAgua: 100`) replica el "100% de un tirón" de siempre sin
  // necesitar un camino aparte.
  const fictionalMinutesParaComerBeber = advanceFictionalMinutes(fictionalMinutesActuales, minutosDeEsteTurno);
  const hungerGanancia = hambreSedItemUsesValidated.reduce((sum, u) => sum + u.curaHambre * u.quantity, 0);
  const nuevoLastAteAtMinutes =
    hungerGanancia > 0
      ? lastAtMinutesForGanancia(params.lastAteAtMinutes, fictionalMinutesParaComerBeber, COMIDA_MINUTOS_POR_TRAMO, hungerGanancia)
      : params.lastAteAtMinutes;
  const aguaGanancia = hambreSedItemUsesValidated.reduce((sum, u) => sum + u.curaAgua * u.quantity, 0);
  const nuevoLastDrankAtMinutes =
    aguaGanancia > 0
      ? lastAtMinutesForGanancia(params.lastDrankAtMinutes, fictionalMinutesParaComerBeber, AGUA_MINUTOS_POR_TRAMO, aguaGanancia)
      : params.lastDrankAtMinutes;
  const hungerThirstPreview = usingExplicitHungerThirstList
    ? (() => {
        const itemsTexto = hambreSedItemUsesValidated.map((u) => (u.quantity > 1 ? `${baseNameOf(u.name)} ×${u.quantity}` : baseNameOf(u.name))).join(', ');
        return { narration: `${characterName} usa ${itemsTexto}. ${pickFlavor(EAT_DRINK_FLAVOR)}` };
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
  // Detección de intención de Descansar (2026-09-06, hallazgo 11) — calculada aquí, ANTES del
  // switch de `narration` de más abajo, para poder usarla tanto en el guard de curación falsa
  // (`hasFalseHealingClaim`) como en la rama determinista nueva "cooldown activo" del propio
  // switch y en el bloque real de energía/condición más abajo — una sola fuente de verdad, sin
  // triplicar la fórmula de `detectsRestIntent`.
  const restIntentDetected = !!(!travel && currentLocationRecord && detectsRestIntent(action) && (!roll || roll.success));
  const restBlockedByCooldown = restIntentDetected && restCooldownActivo(params.lastRestAtMinutes, params.fictionalMinutesActuales);
  // Ver `hasFalseHealingClaim` (narrador.ts) — Descansar ya NO cura condicionFisica (2026-09-06,
  // hallazgo 11: decisión explícita de la usuaria) — sin objeto médico, el techo real es siempre
  // `params.condicionFisica` (sin mejora), así que este guard se simplifica a "¿el jugador
  // narrará un descanso sin objeto médico de por medio, estando ya no-ILESO?" — sigue haciendo
  // falta para que el LLM nunca prometa curación de un descanso que mecánicamente ya no cura nada.
  // No se filtra por `restBlockedByCooldown` aquí: aunque el cooldown esté activo, la rama
  // determinista de rechazo (más abajo) ya se encarga de esos turnos sin pasar por el LLM en
  // absoluto — este guard solo protege los turnos que SÍ llegan a `narrateAction`.
  const restHealCeilingBelowIleso = !usingExplicitHealList && restIntentDetected && !medicalCuraHasta && params.condicionFisica !== 'ILESO';
  // Ver `hasFalseNewItemClaim` (narrador.ts) — nombres reales de TODO el catálogo del mundo, no
  // solo lo que el personaje ya lleva (a diferencia de `equippableItemNames`/`catalogBySlug`,
  // acotados al inventario actual): un `newItem` propuesto puede ser cualquier objeto del mundo,
  // no solo uno que la jugadora ya tenga.
  const worldItemCatalogNames = (await prisma.itemCatalog.findMany({ where: { worldId }, select: { name: true } })).map((i) => i.name);
  // Ver `hasFalseCombatTargetName` (narrador.ts) — solo cuando este turno resolvió de verdad un
  // intercambio contra un objetivo concreto (nunca en execute/decapitar, que ya tiene su propio
  // cierre determinista sin depender de que el modelo nombre a nadie) Y hay algún otro NPC real en
  // la misma escena con quien pueda confundirse.
  const combatRealTargetName = exchangeHappened && npcAttackTarget ? npcAttackTarget.name : undefined;
  const otherNpcNamesInScene = combatRealTargetName ? npcsInScene.filter((n) => n.id !== npcAttackTarget!.id).map((n) => n.name) : [];
  // Ver `hasWrongNpcName` (narrador.ts) — nombres de NPCs YA conocidos por esta partida
  // (`NpcState` propio, ej. el rival de un combate anterior de la misma sesión) que no son el
  // objetivo real de ESTE intercambio ni están en la escena actual (`otherNpcNamesInScene` ya
  // cubre esos). Query barata y acotada a lo que la partida ya vio — no hace falta cargar el
  // catálogo completo de NPCs del mundo, el candidato real a "arrastrarse" es siempre alguien con
  // quien esta partida concreta ya interactuó antes.
  const possiblyStaleNpcNames = combatRealTargetName
    ? (await prisma.npcState.findMany({ where: { saveId }, select: { npc: { select: { name: true } } } }))
        .map((s) => s.npc.name)
        .filter((name) => name !== combatRealTargetName && !otherNpcNamesInScene.includes(name))
    : [];
  // Ver `hasFalsePassiveHarvestClaim` (narrador.ts) — cualquier camino mecánico real de
  // obtención de objeto ya activo este turno (recolección determinista, saqueo, construcción,
  // crafteo) legitima que la prosa prometa recibir algo; sin ninguno de estos, una promesa de
  // obtención en prosa libre es pura alucinación.
  const harvestOrLootActiveThisTurn = !!harvestMatch || lootMode || buildMode || craftMode;
  const narrationCtx = {
    worldFacts: [...contextBlocks, ...(await selectRelevantFacts(action, saveId, worldId, sessionFacts))],
    // Separado de worldFacts (roadmap 2026-07-24, "revisar partida" — ver comentario en
    // TurnContext.backgroundLore, narrador.ts): el lore RAG es trasfondo del mundo, no hechos
    // de la escena actual — fusionarlos bajo el mismo "HECHOS DEL MUNDO" le daba al modelo
    // licencia para hacer aparecer en persona a cualquier NPC que el RAG trajera por
    // similitud de texto, aunque viviera en otra región o perteneciera a la trama de otro
    // personaje jugable.
    backgroundLore: formatLoreForPrompt(retrieved),
    characterSummary,
    // Ver `hasFalseCombatAttacker` (narrador.ts) — bug real jugando en vivo, prueba con Playwright,
    // 2026-08-27.
    characterName,
    action,
    roll,
    weaklyGrounded: isWeaklyGrounded(retrieved) && sessionFacts.length === 0 && contextBlocks.length === 0,
    enCombate,
    banda: classification.banda,
    npcSlugsInScene: npcsInScene.map((n) => n.slug),
    // Ver `hasWrongAggressorName` (narrador.ts) — nombres de NPCs presentes en escena que NO
    // pueden ser agresores por catálogo (temperamento distinto de AGRESIVO/ENEMIGO, ya combinado
    // con reputación real de facción). A diferencia de `combatRealTargetName`/`otherNpcNamesInScene`
    // (que solo existen tras un intercambio ya resuelto), esto está disponible SIEMPRE que haya
    // algún NPC vivo en escena — cubre también la apertura de combate desde una acción pasiva.
    nonHostileNpcNamesInScene,
    nonHostileNpcSlugsInScene,
    // `contextBlocks` va SIEMPRE primero en `worldFacts` (línea de arriba) — su longitud es
    // justo el corte que un reintento de emergencia (attempt2, ver narrador.ts) debe respetar
    // para no perder bloques deterministas/obligatorios como la escena de Gistera Koh.
    criticalFactsCount: contextBlocks.length,
    lastNarrationText: lastNarration?.text,
    combatBothMissed,
    combatRealHitLanded,
    nonExchangeAttackHitLanded,
    playerActedAsDefenderThisExchange,
    npcAttackerIsInoffensive,
    // Mismo criterio que `gisteraAceptaEsteTurno` (más abajo, tras la llamada al narrador) pero
    // calculado aquí porque el `ctx` del narrador se construye antes de esa variable — ver
    // `hasGorhornPronouncingOrcoEnfurecidoName` (narrador.ts).
    gisteraAcceptanceTurnRisksOrcoName: gisteraSeHaMarchado && !gisteraQuestYaExiste,
    npcFallsUnconsciousThisTurn,
    npcFallsConvalecienteThisTurn,
    combatNoRealDeathThisTurn,
    jugadorRecibeGolpeEsteTurno,
    combatNotYetResolved,
    possiblyFalseItemUseNames,
    possiblyResurrectedNpcNames,
    possiblyUnauthorizedNpcNames,
    possiblyFalseTravelDestinationNames,
    phantomTravelLocationNames,
    possiblyFalseInventoryReviewNames,
    equippedWeaponNamesInCombat,
    equippableItemNames,
    restHealCeilingBelowIleso,
    worldItemCatalogNames,
    harvestOrLootActiveThisTurn,
    combatRealTargetName,
    otherNpcNamesInScene,
    possiblyStaleNpcNames,
    gisteraSeHaMarchado,
    // Ver `hasIllegitimateMagicVocabulary` (narrador.ts) — bug real jugando en vivo, 2026-09-01:
    // vocabulario mágico narrando la curación de un personaje sin ninguna clase/habilidad mágica.
    characterClase: clase,
    // Ver `hasWrongCelestialReference` (narrador.ts) — bug real, sesión autónoma de pruebas
    // 2026-09-04: "el resplandor de la luna" narrado en pleno día. `fictionalMinutesActuales` (no
    // `nuevoFictionalMinutes`, que todavía no se calcula aquí) es el momento de ANTES de que este
    // turno avance el reloj — el momento real de la escena que se está narrando ahora mismo.
    momentoDelDia: momentoDelDiaFor(fictionalMinutesActuales),
    onNarrationChunk,
    onNarrationReset,
  };

  // Grupo 3 § Mundo determinista, Capa 4 (docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25) —
  // disparo real: si hay un `CombatEncounter` activo, este turno se resuelve por el motor de
  // Combate múltiple (`combateMultipleOrquestacion.ts`) en vez del 1v1 clásico. Ruta determinista
  // propia, mismo criterio que loot/build/harvest/craft de abajo: nunca llama a `narrateAction`
  // (la narración ya sale de `narrarTurnoCombateMultiple`, un modelo más ligero, dentro del motor
  // mismo) — llamar a los dos narradores para el mismo golpe sería redundante y podría contradecirse.
  let combatEncounterMode = false;
  let combatEncounterNarration = '';
  let combatEncounterTerminado = false;
  let combatEncounterCaidos: { tipo: string; npcId: string | null; nuevaCondicion: CondicionFisica }[] = [];
  let combatEncounterId: string | null = null;
  // Saqueo/desuello de CombatEncounter (2026-08-25, ver comentario completo más abajo, junto al
  // materializado real) — resumen de qué especies quedaron caídas al RESOLVERSE el encuentro, para
  // que `/turn/narrate` se lo pueda devolver al frontend (pantalla de resumen tras combate) y para
  // nombrar a cada una en un hecho de sesión nuevo, fuera de la transacción principal.
  let combatEncounterLootSummary: { npcId: string; slug: string; name: string; cantidad: number }[] = [];
  // Condición/energía REALES de la jugadora tras la resolución (`escribirCondicionYEnergia`, ya
  // escritas en `Save` dentro de las transacciones del motor de combate múltiple, más abajo) — el
  // resto de esta función calcula `proposedCondicion`/`nuevaEnergia` a partir del intercambio 1v1
  // clásico (`resolveCombatExchangePhase`, que en este modo nunca corre de verdad), así que sin
  // este override esos cálculos seguirían asumiendo "no pasó nada" y sobrescribirían lo que el
  // motor de grupo ya dejó escrito.
  let combatEncounterFinalCondicion: CondicionFisica | null = null;
  let combatEncounterFinalEnergia: number | null = null;
  if (activeCombatEncounter) {
    combatEncounterMode = true;
    const encounterId = activeCombatEncounter.id;
    combatEncounterId = encounterId;
    const narraciones: string[] = [];

    // Objetivo individual real (2026-08-26, docs/producto/21-roadmap.md § Fase 3) — si la RONDA actual
    // todavía no sabe a quién quiere atacar la jugadora, hay que decidirlo YA, antes de resolver
    // ningún turno autónomo de esa ronda (aunque su posición en `ordenIniciativa` no sea la
    // primera) — un enganche puede "alcanzar hacia atrás" y cancelar el de alguien que, en la
    // cola, actuaría antes que ella; resolver ese turno en firme antes de saber su elección
    // dejaría un golpe real sin poder deshacerlo. Ver comentario largo de
    // `esperandoEleccionJugadora` en schema.prisma.
    const encounterFresco = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
    if (encounterFresco.esperandoEleccionJugadora) {
      // Mismo criterio de siempre: nombre citado entre comillas contra los ENEMIGO vivos; sin cita
      // real o sin match, cae al primer enemigo vivo (nunca se queda sin elegir).
      const participantesVivos = await prisma.combatParticipant.findMany({ where: { encounterId } });
      const enemigos = participantesVivos.filter((p) => p.bando === 'ENEMIGO');
      const enemigoNpcIds = enemigos.filter((p) => p.npcId).map((p) => p.npcId!);
      const enemigoNpcs = enemigoNpcIds.length ? await prisma.npc.findMany({ where: { id: { in: enemigoNpcIds } }, select: { id: true, name: true } }) : [];
      const nombreByNpcId = new Map(enemigoNpcs.map((n) => [n.id, n.name]));
      // Bug real (2026-08-25, cazado al cerrar saqueo/desuello): un grupo puede tener varios
      // individuos con el MISMO nombre citado, algunos ya CONVALECIENTE/MUERTO — sin este filtro,
      // `.find()` podía emparejar el primero del array (orden de creación, no de vida), dejando a
      // la jugadora "atacando" a un cadáver que ya no cuenta como intercambio real, sin ningún
      // aviso — el turno se resolvía sin que pasara nada mecánicamente.
      const soloEnemigoNpcIds = enemigos.filter((p) => p.condicionFisicaGrupo === null && p.npcId).map((p) => p.npcId!);
      const soloEnemigoStates = soloEnemigoNpcIds.length
        ? await prisma.npcState.findMany({ where: { saveId, npcId: { in: soloEnemigoNpcIds } }, select: { npcId: true, condicionFisica: true } })
        : [];
      const soloCondicionByNpcId = new Map(soloEnemigoStates.map((s) => [s.npcId, s.condicionFisica]));
      // Identificador de combatientes duplicados (2026-08-27, bug real jugando: "ataqué a los dos
      // buitres a la vez") — matching por texto (incluido el sufijo "#N" cuando hace falta
      // desambiguar) extraído a `resolverObjetivoPorTexto` (combateMultiple.ts) para poder probarlo
      // aislado del resto del turno (clasificador LLM real, `explicitTarget`/`npcsInScene` del
      // sistema viejo — ruido genuino para un test de este matching concreto).
      const candidatos = enemigos.map((p) => ({
        participantId: p.id,
        npcId: p.npcId,
        vivo: (() => {
          const condicion = p.condicionFisicaGrupo ?? soloCondicionByNpcId.get(p.npcId ?? '') ?? 'ILESO';
          return condicion !== 'CONVALECIENTE' && condicion !== 'MUERTO';
        })(),
      }));
      const targetParticipantId = resolverObjetivoPorTexto(action, candidatos, nombreByNpcId, normalizeText);
      if (targetParticipantId) {
        await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: targetParticipantId });
      }
    }

    // Turnos autónomos pendientes de esta ronda (ahora ya con el enganche fijo) hasta que le toca
    // a la jugadora — cubre también el caso defensivo de un reinicio de backend a media ronda.
    // Bug real de timeout de transacción (2026-08-25, ver comentario de cabecera en
    // combateMultipleOrquestacion.ts) — esto YA NO va envuelto en `prisma.$transaction`: la propia
    // función gestiona sus transacciones cortas internamente y llama a Ollama fuera de ellas.
    const antes = await resolverTurnosAutonomosHastaJugadora({ prisma, worldId, saveId, encounterId });
    narraciones.push(...antes.narraciones);
    const intercambiosContraJugadora = [...antes.intercambiosContraJugadora];
    combatEncounterCaidos.push(...antes.caidos);
    combatEncounterTerminado = antes.encounterTerminado;

    if (!combatEncounterTerminado && antes.esperandoAccionJugadora) {
      // A quién ataca ya está fijo (objetivoActualId, decidido arriba o en una ronda anterior) —
      // solo hace falta resolver con qué habilidad. Misma habilidad ya resuelta arriba para el 1v1
      // clásico (botón pulsado o texto libre), sin recalcular nada nuevo.
      const jugadorHabilidad: HabilidadParaIntercambio = {
        name: selectedAbilityData?.name ?? 'Ataque Básico',
        description: selectedAbilityData?.description ?? '',
        attribute: classification.atributo,
        attributeBonus: abilityAttributeBonus,
        effects: abilityEffects,
        rol: abilityRol ?? (detectsAttackIntent(action) ? 'ataque' : 'defensa'),
        energyCost: abilityEnergyCost,
        energyRegen: abilityEnergyRegen,
        maxUsesPerCombat: selectedAbilityData?.maxUsesPerCombat ?? null,
        // Fase 3 § 3a de efectos de clase (2026-08-27) — mismo gate que el camino 1vs1 clásico
        // (línea ~2772, `abilityDurationEffectMagnitude/Turns`): un uso bloqueado por tope de
        // combate no debe empujar ningún AUMENTO/DEBILIDAD.
        durationEffectMagnitude: playerAbilityUsageBlocked ? null : (selectedAbilityData?.durationEffectMagnitude ?? null),
        durationEffectTurns: playerAbilityUsageBlocked ? null : (selectedAbilityData?.durationEffectTurns ?? null),
        // Domador (2026-09-09, "aumenta a tu bestia"; 'both' 2026-09-14, Grito Animal — "a tu
        // bestia Y a ti mismo") — mismo gate de tope de usos que arriba.
        durationEffectTarget: playerAbilityUsageBlocked ? null : ((selectedAbilityData?.durationEffectTarget as 'self' | 'companion' | 'both' | null) ?? null),
      };
      const accion: AccionJugadorCombate = { habilidad: jugadorHabilidad, dualWieldBonus };
      const turnoJugadora = await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion });
      if (turnoJugadora) {
        if (turnoJugadora.narracion) narraciones.push(turnoJugadora.narracion);
        narraciones.push(...turnoJugadora.narracionesExtra);
        combatEncounterCaidos.push(...turnoJugadora.caidos);
        combatEncounterTerminado = turnoJugadora.encounterTerminado;
        // Punto del jugador en el mapa de Zona (2026-09-04) — solo el turno DE LA JUGADORA (nunca
        // los sub-turnos autónomos NPC-vs-NPC de `antes`/`despues`, sin relación con su acción).
        // Mueve al jugador junto al primer NPC/fauna real que cayó este turno y lo marca ausente 6h
        // — mismo criterio que el 1v1 clásico, fuera de la transacción principal porque
        // `resolverTurnoJugador` ya gestiona sus propias transacciones cortas (ver comentario de
        // cabecera de `ejecutarIntercambioYAvanzar`).
        const npcCaidoReal = turnoJugadora.caidos.find((c) => c.tipo !== 'JUGADOR' && c.npcId);
        if (npcCaidoReal?.npcId && currentLocationId) {
          const npcCaido = await prisma.npc.findUnique({ where: { id: npcCaidoReal.npcId }, select: { slug: true, kind: true } });
          if (npcCaido) {
            const scopeCaido = scopeFor(npcCaido.kind, currentLocationId);
            // `nuevoFictionalMinutes` (la variable de nivel función) todavía no está declarada en
            // este punto — mismo cálculo local que ya usan otros sitios anteriores a su declaración
            // oficial (línea ~4712), ver `fictionalMinutesParaComerBeber` unas líneas más abajo.
            const minutosParaAusencia = advanceFictionalMinutes(fictionalMinutesActuales, minutosDeEsteTurno);
            await prisma.npcState.upsert({
              where: { saveId_npcId_scope: { saveId, npcId: npcCaidoReal.npcId, scope: scopeCaido } },
              create: { saveId, npcId: npcCaidoReal.npcId, scope: scopeCaido, zonaAusenteHastaMinutes: minutoDeReaparicion(minutosParaAusencia), zonaLocationId: currentLocationId },
              update: { zonaAusenteHastaMinutes: minutoDeReaparicion(minutosParaAusencia), zonaLocationId: currentLocationId },
            });
            const zonaObjetivoMultiple = await posicionDeObjetivo(prisma, saveId, currentLocationId, npcCaido.slug);
            if (zonaObjetivoMultiple) await moverJugadorA(prisma, saveId, zonaObjetivoMultiple.x, zonaObjetivoMultiple.y);
          }
        }
        // Desglose real de dados (2026-09-04, auditoría "buscar tiradas de dados sin
        // representar") — hallazgo real: combate múltiple SIEMPRE tira con la misma mecánica que
        // el 1v1 (mismo rollD20), pero nunca llegaba a `combatExchangeDisplayFinal` (mismo campo
        // que DiceRollReveal/CombatExchangeBadge ya saben pintar para el 1v1 clásico) — solo
        // nunca les llegaba nada para el modo CombatEncounter. Solo se rellena cuando el turno de
        // la jugadora fue un intercambio real con oposición (turnoJugadora.combatExchangeDisplay
        // es `null` en los caminos sin tirada: golpe gratis, invocación, avance sin atacar).
        if (turnoJugadora.combatExchangeDisplay) combatExchangeDisplayFinal = { ...turnoJugadora.combatExchangeDisplay, rivalNombre: turnoJugadora.defensorNombre };
      }

      if (!combatEncounterTerminado) {
        const despues = await resolverTurnosAutonomosHastaJugadora({ prisma, worldId, saveId, encounterId });
        narraciones.push(...despues.narraciones);
        intercambiosContraJugadora.push(...despues.intercambiosContraJugadora);
        combatEncounterCaidos.push(...despues.caidos);
        combatEncounterTerminado = despues.encounterTerminado;
      }
    }

    // Fase G del 0.1 (hallazgo G11): si la jugadora no tuvo intercambio propio este turno (un
    // enemigo con más iniciativa ya resolvió el duelo de la ronda), se enseña el primer intercambio
    // real en el que la atacaron — antes no salía ninguna tirada y su acción parecía no hacer nada.
    if (!combatExchangeDisplayFinal && intercambiosContraJugadora.length > 0) {
      combatExchangeDisplayFinal = { ...intercambiosContraJugadora[0].display, rivalNombre: intercambiosContraJugadora[0].atacanteNombre };
    }

    combatEncounterNarration = narraciones.filter(Boolean).join(' ') || `${characterName} se mantiene en guardia, pero el intercambio no llega a resolverse este turno.`;

    const saveTrasEncuentro = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { condicionFisica: true, energia: true } });
    combatEncounterFinalCondicion = saveTrasEncuentro.condicionFisica;
    combatEncounterFinalEnergia = saveTrasEncuentro.energia;
  }

  // Turno narrado de verdad por el LLM local (2026-08-11, captura en vivo de pares DPO) — las 7
  // ramas deterministas de abajo (combate múltiple/Gistera guionizada/saqueo/construcción/
  // cosecha/crafteo/curación explícita) nunca llaman a narrateAction, así que no hay ningún
  // prompt/respuesta real que capturar para el profesor cloud.
  const wasLlmNarrated = !(
    combatEncounterMode ||
    gisteraSePresentaEsteTurno ||
    lootMode ||
    buildMode ||
    harvestOutcome ||
    craftMode ||
    usingExplicitHealList ||
    usingExplicitHungerThirstList ||
    restBlockedByCooldown
  );

  // Animación de dados en paralelo (ver comentario de `onExchangeResolved` en
  // NarrateAndPersistParams) — justo antes de narrar, nunca antes: `combatExchangeDisplayFinal` ya
  // está fijado en este punto para cualquier turno con intercambio real (1v1 o combate múltiple),
  // y esto es lo más cerca posible del arranque real de `narrateAction` (la parte lenta) sin
  // adelantarse a ningún guard de arriba que todavía pudiera descartar el turno entero.
  if (combatExchangeDisplayFinal) onExchangeResolved?.(combatExchangeDisplayFinal, npcAbilityUsed?.npcName ?? combatExchangeDisplayFinal.rivalNombre ?? null);

  const narration: NarrationResult = combatEncounterMode
    ? { narration: combatEncounterNarration, newFacts: [] }
    : gisteraSePresentaEsteTurno
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
              : usingExplicitHungerThirstList
                ? { narration: hungerThirstPreview!.narration, newFacts: [] }
                : restBlockedByCooldown
                  ? {
                      narration: `${characterName} no está lo bastante cansado y no quiere volver a descansar todavía. ${pickFlavor(REST_COOLDOWN_FLAVOR)}`,
                      newFacts: [],
                    }
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
    // Bug real (auditoría de código 2026-08-25, categoría sin guard hasta ahora): los dos fixes de
    // abajo (newFacts/newBuilding) protegen el ESTADO persistido, pero nunca corregían la PROSA
    // visible — la jugadora podía seguir leyendo una escena de construcción completada ("Gorhorn
    // termina de levantar el ayuntamiento...") aunque mecánicamente no se construyó nada y los
    // materiales siguen intactos. Mismo criterio que los dos guards de viaje justo arriba
    // (hasFalseTravelClaim/hasFalsePhantomTravel): sustituir `narration.narration` por una frase
    // honesta en vez de confiar en que el modelo se corrija solo.
    narration.narration = `${characterName} lo intenta, pero enseguida se da cuenta de que no tiene lo necesario para completar ${buildRecipe.name} — el intento queda a medias, sin gastar nada.`;
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
  // Fase G del 0.1 (hallazgo G22): `gisteraKoh` solo mira que su punto del mapa esté al lado, y
  // ese punto sigue activo tras presentarse y marcharse — la llegada «sin nombre» se añadía otra
  // vez a cualquier turno junto a él (p. ej. construir el ayuntamiento). Solo antes de presentarse.
  if (gisteraKoh && !gisteraYaPresentada && !gisteraSeHaMarchado && !gisteraSinNombreEnEscena) {
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
    // Destino ocultado de la narración visible (petición explícita de la usuaria, 2026-09-05): la
    // frase ya no dice hacia dónde se va, solo que abandona la Hondonada del Eco. El destino real
    // (Ciénaga Troncal) se queda solo en `newFacts` — memoria interna del motor para que el guard
    // de "no vuelve a aparecer" (`gisteraSeHaMarchado`) siga funcionando, nunca mostrado al jugador.
    narration.narration = `${narration.narration} ${GISTERA_DESPEDIDA_NARRATION}`;
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
  // `restAttempted` (cualquier sitio) vs `restSucceeds` (además, refugio/asentamiento real) — YA
  // NO curan condicionFisica (2026-09-06, hallazgo 11, decisión explícita de la usuaria) — siguen
  // vivas solo para dos cosas: (a) energía (reposo fijo `ENERGY_REST_RESTORE`, energy.ts §
  // nextEnergia — ya no distingue refugio de vivac para energía) y (b) `restSucceeds` sigue
  // gating el punto de guardado (más abajo, "Punto de guardado"), sin cambios. Cooldown de 3h de
  // FICCIÓN (`REST_COOLDOWN_MINUTES`, energy.ts) — si sigue activo, ambos se fuerzan a `false`:
  // el intento "no cuenta" del todo (ni energía ni punto de guardado), coherente con "el
  // personaje no está cansado y no quiere volver a descansar todavía". `restIntentDetected`/
  // `restBlockedByCooldown` ya se calcularon más arriba (línea ~4267), reutilizados aquí.
  const restAttempted = restIntentDetected && !restBlockedByCooldown;
  const restSucceeds = !!(restAttempted && isValidRestLocationKind(currentLocationRecord!.kind));
  // Marca de cooldown (2026-09-06, hallazgo 11) — solo se actualiza cuando el descanso SE APLICÓ
  // de verdad (`restAttempted`), no en cada intento; un intento bloqueado por el propio cooldown
  // no reinicia el contador (mismo criterio que `dispersadoDesdeMinutes`, cazar.ts).
  const nuevoLastRestAtMinutes = restAttempted ? fictionalMinutesActuales : params.lastRestAtMinutes;
  // Reglas de curación (2026-07-29, ajustado 2026-09-06): sin objeto médico, el techo es la propia
  // condición actual — ninguna mejora "porque sí" pasa (ver healCeilingFor/death.ts). Descansar ya
  // no forma parte de esta fórmula en absoluto.
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
    : healCeilingFor(params.condicionFisica, medicalCuraHasta, medicalCuraUnPaso);
  // Grupo 3 § Mundo determinista, Capa 4 (2026-08-25) — en modo `CombatEncounter`, la condición
  // real ya la escribió el motor de combate múltiple (ver `combatEncounterFinalCondicion` arriba)
  // — `condicionPropuestaCombinada` de aquí siempre sería "nada pasó" (el 1v1 clásico nunca corrió
  // de verdad este turno), así que nunca debe ganar.
  const proposedCondicion = combatEncounterFinalCondicion ?? nextCondicionFisica(params.condicionFisica, condicionPropuestaCombinada, !!enCombate, healCeiling);
  // Suma total de energía de los objetos explícitos (2026-08-18) — a diferencia de curaHasta, el
  // orden no importa: cada objeto restaura lo suyo, `nextEnergia` (energy.ts) ya topa el resultado
  // final al máximo real.
  const explicitHealEnergyRestore = usingExplicitHealList ? healItemUsesValidated.reduce((sum, u) => sum + u.curaEnergia * u.quantity, 0) : 0;
  // Comer/Beber también repone energía (2026-09-06, hallazgo 11) — mismo criterio que Curar arriba,
  // el orden no importa, cada ítem seleccionado suma su `curaEnergia` real de catálogo.
  const explicitHungerThirstEnergyRestore = usingExplicitHungerThirstList
    ? hambreSedItemUsesValidated.reduce((sum, u) => sum + u.curaEnergia * u.quantity, 0)
    : 0;
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
  // Mismo criterio que `proposedCondicion` arriba — en modo `CombatEncounter` la energía real ya
  // la escribió el motor de combate múltiple.
  const nuevaEnergia =
    combatEncounterFinalEnergia ??
    Math.min(
      energiaMax,
      nextEnergia({
        current: params.energia,
        max: energiaMax,
        abilityEnergyCost,
        abilityEnergyRegen,
        exchangeHappened,
        restSucceeds,
        restAttempted,
        // Prioridad: Curar explícito > Comer/Beber explícito > un solo ítem energético suelto
        // detectado en texto libre (energyItemRestoreAmount) — mismo criterio de "solo una fuente
        // manda por turno" que ya existía, ampliado con la nueva vía de Comer/Beber.
        itemRestoreAmount: usingExplicitHealList
          ? explicitHealEnergyRestore || null
          : usingExplicitHungerThirstList
            ? explicitHungerThirstEnergyRestore || null
            : energyItemRestoreAmount,
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
    activeEffects: ActiveEffect[];
    energia: number;
    energiaMax: number;
    /// Habilidad "Comer/Beber" (2026-09-04) — % resultantes de Hambre/Sed tras este turno (vía
    /// `comidaPct`/`aguaPct` sobre `nuevoLastAteAtMinutes`/`nuevoLastDrankAtMinutes`), mismo
    /// criterio que `energia`/`energiaMax`: se calculan aquí para viajar en la respuesta HTTP del
    /// turno, no solo al cargar partida.
    hambre: number;
    sed: number;
    finDePartida: boolean;
    pendingDeathResolution: boolean;
    justDied: boolean;
    newInventoryItems: NewInventoryItemInfo[];
    removedInventoryItemIds: string[];
    updatedInventoryItems: { id: string; name: string }[];
    logEntryId: string;
    newQuestObjetivos: string[];
    newQuestInfo: { title: string; objetivo: string } | null;
    newQuestOfferInfo: { title: string; description: string } | null;
    npcInteractionOffer: { npcSlug: string; npcName: string; options: string[] } | null;
    questCompletedInfo: QuestCompletedInfo | null;
    factionRepChange: FactionRepChangeInfo | null;
    professionXpGains: { oficio: string; xpDelta: number; newLevel: number; leveledUp: boolean }[];
    newKingdomFounded: KingdomFoundedInfo | null;
    companionCreated: { id: string; name: string; role: string; notes: string } | null;
    partiallyLootedSlugs: string[];
    /// Auditoría 2026-08-06 — ver comentario de `deathCount` en NarrateAndPersistResult. Calculado
    /// DENTRO de la transacción (`finalDeathCount`), tiene que salir de aquí igual que el resto de
    /// campos de este objeto, no se puede releer después: no hay ninguna tabla que lo persista
    /// aparte de `Save.deathCount`, ya escrito por la propia transacción.
    deathCount: number;
    /// Hallazgo 38 (revisar-partida-hallazgos.md 2026-09-07) — `isFirstVisitToDestination` solo
    /// existe dentro de esta transacción (se calcula junto a `LocationVisit.createMany`), así que
    /// el slug de destino tiene que salir de aquí igual que `deathCount` arriba.
    discoveredLocationSlug: string | null;
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

    // docs/mecanicas/19-post-combate-y-recompensas-mision.md pieza 2 — recuperación de CONVALECIENTE a las 6h
    // de ficción / desaparición de un cadáver a las 48h. Antes de nada más este turno, con el
    // `fictionalMinutes` ya avanzado: cualquier NPC afectado debe verse ya actualizado en el resto
    // de este mismo turno (p. ej. si vuelve a estar HERIDO, `npcsInScene` de este turno ya debería
    // reflejarlo si se recalculara — no se recalcula aquí, pero al menos la DB queda consistente
    // para el turno SIGUIENTE sin depender de que pase algo más).
    await applyCondicionTimeouts(tx, saveId, nuevoFictionalMinutes);
    // Rediseño de captura (2026-08-28) — misma lógica de timeout silencioso, ver comentario de la
    // función: una captura sin depositar en Jaula tras su plazo (ligado al tier de cuerda) se
    // escapa sola del inventario.
    await applyCapturaEnInventarioTimeouts(tx, saveId, nuevoFictionalMinutes);

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
    // Oferta de misión sin aceptar (ver NarrateAndPersistResult.newQuestOfferInfo más arriba).
    let newQuestOfferInfo: { title: string; description: string } | null = null;
    // Oferta de menú de interacción con NPC (2026-09-06, ver NarrateAndPersistResult.
    // npcInteractionOffer más arriba) — se rellena más abajo, tras resolver newQuestOfferInfo.
    let npcInteractionOffer: { npcSlug: string; npcName: string; options: string[] } | null = null;
    // Notificación de misión completada (ver NarrateAndPersistResult.questCompletedInfo más
    // arriba) — se rellena en completeNpcTargetQuests (derrota normal/Decapitar) y en la rama
    // orcoYaResuelto (aceptar la misión con el objetivo ya resuelto de antes), los 3 sitios que
    // conceden recompensa de verdad. Si dos misiones se completaran en el mismo turno (caso raro),
    // gana la última — la recompensa real de ambas se concede igual, solo la tarjeta es una sola.
    let questCompletedInfo: QuestCompletedInfo | null = null;
    // Feedback de UX (2026-08-30) — ver comentario completo en `applyKillSideEffects`. Mismo
    // criterio que `questCompletedInfo`: si dos NPC de facción caen en el mismo turno (raro, pero
    // posible en combate múltiple), gana el último — cada delta real ya se aplicó/persistió igual.
    let factionRepChange: FactionRepChangeInfo | null = null;
    // Notificación de fundación de reino (2026-08-04, ver NarrateAndPersistResult.newKingdomFounded
    // más arriba) — se rellena solo al construir el Ayuntamiento tier 1 desde cero (nunca en una
    // mejora de tier), para que el frontend abra el popup de fundación de facción.
    let newKingdomFounded: KingdomFoundedInfo | null = null;
    // Consolidación de territorio (2026-08-23, Grupo 3 § Territory.control) — capturado aquí,
    // antes de que exista `reinoXp` (se declara mucho más abajo), para poder sumarle sus 300 XP
    // (docs/mecanicas/10-niveles-xp-reino.md § 5.4) en el mismo punto que el resto de eventos de Reino.
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

    // Tick diario (Reino, producción de edificios, Casa de curas) — ver `dailyTick.ts`. Solo hace
    // algo si este turno cruza al menos un día de ficción completo. Determinista, cero IA.
    ({ territoryConsolidatedThisTurn } = await runDailyTick(tx, {
      saveId,
      worldId,
      minutosAntes: fictionalMinutesActuales,
      minutosDespues: nuevoFictionalMinutes,
    }));

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
      npcActiveEffectsNext,
      saveId,
      worldId,
      currentLocationId,
      nuevoFictionalMinutes,
      nuevaFictionalDateLabel,
      activeRegion,
      nextAfterMainLogCreatedAt,
    });
    if (combatExchangeResult.questCompletedInfo) questCompletedInfo = combatExchangeResult.questCompletedInfo;
    if (combatExchangeResult.factionRepChange) factionRepChange = combatExchangeResult.factionRepChange;
    // Bug real (auditoría "revisar partida" 2026-08-14): la recompensa de misión se narraba
    // ("+100 XP" en el texto de `completeNpcTargetQuests`) pero nunca se sumaba al XP real del
    // turno — a diferencia del camino de saqueo (más abajo, `lootResult.questRewardXp`), que sí lo
    // hacía bien. Cerrar la misión matando/incapacitando al objetivo (el camino más común) daba XP
    // fantasma: el jugador veía el número pero `Save.xp` nunca subía.
    questRewardXp += combatExchangeResult.questCompletedInfo?.rewardXp ?? 0;

    // "Decapitar"/"Matar" (REDISEÑADO 2026-08-30) — ya no tiene camino aparte aquí, es un ataque
    // normal como cualquier otro: `combatExchangeResult`/`npcTargetNewCondicion` de arriba ya
    // cubren su cierre de misión/reputación/población igual que cualquier otro golpe que deja
    // MUERTO a un NPC (`applyCombatExchangeToNpcState` más arriba, mismo camino).

    // Caché de Desollar (bug real, reverificación en vivo 2026-08-29, ver `invalidateCarcassRollCache`
    // en recolectar.ts) — cualquier camino de combate que deja un NPC MUERTO en la ubicación actual
    // (golpe normal, Matar o combate múltiple) invalida la tirada congelada de "desollador" para
    // esta ubicación si la había, aunque estuviera vacía (el bug real era justo ese caso: una tirada
    // vacía no tiene ningún `sourceSlug` que la invalidación normal de recolección pueda enganchar).
    // Caché de Desollar, parte 1: camino 1v1 clásico / Matar (bug real, reverificación en vivo
    // 2026-08-29, ver `invalidateCarcassRollCache` en recolectar.ts). El camino de combate múltiple
    // se cubre aparte más abajo, tras `combatEncounterLootSummary` — `combatEncounterCaidos` NO basta
    // ahí: un golpe de grupo puede dejar `nuevaCondicion: 'CONVALECIENTE'` en un turno y el grupo solo
    // queda MUERTO del todo por acumulación de turnos anteriores ya escrita en `condicionFisicaGrupo`.
    const huboMuerteClasicaEnEstaUbicacion = npcTargetNewCondicion === 'MUERTO';
    if (huboMuerteClasicaEnEstaUbicacion) {
      const saveConCache = await tx.save.findUnique({ where: { id: saveId }, select: { harvestRollCache: true } });
      await invalidateCarcassRollCache(tx, saveId, saveConCache?.harvestRollCache, currentLocationId);
    }

    if (combatEncounterCaidos.length > 0) {
      const npcCaidosIds = combatEncounterCaidos.filter((c) => c.tipo === 'NPC' && c.npcId).map((c) => c.npcId!);
      const npcCaidosRows = npcCaidosIds.length
        ? await tx.npc.findMany({ where: { id: { in: npcCaidosIds } }, select: { id: true, name: true, raza: true, slug: true, faction: true } })
        : [];
      const npcCaidoById = new Map(npcCaidosRows.map((n) => [n.id, n]));
      for (const caido of combatEncounterCaidos) {
        if (caido.tipo !== 'NPC' || !caido.npcId) continue;
        const npcRow = npcCaidoById.get(caido.npcId);
        if (!npcRow) continue;
        const killSideEffects = await applyKillSideEffects({
          tx,
          npc: npcRow,
          nuevaCondicion: caido.nuevaCondicion,
          saveId,
          worldId,
          nuevoFictionalMinutes,
          nuevaFictionalDateLabel,
          activeRegion,
          nextAfterMainLogCreatedAt,
          completeQuest: caido.nuevaCondicion === 'MUERTO',
        });
        if (killSideEffects.questCompletedInfo) {
          questCompletedInfo = killSideEffects.questCompletedInfo;
          questRewardXp += killSideEffects.questCompletedInfo.rewardXp ?? 0;
        }
        if (killSideEffects.factionRepChange) factionRepChange = killSideEffects.factionRepChange;
      }
    }

    // Saqueo/desuello de CombatEncounter (2026-08-25, Grupo 3 § Mundo determinista, Capa 4) —
    // decisión explícita tras valorarlo con la usuaria: en vez de un mecanismo nuevo, se reutiliza
    // el pipeline de saqueo/desuello CLÁSICO tal cual (`carcassCandidatesFor`/`applyLootMode`,
    // recolectar.ts), sin tocar su código. Solo al RESOLVERSE el encuentro entero (nunca a mitad de
    // combate, petición explícita: "saquear al final del combate"). Dos piezas:
    // (1) Un miembro de GRUPO solo tenía su condición real en `CombatParticipant.condicionFisicaGrupo`
    // — nunca en `NpcState` (esa fila la comparten todos los individuos de la especie). Se
    // materializa aquí en `NpcState.groupSize`/`groupDefeated` (los mismos campos que ya lee
    // `carcassCandidatesFor`), sustituyendo lo que antes pre-escribía `cazar.ts` al INICIAR la caza
    // (ya no lo hace, ver `iniciarCombatEncounter`). Los solitarios ya tienen su `NpcState` real y
    // correcto (escrito por `escribirCondicionYEnergia` durante el propio combate) — no necesitan
    // materializado, solo entrar en el resumen si cayeron.
    // (2) `combatEncounterLootSummary` viaja fuera de la tx para el hecho de sesión (más abajo,
    // junto al resto de `appendSessionFacts` — nunca dentro de una transacción, llama a Ollama).
    if (combatEncounterTerminado && combatEncounterId) {
      const participantesFinal = await tx.combatParticipant.findMany({ where: { encounterId: combatEncounterId, tipo: 'NPC' } });
      const npcIds = [...new Set(participantesFinal.filter((p) => p.npcId).map((p) => p.npcId!))];
      const npcRowsFinal = npcIds.length ? await tx.npc.findMany({ where: { id: { in: npcIds } } }) : [];
      const npcRowById = new Map(npcRowsFinal.map((n) => [n.id, n]));
      const participantesPorNpc = new Map<string, typeof participantesFinal>();
      for (const p of participantesFinal) {
        if (!p.npcId) continue;
        if (!participantesPorNpc.has(p.npcId)) participantesPorNpc.set(p.npcId, []);
        participantesPorNpc.get(p.npcId)!.push(p);
      }
      for (const [npcId, participantesDeEsteNpc] of participantesPorNpc) {
        const npcRow = npcRowById.get(npcId);
        if (!npcRow) continue;
        const esGrupo = participantesDeEsteNpc.some((p) => p.condicionFisicaGrupo !== null);
        const scope = scopeFor(npcRow.kind, currentLocationId);
        if (esGrupo) {
          const caidosCount = participantesDeEsteNpc.filter((p) => p.condicionFisicaGrupo === 'CONVALECIENTE' || p.condicionFisicaGrupo === 'MUERTO').length;
          if (caidosCount === 0) continue;
          await tx.npcState.upsert({
            where: { saveId_npcId_scope: { saveId, npcId, scope } },
            create: { saveId, npcId, scope, condicionFisica: 'ILESO', groupSize: participantesDeEsteNpc.length, groupDefeated: caidosCount, corpsesLooted: 0, saqueado: false, lootedItemNames: [] },
            update: { groupSize: participantesDeEsteNpc.length, groupDefeated: caidosCount, corpsesLooted: 0, saqueado: false, lootedItemNames: [] },
          });
          combatEncounterLootSummary.push({ npcId, slug: npcRow.slug, name: npcRow.name, cantidad: caidosCount });
        } else {
          const state = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId, scope } } });
          if (state?.condicionFisica === 'CONVALECIENTE' || state?.condicionFisica === 'MUERTO') {
            combatEncounterLootSummary.push({ npcId, slug: npcRow.slug, name: npcRow.name, cantidad: 1 });
          }
        }
      }
    }

    // Caché de Desollar, parte 2: camino de combate múltiple — `combatEncounterLootSummary` ya
    // resume exactamente qué NPCs quedaron listos para saquear/desollar al resolverse el
    // `CombatEncounter` (grupos y solitarios), así que es la señal correcta aquí (a diferencia de
    // `combatEncounterCaidos`, que solo refleja el golpe de ESTE turno, no el estado final del grupo).
    if (combatEncounterLootSummary.length > 0) {
      const saveConCache = await tx.save.findUnique({ where: { id: saveId }, select: { harvestRollCache: true } });
      await invalidateCarcassRollCache(tx, saveId, saveConCache?.harvestRollCache, currentLocationId);
    }

    // Despiece/recolección (§ 3.3) — ver `applyHarvest` más arriba.
    const harvestResult = await applyHarvest({ tx, harvestMatch, harvestOutcome, roll, saveId, currentLocationId, characterName });
    newInventoryItems.push(...harvestResult.newInventoryItems);
    createdItemNames.push(...harvestResult.createdItemNames);
    if (harvestResult.narrationOverride) narration.narration = harvestResult.narrationOverride;

    // Producción de acciones por tiempo (docs/08 § 4) — hasta ahora "debería conseguir 60 de
    // leña" era solo texto de aviso y nunca se materializaba de verdad (roadmap 2026-07-19).
    // Mismo criterio que el despiece: solo si la acción tuvo éxito o no requería tirada.
    //
    // Bug real (auditoría en vivo, 2026-09-01): `computeDuration` (timedActions.ts) decide la
    // producción SOLO por palabras sueltas del texto libre (regex de "leña", sin relación con
    // `buildRecipe`/`detectsBuildIntent` de arriba) — "Construyo un campamento... usando la leña,
    // piedra y piel que llevo" disparaba la regex de leña por la propia palabra "leña" en la
    // frase, creando un InventoryItem fantasma ("Leña (12960)") EN PARALELO a la construcción
    // real, sin relación con ella. `buildRecipe` ya excluye este caso — presente tanto si la
    // construcción se completa (`buildMode`) como si queda bloqueada por falta de requisitos: en
    // ambos casos la "producción de leña" del mismo turno es igual de incorrecta.
    if (produccion && !buildRecipe && (!roll || roll.success)) {
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
    // Bug real (2026-09-04, auditoría "representar siempre XP/profesión/reputación" — misma
    // petición que ya cerró el desglose de dados de combate múltiple: "quiero que SIEMPRE se
    // represente"): crafteo/construcción exitosos SÍ suben el XP/nivel de oficio de verdad
    // (`tx.professionProgress.upsert` de abajo), pero ese delta nunca viajaba estructurado hasta
    // el frontend — solo un snapshot silencioso de `professionProgress` completo (todas las
    // profesiones, sin indicar cuál cambió ni cuánto) que actualizaba el estado de React sin
    // ningún chip/color visible. Mismo criterio que `xpDelta`/`factionRepChange`: el número real
    // viaja explícito, nunca implícito en un snapshot que hay que comparar a mano.
    const professionXpGains: { oficio: string; xpDelta: number; newLevel: number; leveledUp: boolean }[] = [];
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
      professionXpGains.push({ oficio, xpDelta, newLevel, leveledUp: newLevel > previousLevel });
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

    // Bug real (auditoría en vivo, 2026-09-01): `catalogBySlug` (construido más arriba, ANTES de
    // esta transacción, a partir de `inventoryRows`) solo conoce los `catalogSlug` que el
    // jugador YA tenía al empezar a narrar. `matchesRow` (ingredients.ts) para un requisito por
    // categoría hace `catalogBySlug.get(row.catalogSlug)` — si una fila de `freshInventoryRows`
    // tiene un `catalogSlug` que no estaba en ese snapshot viejo (un objeto llegó entre la
    // primera lectura y esta relectura: producción de fondo, otro turno, un tick del mundo), el
    // lookup da `undefined` y esa fila se considera "no coincide" aunque su categoría real sí
    // encaje — undercuenta el inventario real y puede rechazar una construcción/crafteo con
    // materiales de sobra. Se amplía el mapa con cualquier `catalogSlug` nuevo antes de planear
    // el consumo real (crafteo/construcción, más abajo) — mismo criterio anti-carrera que
    // `freshInventoryRows` en sí: los datos que se USAN para decidir deben ser los frescos.
    const freshCatalogSlugs = [...new Set(freshInventoryRows.map((i) => i.catalogSlug).filter((s): s is string => !!s))].filter(
      (slug) => !catalogBySlug.has(slug),
    );
    if (freshCatalogSlugs.length > 0) {
      const freshCatalogRows = await tx.itemCatalog.findMany({
        where: { worldId, slug: { in: freshCatalogSlugs } },
        select: {
          slug: true,
          tipo: true,
          category: true,
          curaHasta: true,
          curaUnPaso: true,
          tipoArma: true,
          curaEnergia: true,
          curaHambre: true,
          curaAgua: true,
          emptyContainerCatalogSlug: true,
          equipSlot: true,
          effectKey: true,
          aliases: true,
          herramientaParaOficio: true,
        },
      });
      for (const c of freshCatalogRows) {
        catalogBySlug.set(c.slug, {
          tipo: c.tipo,
          category: c.category,
          curaHasta: c.curaHasta,
          curaUnPaso: c.curaUnPaso,
          tipoArma: c.tipoArma,
          curaEnergia: c.curaEnergia,
          curaHambre: c.curaHambre,
          curaAgua: c.curaAgua,
          emptyContainerCatalogSlug: c.emptyContainerCatalogSlug,
          equipSlot: c.equipSlot,
          effectKey: c.effectKey,
          aliases: c.aliases,
          herramientaParaOficio: c.herramientaParaOficio,
        });
      }
    }

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

    // Panel "Comer/Beber" (2026-09-04) — mismo patrón EXACTO que el bucle de Curar justo arriba.
    //
    // `emptyContainerCatalogSlug` (hallazgo 13, revisar-partida-hallazgos.md 2026-09-06) — caso
    // nuevo: el odre de agua lleno, al beberse, no desaparece del todo — devuelve el odre vacío al
    // inventario. Memoizado por si el mismo turno consumiera más de un ítem con contenedor (hoy
    // solo el odre, pero sin asumirlo).
    const emptyContainerRowCache = new Map<string, { name: string; description: string; equipSlot: string | null; effectKey: string | null; tipo: string | null } | null>();
    async function emptyContainerRowFor(slug: string) {
      if (emptyContainerRowCache.has(slug)) return emptyContainerRowCache.get(slug)!;
      const row = await tx.itemCatalog.findUnique({
        where: { worldId_slug: { worldId, slug } },
        select: { name: true, description: true, equipSlot: true, effectKey: true, tipo: true },
      });
      emptyContainerRowCache.set(slug, row);
      return row;
    }
    for (const u of hambreSedItemUsesValidated) {
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
      if (u.emptyContainerCatalogSlug) {
        const emptyRow = await emptyContainerRowFor(u.emptyContainerCatalogSlug);
        if (emptyRow) {
          const nameConCantidad = aConsumir > 1 ? `${emptyRow.name} (${aConsumir})` : emptyRow.name;
          const created = await tx.inventoryItem.create({
            data: { saveId, name: nameConCantidad, description: emptyRow.description, origin: 'consumo', catalogSlug: u.emptyContainerCatalogSlug },
          });
          newInventoryItems.push({ ...created, slot: null, equipSlot: emptyRow.equipSlot, effectKey: emptyRow.effectKey, tipo: emptyRow.tipo });
          createdItemNames.push(created.name);
        }
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
      // `resultCantidad` (2026-08-30) — mismo formato de sufijo `(N)` que ya usa el resto del
      // inventario apilable, nunca N filas separadas para el mismo resultado de un solo crafteo.
      const resultCantidad = recipe.resultCantidad ?? 1;
      const created = await tx.inventoryItem.create({
        data: {
          saveId,
          name: resultCantidad > 1 ? `${recipe.resultName} (${resultCantidad})` : recipe.resultName,
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
        ? await computeBuildBlockedReason({ db: tx, saveId, worldId, buildRecipe, activeRegion, currentLocationRecord, excludeBuildingId: earlyBuildingId })
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
      // Guard real (Grupo 3 § Mundo determinista, docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25):
      // hasta ahora se creaba un `InventoryItem` real por CUALQUIER `newItem` que el modelo
      // propusiera, sin `catalogSlug`, fuera del `ItemCatalog` que usa el resto del juego
      // (recolección/combate/crafteo) — un objeto de nombre libre, imposible de tipar. Ahora exige
      // que el nombre coincida con un item REAL del catálogo del mundo — el modelo puede seguir
      // proponiendo "consigues un Cuchillo de Hielo Sílice", pero solo se materializa si ese
      // nombre existe de verdad, y en ese caso hereda su `equipSlot`/`effectKey`/`tipo` reales,
      // igual que cualquier otro objeto del juego (antes siempre salían `null`, aunque el nombre
      // coincidiera con catálogo por pura casualidad).
      const catalogMatch = await tx.itemCatalog.findFirst({
        where: { worldId, name: { equals: narration.newItem.name, mode: 'insensitive' } },
      });
      if (catalogMatch) {
        const created = await tx.inventoryItem.create({
          data: {
            saveId,
            name: catalogMatch.name,
            description: narration.newItem.description || catalogMatch.description,
            origin: 'partida',
            statBonuses: catalogMatch.statBonuses ?? Prisma.JsonNull,
            catalogSlug: catalogMatch.slug,
          },
        });
        createdItemNames.push(created.name);
        newInventoryItems.push({ ...created, slot: null, equipSlot: catalogMatch.equipSlot, effectKey: catalogMatch.effectKey, tipo: catalogMatch.tipo });
      }
    }
    if (narration.newCompanion) {
      // Guard real (Grupo 3 § Mundo determinista, docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25):
      // hasta ahora el único freno era el cupo de slots (abajo) — el modelo podía "ganar un
      // aliado" de la nada, sin ningún NPC real detrás ni ningún umbral de relación. Ahora exige
      // que el nombre coincida con un NPC de verdad presente en la escena Y que su temperamento
      // EFECTIVO (mismo `effectiveTemperamento` que ya decide si un NPC es hostil en combate,
      // ajustado por reputación de facción) sea AMIGABLE o INOFENSIVO — nunca CAUTELOSO/AGRESIVO/
      // ENEMIGO. AMIGABLE a secas se descartó al comprobar el catálogo real: NINGÚN NPC nace con
      // ese temperamento (`worldCatalog.ts`, 0 ocurrencias) — exigirlo habría hecho el reclutamiento
      // libre imposible en la práctica salvo con reputación de facción al máximo.
      const companionNpcMatch = npcsInScene.find((n) => normalizeText(n.name) === normalizeText(narration.newCompanion!.name));
      const companionNpcTemperamentoOk = companionNpcMatch
        ? ['AMIGABLE', 'INOFENSIVO'].includes(effectiveTemperamento(companionNpcMatch.temperamento, companionNpcMatch.faction, factionsStatus))
        : false;

      if (companionNpcTemperamentoOk) {
        // Tope real de slots (2026-08-04, ver el aviso de contextBlocks más arriba) — reconsultado
        // fresco dentro de la transacción, mismo criterio que `freshInventoryRows`: el modelo puede
        // ignorar el aviso, esto es lo que garantiza que nunca se cree un compañero sin hueco.
        const [freshCompanionCount, freshCompanionBuildings] = await Promise.all([
          // `esSlotDomador: false` (Grupo 3 § Compañeros y supervivencia, 2026-08-25) — el slot
          // garantizado del Domador nunca compite con el cupo de edificio.
          tx.companion.count({ where: { saveId, esSlotDomador: false } }),
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
    }

    // Eventos de Reino (docs/mecanicas/10-niveles-xp-reino.md § 5) — necesitan enlazar por nombre de
    // territorio y contar súbditos existentes, por eso van en la transacción interactiva.
    let reinoXp = territoryConsolidatedThisTurn ? REINO_XP.consolidado : 0;
    let territoryId: string | undefined;

    // Contador para nudges deterministas de KingdomStats (abajo) — increment-only, se salta en
    // silencio si todavía no hay fila (sin Territory fundado, "el vacío es un estado válido").
    async function bumpKingdomStats(delta: Partial<import('./kingdomTick.js').KingdomStatsBlock>): Promise<void> {
      const entries = Object.entries(delta).filter(([, v]) => v);
      if (entries.length === 0) return;
      const ownerKey = ownerKeyFor({ saveId });
      const exists = await tx.kingdomStats.findUnique({ where: { ownerKey }, select: { ownerKey: true } });
      if (!exists) return;
      await tx.kingdomStats.update({
        where: { ownerKey },
        data: Object.fromEntries(entries.map(([k, v]) => [k, { increment: v as number }])),
      });
    }

    // Guard real (Grupo 3 § Mundo determinista, docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25):
    // antes `region` salía del texto libre del modelo, que podía reclamar una región distinta de
    // donde el personaje está de pie. Ahora `region` SIEMPRE sale de `regionLocation` (la ubicación
    // real, ya resuelta de forma determinista) — el modelo nunca decide dónde se planta el
    // territorio, solo puede proponer que se funde uno aquí.
    if (narration.newTerritory) {
      const existingTerritories = await tx.territory.count({ where: { saveId } });
      assertExactlyOneOwner({ saveId }, 'turnResolution.ts newTerritory');
      const territory = await tx.territory.create({
        data: {
          saveId,
          name: narration.newTerritory.name,
          region: regionLocation?.region ?? null,
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
        assertExactlyOneOwner({ saveId }, 'turnResolution.ts newTerritory kingdomStats');
        await tx.kingdomStats.upsert({
          where: { ownerKey: ownerKeyFor({ saveId }) },
          create: { saveId, ownerKey: ownerKeyFor({ saveId }), ...DEFAULT_KINGDOM_STATS },
          update: {},
        });
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
      // Punto del jugador en el mapa de Zona (2026-09-04) — un EDIFICIO nuevo no tiene `ZonePoint`
      // propio (se crea al construir, fuera del alcance de esta pieza sembrar uno) — "construir
      // ocurre donde ya estás plantado", así que se mueve al punto de ENTRADA de la zona actual en
      // vez de inventar una posición nueva. No-op si nunca hubo entrada guardada (partida previa a
      // esta pieza).
      await volverAEntrada(tx, saveId, { x: params.jugadorZonaPosEntradaX ?? null, y: params.jugadorZonaPosEntradaY ?? null });
      if (buildRecipe.upgradesRecipeKey) {
        // Mejora de Ayuntamiento (2026-08-04): actualiza el MISMO `Building.id`, nunca crea uno
        // nuevo — "no se acumulan, mejoras el actual" (docs/mecanicas/17-reglas-construcciones-reino.md).
        // El objetivo ya se verificó arriba (`buildBlockedReason`), pero se re-busca fresco dentro
        // de la transacción por si acaso, mismo criterio que `freshInventoryRows`.
        const target = await tx.building.findFirst({ where: { saveId, recipeKey: buildRecipe.upgradesRecipeKey } });
        if (target) {
          await tx.building.update({
            where: { id: target.id },
            data: { name: buildRecipe.name, description: buildRecipe.description, tier: buildingTierFor(buildRecipe) ?? undefined, status: 'ACTIVO' },
          });
        }
      } else {
        // Completa la fila EN_CONSTRUCCION ya creada en turn.ts en vez de crear una nueva
        // (2026-08-23, Grupo 3 § Building.status) — `earlyBuildingId` solo falta si esta
        // construcción se resolvió por el turno síncrono de /turn/narrate (nunca pasa hoy, todas
        // las recetas son banda larga, pero se cubre el caso por si acaso) o si `turn.ts` no llegó
        // a detectarla a tiempo (mismo "mejor esfuerzo" que el resto de esta revalidación).
        if (!earlyBuildingId) assertExactlyOneOwner({ saveId }, 'turnResolution.ts construir Building');
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
                tier: buildingTierFor(buildRecipe) ?? undefined,
                // Posición en el lienzo de Zona (2026-09-08, ver comentario de Building.x/y en
                // schema.prisma) — mismo criterio que `earlyBuildingId` en turn.ts: posición de
                // entrada, coherente con `volverAEntrada` justo arriba en este mismo bloque.
                x: params.jugadorZonaPosEntradaX ?? undefined,
                y: params.jugadorZonaPosEntradaY ?? undefined,
              },
            });
        // Libro de Sucesos (CR-3, hito 0.2).
        await registrarSuceso(tx, {
          saveId,
          tipo: 'EDIFICIO_CONSTRUIDO',
          fictionalMinutes: nuevoFictionalMinutes,
          regionSlug: activeRegion ? slugify(activeRegion) : null,
          locationId: currentLocationId,
          origen: 'JUGADOR',
          actores: [
            { entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' },
            { entidadTipo: 'EDIFICIO', entidadId: created.id, papel: 'BENEFICIARIO' },
          ],
          datos: { edificio: buildRecipe.name },
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
          assertExactlyOneOwner({ saveId }, 'turnResolution.ts fundar reino territory');
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
            assertExactlyOneOwner({ saveId }, 'turnResolution.ts fundar reino kingdomStats');
            await tx.kingdomStats.upsert({
              where: { ownerKey: ownerKeyFor({ saveId }) },
              create: { saveId, ownerKey: ownerKeyFor({ saveId }), ...DEFAULT_KINGDOM_STATS },
              update: {},
            });
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
        // Conquista territorial estilo X4 (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — al
        // levantar un Cuartel Avanzado (siempre en región DISTINTA a la de la Capital, ya
        // garantizado por `computeBuildBlockedReason`), pasan dos cosas nuevas:
        // (1) su propia zona-interior navegable, mismo patrón que la Capital (reino.ts) pero de
        //     MENOR escala ("base secundaria", decisión explícita de Álvaro) — 1 parcela AVANZADA
        //     central ya ocupada por el propio Cuartel + 1 BÁSICA vacía alrededor (cifra de
        //     partida, crece cuando haya más variedad de edificios que la justifique).
        // (2) si la región ya tiene una Faction NPC dueña real (`REGION_OWNING_FACTIONS`) DISTINTA
        //     de la propia facción del jugador, esto es EXPANSIÓN AGRESIVA real en su territorio —
        //     dispara el evento discreto que alimenta `FactionRelation` (§ 7.3), primer caller real
        //     de `recordFactionEvent` en producción.
        if (buildRecipe.isCuartelAvanzado) {
          const playerFaction = await tx.faction.findFirst({ where: { saveId, origenSlug: null }, select: { id: true, name: true } });
          const cuartelLocationSlug = `cuartel-avanzado-interior-${created.id}`;
          const cuartelLocation = await tx.location.create({
            data: {
              worldId,
              slug: cuartelLocationSlug,
              name: `Puesto de ${playerFaction?.name ?? characterName}`,
              region: activeRegion ?? '',
              kind: 'interior',
              description: `Dentro de la palizada del cuartel avanzado: un puesto modesto, mucho más pequeño que la capital — apenas espacio para lo esencial.`,
              aliases: playerFaction ? [slugify(playerFaction.name)] : [],
            },
          });
          if (currentLocationId) {
            await tx.locationLink.create({
              data: { fromId: currentLocationId, toId: cuartelLocation.id, minutosBase: 0, terreno: 'La entrada del cuartel' },
            });
          }
          await tx.parcela.create({
            data: { locationId: cuartelLocation.id, x: 400, y: 300, tipo: 'AVANZADA', recipeKeyFijo: buildRecipe.key, buildingId: created.id },
          });
          await tx.parcela.create({
            data: { locationId: cuartelLocation.id, x: 400, y: 150, tipo: 'BASICA' },
          });

          if (playerFaction && activeRegion) {
            const duenoOriginalName = REGION_OWNING_FACTIONS[activeRegion]?.[0];
            if (duenoOriginalName && duenoOriginalName !== playerFaction.name) {
              // CR-6: jugador↔facción, contra la de catálogo (como diplomacia y mercado, hasta CR-7); la
              // relación ya es de la partida porque su Reino lo es.
              const targetFaction = await tx.faction.findFirst({ where: { worldId, name: duenoOriginalName, saveId: null }, select: { id: true } });
              if (targetFaction) {
                const fact = await recordFactionEvent(tx, worldId, playerFaction.id, targetFaction.id, 'EXPANSION_TERRITORIAL_AGRESIVA', saveId);
                if (fact) {
                  await tx.logEntry.create({
                    data: { saveId, channel: 'WORLD', text: fact, timeLabel, fictionalMinutes: fictionalMinutesActuales, isSystemMessage: true },
                  });
                }
              }
            }
          }
        }
      }
      reinoXp = Math.max(reinoXp, REINO_XP.buildingActive);
    } else if (narration.newBuilding) {
      assertExactlyOneOwner({ saveId }, 'turnResolution.ts newBuilding');
      const edificioNarrado = await tx.building.create({
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
      // Libro de Sucesos (CR-3, hito 0.2).
      await registrarSuceso(tx, {
        saveId,
        tipo: 'EDIFICIO_CONSTRUIDO',
        fictionalMinutes: nuevoFictionalMinutes,
        regionSlug: activeRegion ? slugify(activeRegion) : null,
        locationId: currentLocationId,
        origen: 'JUGADOR',
        actores: [
          { entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' },
          { entidadTipo: 'EDIFICIO', entidadId: edificioNarrado.id, papel: 'BENEFICIARIO' },
        ],
        datos: { edificio: narration.newBuilding.name },
      });
      // Nudge determinista por palabra clave (sesión de diseño 2026-07-23, mismo criterio que
      // tabulatedAttackAttribute en npcScene.ts) — sin campo nuevo en el JSON del modelo: el
      // `kind` libre que ya propone es la única señal que hace falta.
      const kindNormalized = normalizeText(narration.newBuilding.kind);
      if (/granja|cultivo|huerta|establo/.test(kindNormalized)) await bumpKingdomStats({ comida: 20 });
      else if (/taller|mina|forja|comercio|mercado/.test(kindNormalized)) await bumpKingdomStats({ riqueza: 20 });
      else if (/pozo|cisterna|aljibe/.test(kindNormalized)) await bumpKingdomStats({ bebida: 20 });
    }

    if (narration.newSubject) {
      // Guard real (Grupo 3 § Mundo determinista, 2026-08-25): antes se creaba el `Subject` igual
      // aunque `territoryName` no matcheara ningún `Territory` real (o no viniera dado en
      // absoluto) — un súbdito flotante, sin reino real al que pertenecer. Exige un territorio
      // real ya resuelto (el recién fundado este mismo turno cuenta, ver `resolveTerritoryId`).
      const resolvedTerritoryId = await resolveTerritoryId(narration.newSubject.territoryName);
      if (resolvedTerritoryId) {
        const existingSubjects = await tx.subject.count({ where: { saveId } });
        await tx.subject.create({
          data: {
            saveId,
            territoryId: resolvedTerritoryId,
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
    }

    // Misiones (docs/mecanicas/09-panel-personaje.md) — mismo patrón que Reino: el modelo propone, el
    // backend valida y materializa. questProgress solo actúa si matchea una misión ACTIVA real.
    // `title?.trim()` (2026-09-07, "salen misiones como UNDEFINED") — el schema no obliga a que el
    // modelo rellene `title`; sin este guard, un `newQuest` con el campo vacío/ausente seguía todo
    // este bloque (incluida la búsqueda de anclaje con "undefined" literal en el texto).
    if (narration.newQuest?.title?.trim()) {
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
        const worldNpcs = await tx.npc.findMany({ where: { worldId, muertoEnMundo: false } });
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

      // Guard real (Grupo 3 § Mundo determinista, docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25):
      // hasta ahora se creaba una `Quest` real por CUALQUIER `newQuest` que el modelo propusiera,
      // sin ningún anclaje a nada real del mundo — título y descripción 100% libres. Exigir al
      // menos UNO de los tres anclajes ya resueltos arriba (NPC/Location/Item reales) no es una
      // solución completa (eso exige un catálogo de misiones propio, fuera de alcance de esta
      // pasada — ver el documento), pero cierra el caso más grave: una misión completamente
      // inventada, sin ninguna conexión con el mundo real, que ni siquiera podría cerrarse sola.
      //
      // Botones Aceptar/Cancelar (2026-08-26, petición explícita: "en vez de depender de que la
      // jugadora escriba texto libre para aceptar... que 'Aceptar' genere una narración
      // determinista de aceptación, sin esperar a que el LLM decida si acepta o no") — este bloque
      // YA NO crea la `Quest` aquí: solo confirma que hay un anclaje real (mismo guard de siempre)
      // y ofrece el título/descripción para que el frontend pinte los botones. La `Quest` de
      // verdad nace en `POST /saves/:id/quests/aceptar` (quests.ts), que vuelve a resolver los
      // anclajes por su cuenta contra el título/descripción exactos — nunca contra `npcsInScene`
      // de este turno concreto, que para entonces ya puede haber cambiado.
      // Bug real jugando en vivo (2026-09-07, "salen misiones como UNDEFINED"): el schema JSON del
      // narrador (`newQuest: { title, description }`) no obliga a que el modelo rellene `title` —
      // sin este guard, un turno donde el modelo devolvía el objeto con el campo vacío/ausente
      // llegaba tal cual hasta el frontend, que literalmente interpola `undefined` en el texto del
      // botón ("Misión propuesta: undefined"). Mismo criterio que el resto de guards de esta
      // familia: mejor no ofrecer nada que ofrecer una tarjeta rota.
      if ((targetNpcId || targetLocationId || targetItemName) && narration.newQuest?.title?.trim()) {
        newQuestOfferInfo = { title: narration.newQuest.title.trim(), description: narration.newQuest.description ?? '' };
      }
    }

    // Oferta determinista de "acabar con el Orco Enfurecido" (segunda vuelta de diseño,
    // 2026-07-23, "revisar partida": el jugador aceptó con claridad — "Gorhorn ha aceptado ayudar
    // a Gistera Koh" ya estaba hasta en `new_facts` — pero el "newQuest" del modelo nunca se
    // disparó, pese a la instrucción explícita de más arriba. Mismo principio que el resto de
    // esta sesión: no confiar en que el modelo cumpla una condición de "si acepta, crea la
    // misión" — se detecta la aceptación de forma determinista).
    //
    // Botones Aceptar/Cancelar (bug real 2026-08-28, "misión se salta los botones" — petición
    // explícita: "quiero que las misiones pasen todas por aceptar y cancelar, sin excepción"): este
    // bloque creaba la `Quest` YA ACTIVA directamente aquí, saltándose por completo el flujo de
    // botones que sí respeta el camino genérico de arriba (`newQuestOfferInfo`). Ahora, igual que
    // ese camino, SOLO ofrece — la `Quest` de verdad nace en `POST /saves/:id/quests/aceptar`
    // (quests.ts), que reconoce este título exacto y aplica su lógica especial (objetivo/recompensa
    // fija, y el caso "ya resuelto antes de aceptar" — ver comentario de ese archivo).
    //
    // Bug real jugando en vivo (2026-08-30, "sigue sin salir el boton aceptar y cancelar" — la
    // usuaria acababa de preguntarle a Gistera "¿Quién eres?" y ella respondió pidiendo ayuda
    // explícitamente, pero el turno no ofreció ningún botón): antes se exigía
    // `detectsVerbalAcceptanceIntent(action)` — es decir, el jugador tenía que escribir una frase
    // de aceptación EN TEXTO LIBRE antes de que aparecieran los botones, lo cual es contradictorio
    // con tener botones en absoluto ("se acepta con el boton aceptar o cancelar y eso genera la
    // narracion para aceptarla y que te responda", aclaración explícita de la usuaria) — el botón
    // debe ofrecerse en el momento en que Gistera FORMULA la petición (`gisteraSePresentaEsteTurno`,
    // línea ~3494), no cuando el jugador ya la aceptó por su cuenta en texto libre.
    if (gisteraSePresentaEsteTurno && !newQuestOfferInfo) {
      const existingOrcoQuest = await tx.quest.findFirst({ where: { saveId, title: { contains: 'Orco Enfurecido' } } });
      if (!existingOrcoQuest) {
        newQuestOfferInfo = {
          title: 'Acabar con el Orco Enfurecido',
          // Bug real jugando en vivo (2026-09-06): la descripción narraba "Gorhorn ha aceptado"
          // mientras los botones Aceptar/Cancelar seguían visibles — contradicción de estado, la
          // propuesta no puede narrar la aceptación antes de que ocurra.
          description:
            'Gistera Koh, expulsada del Clan Serhu, pide ayuda para acabar con el guerrero que la persigue. Aceptar la pondría a salvo.',
        };
      }
    }

    // Bug real jugando en vivo (2026-09-03, "misión de apertura no sobrevive a un F5") — mismo
    // patrón exacto que `pendingDynamicModeOffer` más abajo: persistir la oferta para que
    // `GET /saves/:id` (detail.ts) pueda reconstruir la tarjeta "MISIÓN PROPUESTA" tras recargar.
    // Cubre AMBOS caminos de arriba (genérico y Gistera/Orco Enfurecido) con una sola escritura,
    // ya resuelto el valor definitivo de `newQuestOfferInfo` para este turno.
    if (newQuestOfferInfo) {
      await tx.save.update({ where: { id: saveId }, data: { pendingQuestOfferInfo: newQuestOfferInfo } });
    }

    // Menú contextual de interacción con NPC (2026-09-06) — `npcInteractionCandidate` ya excluye a
    // Gistera Koh (calculado más arriba, junto a `dialogueTarget`); aquí solo falta saber si ESTE
    // turno generó una oferta de misión genérica (`newQuestOfferInfo`) para poder ofrecer la opción
    // 'Misión: <título>' — no hay relación NPC↔Quest en el modelo, así que el criterio es "hubo
    // diálogo con este NPC Y una oferta nació en este mismo turno" (única señal real disponible sin
    // ampliar el modelo de datos, coherente con el alcance de esta pieza).
    if (npcInteractionCandidate) {
      const opciones = opcionesDisponiblesPara(npcInteractionCandidate, {
        hayMisionOfertadaDeEsteNpc: !!newQuestOfferInfo,
        tituloMisionOfertada: newQuestOfferInfo?.title,
      });
      npcInteractionOffer = { npcSlug: npcInteractionCandidate.slug, npcName: npcInteractionCandidate.name, options: opciones };
      await tx.save.update({ where: { id: saveId }, data: { pendingNpcInteractionOffer: npcInteractionOffer } });
    }

    if (narration.questProgress) {
      const matchingQuests = await tx.quest.findMany({
        where: { saveId, title: narration.questProgress.title, status: 'ACTIVA' },
      });
      await tx.quest.updateMany({
        where: { saveId, title: narration.questProgress.title, status: 'ACTIVA' },
        data: { status: narration.questProgress.status },
      });
      for (const mision of matchingQuests) {
        await registrarFinDeMision(tx, { saveId, titulo: mision.title, estado: narration.questProgress.status, fictionalMinutes: nuevoFictionalMinutes });
      }

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
            // isSystemMessage (ver comentario completo en schema.prisma) — texto fijo determinista.
            const rewardEntry = await tx.logEntry.create({
              data: {
                saveId,
                channel: 'CHARACTER',
                text: rewardText,
                isPlayerAction: false,
                timeLabel: nuevaFictionalDateLabel,
                fictionalMinutes: nuevoFictionalMinutes,
                isSystemMessage: true,
                ...(nextAfterMainLogCreatedAt ? { createdAt: nextAfterMainLogCreatedAt() } : {}),
              },
            });
            questCompletedInfo = { logEntryId: rewardEntry.id, text: rewardText, title: quest.title, grantedItems, rewardXp: quest.rewardXp ?? 0 };
            // Bug real (2026-09-04, auditoría "representar siempre XP/profesión/reputación"):
            // `questRewardNarrationFor` ya narraba "+N XP" en el texto de arriba, pero nada en
            // este bloque sumaba `quest.rewardXp` a `questRewardXp` (la variable que sí alimenta
            // `xpTurno`/`applyXp` más abajo) — a diferencia de las 2 ramas de combate
            // (`combatExchangeResult.questCompletedInfo`/`killSideEffects.questCompletedInfo`,
            // líneas ~4830/4878), que sí lo hacen. El número que veía el jugador era ficticio:
            // `Save.xp` real nunca subía para una misión cerrada en paz por el propio modelo.
            questRewardXp += quest.rewardXp ?? 0;
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
          // Bug real (2026-09-04, auditoría "representar siempre XP/profesión/reputación"): el
          // delta se calculaba y persistía de verdad, pero `factionRepChange` (la variable que
          // viaja hasta el LogEntry/return del turno, ver comentario de FactionRepChangeInfo en
          // reputation.ts) nunca se reasignaba aquí — a diferencia del bloque de combate
          // (`applyKillSideEffects`, más arriba), que sí lo hace. Es además el ÚNICO camino real
          // que genera un delta POSITIVO (`FACTION_REP_PEACE_DELTA`) — sin este fix, el chip verde
          // de LogPanel.tsx nunca se había visto disparar jugando, pese a estar bien programado.
          factionRepChange = { faction: npc.faction, delta: FACTION_REP_PEACE_DELTA, newValue: updatedFactionsStatus[npc.faction] };
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
      const misionesDeLlegada = await tx.quest.findMany({ where: { saveId, targetLocationId: travel.toLocationId, status: 'ACTIVA' }, select: { title: true } });
      await tx.quest.updateMany({
        where: { saveId, targetLocationId: travel.toLocationId, status: 'ACTIVA' },
        data: { status: 'COMPLETADA' },
      });
      for (const mision of misionesDeLlegada) {
        await registrarFinDeMision(tx, { saveId, titulo: mision.title, estado: 'COMPLETADA', fictionalMinutes: nuevoFictionalMinutes });
      }
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
    const xpHitoFromTipos = xpForHitos(hitos);
    const xpHito = Math.max(xpHitoFromTipos, reinoXp);
    // UX 2026-09-01: separar el chip de XP normal del de "hito"/capítulo en el frontend (antes un
    // único "+N XP" sumaba ambos, y un turno FALLIDO con un hito grande detrás — p.ej. "capitulo",
    // 500 XP — se veía como "+500 XP" pegado a un "Fallo" en rojo, como si el juego premiara el
    // fracaso). `reinoXp` no tiene un `HitoTipo` propio (fundar/consolidar territorio, activar
    // edificio, súbdito nuevo...) así que, si es él quien domina sobre los hitos propuestos por el
    // modelo, usa una etiqueta genérica de Reino en vez de `labelForHitos`.
    const xpHitoLabel: string | null =
      xpHito === 0 ? null : reinoXp >= xpHitoFromTipos ? 'Progreso del Reino' : labelForHitos(hitos);
    const xpTurno = xpTirada + xpHito + questRewardXp;
    const result = applyXp(params.currentXp, params.currentLevel, xpTurno, { xpTirada, xpHito, xpHitoLabel });

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
    } else if (travelInterruptionNpcId && !travel) {
      // Grupo 3 § Mundo determinista, Capa 2 (2026-08-25) — mismo aviso pero para una acción
      // larga SIN desplazamiento (`pickStationaryInterruption`, turn.ts): no hay ningún destino
      // que truncar, así que `travelInterruptionOriginalDestinationName` se queda null y este
      // branch cubre el aviso equivalente. Reutiliza `travelInterrupted` (nombre heredado del
      // caso de viaje, pero el frontend solo lo usa como "resalta esta entrada", no lee semántica
      // de viaje en el campo) para el mismo fondo ámbar.
      await tx.logEntry.create({
        data: {
          saveId,
          channel: 'CHARACTER',
          text: 'Algo te sale al paso mientras estás ocupado con esto.',
          timeLabel,
          fictionalMinutes: nuevoFictionalMinutes,
          createdAt: nextBeforeMainLogCreatedAt(),
          travelInterrupted: true,
        },
      });
    }

    // Franja 1b (2026-09-08, "Interactuar" motor unificado de eventos de escena) — sustituye el
    // "callejón sin salida" de antes (el aviso ámbar de arriba se quedaba en un texto plano, sin
    // ninguna consecuencia): el candidato de la interrupción YA resuelto (`interruptionCandidateForOffer`,
    // ver más arriba) se ofrece como Interactuar, mismo shape/patrón exacto que la oferta ambiental
    // normal (línea ~7185 más abajo, `dynamicModeOffer`). Sin cooldown ni probabilidad — a
    // diferencia de la oferta ambiental, este evento ya está determinísticamente decidido por
    // `pickTravelInterruption`/`pickStationaryInterruption`, no tiene sentido volver a tirar dados
    // sobre si se ofrece. Guard mínimo: no pisar una conversación ya en curso de otro origen.
    if (interruptionCandidateForOffer) {
      const saveDynamicStateForInterruption = await tx.save.findUnique({
        where: { id: saveId },
        select: { pendingDynamicMode: true },
      });
      if (!saveDynamicStateForInterruption?.pendingDynamicMode) {
        const interruptionDynamicModeOffer = {
          tipo: 'FAUNA' as const,
          targetSlug: interruptionCandidateForOffer.targetSlug,
          targetName: interruptionCandidateForOffer.targetName,
        };
        await tx.save.update({
          where: { id: saveId },
          data: { pendingDynamicModeOffer: interruptionDynamicModeOffer, lastDynamicModeOfferAtMinutes: nuevoFictionalMinutes },
        });
      }
    }

    const mainLogEntry = await tx.logEntry.create({
      data: {
        saveId,
        channel: 'CHARACTER',
        text: narration.narration,
        roll: effectiveRoll ? (effectiveRoll as unknown as Prisma.InputJsonValue) : undefined,
        // Bug real jugando en vivo (2026-08-13): sin persistir esto, recargar la partida perdía
        // el lado "Enemigo" del intercambio — `roll` de arriba solo guarda el lado del jugador.
        combatExchange: combatExchangeDisplayFinal ? (combatExchangeDisplayFinal as unknown as Prisma.InputJsonValue) : undefined,
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
        // UX 2026-09-01 (ver comentario de la columna en schema.prisma) — desglose de `xpDelta`
        // para que el frontend separe el chip de hito/capítulo del de XP normal tras recargar.
        xpHitoDelta: xpHito > 0 ? xpHito : undefined,
        xpHitoLabel: xpHito > 0 ? xpHitoLabel ?? undefined : undefined,
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
        for (const ability of abilityUnlocksAlSubirANivel(characterName, lvl, params.clase, params.especializacion)) {
          await tx.savedAction.create({ data: savedActionDataFromAbility(saveId, ability) });
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
    // B11 (pruebas 2026-09-28): regeneración pasiva fuera de combate por el tiempo transcurrido.
    let finalEnergia = enCombate ? nuevaEnergia : Math.min(energiaMax, nuevaEnergia + energiaPasivaEntre(fictionalMinutesActuales, nuevoFictionalMinutes));

    // Punto de guardado (2026-08-04, docs/mecanicas/17-reglas-construcciones-reino.md): solo descansar en
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

    // Libro de Sucesos (CR-3, hito 0.2): caer convaleciente en un combate es perderlo (morir tiene
    // su propio suceso, más abajo).
    if (enCombate && proposedCondicion === 'CONVALECIENTE' && params.condicionFisica !== 'CONVALECIENTE') {
      await registrarSuceso(tx, {
        saveId,
        tipo: 'COMBATE_PERDIDO',
        fictionalMinutes: nuevoFictionalMinutes,
        locationId: currentLocationId,
        origen: 'JUGADOR',
        actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'VICTIMA' }],
        datos: { personaje: characterName, rival: npcAbilityUsed?.npcName ?? combatExchangeDisplayFinal?.rivalNombre ?? 'sus enemigos' },
      });
    }

    let finalPendingDeathResolution = false;
    if (proposedCondicion === 'MUERTO') {
      const outcome = resolveDeathOutcome(params.dificultad, params.deathCount);
      finalDeathCount = outcome.deathCount;
      if (outcome.finDePartida) {
        // Sin vidas restantes: game over real, sin botón de reintentar — nada que decidir, el
        // frontend saca al jugador al selector de partidas (2026-08-31, petición explícita).
        finDePartidaResult = true;
        finalEndedAt = new Date();
        finalCondicion = 'MUERTO';
      } else {
        // Muerte permanente, botón Aceptar/Reintentar (2026-08-31, petición explícita: "te pondra
        // un boton... si le das vuelve al punto de guardado"): el susurro de la Entidad ya se
        // narra AQUÍ (es determinista, no depende de a dónde se vaya a respawnear todavía), pero
        // el respawn/reinicio real se retiene — POST /saves/:id/death/resolve lo aplica al pulsar
        // el botón, con el estado de la partida en ESE momento (nunca lo que había al morir).
        // `finalCondicion` se queda en MUERTO a propósito: bloquea turnos vía el mismo guard que
        // `pendingDeathResolution` en turn.ts, red de seguridad doble.
        await tx.logEntry.create({
          data: {
            saveId,
            channel: 'CHARACTER',
            text: whisperText(characterName, outcome.avisoUltimaVez),
            timeLabel,
            fictionalMinutes: nuevoFictionalMinutes,
            createdAt: nextAfterMainLogCreatedAt(),
          },
        });
        finalCondicion = 'MUERTO';
        finalPendingDeathResolution = true;
      }
      // Libro de Sucesos (CR-3, hito 0.2): la muerte del personaje, y el final si no quedan vidas.
      const actoresMuerte = [{ entidadTipo: 'PERSONAJE' as const, entidadId: saveId, papel: 'VICTIMA' as const }];
      const muerteId = await registrarSuceso(tx, {
        saveId,
        tipo: 'MUERTE_JUGADOR',
        fictionalMinutes: nuevoFictionalMinutes,
        locationId: currentLocationId,
        origen: 'JUGADOR',
        actores: actoresMuerte,
        datos: { personaje: characterName },
      });
      if (outcome.finDePartida) {
        await registrarSuceso(tx, {
          saveId,
          tipo: 'FIN_PARTIDA',
          fictionalMinutes: nuevoFictionalMinutes,
          locationId: currentLocationId,
          origen: 'JUGADOR',
          actores: actoresMuerte,
          datos: { personaje: characterName },
          causas: [muerteId],
        });
      }
    }

    // Fase 2 de efectos de clase (2026-08-27) — mismo valor para lo que se PERSISTE y lo que se
    // DEVUELVE este turno (antes solo se calculaba inline dentro del `data` de abajo, sin que el
    // resto de la función pudiera reutilizarlo para la respuesta HTTP).
    const jugadorActiveEffectsFinal = params.condicionFisica !== 'ILESO' && finalCondicion === 'ILESO' ? [] : jugadorActiveEffectsNext;

    // Punto del jugador en el mapa de Zona (2026-09-04) — hablar con un NPC determinista lo acerca
    // a él, mismo criterio que combate. Nunca en el mismo turno que un viaje real (`zonaEntradaCoords`
    // ya fija dónde aparece al llegar; hablar y viajar no ocurren en el mismo turno en la práctica,
    // pero por si acaso el viaje manda).
    if (dialogueTarget && !zonaEntradaCoords && currentLocationId) {
      const zonaObjetivoDialogo = await posicionDeObjetivo(tx, saveId, currentLocationId, dialogueTarget.slug);
      if (zonaObjetivoDialogo) {
        await moverJugadorA(tx, saveId, zonaObjetivoDialogo.x, zonaObjetivoDialogo.y);
      } else {
        const scopeDialogo = scopeFor(dialogueTarget.kind, currentLocationId);
        const npcStateDialogo = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: dialogueTarget.id, scope: scopeDialogo } }, select: { zonaPosX: true, zonaPosY: true } });
        if (npcStateDialogo?.zonaPosX != null && npcStateDialogo?.zonaPosY != null) {
          await moverJugadorA(tx, saveId, npcStateDialogo.zonaPosX, npcStateDialogo.zonaPosY);
        }
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
        // Punto del jugador en el mapa de Zona (2026-09-04) — solo se toca en un turno de viaje
        // real (`zonaEntradaCoords` calculado arriba); fuera de viaje, `undefined` deja el campo
        // intacto (Prisma no lo incluye en el UPDATE), así que el resto de enganches deterministas
        // (cazar/recolectar/combate/hablar, cada uno en su propio punto de escritura) siguen
        // siendo la única fuente que mueve `zonaPosX/Y` dentro de la misma zona.
        ...(zonaEntradaCoords
          ? { zonaPosX: zonaEntradaCoords.x, zonaPosY: zonaEntradaCoords.y, zonaPosEntradaX: zonaEntradaCoords.x, zonaPosEntradaY: zonaEntradaCoords.y }
          : {}),
        condicionFisica: finalCondicion,
        salud: saludForCondicion(finalCondicion),
        energia: finalEnergia,
        // Habilidad "Comer/Beber" (2026-09-04) — timestamps recalculados por lastAtMinutesForGanancia
        // (o el minuto de ficción actual, si se pulsó "Beber agua"); sin uso este turno, quedan
        // igual que antes (`nuevoLastAteAtMinutes`/`nuevoLastDrankAtMinutes` ya devuelven el valor
        // de entrada sin tocar cuando no hubo ganancia).
        lastAteAtMinutes: nuevoLastAteAtMinutes,
        lastDrankAtMinutes: nuevoLastDrankAtMinutes,
        // Cooldown de Descansar (2026-09-06, hallazgo 11) — solo cambia cuando `restAttempted`
        // fue true este turno (ver comentario de `nuevoLastRestAtMinutes` más arriba).
        lastRestAtMinutes: nuevoLastRestAtMinutes,
        lastRestLocationId: finalLastRestLocationId,
        deathCount: finalDeathCount,
        endedAt: finalEndedAt,
        pendingDeathResolution: finalPendingDeathResolution,
        // Rediseño del turno de combate (2026-07-28): guarda el ataque de NPC decidido para el
        // PRÓXIMO intercambio (si la iniciativa lo favorece) o limpia el de este turno, ya
        // consumido — nunca sobrevive más de un intercambio sin resolverse.
        pendingNpcAttack: nuevoPendingNpcAttack ? (nuevoPendingNpcAttack as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        // CANALIZAR real (2026-09-09) — mismo criterio exacto que pendingNpcAttack arriba.
        pendingCanalizacion: nuevoPendingCanalizacion ? (nuevoPendingCanalizacion as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        // Fase 2 de efectos de clase (2026-08-26) — `jugadorActiveEffectsNext` ya con el push/
        // decremento de este intercambio aplicado (ver resolveCombatExchangePhase), salvo que el
        // jugador de verdad VUELVA a ILESO este turno desde un estado peor (descanso/curación
        // real), mismo criterio de reset que `NpcState.abilityUsesThisEncounter`/`activeEffects`.
        // Bug real evitado en el propio diseño (2026-08-26): comparar solo `finalCondicion ===
        // 'ILESO'` a secas resetearía SIEMPRE que el jugador siga ileso (el caso más común, p.ej.
        // ganando un combate sin recibir ni un golpe) — hace falta la transición real desde un
        // estado peor, no solo el valor final.
        activeEffects: jugadorActiveEffectsFinal as unknown as Prisma.InputJsonValue,
        // Bug real de sessionFacts reintroduciendo NPCs "retirados para siempre" (2026-08-27,
        // cerrado 2026-08-28) — `gisteraAceptaEsteTurno` solo es true el turno EXACTO de la
        // aceptación, nunca se repite; `push` es seguro porque nunca se vacía/resetea esta lista.
        ...(gisteraAceptaEsteTurno ? { npcsRetiredForever: { push: 'gistera-koh' } } : {}),
      },
    });

    return {
      progression: result,
      condicionFisica: finalCondicion,
      activeEffects: jugadorActiveEffectsFinal,
      energia: finalEnergia,
      energiaMax,
      hambre: comidaPct(nuevoLastAteAtMinutes, fictionalMinutesParaComerBeber),
      sed: aguaPct(nuevoLastDrankAtMinutes, fictionalMinutesParaComerBeber),
      finDePartida: finDePartidaResult,
      pendingDeathResolution: finalPendingDeathResolution,
      justDied: proposedCondicion === 'MUERTO',
      newInventoryItems,
      removedInventoryItemIds,
      updatedInventoryItems,
      logEntryId: mainLogEntry.id,
      newQuestObjetivos,
      newQuestInfo,
      newQuestOfferInfo,
      npcInteractionOffer,
      questCompletedInfo,
      factionRepChange,
      professionXpGains,
      newKingdomFounded,
      companionCreated,
      partiallyLootedSlugs,
      deathCount: finalDeathCount,
      // Hallazgo 38 — `travel.path` ya trae los slugs del camino en orden (travel.ts), el último
      // es siempre el destino: mismo dato que `travel.toLocationId`/`toLocationName`, sin
      // necesitar ampliar `TravelResolution` con un campo nuevo.
      discoveredLocationSlug: isFirstVisitToDestination && travel ? travel.path[travel.path.length - 1] : null,
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
    activeEffects,
    energia,
    energiaMax: energiaMaxResult,
    hambre,
    sed,
    finDePartida,
    pendingDeathResolution,
    justDied,
    newInventoryItems,
    removedInventoryItemIds,
    updatedInventoryItems,
    logEntryId,
    newQuestObjetivos,
    newQuestInfo,
    newQuestOfferInfo,
    npcInteractionOffer,
    questCompletedInfo,
    factionRepChange,
    professionXpGains,
    newKingdomFounded,
    companionCreated,
    partiallyLootedSlugs,
    deathCount: finalDeathCountResult,
    discoveredLocationSlug,
  } = transactionResult;
  // La transacción hizo commit de verdad — ahora sí se dispara la generación lenta de fondo (ver
  // el comentario de `chapterDue` más arriba).
  if (chapterDue) {
    void scheduleChapterSummaryGeneration(saveId, characterName, nuevoFictionalMinutes);
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
  // Saqueo/desuello de CombatEncounter (2026-08-25) — hecho de sesión determinista, mismo criterio
  // que la Pieza A de la Capa 3 (mundo-determinista.md): sin nombrar aquí a cada caído,
  // `detectNpcsInScene` (con `action: ''` en el GET de Desollar) nunca los volvería a encontrar
  // tras cerrarse este turno, aunque su `NpcState` ya diga MUERTO/`groupDefeated` > 0.
  if (combatEncounterLootSummary.length > 0) {
    await appendSessionFacts(
      saveId,
      sessionFacts,
      combatEncounterLootSummary.map((c) => `${c.name} ${c.cantidad > 1 ? `(${c.cantidad} caídos)` : 'cae derrotado'} tras el combate.`),
    );
  }

  // Franja 3 de "Interactuar" — preámbulo de fauna agresiva por colisión de celda (2026-09-08,
  // diseño confirmado con la usuaria: "estilo Mount & Blade", "todo agresivo, incluido el ataque
  // explícito, exige colisión de celda real"). Solo afecta al camino 1v1 clásico
  // (`resolveCombatSlugsAndPersist` más abajo) — el combate múltiple (`combatEncounterMode`) ya se
  // decidió en otro punto (caza en grupo, cazar.ts) y no pasa por aquí.
  //
  // Un agresivo/enemigo detectado por TEXTO ya no basta por sí solo para forzar combate: hace falta
  // además que su `ZonePoint` real esté en la MISMA celda que el jugador ahora mismo
  // (`zonaPosX/Y`, sistema de movimiento por cuadrícula) — si está lejos, se excluye de
  // `npcsInSceneVivos` ANTES de que `agresivoSlugsInScene`/`shouldForceCombat` lo vean, así que ni
  // siquiera un "ataco a X" explícito lo alcanza (mismo criterio de coherencia: no puedes atacar a
  // algo que no está físicamente donde tú estás).
  //
  // Dos excepciones deliberadas, ninguna un parche — casos donde "colisión de celda" no aplica por
  // diseño, no por hueco:
  // 1. Sin posición conocida del jugador (`params.zonaPosX/Y` null, partida previa a esa pieza) —
  //    fallback seguro: comportamiento actual sin cambios, nunca se activa el filtro por ausencia
  //    de dato (mismo criterio que el resto del proyecto con campos nullable de esa pieza).
  // 2. El candidato de INTERRUPCIÓN DE VIAJE (`travelInterruptionNpcId`) — el viaje ocurre ENTRE
  //    Locations, fuera del sistema de cuadrícula por naturaleza (la usuaria: "el viaje no implica
  //    ninguna zona, así que sería el único punto donde no haría falta el ZonePoint") — sigue
  //    forzando combate real exactamente como antes (ver Franja 1b), sin exigir colisión.
  let npcsInSceneVivosParaCombate = npcsInSceneVivos;
  if (params.zonaPosX != null && params.zonaPosY != null && regionLocationId) {
    const celdaJugador = celdaDePixel({ x: params.zonaPosX, y: params.zonaPosY });
    const agresivosATestear = npcsInSceneVivos.filter((n) => {
      if (n.id === travelInterruptionNpcId) return false; // excepción 2 — nunca se filtra
      const t = effectiveTemperamento(n.temperamento, n.faction, factionsStatus);
      return t === 'AGRESIVO' || t === 'ENEMIGO';
    });
    if (agresivosATestear.length > 0) {
      const zonePointsAgresivos = await prisma.zonePoint.findMany({
        where: { saveId, locationId: regionLocationId, targetSlug: { in: agresivosATestear.map((n) => n.slug) }, tipo: { in: ['FAUNA', 'NPC'] }, activo: true },
        select: { targetSlug: true, x: true, y: true },
      });
      const zonePointsPorSlug = new Map<string, { x: number; y: number }[]>();
      for (const zp of zonePointsAgresivos) {
        if (!zonePointsPorSlug.has(zp.targetSlug)) zonePointsPorSlug.set(zp.targetSlug, []);
        zonePointsPorSlug.get(zp.targetSlug)!.push({ x: zp.x, y: zp.y });
      }
      // Sin ZonePoint real (mencionado solo narrativamente, o dinámico sin posición de catálogo) —
      // decisión explícita de la usuaria: "sin ZonePoint real, nunca fuerza combate" (tratarlo como
      // si estuviera lejos, no un fallback permisivo).
      const agresivosSinColision = new Set(
        agresivosATestear
          .filter((n) => {
            const puntos = zonePointsPorSlug.get(n.slug);
            if (!puntos || puntos.length === 0) return true;
            return !puntos.some((p) => mismaCelda(celdaDePixel(p), celdaJugador));
          })
          .map((n) => n.id),
      );
      if (agresivosSinColision.size > 0) {
        npcsInSceneVivosParaCombate = npcsInSceneVivos.filter((n) => !agresivosSinColision.has(n.id));
      }
    }
  }

  // Grupo 3 § Mundo determinista, Capa 4 (2026-08-25) — un `CombatEncounter` real es un canal de
  // combate aparte del 1v1 clásico (`resolveCombatSlugsAndPersist` de abajo, que solo sabe de
  // `NpcState`/`npcsInScene`) — se construye su propio `combateIniciado` a partir de los
  // participantes YA REALES del encuentro, y se persiste `pendingCombatNpcSlugs` a mano para que
  // el frontend (que hoy solo sabe leer ese campo, no `CombatParticipant`) siga mostrando el panel
  // de combate mientras el encuentro sigue EN_CURSO. `saqueado`/`lootedItemNames`/`analizado`
  // quedan en su valor por defecto — mientras el encuentro sigue EN_CURSO nadie ha podido saquear
  // nada todavía (petición explícita: solo se puede saquear/desollar al RESOLVERSE del todo, ver
  // `combatEncounterLootSummary` arriba). Este display es solo para el popup DURANTE el combate.
  const combateIniciado = combatEncounterMode
    ? await (async () => {
        const participantesFinal = await prisma.combatParticipant.findMany({ where: { encounterId: combatEncounterId! } });
        const enemigoNpcIds = participantesFinal.filter((p) => p.tipo === 'NPC' && p.npcId).map((p) => p.npcId!);
        const enemigoNpcRows = enemigoNpcIds.length
          ? await prisma.npc.findMany({ where: { id: { in: enemigoNpcIds } }, select: { id: true, slug: true, name: true, kind: true, atributoResistencia: true } })
          : [];
        const npcRowById = new Map(enemigoNpcRows.map((n) => [n.id, n]));
        // Bug real de display (2026-08-25, hallado al cerrar saqueo/desuello): un participante
        // SOLITARIO siempre tiene `condicionFisicaGrupo: null` (ver comentario del campo en
        // schema.prisma — solo lo usan los miembros de grupo) así que `?? 'ILESO'` lo mostraba
        // "ileso" en el popup aunque ya estuviera MUERTO de verdad en su `NpcState` real.
        const soloNpcIds = participantesFinal.filter((p) => p.tipo === 'NPC' && p.npcId && p.condicionFisicaGrupo === null).map((p) => p.npcId!);
        const soloStates = soloNpcIds.length
          ? await prisma.npcState.findMany({
              where: { saveId, npcId: { in: soloNpcIds } },
              select: { npcId: true, scope: true, condicionFisica: true, analizado: true },
            })
          : [];
        const soloCondicionByNpcId = new Map(soloStates.map((s) => [s.npcId, s.condicionFisica]));
        // "Analizar Rival" real en combate múltiple (2026-08-27) — mismo criterio que
        // `soloCondicionByNpcId`: solitario lee de `NpcState.analizado`, miembro de grupo lee de su
        // propio `CombatParticipant.analizadoGrupo` (ver comentario de la columna en schema.prisma).
        const soloAnalizadoByNpcId = new Map(soloStates.map((s) => [s.npcId, s.analizado]));
        const enemigosParaDisplay = participantesFinal.filter((p) => p.tipo === 'NPC' && p.npcId && npcRowById.has(p.npcId));
        // Identificador de combatientes duplicados (2026-08-27, bug real jugando: "ataqué a los dos
        // buitres a la vez" — no podía dirigir el golpe al segundo, `slug` no distingue individuos
        // de un mismo Npc de catálogo). Misma función pura que usa el matching por texto de arriba
        // (`esperandoEleccionJugadora`), para que el número que ve la jugadora sea siempre el mismo
        // que el backend interpreta al citarlo — null para un enemigo solitario (ver comentario de
        // `NpcInSceneInfo.instanceNumber`, types.ts, frontend).
        const instanceNumberByParticipantIdDisplay = instanceNumbersByParticipantId(
          enemigosParaDisplay.map((p) => ({ participantId: p.id, npcId: p.npcId! })),
        );
        const npcs = enemigosParaDisplay.map((p) => {
          const npcRow = npcRowById.get(p.npcId!)!;
          const numeroInstancia = instanceNumberByParticipantIdDisplay.get(p.id) ?? null;
          return {
            slug: npcRow.slug,
            name: npcRow.name,
            condicionFisica: p.condicionFisicaGrupo ?? soloCondicionByNpcId.get(p.npcId!) ?? 'ILESO',
            saqueado: false,
            lootedItemNames: [] as string[],
            analizado: p.condicionFisicaGrupo !== null ? (p.analizadoGrupo ?? false) : (soloAnalizadoByNpcId.get(p.npcId!) ?? false),
            capturable: npcRow.atributoResistencia !== null,
            // `combateMultipleOrquestacion.ts` no lee/aplica `activeEffects` todavía (Fase 2,
            // 2026-08-26, deferred a propósito — ver docs/producto/21-roadmap.md § Fase 2) — `[]` real,
            // no un hueco de este display en concreto.
            activeEffects: [] as ActiveEffect[],
            participantId: p.id,
            instanceNumber: numeroInstancia,
          };
        });
        if (!combatEncounterTerminado) {
          await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: npcs.map((n) => n.slug) } });
        } else {
          await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [] } });
        }
        return { npcs };
      })()
    : (await resolveCombatSlugsAndPersist({
        saveId,
        action,
        enCombate,
        narration,
        npcsInScene,
        npcsInSceneVivos: npcsInSceneVivosParaCombate,
        factionsStatus,
        condicionFisicaJugador: params.condicionFisica,
        explicitTarget,
        exchangeHappened,
        npcAttackTarget,
        npcAttackHits,
        npcTargetNewCondicion,
        partiallyLootedSlugs,
        analizarRivalExito,
        npcActiveEffectsNext,
        // Bug real jugando en vivo (ronda de pruebas 2026-08-28): morir y respawnear (sobrevivible,
        // sin finDePartida) no limpiaba `pendingCombatNpcSlugs` — el enemigo seguía "enganchado" al
        // jugador aunque este ya no estuviera físicamente donde murió (respawnea en su campamento).
        // Causa: este bloque corre DESPUÉS del cálculo de muerte/respawn (proposedCondicion ===
        // 'MUERTO', más arriba) pero antes no sabía nada de ello — recalculaba `combatSlugs` con el
        // NPC agresor de siempre y sobrescribía cualquier limpieza. `justDied` fuerza el combate a
        // cerrarse del todo en el turno exacto de la muerte sobrevivible.
        justDied: proposedCondicion === 'MUERTO',
        regionActual: regionLocation?.region ?? null,
        attackerRollGradoExito: roll?.gradoExito ?? null,
        attackTarget: candidateAttackTarget,
      })).combateIniciado;

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
  // `npcAttackTarget?.name` añadido de forma determinista (bug real jugando en vivo, 2026-09-03):
  // el motor ya sabe con certeza contra quién se luchó este turno, pero antes el desbloqueo
  // dependía por completo de que el LLM mencionara el nombre por casualidad en su narración — un
  // ataque narrado de forma genérica ("la bestia esquiva y retrocede gruñendo") nunca desbloqueaba
  // nada aunque el objetivo real fuera conocido.
  //
  // 3 fases (2026-09-08, rediseño explícito de Álvaro) — CAMBIA la filosofía original de arriba:
  // ahora sí se pasa `npcsInScene` completo como señal de presencia REAL (`npcSlugsInScene`), no
  // solo el objetivo de ataque. Una mención textual (`mentionedText`) sigue siendo lo único que
  // decide SI algo se descubre en absoluto (como mucho CITADO); estar de verdad en `npcsInScene`
  // este turno es lo que decide si esa detección sube a DESCUBIERTO (ficha completa con imagen) en
  // vez de quedarse en CITADO (nombre+región nada más) — ver `recordEntityDiscoveries`.
  await recordEntityDiscoveries({
    saveId,
    worldId,
    mentionedText: [narration.narration, ...narration.newFacts, ...newQuestObjetivos, npcAttackTarget?.name ?? ''].join('\n'),
    npcSlugsInScene: npcsInScene.map((n) => n.slug),
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
    prisma.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) } }),
    // deathCount/factionsStatus/professionProgress (auditoría 2026-08-06, bug real): las tres se
    // mutan dentro de la transacción de este mismo turno (combate/decapitar/crafteo) pero nunca
    // viajaban de vuelta al frontend — GameView.tsx solo las actualizaba en `syncFromSave`, así que
    // el jugador veía el contador de muertes, la pestaña Reputación o Profesiones desactualizados
    // hasta recargar del todo. Mismo criterio que quests/territories: se releen ya fuera de la
    // transacción (que a estas alturas ya hizo commit), nunca se rastrea el delta a mano.
    prisma.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true, fictionalDateLabel: true, fictionalMinutes: true } }),
    prisma.professionProgress.findMany({ where: { saveId } }),
  ]);
  const freshFactionsStatus = parseFactionsStatus(freshWorldState?.factionsStatus);

  // "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — decidido AQUÍ, tras conocer
  // ya el desenlace real del turno (`combateIniciado`): nunca se ofrece si este turno terminó en
  // combate, ni si ya hay un modo dinámico en curso (evita pisar uno a medias). Solo decide EL
  // CANDIDATO — la narración de la primera vuelta ocurre en el endpoint dedicado
  // (POST /saves/:id/modo-dinamico/interactuar), no aquí, para no gastar Ollama en ofertas que el
  // jugador nunca acepta.
  //
  // Bug real jugando en vivo (2026-08-27): sin este guard, un turno donde Gistera Koh ofrecía su
  // misión determinista (`newQuestOfferInfo`, más arriba) también podía calcular un
  // `dynamicModeOffer` si había algún ZonePoint candidato en la misma Location — ambas ofertas
  // llegaban al mismo LogEntry (ver useTurnFlow.ts) y competían por la atención de la jugadora en
  // el momento narrativamente más inoportuno. La oferta de misión es siempre prioritaria: nunca se
  // calcula el modo dinámico en el mismo turno que ya ofrece una misión.
  //
  // Bug real jugando en vivo (2026-08-29/30): el guard de arriba solo cubre el turno EXACTO en que
  // `newQuestOfferInfo` se calcula — pero `detectsVerbalAcceptanceIntent` (línea ~5379) exige una
  // frase de aceptación explícita ("acepto", "cuenta conmigo"...) en ese mismo turno; una frase de
  // acorralamiento en combate como "No te escaparás tan fácilmente" no matchea, así que
  // `newQuestOfferInfo` queda `null` ESE turno aunque el arco de Gistera/Orco siga sin resolver. Si
  // además ese turno no generó un intercambio de combate nuevo, `combateIniciado` también cae a
  // `null` — con los dos guards en falso, el modo dinámico quedaba libre para ofrecer "Interactuar"
  // sobre cualquier ZonePoint de la escena, justo en medio de un arco narrativo scriptado sin
  // cerrar. `gisteraEnEscena && !gisteraSeHaMarchado` (calculadas más arriba, línea ~3595) cubren
  // TODOS los turnos del arco completo, no solo el turno puntual de aceptación — mientras Gistera
  // siga presente y no se haya marchado (su quest resuelta o su aceptación verbal detectada), el
  // modo dinámico se queda callado.
  // Retomar viaje truncado por un evento de interrupción (ronda de correcciones 2026-08-28, P3.2 —
  // hallazgo real: "el viaje se trunca sin recordar el destino, el jugador queda varado"). Se
  // dispara SOLO cuando este turno resolvió el evento sin dejar combate activo y el jugador sigue
  // vivo — mismo criterio de "resuelto con éxito" que el resto del motor usa para decidir si algo
  // se cierra limpio. `regionLocationId` ya es la ubicación real donde el jugador quedó tras este
  // turno (destino de `travel` si hubo, si no `currentLocationId` — ver su declaración arriba).
  let travelResumed: { toLocationName: string; duracionMinutosResumen: number } | null = null;
  if (!combateIniciado && !finDePartida && !justDied && regionLocationId) {
    const saveTravelResumeState = await prisma.save.findUnique({
      where: { id: saveId },
      select: { pendingTravelResumeDestinationId: true },
    });
    const resumeDestinationId = saveTravelResumeState?.pendingTravelResumeDestinationId ?? null;
    if (resumeDestinationId && resumeDestinationId !== regionLocationId) {
      const resumedTravel = await resolveTravelToLocationId(worldId, regionLocationId, resumeDestinationId, attributes);
      if (resumedTravel) {
        // Mismo criterio de espera-por-tramos que turn.ts (ver comentario en travel.ts,
        // segundosRealesPorTramos) — este es también un viaje real, no una acción estacionaria.
        const minutosReales =
          segundosRealesPorTramos(resumedTravel.segments.length, {
            segundosPrimerTramo: env.travelSegundosPrimerTramo,
            segundosPorTramoExtra: env.travelSegundosPorTramoExtra,
            segundosMaximos: env.travelSegundosMaximos,
          }) / 60;
        const busyUntil = new Date(Date.now() + minutosReales * 60_000);
        const resumeText = `Con esto resuelto, ${characterName} retoma el camino hacia ${resumedTravel.toLocationName}.`;
        // Mismo `classification` sintético sin tirada que turn.ts construye para cualquier viaje
        // ya conocido por el grafo (ver `if (travel) { classification = {...} }`, turn.ts) — bug
        // real encontrado al testear: sin esto, `resolveClaimedTransit` (worldTick.ts) desestructura
        // `classification` como `undefined` del `zoneContext`, y `classification.requiereTirada`
        // revienta con un TypeError silencioso (capturado por su propio catch), dejando el
        // tránsito sin resolver nunca — el jugador se queda varado en el punto intermedio para
        // siempre en vez de llegar al destino original.
        const resumedClassification = {
          requiereTirada: false,
          atributo: 'destreza' as const,
          dificultad: 8,
          razon: `Viaje conocido por el camino hacia ${resumedTravel.toLocationName} — no requiere tirada.`,
          banda: resumedTravel.banda,
          duracionEstimadaMinutos: resumedTravel.minutos,
        };
        const resumedZoneContext = {
          action: `Viajar a ${resumedTravel.toLocationName}`,
          classification: resumedClassification,
          travel: resumedTravel,
          duracionMinutos: resumedTravel.minutos,
        } as object;
        const resumedTransitId = await prisma.$transaction(async (tx) => {
          await tx.logEntry.create({
            data: { saveId, channel: 'CHARACTER', text: resumeText, timeLabel: freshWorldState?.fictionalDateLabel ?? timeLabel },
          });
          const resumedTransit = await tx.characterTransit.upsert({
            where: { saveId },
            create: { saveId, activity: `Viajar a ${resumedTravel.toLocationName}`, busyUntil, zoneContext: resumedZoneContext },
            update: { activity: `Viajar a ${resumedTravel.toLocationName}`, busyUntil, zoneContext: resumedZoneContext },
          });
          await tx.save.update({ where: { id: saveId }, data: { pendingTravelResumeDestinationId: null } });
          return resumedTransit.id;
        });
        void startEagerTransitResolution(resumedTransitId, busyUntil).catch((err) =>
          console.error(`[turno] error retomando el tránsito truncado de la partida ${saveId}:`, err),
        );
        travelResumed = { toLocationName: resumedTravel.toLocationName, duracionMinutosResumen: resumedTravel.minutos };
      } else {
        // Destino truncado ya no alcanzable (grafo cambió, o el jugador ya está ahí por otra vía)
        // — se limpia igualmente para no reintentar cada turno con el mismo resultado.
        await prisma.save.update({ where: { id: saveId }, data: { pendingTravelResumeDestinationId: null } });
      }
    }
  }

  let dynamicModeOffer: { tipo: 'NPC' | 'FAUNA' | 'RECURSO'; targetSlug: string; targetName: string } | null = null;
  // Franja 1b (2026-09-08) — si este mismo turno ya ofreció Interactuar por interrupción de viaje
  // (más arriba, `interruptionCandidateForOffer`), no evaluar TAMBIÉN la oferta ambiental: pisaría
  // `pendingDynamicModeOffer` recién escrito con un candidato distinto sin que el jugador llegara a
  // ver la oferta original. El guard de `pendingDynamicMode` de abajo no basta por sí solo porque
  // la interrupción escribe `pendingDynamicModeOffer` (oferta sin aceptar), no `pendingDynamicMode`
  // (conversación ya en curso) — son dos campos distintos, ver dynamicMode.ts.
  if (!combateIniciado && !newQuestOfferInfo && !(gisteraEnEscena && !gisteraSeHaMarchado) && regionLocationId && !interruptionCandidateForOffer) {
    const saveDynamicState = await prisma.save.findUnique({
      where: { id: saveId },
      select: { pendingDynamicMode: true, lastDynamicModeOfferAtMinutes: true },
    });
    const fictionalMinutesActuales = freshWorldState?.fictionalMinutes ?? 0;
    const enCooldown =
      saveDynamicState?.lastDynamicModeOfferAtMinutes != null &&
      fictionalMinutesActuales - saveDynamicState.lastDynamicModeOfferAtMinutes < COOLDOWN_MODO_DINAMICO_MINUTOS;
    if (!saveDynamicState?.pendingDynamicMode && !enCooldown) {
      // RECURSO incluido (2026-09-08, "Ver qué hay en la zona") — a diferencia de NPC/FAUNA, un
      // candidato RECURSO nunca abre conversación de vueltas (ver comentario de `DynamicModeTipo`,
      // dynamicMode.ts): la propia oferta ya trae el botón de acción, resuelto por su propia ruta
      // (`dynamicModeRecurso.ts`).
      const zonePointsRaw = await prisma.zonePoint.findMany({
        where: { saveId, locationId: regionLocationId, tipo: { in: ['NPC', 'FAUNA', 'RECURSO'] } },
        select: { tipo: true, targetSlug: true, cantidad: true },
      });
      // Ver `ZonePointCandidateRow.temperamento` (dynamicMode.ts) — bug real, investigación
      // 2026-09-05 a raíz de "Kirelon sobrerrepresentado": el problema nunca fue un peso de
      // aparición mal calibrado, es que NINGÚN candidato se filtraba por temperamento, así que
      // cualquier fauna/NPC AGRESIVO (7 fichas reales ya sembradas: cruzavientos/ferike/
      // kirelon-arenoso/lebude/miruina/rondador-de-brasas/towrgu) se ofrecía igual que uno
      // CAUTELOSO/INOFENSIVO. `effectiveTemperamento` (mismo cálculo que usa el resto del motor
      // para decidir si un NPC fuerza combate) por si la reputación de facción lo desplaza — en la
      // práctica casi toda la fauna no tiene `faction`, así que se queda en el valor de catálogo.
      // RECURSO no tiene fila `Npc` que resolver — nunca entra en `npcsParaOferta`, se queda con
      // `temperamento: null` (inerte, nunca AGRESIVO, nunca descartado por ese filtro).
      const npcsParaOferta = await prisma.npc.findMany({
        where: { worldId, slug: { in: zonePointsRaw.filter((p) => p.tipo !== 'RECURSO').map((p) => p.targetSlug) } },
        select: { slug: true, temperamento: true, faction: true },
      });
      const temperamentoPorSlug = new Map(
        npcsParaOferta.map((n) => [n.slug, effectiveTemperamento(n.temperamento, n.faction, freshFactionsStatus)]),
      );
      const zonePointsParaOferta = zonePointsRaw.map((p) => ({ ...p, temperamento: temperamentoPorSlug.get(p.targetSlug) ?? null }));
      const candidato = decideOfertaModoDinamico(zonePointsParaOferta);
      if (candidato) {
        const targetName = await dynamicModeCandidateNameFor(prisma, candidato);
        dynamicModeOffer = { tipo: candidato.tipo, targetSlug: candidato.targetSlug, targetName };
        // Bug real 2026-08-28 ("oferta de modo dinámico no sobrevive a una recarga") — persistir la
        // oferta en `Save.pendingDynamicModeOffer` para que `GET /saves/:id` pueda reconstruirla
        // tras F5, igual que `pendingDynamicMode` ya hace con la conversación EN CURSO.
        await prisma.save.update({
          where: { id: saveId },
          data: { lastDynamicModeOfferAtMinutes: fictionalMinutesActuales, pendingDynamicModeOffer: dynamicModeOffer },
        });
      }
    }
  }
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
    activeEffects,
    energia,
    energiaMax: energiaMaxResult,
    hambre,
    sed,
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
    entorno: entornoTemporalFor(freshWorldState?.fictionalMinutes ?? nuevoFictionalMinutes, activeRegion, raza),
    combateIniciado,
    finDePartida,
    pendingDeathResolution,
    justDied,
    newInventoryItems,
    removedInventoryItemIds,
    updatedInventoryItems,
    logEntryId,
    quests,
    newQuestInfo,
    newQuestOfferInfo,
    npcInteractionOffer,
    dynamicModeOffer,
    travelResumed,
    questCompletedInfo,
    factionRepChange,
    professionXpGains,
    newKingdomFounded,
    companionCreated,
    esperandoDefensaJugador: !!nuevoPendingNpcAttack,
    npcAbilityUsed,
    combatExchangeDisplay: combatExchangeDisplayFinal,
    playerAbilityUsed,
    nextInitiativeRoll,
    territories,
    buildings,
    subjects,
    kingdomStats,
    deathCount: finalDeathCountResult,
    factionsStatus: freshFactionsStatus,
    professionProgress,
    combatEncounterLootSummary: combatEncounterLootSummary.length > 0 ? combatEncounterLootSummary : null,
    discoveredLocationSlug,
  };
}
