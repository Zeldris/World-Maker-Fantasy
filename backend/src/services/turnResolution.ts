import { narrateAction, generateNpcReply, type ClassificationResult, type NarrationResult } from './narrador.js';
import { retrieveLore, formatLoreForPrompt, isWeaklyGrounded } from './retrieval.js';
import { xpForRollSuccess, xpForHitos, applyXp, type ProgressionResult, type HitoTipo } from './progression.js';
import { alivioForLevel, xpForCraftSuccess, applyProfessionXp } from './professionProgress.js';
import { tickKingdom, daysCrossed, DEFAULT_KINGDOM_STATS } from './kingdomTick.js';
import { mergeFacts } from './worldFacts.js';
import {
  detectNpcsInScene,
  npcSceneBlockFor,
  contraataqueDifficultyFor,
  detectsAttackIntent,
  detectsHostileSearchIntent,
  detectsDialogueIntent,
  detectsVerbalAcceptanceIntent,
  scopeFor,
  pickAmbientEncounterCandidate,
} from './npcScene.js';
import { detectHarvest, harvestBlockFor } from './harvest.js';
import { detectItemReference, missingItemBlockFor } from './itemReference.js';
import {
  CRAFTING_RECIPES,
  detectsCraftIntent,
  canCraft,
  craftRequisitoShortfalls,
  planCraftConsumption,
} from './crafting.js';
import { detectsBuildIntent, checkRecipe, planConsumption, baseNameOf, CONSTRUCTION_RECIPES, type ConstructionRecipe, type RecipeCheck } from './construction.js';
import { shortfallLabel } from './requisitos.js';
import { classAbilityUnlocksFor } from './classAbilities.js';
import { protectedFactsFor } from './protectedFacts.js';
import { lintRegionMismatch } from './narrationLint.js';
import { destinationsFrom, normalizeText, levenshtein, initialLocationSlugFor, matchDestination, type TravelResolution } from './travel.js';
import { detectsRestIntent, type Produccion } from './timedActions.js';
import { claimChapterIfDue, scheduleChapterSummaryGeneration } from './chapterSummary.js';
import { recordEntityDiscoveries } from './entityDiscovery.js';
import {
  nextCondicionFisica,
  resolveDeathOutcome,
  whisperText,
  isValidRestLocationKind,
  isCondicionDowngrade,
  oneStepWorseThan,
  nextCondicionForAttack,
  worseCondicion,
  saludForCondicion,
  saludBandFor,
} from './death.js';
import { continentForRegion, oppositeContinent } from '../lib/continent.js';
import { advanceFictionalMinutes, formatFictionalDate } from './worldClock.js';
import { prisma } from '../lib/prisma.js';
import { rollCheck } from './dice.js';
import type { RollResult, AttributeBlock } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';
import type { Prisma, CondicionFisica, Dificultad, AbilityEffect } from '@prisma/client';

const REINO_XP = { territory: 150, buildingActive: 100, firstSubject: 100, subject: 25 } as const;

const LOOT_INTENT_REGEX = /registr|saque|desped|coj|robo|compr|qued/;

// Auditoría de typo-tolerance (roadmap 2026-07-19, P0.4 de Fable): mismo patrón que
// matchNpcAliases/detectsAttackIntent — solo los stems literales de 5+ letras entran en la
// tolerancia a erratas; "coj"/"robo"/"qued" (≤4 letras) se quedan solo con el regex exacto.
const LOOT_INTENT_STEMS = ['registr', 'saque', 'desped', 'compr'];

export function detectsLootIntent(action: string): boolean {
  const normalized = normalizeText(action);
  if (LOOT_INTENT_REGEX.test(normalized)) return true;
  const words = normalized.split(/\s+/).filter((w) => w.length >= 5);
  return LOOT_INTENT_STEMS.some((stem) => words.some((w) => levenshtein(w, stem) <= 2));
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
  timeLabel: string;
  sessionFacts: string[];
  currentXp: number;
  currentLevel: number;
  classification: ClassificationResult;
  roll?: RollResult;
  attributes: AttributeBlock;
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
  /// Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2): id de la
  /// SavedAction pulsada en CombatModal.tsx, si la hay. Cuando resuelve a una con `effect` no
  /// nulo, ese efecto GANA sobre los regex de npcScene.ts (detectsAttackIntent) para decidir si
  /// el turno cuenta como golpe sobre el NPC, si un REMATE lo remata de verdad, y si el NPC
  /// contraataca este turno — los regex se quedan intactos solo para cuando el jugador escribe
  /// la acción a mano, sin pulsar ningún botón de habilidad.
  savedActionId?: string;
}

export interface NewInventoryItemInfo {
  id: string;
  name: string;
  description: string;
  origin: string | null;
  slot: null;
  statBonusAttribute: string | null;
  statBonusAmount: number | null;
}

export interface NarrateAndPersistResult {
  narration: NarrationResult;
  progression: ProgressionResult;
  condicionFisica: CondicionFisica;
  /// Enriquecido con nombres y estado real (el modelo solo propone slugs, § 2.5) para que el
  /// frontend pueda mostrar el popup de combate ya sincronizado con `NpcState`, sin una consulta
  /// adicional ni asumir que todo NPC arranca ILESO/sin saquear.
  combateIniciado?: { npcs: { slug: string; name: string; condicionFisica: CondicionFisica; saqueado: boolean }[] } | null;
  finDePartida: boolean;
  /// Roadmap 2026-07-19 (bug real de UI encontrado en auditoría de frontend): loot/despiece/
  /// producción se materializaban de verdad en la DB, pero `/turn/narrate` nunca devolvía esos
  /// objetos — el inventario en pantalla se quedaba desactualizado hasta recargar la partida.
  /// Ahora el frontend puede añadirlos directamente al estado local sin otra consulta.
  newInventoryItems: NewInventoryItemInfo[];
  /// Id real de la fila LogEntry de esta narración (rework 2026-07-24, persistencia de banners de
  /// entidad) — el frontend ya no usa un id inventado (`c-${Date.now()}`) para la entrada que
  /// acaba de crear, así que puede pedir luego "guarda esta imagen en esta entrada de verdad".
  logEntryId: string;
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
    currentLocationId,
    travel,
    minutosDeEsteTurno,
    fictionalMinutesActuales,
    produccion,
    enCombate,
    onNarrationChunk,
    onNarrationReset,
    savedActionId,
  } = params;

  // Revisión técnica 2026-07-22: estas 4 consultas no dependen entre sí (retrieveLore es la única
  // que depende de una de ellas, ver más abajo) — antes iban en `await` secuencial, una detrás de
  // otra, cada una su propio viaje de ida y vuelta a Postgres. Agrupadas en Promise.all para pagar
  // solo la más lenta de las 4, no la suma de las 4. Ahorro real pero modesto (decenas-cientos de
  // ms) frente a los 30-220s que domina la generación del modelo — vale la pena por ser gratis y
  // sin riesgo, no porque vaya a notarse en la duración total del turno.
  const regionLocationId = travel ? travel.toLocationId : currentLocationId;
  const [abilityEffect, regionLocation, npcsInScene, harvestMatch, faunaSources] = await Promise.all([
    // Efecto de la habilidad de clase pulsada (checklist 2026-07-21/22, puntos 1-2) — null si el
    // jugador escribió la acción a mano (sin savedActionId) o si esa SavedAction no tiene efecto
    // asignado (habilidades generales, o partidas en curso creadas antes de esta migración).
    savedActionId
      ? prisma.savedAction.findUnique({ where: { id: savedActionId }, select: { effect: true } }).then((r) => (r?.effect ?? null) as AbilityEffect | null)
      : Promise.resolve<AbilityEffect | null>(null),
    regionLocationId ? prisma.location.findUnique({ where: { id: regionLocationId }, select: { region: true, name: true } }) : Promise.resolve(null),
    detectNpcsInScene({ action, worldId, sessionFacts, saveId, currentLocationId }),
    travel ? Promise.resolve(null) : detectHarvest({ action, worldId, saveId, currentLocationId }),
    // Distingue fauna (animales, sin habla) de NPCs de verdad dentro de `npcsInScene` — ambos
    // comparten la misma tabla Npc/detección por alias (ver comentario del bloque de diálogo más
    // abajo, bug real 2026-07-23).
    prisma.harvestYield.findMany({ where: { worldId }, select: { sourceSlug: true } }),
  ]);
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
  const retrieved = await retrieveLore(regionLabel ? `${action} — ${regionLabel}` : action, worldId, 4, excludeTags);
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
  // Habilidades de clase con efecto (checklist 2026-07-21/22, puntos 1-2): AGUANTE es puramente
  // defensivo — nunca cuenta como golpe sobre el NPC, gane o pierda la tirada. El resto de
  // efectos de combate (ATAQUE/ATURDIMIENTO/REMATE/INTIMIDACION) cuentan como golpe por sí
  // solos, sin depender de que detectsAttackIntent reconozca el verbo exacto del promptText
  // (mismo problema ya visto con matchNpcAliases: un regex de palabras no puede cubrir toda la
  // prosa posible de 9 habilidades distintas) — el regex se queda como red de seguridad para
  // cuando el jugador ataca escribiendo la acción a mano, sin pulsar ningún botón.
  const countsAsAttack = abilityEffect === 'AGUANTE' ? false : detectsAttackIntent(action) || !!abilityEffect;
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
  const npcAttackTarget =
    enCombate && !lootMode && npcsInScene.length > 0 && countsAsAttack ? (explicitTarget ?? npcsInScene[0]) : null;
  const npcAttackHits = !!npcAttackTarget && !!roll && roll.success;
  const npcTargetNewCondicion = npcAttackTarget ? nextCondicionForAttack(abilityEffect, npcAttackTarget.condicionFisica) : null;

  // Bloque de posición (docs/12 § 1.5): en un turno de viaje, la narración recibe la llegada al
  // destino + la ruta recorrida; en cualquier otro turno, recibe siempre dónde está y hacia
  // dónde puede ir — reduce los casos "weaklyGrounded" al dar siempre algo concreto que describir.
  const contextBlocks: string[] = [];

  // Sugerencia ambiental de encuentro (checklist 2026-07-21/22, punto 3 — "más NPCs/fauna
  // itinerante para encuentros casuales más frecuentes"): sin esto, el modelo nunca tenía ningún
  // empujón hacia el roster real de itinerantes del catálogo durante viaje/exploración — dependía
  // por completo de que el JUGADOR mencionara un nombre primero (detectNpcsInScene solo detecta,
  // nunca sugiere). No relaja la regla de "el combate solo se dispara contra un NPC/fauna real del
  // catálogo" (petición explícita de la usuaria): al contrario, empuja al modelo a usar un nombre
  // real y reconocible en vez de inventar una amenaza anónima. Solo cuando no hay ya nadie en
  // escena, fuera de combate/saqueo/cosecha, con contexto real de ubicación — 25% de probabilidad
  // (mismo orden que el evento de ambientación de entorno.ts) y siempre opcional para el modelo.
  if (npcsInScene.length === 0 && !enCombate && !lootMode && !harvestMatch && (travel || currentLocationId) && Math.random() < 0.25) {
    const itinerantCandidates = await prisma.npc.findMany({
      where: { worldId, kind: 'PLANTILLA', homeLocationSlug: null },
      select: { slug: true, name: true, role: true },
    });
    const candidate = pickAmbientEncounterCandidate(itinerantCandidates);
    if (candidate) {
      contextBlocks.push(
        `SUGERENCIA OPCIONAL DE ENCUENTRO (úsala solo si encaja de forma natural con la escena, ignórala si no): el personaje podría cruzarse aquí con ${candidate.name} (${candidate.role}). Si decides introducirlo, usa ese nombre exacto para que el motor lo reconozca de verdad.`,
      );
    }
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
    contextBlocks.push(
      `LLEGADA A ${travel.toLocationName}: ${destination?.description ?? ''}\nRUTA RECORRIDA: ${ruta}`,
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
    }
  }

  for (const npc of npcsInScene) {
    contextBlocks.push(npcSceneBlockFor(npc, params.currentLevel));
  }

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

  // Contraataque determinista del NPC en combate (roadmap 2026-07-19): hasta ahora el "enemigo"
  // nunca tenía turno propio — solo lo que el modelo decidiera narrar. Se resuelve ANTES de narrar
  // (mismo patrón que la tirada del jugador, nunca lo decide el modelo): tirada de destreza del
  // propio jugador contra la dificultad ya calibrada por diferencia de nivel — éxito = esquiva/
  // bloquea, fallo = el golpe llega. Solo dentro del popup de combate (§ 2.3); fuera de combate
  // esto no aplica.
  let npcCounterFailed = false;
  // ATURDIMIENTO/INTIMIDACION con éxito (checklist 2026-07-21/22, puntos 1-2): el NPC no
  // contraataca este turno — sin tirada, sin bloque de "te alcanza", directamente fuera de
  // combate para él. Solo aplica cuando la propia habilidad SÍ conectó (npcAttackHits), no por
  // el mero hecho de intentarla.
  const stunOrIntimidateLanded = npcAttackHits && (abilityEffect === 'ATURDIMIENTO' || abilityEffect === 'INTIMIDACION');
  if (enCombate && npcsInScene.length > 0) {
    // Bug real (auditoría 2026-07-24, misma familia que npcAttackTarget): esto contraatacaba
    // siempre con el primer NPC detectado en escena, no con quien el jugador tiene delante de
    // verdad — con un aliado (Gistera Koh) y el enemigo real (Orco Enfurecido) a la vez en
    // escena, el "contraataque" podía describir al aliado golpeando al jugador. `npcAttackTarget`
    // ya resuelve el objetivo real de este turno (nombre citado o único NPC hostil); solo cae a
    // `npcsInScene[0]` cuando el turno no es un ataque (p. ej. usar un objeto en pleno combate).
    const npc = npcAttackTarget ?? npcsInScene[0];
    if (stunOrIntimidateLanded) {
      contextBlocks.push(
        `${npc.name.toUpperCase()} NO CONTRAATACA ESTE TURNO — ${
          abilityEffect === 'ATURDIMIENTO' ? 'está aturdido/derribado' : 'tiene la guardia rota por la intimidación'
        }, sin capacidad de responder ahora mismo. Narra la escena reflejando que no puede replicar.`,
      );
    } else {
      const dificultadContraataque = contraataqueDifficultyFor(npc.level, params.currentLevel, defensa);
      const contraataque = rollCheck(attributes, 'destreza', dificultadContraataque);
      npcCounterFailed = !contraataque.success;
      contextBlocks.push(
        `CONTRAATAQUE DE ${npc.name.toUpperCase()} — RESULTADO YA RESUELTO, no lo cambies: tirada de destreza para esquivar/bloquear = ${contraataque.result} vs dificultad ${contraataque.difficulty} → ${
          contraataque.success
            ? 'ESQUIVAS/BLOQUEAS — el golpe no te alcanza, narra cómo lo evitas.'
            : 'TE ALCANZA — narra el golpe y propón "condicionFisica" un escalón peor que ahora mismo.'
        }`,
      );
    }
  }

  if (harvestMatch) {
    contextBlocks.push(harvestBlockFor(harvestMatch));
  }

  // Roadmap 2026-07-19: `Companion`/`Quest` se persistían pero nunca entraban en ningún prompt —
  // un compañero ganado se "olvidaría" al turno siguiente, y pedirle al modelo cerrar una misión
  // por título EXACTO (questProgress) sin decirle qué misiones activas existen era casi imposible
  // de acertar para un 7B. Mismo patrón que el resto de contextBlocks: contexto determinista, el
  // modelo solo lo usa para narrar/decidir, nunca lo inventa.
  const [activeQuests, companions, inventoryRows, professionProgressRows] = await Promise.all([
    prisma.quest.findMany({ where: { saveId, status: 'ACTIVA' } }),
    prisma.companion.findMany({ where: { saveId } }),
    prisma.inventoryItem.findMany({ where: { saveId }, select: { id: true, name: true } }),
    prisma.professionProgress.findMany({ where: { saveId } }),
  ]);
  const inventoryNames = inventoryRows.map((i) => i.name);
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
  const gisteraYaPresentada = sessionFacts.some((f) => f.includes('Gistera Koh'));
  const gisteraSinNombreEnEscena = sessionFacts.some((f) => f.includes('sin nombre revelado todavía'));
  const gisteraEnEscena =
    gisteraKoh !== null || gisteraSinNombreEnEscena || gisteraYaPresentada || npcsInScene.some((npc) => npc.slug === 'gistera-koh');
  const gisteraSePresentaEsteTurno = gisteraEnEscena && !gisteraYaPresentada && detectsDialogueIntent(action);
  if (gisteraEnEscena && gisteraYaPresentada) {
    contextBlocks.push(
      'GISTERA KOH busca convencer a Gorhorn de que la ayude a acabar con el Orco Enfurecido que la persigue — se ha fijado en la marca/tótem del Clan Maktor que lleva Gorhorn y lo usa a su favor (un expulsado hablando con otro sin clan). Si en algún turno Gorhorn acepta ayudarla de verdad (no antes, y no lo fuerces si Gorhorn todavía no se ha decidido), crea la misión con "newQuest" mencionando "Orco Enfurecido" en el título o la descripción, para que derrotarlo la cierre sola.',
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
  const craftPossibleByKey: Record<string, boolean> = {};
  for (const recipe of CRAFTING_RECIPES) {
    const wants = detectsCraftIntent(recipe, action);
    const alivio = alivioFor(recipe.oficio);
    const possible = wants && canCraft(recipe, currentLocationRecord?.slug ?? null, inventoryNames, attributes, secondaryAttributes, alivio);
    craftPossibleByKey[recipe.key] = possible;
    if (wants && !possible) {
      contextBlocks.push(recipe.narrationWant);
      const shortfalls = craftRequisitoShortfalls(recipe, attributes, secondaryAttributes, alivio);
      if (shortfalls.length > 0) {
        contextBlocks.push(
          `Además, al personaje todavía le falta: ${shortfalls.map(shortfallLabel).join(', ')} para poder craftear ${recipe.resultName}.`,
        );
      }
    } else if (possible) {
      contextBlocks.push(recipe.narrationDo);
    }
  }

  // Construcción con requisitos reales (roadmap 2026-07-20/21, petición explícita de la usuaria:
  // "para construir un campamento necesites x20 leños, 10 piedras y 5 pieles") — mismo patrón
  // narrativo que crafting.ts (avisa si falta algo, nunca lo materializa el modelo), pero con
  // cantidades reales sumadas entre filas de inventario, no solo presencia de un objeto. Ampliado
  // 2026-07-22 (checklist punto 5/6) de una receta fija (Campamento) a CONSTRUCTION_RECIPES: la
  // primera cuyo sustantivo aparece en la acción gana — los nombres no se solapan a propósito.
  // Ampliado 2026-07-23 con requisitos de atributo — `missing[]` ya mezcla materiales y atributos
  // (mismo shape `{label,tienes,necesitas}`), así que el texto vale para ambos sin distinguir.
  const buildRecipe: ConstructionRecipe | undefined = CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, action));
  const buildRecipeCheck: RecipeCheck | null = buildRecipe
    ? checkRecipe(buildRecipe, inventoryRows, attributes, secondaryAttributes, alivioFor(buildRecipe.oficio))
    : null;
  if (buildRecipe && buildRecipeCheck && !buildRecipeCheck.met) {
    const faltantes = buildRecipeCheck.missing.map((m) => `${m.label} (tienes ${m.tienes}, necesitas ${m.necesitas})`).join(', ');
    contextBlocks.push(
      `El personaje quiere construir ${buildRecipe.name}, pero todavía no cumple los requisitos: ${faltantes} — narra que lo intenta o lo planea, pero no que lo termina de verdad.`,
    );
  } else if (buildRecipe && buildRecipeCheck?.met) {
    contextBlocks.push(
      `El personaje tiene todos los materiales para construir ${buildRecipe.name} — narra la construcción con el peso que merece. Los materiales ya se consumen automáticamente por el backend.`,
    );
  }

  if (lootMode || harvestMatch) {
    contextBlocks.push(
      'IMPORTANTE: no rellenes "newItem" en este turno — el objeto o botín ya se gestiona automáticamente por el backend a partir de datos fijos.',
    );
  }

  const narration = await narrateAction({
    worldFacts: [...contextBlocks, ...formatLoreForPrompt(retrieved), ...sessionFacts],
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
    onNarrationChunk,
    onNarrationReset,
  });

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
    narration.newFacts = [...narration.newFacts, `Gistera Koh, una orca expulsada del Clan Serhu, le ha pedido a ${characterName} que la ayude a acabar con el Orco Enfurecido que la persigue.`];
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
  // sigue esperando aquí porque decide el hito/XP de ESTE turno; si toca capítulo, la generación
  // de verdad (`scheduleChapterSummaryGeneration`, la llamada lenta) se dispara con `void` —
  // sin esperar — y solo se registra si falla, exactamente igual de resiliente que el try/catch
  // original (`claimChapterIfDue` ya protege contra reclamar el mismo capítulo dos veces mientras
  // la generación de fondo sigue en marcha).
  const chapterDue = await claimChapterIfDue(saveId);
  if (chapterDue) {
    void scheduleChapterSummaryGeneration(saveId, characterName);
  }

  // Condición física (docs/14 § 1) y descanso válido (§ 4.1) — deterministas, calculados antes
  // de la transacción porque no dependen de ella (solo leen el catálogo de mundo). Se combina la
  // propuesta del modelo con la del contraataque determinista (la peor de las dos gana, pero
  // nextCondicionFisica sigue topando a un único escalón por turno — nunca se suman).
  const condicionPropuestaCombinada = worseCondicion(
    narration.condicionFisica,
    npcCounterFailed ? oneStepWorseThan(params.condicionFisica) : null,
  );
  const proposedCondicion = nextCondicionFisica(params.condicionFisica, condicionPropuestaCombinada, !!enCombate);
  const restSucceeds =
    !travel && currentLocationRecord && detectsRestIntent(action) && (!roll || roll.success) && isValidRestLocationKind(currentLocationRecord.kind);

  // Reloj ficticio (worldClock.ts): avanza siempre, aunque este turno no traiga hechos nuevos —
  // antes "fictionalDateLabel" era un placeholder fijo que nunca se tocaba.
  const nuevoFictionalMinutes = advanceFictionalMinutes(fictionalMinutesActuales, minutosDeEsteTurno);
  const nuevaFictionalDateLabel = formatFictionalDate(nuevoFictionalMinutes);

  const { progression, condicionFisica, finDePartida, newInventoryItems, logEntryId } = await prisma.$transaction(async (tx) => {
    const newInventoryItems: NewInventoryItemInfo[] = [];
    // Nombres de todo lo materializado este turno (roadmap 2026-07-20, P1 de Fable) — para cerrar
    // solo la misión "conseguir Z" (Quest.targetItemName) al final de la transacción, sin repetir
    // el chequeo en cada uno de los 5 sitios que crean InventoryItem.
    const createdItemNames: string[] = [];

    await tx.worldState.update({
      where: { saveId },
      data: {
        fictionalMinutes: nuevoFictionalMinutes,
        fictionalDateLabel: nuevaFictionalDateLabel,
        ...(narration.newFacts.length ? { facts: mergeFacts(sessionFacts, narration.newFacts) } : {}),
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
        const { poblacion, felicidad, comida, bebida, riqueza, soldados, trabajadores, visitantes } = kingdomStats;
        const ticked = tickKingdom({ poblacion, felicidad, comida, bebida, riqueza, soldados, trabajadores, visitantes }, diasCruzados);
        await tx.kingdomStats.update({ where: { saveId }, data: ticked });
      }
    }

    // Loot (docs/12 § 4.5, decisión de la usuaria: copiar todo el loadout) — la ÚNICA fuente de
    // botín es lo que el NPC lleva encima (NpcItem), nunca una invención del modelo.
    if (lootMode) {
      for (const npc of npcsInScene) {
        // NpcState (roadmap 2026-07-19): antes no había forma de saber si este NPC ya se había
        // saqueado en esta partida, así que el mismo botín se podía repetir infinitas veces.
        if (npc.saqueado) continue;
        for (const item of npc.items) {
          const created = await tx.inventoryItem.create({
            data: {
              saveId,
              name: item.cantidad > 1 ? `${item.name} ×${item.cantidad}` : item.name,
              description: item.notas ?? `Botín de ${npc.name}.`,
              origin: `botín de ${npc.name}`,
              // El bonificador de equipo (si el objeto lo tenía en el catálogo) viaja con él —
              // un hacha robada sigue dando su bonificador al equiparla.
              statBonusAttribute: item.statBonusAttribute,
              statBonusAmount: item.statBonusAmount,
              catalogSlug: item.catalogSlug,
            },
          });
          newInventoryItems.push({ ...created, slot: null });
          createdItemNames.push(created.name);
        }
        if (npc.items.length > 0) {
          const scope = scopeFor(npc.kind, currentLocationId);
          await tx.npcState.upsert({
            where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope } },
            create: { saveId, npcId: npc.id, scope, saqueado: true },
            update: { saqueado: true },
          });
        }
      }
    }

    if (npcAttackTarget && npcAttackHits && npcTargetNewCondicion) {
      const scope = scopeFor(npcAttackTarget.kind, currentLocationId);
      await tx.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: npcAttackTarget.id, scope } },
        create: { saveId, npcId: npcAttackTarget.id, scope, condicionFisica: npcTargetNewCondicion },
        update: { condicionFisica: npcTargetNewCondicion },
      });

      if (npcTargetNewCondicion === 'INCAPACITADO' || npcTargetNewCondicion === 'MUERTO') {
        // Cierre detectable por backend (roadmap 2026-07-19, mecánicas): si alguna misión ACTIVA
        // apuntaba a este NPC (Quest.targetNpcId, ver newQuest más arriba), derrotarlo la cierra
        // sola en cuanto cae — el modelo nunca tiene que acertar el título EXACTO vía
        // questProgress para el caso más común de misión de combate ("derrotar a X").
        await tx.quest.updateMany({
          where: { saveId, targetNpcId: npcAttackTarget.id, status: 'ACTIVA' },
          data: { status: 'COMPLETADA' },
        });

        // Reputación de facción determinista (roadmap 2026-07-19, prioridad 4): reutiliza
        // `WorldState.factionsStatus` (Json reservado desde el diseño original, nunca usado
        // hasta ahora — mismo patrón que `agenda`). Derrotar a un NPC de una facción concreta
        // resta 1 con esa facción; sin facción (fauna, NPCs independientes) no afecta a nada.
        if (npcAttackTarget.faction) {
          const currentWorldState = await tx.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true } });
          const factionsStatus = { ...((currentWorldState?.factionsStatus as Record<string, number> | null) ?? {}) };
          factionsStatus[npcAttackTarget.faction] = (factionsStatus[npcAttackTarget.faction] ?? 0) - 1;
          await tx.worldState.update({ where: { saveId }, data: { factionsStatus } });
        }
      }
    }

    // Despiece/recolección (§ 3.3) — solo si la acción tuvo éxito (o no requería tirada).
    if (harvestMatch && (!roll || roll.success)) {
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
        newInventoryItems.push({ ...created, slot: null });
        createdItemNames.push(created.name);
      }
    }

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
      newInventoryItems.push({ ...created, slot: null });
      createdItemNames.push(created.name);
    }

    // Nivel de oficio (sesión de diseño 2026-07-23): se otorga en cuanto la receta se materializa
    // de verdad (no solo se comprueba posible) — un solo upsert, la profesión ya es dato estático
    // de la receta, cero coste de IA.
    async function awardProfessionXp(oficio: string | undefined, tier: number | undefined): Promise<void> {
      if (!oficio) return;
      const existing = await tx.professionProgress.findUnique({ where: { saveId_professionId: { saveId, professionId: oficio } } });
      const result = applyProfessionXp(existing?.xp ?? 0, existing?.nivel ?? 1, xpForCraftSuccess(tier));
      await tx.professionProgress.upsert({
        where: { saveId_professionId: { saveId, professionId: oficio } },
        create: { saveId, professionId: oficio, nivel: result.newLevel, xp: result.newXp },
        update: { nivel: result.newLevel, xp: result.newXp },
      });
    }

    // Crafteo v1: intercambio 1:1 de filas de inventario, tabulado en CRAFTING_RECIPES (auditoría
    // 2026-07-22 — antes 5 bloques casi idénticos, uno por objeto).
    for (const recipe of CRAFTING_RECIPES) {
      if (!craftPossibleByKey[recipe.key]) continue;
      const rowIds = planCraftConsumption(recipe, inventoryRows);
      if (!rowIds) continue;
      await tx.inventoryItem.deleteMany({ where: { id: { in: rowIds } } });
      const created = await tx.inventoryItem.create({
        data: {
          saveId,
          name: recipe.resultName,
          description: recipe.resultDescription,
          origin: 'crafteo',
          catalogSlug: recipe.resultCatalogSlug,
          ...(recipe.statBonusAttribute
            ? { statBonusAttribute: recipe.statBonusAttribute, statBonusAmount: recipe.statBonusAmount }
            : {}),
        },
      });
      newInventoryItems.push({ ...created, slot: null });
      createdItemNames.push(created.name);
      await awardProfessionXp(recipe.oficio, recipe.tier);
    }

    // Construcción (roadmap 2026-07-20/21, ampliado 2026-07-22): a diferencia del resto de
    // crafteo (una fila entera 1:1), aquí se consumen CANTIDADES reales repartidas entre las
    // filas que hagan falta (planConsumption), dejando un remanente reducido en la última fila
    // si sobra.
    if (buildRecipe && buildRecipeCheck?.met) {
      for (const req of buildRecipe.requirements) {
        const plan = planConsumption(inventoryRows, req.namePrefix, req.cantidad);
        if (plan.deleteIds.length > 0) {
          await tx.inventoryItem.deleteMany({ where: { id: { in: plan.deleteIds } } });
        }
        if (plan.updateRemainder) {
          const row = inventoryRows.find((r) => r.id === plan.updateRemainder!.id);
          if (row) {
            await tx.inventoryItem.update({
              where: { id: plan.updateRemainder.id },
              data: { name: `${baseNameOf(row.name)} (${plan.updateRemainder.newQuantity})` },
            });
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
    }
    if (narration.newCompanion) {
      await tx.companion.create({
        data: {
          saveId,
          name: narration.newCompanion.name,
          role: narration.newCompanion.role,
          notes: narration.newCompanion.notes,
        },
      });
    }

    // Eventos de Reino (docs/10-niveles-xp-reino.md § 5) — necesitan enlazar por nombre de
    // territorio y contar súbditos existentes, por eso van en la transacción interactiva.
    let reinoXp = 0;
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

    if (narration.newBuilding) {
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
      // NPC caiga (INCAPACITADO/MUERTO, ver npcAttackTarget más abajo), la misión se cierra sola,
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
        await tx.quest.create({
          data: {
            saveId,
            title: 'Acabar con el Orco Enfurecido',
            description:
              'Gistera Koh, expulsada del Clan Serhu, pidió ayuda para acabar con el guerrero que la persigue — Gorhorn ha aceptado. Derrotarlo la pondrá a salvo.',
            targetNpcId: orcoEnfurecido?.id,
          },
        });
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
        for (const quest of matchingQuests) {
          if (!quest.targetNpcId) continue;
          const npc = await tx.npc.findUnique({ where: { id: quest.targetNpcId } });
          if (!npc?.faction) continue;
          const derrotadoEsteTurno =
            npcAttackTarget?.id === quest.targetNpcId &&
            npcAttackHits &&
            (npcTargetNewCondicion === 'INCAPACITADO' || npcTargetNewCondicion === 'MUERTO');
          if (derrotadoEsteTurno) continue;
          const state = await tx.npcState.findUnique({
            where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: scopeFor(npc.kind, currentLocationId) } },
          });
          const yaDerrotado = state?.condicionFisica === 'INCAPACITADO' || state?.condicionFisica === 'MUERTO';
          if (yaDerrotado) continue;
          const currentWorldState = await tx.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true } });
          const factionsStatus = { ...((currentWorldState?.factionsStatus as Record<string, number> | null) ?? {}) };
          factionsStatus[npc.faction] = (factionsStatus[npc.faction] ?? 0) + 1;
          await tx.worldState.update({ where: { saveId }, data: { factionsStatus } });
        }
      }
    }

    // Cierre de misión "conseguir Z" (roadmap 2026-07-20, P1 de Fable, Quest.targetItemName):
    // cualquier objeto materializado ESTE turno (loot/despiece/producción/crafteo/newItem, ver
    // createdItemNames más arriba) que mencione el nombre objetivo cierra la misión sola.
    if (createdItemNames.length > 0) {
      const activeQuestsWithItem = await tx.quest.findMany({
        where: { saveId, status: 'ACTIVA', targetItemName: { not: null } },
      });
      for (const quest of activeQuestsWithItem) {
        const targetNormalized = normalizeText(quest.targetItemName!);
        const conseguido = createdItemNames.some((name) => normalizeText(name).includes(targetNormalized));
        if (conseguido) {
          await tx.quest.update({ where: { id: quest.id }, data: { status: 'COMPLETADA' } });
        }
      }
    }

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

    const hitos: HitoTipo[] = [];
    if (narration.hito) hitos.push(narration.hito);
    if (isFirstVisitToDestination) hitos.push('descubrimiento');
    if (chapterDue) hitos.push('capitulo');

    const xpTirada = roll ? xpForRollSuccess(classification.dificultad, roll.success) : 0;
    const xpHito = Math.max(xpForHitos(hitos), reinoXp);
    const xpTurno = xpTirada + xpHito;
    const result = applyXp(params.currentXp, params.currentLevel, xpTurno);

    // Bug real encontrado auditando la partida de Gorhorn (2026-07-24, "revisar mi partida
    // actual"): `now()` de Postgres es fijo durante TODA una transacción — si un mismo turno crea
    // varias LogEntry aquí (narración + subida de nivel + desbloqueo de habilidad...), todas caen
    // con el MISMO `createdAt`, y sin desempate el orden de lectura (`orderBy: createdAt asc`) no
    // está garantizado — puede salir "sube a nivel 2" antes que la narración que lo causó. Mismo
    // arreglo que en turn.ts (transición a banda extendida/larga): `createdAt` explícito con +1ms
    // por fila, en el mismo orden en que se crean, para que el orden de lectura sea siempre el real.
    let logEntrySequence = 0;
    const nextLogEntryCreatedAt = () => new Date(Date.now() + logEntrySequence++);

    const mainLogEntry = await tx.logEntry.create({
      data: {
        saveId,
        channel: 'CHARACTER',
        text: narration.narration,
        roll: roll ? (roll as unknown as Prisma.InputJsonValue) : undefined,
        timeLabel,
        xpDelta: xpTurno > 0 ? xpTurno : undefined,
        fictionalMinutes: nuevoFictionalMinutes,
        createdAt: nextLogEntryCreatedAt(),
      },
    });

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
          createdAt: nextLogEntryCreatedAt(),
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
              effect: ability.effect ?? null,
              preferredAttribute: ability.preferredAttribute ?? null,
            },
          });
          await tx.logEntry.create({
            data: {
              saveId,
              channel: 'CHARACTER',
              text: `${characterName} desbloquea la habilidad de clase "${ability.name}".`,
              timeLabel,
              fictionalMinutes: nuevoFictionalMinutes,
              createdAt: nextLogEntryCreatedAt(),
            },
          });
        }
      }
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

    if (restSucceeds && currentLocationRecord) {
      finalLastRestLocationId = currentLocationRecord.id;
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
        await tx.logEntry.create({
          data: {
            saveId,
            channel: 'CHARACTER',
            text: whisperText(characterName, respawnLocation?.name ?? 'un lugar que reconoce', outcome.avisoUltimaVez),
            timeLabel,
            fictionalMinutes: nuevoFictionalMinutes,
            createdAt: nextLogEntryCreatedAt(),
          },
        });
        finalCondicion = 'ILESO';
        finalCurrentLocationId = respawnLocationId;
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
        lastRestLocationId: finalLastRestLocationId,
        deathCount: finalDeathCount,
        endedAt: finalEndedAt,
      },
    });

    return {
      progression: result,
      condicionFisica: finalCondicion,
      finDePartida: finDePartidaResult,
      newInventoryItems,
      logEntryId: mainLogEntry.id,
    };
  });

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
  const combatSlugsFromModel = (narration.combateIniciado?.npcSlugs ?? []).filter((slug) => npcsInScene.some((n) => n.slug === slug));
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
    npcsInScene.length > 0 &&
    (isCondicionDowngrade(params.condicionFisica, narration.condicionFisica) ||
      detectsAttackIntent(action) ||
      (detectsHostileSearchIntent(action) && !detectsVerbalAcceptanceIntent(action)));
  // Bug real (auditoría 2026-07-23, "ha metido un murgol que no pinta nada"): la red de seguridad
  // metía a TODOS los NPCs detectados en escena como participantes de combate (aliados, fauna de
  // paso...), no solo al hostil. Si la acción cita un nombre real entre comillas (`explicitTarget`,
  // ver arriba), el popup arranca solo con ese — el listado completo de `npcsInScene` queda como
  // último recurso para cuando la acción no nombra a nadie en concreto ("me defiendo").
  const forcedCombatSlugs = explicitTarget ? [explicitTarget.slug] : npcsInScene.map((n) => n.slug);
  const combatSlugs = combatSlugsFromModel.length > 0 ? combatSlugsFromModel : shouldForceCombat ? forcedCombatSlugs : [];

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
          .map((n) => ({ slug: n.slug, name: n.name, condicionFisica: n.condicionFisica, saqueado: n.saqueado })),
      }
    : null;

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
      gradoExito: roll?.gradoExito ?? null,
      newInventoryItemsCount: newInventoryItems.length,
    }),
  );

  // Enciclopedia progresiva (sesión de diseño 2026-07-23) — se escanea SOLO lo nuevo de este
  // turno (narración + new_facts); lo de turnos anteriores ya quedó en DiscoveredEntity.
  await recordEntityDiscoveries({
    saveId,
    worldId,
    mentionedText: [narration.narration, ...narration.newFacts].join('\n'),
  });

  return { narration, progression, condicionFisica, combateIniciado, finDePartida, newInventoryItems, logEntryId };
}
