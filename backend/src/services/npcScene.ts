import { prisma } from '../lib/prisma.js';
import { normalizeText, fuzzyMatchCandidates, fuzzyMatchesAnyStem, findFuzzyStemMatch, matchesAliasBoundary } from './travel.js';
import type { NpcKind, CondicionFisica, Temperamento, WeaponCategory, EquipSlot, ItemTipo, Prisma, NpcState, AbilityEffect, NpcInteractionType } from '@prisma/client';
import type { Attribute, AttributeBlock } from './dice.js';
import { sumAttributes } from './equipment.js';
import type { Clase } from './classAbilities.js';
import { npcAttributesForLevel } from './progression.js';
import { parseActiveEffects, type ActiveEffect } from './activeEffects.js';
import { effectiveTemperamento } from './reputation.js';
import { momentoDelDiaFor } from './worldClock.js';
import { faunaMomentoDelDia } from '../scripts/worldCatalog.js';

/// Detección determinista de "NPC en escena" (docs/12-mundo-estructurado.md § 2.5) — sin llamada
/// extra a Ollama: se busca Npc.aliases (normalizados) en el texto de la acción y en los hechos
/// de la sesión. Los números y el equipo del NPC SIEMPRE llegan por esta vía, nunca los inventa
/// el modelo (§ 2.1).

export interface NpcItemInScene {
  name: string;
  cantidad: number;
  notas: string | null;
  /// Descripción real de catálogo (2026-07-30, auditoría "revisar partida" — "doble
  /// descripción"): fallback de `itemsLine()` cuando este objeto no tiene `notas` propias —
  /// antes, sin `notas`, el Narrador solo veía el nombre pelado del objeto, perdiendo su aspecto
  /// real (p.ej. "Maza orca" sin saber que está "astillada, con sangre seca").
  description: string;
  /// Ranura de equipo real del catálogo (2026-07-30, "categorizar por ranura") — se copia al
  /// InventoryItem real si se saquea, para que el frontend sepa dónde encaja sin esperar a
  /// recargar la partida (ver `NewInventoryItemInfo.equipSlot`, turnResolution.ts).
  equipSlot: EquipSlot | null;
  /// Bonificadores de equipo (2026-07-19, mapa múltiple desde 2026-08-03) — se copian al
  /// InventoryItem real si se saquea (ver turnResolution.ts), para que un hacha robada siga
  /// dando su bonificador al equiparla.
  statBonuses: Prisma.JsonValue | null;
  /// Slug de ItemCatalog (sesión de diseño 2026-07-23) — se copia al InventoryItem.catalogSlug
  /// real si se saquea, para poder mirar sus requisitos de equipar (ver requisitos.ts).
  catalogSlug: string;
  /// Clave de efecto especial de catálogo (2026-08-06, bug real jugando: "Mapa de las Llanuras" no
  /// activaba los puntos del mapa hasta recargar) — se copia al InventoryItem real si se saquea,
  /// mismo criterio exacto que equipSlot/statBonuses arriba (sin esto, MapaPanel.tsx no lo veía
  /// hasta la siguiente GET /saves/:id, que sí lo resuelve vía join con ItemCatalog).
  effectKey: string | null;
  /// Rediseño del turno de combate (2026-07-28) — necesario para resolver el "Ataque base" del
  /// NPC (baseAttack.ts, mismo criterio que ya usa world.ts para la Enciclopedia): solo los
  /// ítems `category === 'arma'` cuentan como arma equipable en su loadout.
  category: string;
  /// Sistema de habilidades de arma (2026-07-29) — categoría real del arma (ver WeaponCategory en
  /// schema.prisma), decide qué habilidad de ataque/defensa genera este objeto. Null en objetos
  /// que no son arma/escudo.
  tipoArma: WeaponCategory | null;
  /// Categorización mecánica real para agrupar el Inventario (bug real jugando en vivo,
  /// 2026-08-07: mismo patrón exacto que equipSlot/effectKey de arriba, pero olvidado en los dos
  /// arreglos anteriores — un objeto recién saqueado se veía "sin categorizar" hasta recargar la
  /// partida entera porque `InventoryItem` no guarda `tipo`, se calcula al vuelo en `detail.ts`
  /// vía join con `ItemCatalog`). Se copia al InventoryItem real si se saquea, ver
  /// `NewInventoryItemInfo.tipo` (turnResolution.ts).
  tipo: ItemTipo;
}

/// Habilidad racial de fauna, tal cual vive en `Npc.habilidadesRaciales` (worldCatalog.ts) — ver
/// `NpcHabilidadRacial` allí. Duplicado aquí en vez de importado (ese archivo es contenido de
/// seed, no un módulo pensado para importarse en el motor de turnos) — mismo criterio que el
/// resto de shapes de este archivo, que ya reflejan columnas de Npc a mano.
///
/// Sistema de categorías de raza de fauna (2026-09-02) — `level`/`effects` añadidos, mismo
/// motivo que en worldCatalog.ts: estas 3 habilidades específicas por animal ahora escalan por
/// nivel y llevan mecánica real, ya no son puramente descriptivas.
export interface NpcHabilidadRacialInScene {
  icon: string;
  name: string;
  description: string;
  categoria: 'ataque' | 'defensa' | 'utilidad';
  preferredAttribute: Attribute;
  level: number;
  effects: AbilityEffect[];
}

export interface NpcInScene {
  id: string;
  slug: string;
  name: string;
  /// "el"/"la" para reforzar el género correcto de nombres descriptivos en el contexto del
  /// Narrador (ver comentario completo en schema.prisma § Npc.articulo) — null para nombres
  /// propios que no lo necesitan.
  articulo: string | null;
  /// "M"/"F" — ver schema.prisma § Npc.genero. Distinto de `articulo`: refuerza el género de
  /// NOMBRES PROPIOS a los que el modelo se refiere de forma genérica en prosa libre en vez de
  /// por su nombre (p.ej. "el orco" para Gistera Koh, femenino). Null = sin refuerzo explícito.
  genero: string | null;
  kind: NpcKind;
  level: number;
  role: string;
  faction: string | null;
  personality: string;
  bio: string;
  items: NpcItemInScene[];
  /// Rediseño del turno de combate (2026-07-28) — necesarios para resolver iniciativa/ataque
  /// base/habilidades de este NPC (combatExchange.ts/npcCombatAbilities.ts). `raza`/`clase`
  /// null si no aplica (fauna no tiene `clase`; NPCs sociales pueden no tener ninguno de los
  /// dos); `ataqueNatural`/`habilidadesRaciales` solo poblados en fauna.
  attributes: AttributeBlock;
  raza: string | null;
  clase: string | null;
  /// Especialización dentro de `clase` (2026-08-24, Grupo 3 § Sistema de clases) — null = solo
  /// tronco común, o clase sin especialización asignada. Mismo criterio nullable que `clase`.
  especializacion: string | null;
  ataqueNatural: string | null;
  habilidadesRaciales: NpcHabilidadRacialInScene[];
  /// Sistema de categorías de raza de fauna (2026-09-02, `Npc.faunaCategoria`) — sistema PARALELO
  /// a `clase`/`raza`, mismo criterio nullable. Solo fauna la lleva; null en humanoides y en
  /// fauna sin categoría asignada todavía.
  faunaCategoria: string | null;
  /// Disposición al combate (schema.prisma § Temperamento, 2026-07-29) — gate determinista en
  /// shouldForceCombat (turnResolution.ts): AGRESIVO fuerza combate con cualquier interacción,
  /// INOFENSIVO protege de la red de seguridad.
  temperamento: Temperamento;
  /// Estado persistido POR PARTIDA (NpcState, roadmap 2026-07-19 "roadmap 3") — antes cada
  /// escena leía siempre el Npc estático, así que "Torgash resucita" cada vez que aparece.
  /// ILESO/false si todavía no existe fila (nunca se ha enfrentado a este NPC en esta partida).
  condicionFisica: CondicionFisica;
  saqueado: boolean;
  /// Saqueo parcial (2026-07-31, ver NpcState.lootedItemNames) — nombres de objeto ya copiados al
  /// inventario del jugador de este NPC en esta partida. `[]` si nunca se ha tocado.
  lootedItemNames: string[];
  /// Sistema de fatiga simétrico (2026-07-30) — null = tope completo (mismo criterio lazy que
  /// `condicionFisica`/ILESO): el tope real se deriva con `energiaMaxFor(attributes.constitucion)`
  /// en el punto de uso (turnResolution.ts), nunca aquí.
  energia: number | null;
  /// Rediseño de combate (2026-08-09, "Analizar rival") — true en cuanto el jugador lo analiza con
  /// éxito una vez, para siempre en esta partida. Gatea qué muestra la ficha del rival en combate
  /// (CombatPanel.tsx § EnemyFicha) — sin analizar, ni estadísticas ni habilidades.
  analizado: boolean;
  /// Bug real jugando en vivo (2026-08-26, "le doy a Capturar y no hace nada"): `POST
  /// /capturar/:npcSlug` (companeros.ts) rechaza cualquier Npc sin `atributoResistencia` (sin
  /// tirada opuesta posible), pero el botón "Capturar" de la tarjeta Matar/Capturar/Clemente
  /// (LogPanel.tsx) se mostraba siempre — sin este dato, no hay forma de ocultarlo de antemano.
  capturable: boolean;
  /// Caza en grupo (2026-08-13) — ver comentario completo en schema.prisma § NpcState.groupSize.
  /// null = encuentro solitario de siempre.
  groupSize: number | null;
  groupDefeated: number;
  /// Cadáveres del grupo ya despiezados (schema.prisma § NpcState.corpsesLooted) — para
  /// `groupSize` no nulo, ES el criterio real de "ya no queda nada que ofrecer" (`saqueado` no
  /// tiene sentido por individuo en un grupo, ver comentario del propio campo en el schema).
  corpsesLooted: number;
  /// Tope de usos por combate (2026-08-15, AbilityEffect.LIMITADA/maxUsesPerCombat) — ver
  /// comentario completo en schema.prisma § NpcState.abilityUsesThisEncounter. `{}` si todavía no
  /// existe fila o no se ha usado ninguna habilidad limitada en este encuentro.
  abilityUsesThisEncounter: Record<string, number>;
  /// Fase 2 de efectos de clase (2026-08-26, docs/21-roadmap.md) — AUMENTO/DEBILIDAD con duración
  /// real por turnos, ver activeEffects.ts. `[]` si todavía no existe fila o no hay ningún efecto
  /// activo ahora mismo — mismo criterio lazy que `abilityUsesThisEncounter`.
  activeEffects: ActiveEffect[];
  /// Combate "fantasma" (bug real, investigación 2026-08-29): dato crudo (no resuelto a región
  /// aquí — `detectNpcsInScene` deliberadamente deja "ya establecido en esta partida" como
  /// candidato SIN mirar región, ver comentario de cabecera de la función). `turnResolution.ts` lo
  /// usa para decidir si un NPC agresivo puede FORZAR combate (solo cerca de su territorio) sin
  /// tocar el resto del contrato de "sigue siendo candidato en escena" ya cubierto por tests.
  /// `null` = itinerante, sin territorio propio.
  homeLocationSlug: string | null;
  /// Auditoría "narrador vs. catálogo del mundo" (2026-08-30) — porcentajes reales de qué tan
  /// receptivo es este NPC a cada tipo de interacción social (schema.prisma § Npc, usados
  /// mecánicamente en companeros.ts/cazar.ts para la tirada real). Antes llegaban solo hasta el
  /// objeto en memoria — el narrador nunca sabía, p.ej., que Torgash Ketg tiene
  /// `reclutablePct: 5` ("tan fácil de convencer como uno entre veinte") y podía narrar una
  /// negociación fluida justo antes de que la tirada real fallara casi siempre.
  comerciablePct: number;
  reclutablePct: number;
  domesticablePct: number;
  cortejablePct: number;
  capturablePct: number;
  /// "Matar" persistido (2026-09-05, bug real: se perdía al recargar) — mismo criterio que
  /// `analizado`, ver NpcState.targetedForKill en schema.prisma.
  targetedForKill: boolean;
  /// Menú contextual de interacción (2026-09-06, ver schema.prisma § Npc.interactionTypes) — `[]`
  /// = sin menú contextual, interacción libre de siempre.
  interactionTypes: NpcInteractionType[];
  /// `professionId` que enseña, si es Maestro de oficio (schema.prisma § Npc.teachesProfession) —
  /// null en el resto. Se proyecta aquí para no repetir la consulta de `aprenderOficio.ts` al
  /// decidir si ofrecer "Aprender profesión" en el menú contextual.
  teachesProfession: string | null;
}

export interface NpcWithAliases {
  id: string;
  aliases: string[];
}

export type NpcWithItems = Prisma.NpcGetPayload<{ include: { items: { include: { item: true } } } }>;

/// Extraído de `detectNpcsInScene` (2026-08-05, eventos de viaje interactivos) para que un NPC
/// pueda entrar en escena por una vía DISTINTA al matching de texto — p.ej. una interrupción de
/// viaje ya decidida de antemano (travelInterruption.ts), sin depender de que el Narrador narre
/// el nombre correcto. Extracción pura, mismo resultado exacto que el `.map` inline de antes.
export function buildNpcInScene(npc: NpcWithItems, state: NpcState | undefined): NpcInScene {
  return {
    id: npc.id,
    slug: npc.slug,
    name: npc.name,
    articulo: npc.articulo,
    genero: npc.genero,
    kind: npc.kind,
    level: npc.level,
    role: npc.role,
    faction: npc.faction,
    personality: npc.personality,
    bio: npc.bio,
    // Entrega real de objeto a NPC (2026-08-31) — `NpcState.givenItems` ya viene aplanado al
    // mismo shape que el resto (ver comentario del campo en schema.prisma), se suma tal cual al
    // loadout fijo de catálogo — mismo pipeline de saqueo/decapitar, sin lógica paralela.
    items: [...npc.items.map((i) => ({
      name: i.item.name,
      cantidad: i.cantidad,
      notas: i.notas,
      description: i.item.description,
      equipSlot: i.item.equipSlot,
      statBonuses: i.item.statBonuses,
      catalogSlug: i.item.slug,
      effectKey: i.item.effectKey,
      category: i.item.category,
      tipoArma: i.item.tipoArma,
      tipo: i.item.tipo,
    })), ...((state?.givenItems as unknown as NpcItemInScene[] | undefined) ?? [])],
    // Escalado por nivel (2026-08-21, "quiero afinar cómo funciona el tema de los niveles"): el
    // bloque `attributes` de catálogo es siempre nivel 1 — aquí se proyecta hasta `npc.level` con
    // el mismo ritmo de puntos que el PJ (ver npcAttributesForLevel, progression.ts). `raza`/
    // `clase` solo existen en humanoides; la fauna (sin clase) reparte proporcional a su propio
    // perfil de nivel 1 en vez de por tabla de clase.
    attributes: npcAttributesForLevel(npc.attributes as AttributeBlock, npc.level, npc.clase as Clase | null) as NpcInScene['attributes'],
    raza: npc.raza,
    clase: npc.clase,
    especializacion: npc.especializacion,
    ataqueNatural: npc.ataqueNatural,
    habilidadesRaciales: (npc.habilidadesRaciales as unknown as NpcHabilidadRacialInScene[]) ?? [],
    faunaCategoria: npc.faunaCategoria,
    temperamento: npc.temperamento,
    condicionFisica: state?.condicionFisica ?? 'ILESO',
    saqueado: state?.saqueado ?? false,
    lootedItemNames: state?.lootedItemNames ?? [],
    energia: state?.energia ?? null,
    analizado: state?.analizado ?? false,
    capturable: npc.atributoResistencia !== null,
    groupSize: state?.groupSize ?? null,
    groupDefeated: state?.groupDefeated ?? 0,
    corpsesLooted: state?.corpsesLooted ?? 0,
    abilityUsesThisEncounter: (state?.abilityUsesThisEncounter as Record<string, number> | undefined) ?? {},
    activeEffects: parseActiveEffects(state?.activeEffects),
    homeLocationSlug: npc.homeLocationSlug,
    comerciablePct: npc.comerciablePct,
    reclutablePct: npc.reclutablePct,
    domesticablePct: npc.domesticablePct,
    cortejablePct: npc.cortejablePct,
    capturablePct: npc.capturablePct,
    targetedForKill: state?.targetedForKill ?? false,
    interactionTypes: npc.interactionTypes,
    teachesProfession: npc.teachesProfession,
  };
}

// Auditoría 2026-08-02 ("revisar partida"): palabras/verbos MUY comunes del propio juego que están
// a distancia Levenshtein ≤2 de un alias real de un solo NPC — mismo tipo de colisión que
// ATTACK_FUZZY_EXCLUSIONS más abajo ("hierro"~"hiero"), pero para la detección de NPCs en escena.
// Confirmado jugando en vivo, las dos veces con NpcState real de por medio (no solo narrativo):
// - "lugar"~"hagar" (Hagar, distancia 2: l→h, u→a) — el hecho de sesión del turno 1 ("...este
//   lugar ha sido escenario...") lo colaba en npcsInScene DURANTE TODA LA PARTIDA, hasta el punto
//   de hijackear un intercambio de combate real contra él en vez del enemigo de verdad.
// - "remato"~"rebano" (Múrgol, distancia 2: m→b, t→n) — "remato"/"remata" es el verbo fijo de
//   CUALQUIER decapitar/rematar del juego, así que esta colisión se repite siempre que se remata.
// - "hablar"~"hagar" (Hagar otra vez, distancia 2: b→g, l→a — revisión de partida 2026-08-08):
//   el propio bio de catálogo de Orco Enfurecido ya usa "sin intentar hablar", así que esta
//   colisión concreta podía dispararse desde la primerísima escena de cualquier partida nueva.
//   Confirmado con NpcState real: Hagar quedó con `energia`/`condicionFisica` tocados por un
//   intercambio que en realidad iba contra el Orco Enfurecido.
// Si se añade un NPC nuevo cuyo alias corto choque con una palabra de uso normal, añadirla aquí
// en vez de tocar la tolerancia a erratas en general (sigue haciendo falta para erratas reales).
const NPC_ALIAS_FUZZY_EXCLUSIONS = new Set([
  // Restaurado (2026-08-15) — se había borrado sin comentario, reabriendo el bug real ya
  // documentado: "este lugar ha cambiado" dispara a Hagar por tolerancia a erratas
  // (Levenshtein("lugar","hagar")=2). Confirmado con la usuaria que fue un borrado accidental.
  'lugar',
  'remato',
  'remata',
  'rematar',
  'remate',
  'rematan',
  'rematamos',
  'hablar',
  // Barrido sistemático (auditoría 2026-08-11, escrita al portar matchesAliasBoundary): "hagar"
  // (5 letras, patrón X-a-X-a-r) resultó estar a distancia Levenshtein ≤2 de toda una familia de
  // verbos comunes en "-ar" de la misma longitud — no un choque aislado como los de arriba, sino
  // estructural al propio alias. Encontrado probando "cazar" (verbo muy frecuente en este juego de
  // caza/recolección) y confirmado con un barrido contra ~150 verbos de acción típicos del juego.
  'cazar',
  'sanar',
  'talar',
  'nadar',
  'matar',
  'apagar',
  'bajar',
  'pagar',
  'negar',
  'niego',
  'comerciar',
  'comerciamos',
  'reclutar',
  'recluto',
  'capturar',
  'capturo',
  'asesinar',
  'informar',
  'torturar',
  'torturo',
  'besar',
  'beso',
  'acariciar',
  'acaricio',
  'elogiar',
  'invitar',
  'señalar',
  'señalo',
  'negociar',
  'negociamos',
  'vender',
  'vendo',
  'comprar',
  'compro',
  'regalar',
  'susurrar',
  'gritar',
  'curar',
  'curamos',
  'curo',
  'sanar',
  'sano',
  'sanamos',
  'confia',
  'patrullar',
  // Colisión entre dos NOMBRES DE NPC reales, no un verbo común (2026-09-02, encontrado al
  // sembrar Terkash — Los Acantilados Partidos): "torgash" (alias corto de Torgash Ketg,
  // Kort'ikar del Clan Serhu) está a distancia Levenshtein 2 de "terkash" (alias del nuevo
  // crustáceo) — mencionar a Torgash Ketg en texto libre ("...mientras Torgash Ketg me
  // observa...") disparaba también a Terkash por tolerancia a erratas, sin que ninguno de los dos
  // tuviera ningún error tipográfico real. La detección EXACTA de Torgash Ketg sigue intacta (su
  // alias real es "Torgash Ketg", con espacio — matchesAliasBoundary, no esta lista de fuzzy).
  'torgash',
]);

/// Puro: dado un texto y una lista de NPCs con sus aliases, devuelve los ids que matchean.
/// Exportado sin envolver en la consulta a Prisma para poder testearlo aparte, como travel.ts.
///
/// Tolerancia a erratas (roadmap 2026-07-19, bug real jugando): "orco redazagado" en vez de
/// "rezagado" hacía fallar la coincidencia exacta por completo — y en silencio, sin ningún aviso,
/// TODO el combate contra ese NPC (NpcState, loot, cierre de misión, reputación) se saltaba el
/// sistema determinista, aunque el modelo narrara la pelea con total normalidad. Si la coincidencia
/// exacta falla, se prueba también con distancia de edición ≤2 palabra a palabra, solo sobre
/// palabras de 5+ letras (evita falsos positivos en palabras cortas y comunes).
export function matchNpcAliases(text: string, npcs: NpcWithAliases[]): string[] {
  const normalized = normalizeText(text);
  const haystackWords = fuzzyMatchCandidates(normalized).filter((w) => !NPC_ALIAS_FUZZY_EXCLUSIONS.has(w));
  const matched: string[] = [];
  for (const npc of npcs) {
    const hit = npc.aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      if (normalizedAlias.length === 0) return false;
      if (matchesAliasBoundary(normalized, normalizedAlias)) return true;
      // Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida"): la
      // tolerancia a erratas comparaba cada palabra SUELTA de un alias multi-palabra por separado
      // — así que un alias como "el kort'ikar serhu" (Torgash) o "jefa del clan serhu" (Ulkha)
      // matcheaba con solo que el texto mencionara "Serhu" en CUALQUIER contexto (p.ej. Gistera Koh
      // presentándose como "una orca del Clan Serhu"), sin que el resto de la frase coincidiera en
      // nada — Torgash y Ulkha (en Campamento del Clan Serhu) aparecían "en escena" en una
      // ubicación distinta solo por compartir el nombre del clan. Restringida a aliases de UNA
      // sola palabra (el caso real que la tolerancia arregló originalmente: "redazagado" por
      // "rezagado" — ya cubierto también como alias suelto en el catálogo), nunca a una palabra
      // sacada de en medio de una frase más larga.
      if (normalizedAlias.includes(' ') || normalizedAlias.length < 5) return false;
      return fuzzyMatchesAnyStem(normalizedAlias, haystackWords);
    });
    if (hit) matched.push(npc.id);
  }
  return matched;
}

/// Ámbito de `NpcState` (roadmap 2026-07-20, bug real P0 — ver comentario del modelo en
/// schema.prisma): `PRINCIPAL` siempre usa el ámbito global ""; `PLANTILLA` usa la ubicación
/// actual como frontera de "esta aparición concreta", para no dejar el arquetipo entero marcado
/// como derrotado/saqueado para siempre tras la primera vez que se encuentra en cualquier sitio.
export function scopeFor(npcKind: NpcKind, currentLocationId: string | null): string {
  return npcKind === 'PRINCIPAL' ? '' : (currentLocationId ?? 'itinerante');
}

/// "¿queda algo por saquear/despiezar de este NPC AHORA MISMO?" (auditoría de deuda técnica
/// 2026-08-18) — único punto de verdad para un criterio que se repetía a mano, casi idéntico, en
/// `panels.ts` § saquear-zona, `recolectar.ts` § carcassCandidatesFor y `harvest.ts` §
/// yaDespiezada (con la polaridad invertida en este último). Caza en grupo (`groupSize` no nulo,
/// ver schema.prisma § NpcState.groupSize): `saqueado` no tiene sentido por individuo, el criterio
/// real es `corpsesLooted < groupDefeated` — aún quedan cadáveres reales del grupo sin saquear.
/// Encuentro solitario (`groupSize` null): `saqueado` a secas. `null`/`undefined` (nunca ha
/// existido fila de estado para este NPC) = nada que saquear todavía.
export function hasPendingLoot(
  state: { groupSize: number | null; groupDefeated: number; corpsesLooted: number; saqueado: boolean } | null | undefined,
): boolean {
  if (!state) return false;
  return state.groupSize ? state.corpsesLooted < state.groupDefeated : !state.saqueado;
}

// Despedida temporal genérica (2026-09-03, Pieza 5 — "Gistera sigue presente tras despedirse",
// distinto de `npcsRetiredForever`: eso es un giro de trama concreto y PERMANENTE hardcodeado solo
// a Gistera Koh aceptando la misión; esto cubre cualquier despedida narrativa normal de cualquier
// NPC, sin marcarlo como ausente para siempre). Verbos inequívocos de partida real, no cualquier
// "adiós" suelto en medio de una conversación que sigue en el mismo sitio — mismo criterio de
// "señal de sobra fuerte, sin enumerar cada preposición" que el resto de detectores de este archivo.
const FAREWELL_INTENT_REGEX = /me despido de|nos despedimos|me marcho|parto hacia|dejo atras/;

export function detectsFarewellIntent(text: string): boolean {
  return FAREWELL_INTENT_REGEX.test(normalizeText(text));
}

/// Filtra de `sessionFacts` cualquier hecho que combine el nombre/alias de un NPC candidato con una
/// despedida explícita (Pieza 5, 2026-09-03) — un hecho como "Me despido de Gistera Koh por ahora y
/// me dirijo hacia Los Restos de Maktor" contiene el nombre real, así que sin este filtro
/// `matchNpcAliases` la reintroduce como presente en la NUEVA ubicación turnos después. Se
/// conservan los `RECENCY_GUARANTEED`-equivalentes últimos hechos SIN filtrar (mismo criterio que
/// `worldFacts.ts` § `RECENCY_GUARANTEED`) — el propio turno de la despedida debe seguir viendo al
/// NPC en el haystack, para que el Narrador pueda cerrar la escena con naturalidad; solo deja de
/// contar como presente a partir del turno siguiente. Puro y testeable aparte, mismo estilo que
/// `matchNpcAliases`.
const FAREWELL_RECENCY_GUARANTEED = 1;

export function filterFarewellFacts(sessionFacts: string[], candidateNpcs: NpcWithAliases[]): string[] {
  if (candidateNpcs.length === 0) return sessionFacts;
  const guaranteed = new Set(sessionFacts.slice(sessionFacts.length - FAREWELL_RECENCY_GUARANTEED));
  return sessionFacts.filter((fact) => {
    if (guaranteed.has(fact)) return true;
    if (!detectsFarewellIntent(fact)) return true;
    return matchNpcAliases(fact, candidateNpcs).length === 0;
  });
}

/// Busca NPCs en escena a partir del texto de la acción Y de los hechos ya establecidos de la
/// sesión (para que un NPC mencionado en un turno anterior "el Kort'ikar Torgash llegó" siga
/// reconociéndose en turnos siguientes aunque el jugador ya no repita su nombre completo).
///
/// Bug real (revisión de partida en 5 fases, 2026-08-27, investigado/cerrado 2026-08-28): el
/// `haystack` de detección incluye TODOS los `sessionFacts` sin distinguir si dicen que el NPC
/// está presente o que se fue para siempre — un fact como "Gistera Koh se marchó... no volverá a
/// aparecer" CONTIENE el nombre "Gistera Koh", así que el matcher la reintroducía como candidata
/// legítima, camino 100% determinista (no una alucinación del LLM). El caso de Gistera Koh ya
/// tenía su propio parche hardcodeado por slug (`turnResolution.ts` § `gisteraSeHaMarchado` +
/// `.filter((n) => n.slug !== 'gistera-koh')`) — `Save.npcsRetiredForever` generaliza ese mismo
/// patrón para cualquier NPC futuro con guion que se despida "para siempre": el caller que decide
/// la despedida (hoy solo `gisteraSeHaMarchado`) añade el slug a esa lista, y aquí se filtra SIEMPRE,
/// sin tener que repetir un `.filter` a mano por cada NPC nuevo.
///
/// Acotar el candidato, no añadir IA (auditoría de arquitectura 2026-07-30 — replanteamiento tras
/// "llevamos días atascados"): antes se comparaba el texto contra TODO el roster de NPCs del
/// mundo, sin acotar por ubicación — causa raíz confirmada del falso positivo real "presas" (a
/// distancia Levenshtein 2 de "brasas") enganchando a un NPC que no pintaba nada en la escena
/// actual. `matchNpcAliases` (Levenshtein≤2 + substring) sigue igual de permisivo a propósito
/// (sigue haciendo falta para erratas reales), pero ahora solo se compara contra quienes de
/// verdad son un candidato plausible aquí — mismo criterio de acotar por región que ya usa
/// `selectDiscoveries` (discovery.ts) para fauna cosechable, extendido a NPCs:
export async function detectNpcsInScene(params: {
  action: string;
  worldId: string;
  sessionFacts: string[];
  saveId: string;
  currentLocationId: string | null;
  /// Fauna diurna/nocturna real (2026-09-02) — minuto de ficción del turno actual, para bloquear
  /// que una mención directa ("Nuente") haga aparecer en escena a una especie fuera de su
  /// `faunaMomentoDelDia` (worldCatalog.ts). Decisión explícita de la usuaria: SÍ bloquear también
  /// la mención directa, no solo la sugerencia ambiental de `turnResolution.ts` — más estricto que
  /// el diseño inicial planteado.
  fictionalMinutes: number;
}): Promise<NpcInScene[]> {
  const [npcs, currentLocation, activeQuestTargets, encounteredStates, saveRow] = await Promise.all([
    prisma.npc.findMany({
      where: { worldId: params.worldId },
      include: { items: { include: { item: true } } },
    }),
    params.currentLocationId
      ? prisma.location.findUnique({ where: { id: params.currentLocationId }, select: { slug: true, region: true } })
      : Promise.resolve(null),
    prisma.quest.findMany({
      where: { saveId: params.saveId, status: 'ACTIVA', targetNpcId: { not: null } },
      select: { targetNpcId: true },
    }),
    prisma.npcState.findMany({ where: { saveId: params.saveId }, select: { npcId: true } }),
    prisma.save.findUnique({ where: { id: params.saveId }, select: { npcsRetiredForever: true } }),
  ]);
  if (npcs.length === 0) return [];
  const retiredForeverSlugs = new Set(saveRow?.npcsRetiredForever ?? []);

  const questTargetIds = new Set(activeQuestTargets.map((q) => q.targetNpcId!));
  const encounteredIds = new Set(encounteredStates.map((s) => s.npcId));

  const homeSlugs = [...new Set(npcs.map((n) => n.homeLocationSlug).filter((s): s is string => !!s))];
  const homeLocations = homeSlugs.length
    ? await prisma.location.findMany({ where: { worldId: params.worldId, slug: { in: homeSlugs } }, select: { slug: true, region: true } })
    : [];
  const regionByHomeSlug = new Map(homeLocations.map((l) => [l.slug, l.region]));

  // Candidato plausible para ESTA escena: personajes únicos de trama (PRINCIPAL, pueden aparecer
  // en cualquier sitio por guion), el objetivo de una misión activa (esté donde esté el jugador),
  // cualquiera ya establecido antes en esta partida (tiene NpcState propio — no es un
  // "desconocido" nuevo), itinerantes sin `homeLocationSlug` (mismo criterio que el encuentro
  // ambiental, turnResolution.ts), o cuyo `homeLocationSlug` cae en la ubicación/región actual.
  // Sin ubicación resuelta este turno (p.ej. viajando), no se puede acotar — se deja sin filtrar
  // en vez de arriesgarse a perder a alguien real (mismo límite que ya documenta discovery.ts).
  //
  // `nucleoJugable` (auditoría 2026-08-14, bug real jugando en vivo: Sella Marn —Nabieus de una
  // región marcada "fuera del núcleo jugable actual"— apareció en combate real igualmente) — quest
  // activa y "ya establecido antes" se comprueban ANTES y siguen ganando siempre (si una misión de
  // verdad apunta a alguien, o ya se le conoció en esta partida, no tiene sentido hacerlo
  // desaparecer). Pero ni "es PRINCIPAL" ni "itinerante sin homeLocationSlug" (los dos casos de
  // Sella Marn a la vez) deben poder saltarse la marca de núcleo — antes sí podían.
  //
  // Fauna diurna/nocturna real (2026-09-02) — MISMA prioridad exacta que `nucleoJugable`: quest
  // activa/"ya establecido antes" (`questTargetIds`/`encounteredIds`) ganan siempre, comprobados
  // ANTES del filtro de hora, igual que ya ganan sobre `nucleoJugable === false`. El resto de
  // candidatos (sin quest ni NpcState propio) sí quedan bloqueados si tienen entrada en
  // `faunaMomentoDelDia` y no coincide con el momento del día real de este turno — un Nuente
  // mencionado de día no debe poder aparecer en escena.
  const momentoActual = momentoDelDiaFor(params.fictionalMinutes);
  const candidateNpcs = npcs.filter((npc) => {
    if (questTargetIds.has(npc.id)) return true;
    if (encounteredIds.has(npc.id)) return true;
    if (npc.nucleoJugable === false) return false;
    const momentoRequerido = faunaMomentoDelDia[npc.slug];
    if (momentoRequerido && momentoRequerido !== momentoActual) return false;
    if (npc.kind === 'PRINCIPAL') return true;
    if (npc.homeLocationSlug === null) return true;
    if (!currentLocation) return true;
    if (npc.homeLocationSlug === currentLocation.slug) return true;
    return regionByHomeSlug.get(npc.homeLocationSlug) === currentLocation.region;
  });
  if (candidateNpcs.length === 0) return [];

  const relevantFacts = filterFarewellFacts(params.sessionFacts, candidateNpcs);
  const haystack = [params.action, ...relevantFacts].join('\n');
  const matchedIds = new Set(matchNpcAliases(haystack, candidateNpcs));
  // `npcsRetiredForever` gana SIEMPRE sobre un match por nombre — un sessionFact que menciona al
  // NPC para decir que se fue para siempre no debe reintroducirlo (ver comentario de cabecera).
  const matchedNpcs = candidateNpcs.filter((npc) => matchedIds.has(npc.id) && !retiredForeverSlugs.has(npc.slug));
  if (matchedNpcs.length === 0) return [];

  // Sin filtrar por `scope` en la consulta (varía por NPC según su `kind`, no es un único valor
  // para todo el `in`) — el volumen de NPCs en escena es siempre pequeño, se filtra en memoria.
  const states = await prisma.npcState.findMany({
    where: { saveId: params.saveId, npcId: { in: matchedNpcs.map((n) => n.id) } },
  });
  const stateByKey = new Map(states.map((s) => [`${s.npcId}|${s.scope}`, s]));

  return matchedNpcs.map((npc) =>
    buildNpcInScene(npc, stateByKey.get(`${npc.id}|${scopeFor(npc.kind, params.currentLocationId)}`)),
  );
}

/// Grupo 3 § Mundo determinista, Capa 3, pieza B (docs/rpgtarkor/mundo-determinista.md, 2026-08-25)
/// — nombres de NPC "candidatos plausibles aquí" (mismo filtro geográfico que `detectNpcsInScene`
/// usa internamente: PRINCIPAL/quest activa/ya encontrado antes/itinerante/región coincidente)
/// pero EXCLUYENDO a quienes ya están autorizados en la escena de ESTE turno (`excludeIds`) —
/// pensado para que un guard de honestidad (`narrador.ts`) pueda comprobar si la narración libre
/// "hace aparecer" a alguien que ningún mecanismo determinista puso ahí. Consulta propia y ligera
/// (solo los campos que hacen falta), no reutiliza `detectNpcsInScene` para no tocar su contrato ya
/// probado — mismo criterio de filtro, duplicado a propósito en vez de compartido.
export async function candidateNpcNamesNotInScene(
  worldId: string,
  saveId: string,
  currentLocationId: string | null,
  excludeIds: Set<string>,
): Promise<string[]> {
  const [npcs, currentLocation, activeQuestTargets, encounteredStates] = await Promise.all([
    prisma.npc.findMany({
      where: { worldId },
      select: { id: true, name: true, kind: true, homeLocationSlug: true, nucleoJugable: true },
    }),
    currentLocationId ? prisma.location.findUnique({ where: { id: currentLocationId }, select: { slug: true, region: true } }) : Promise.resolve(null),
    prisma.quest.findMany({ where: { saveId, status: 'ACTIVA', targetNpcId: { not: null } }, select: { targetNpcId: true } }),
    prisma.npcState.findMany({ where: { saveId }, select: { npcId: true } }),
  ]);
  if (npcs.length === 0) return [];

  const questTargetIds = new Set(activeQuestTargets.map((q) => q.targetNpcId!));
  const encounteredIds = new Set(encounteredStates.map((s) => s.npcId));
  const homeSlugs = [...new Set(npcs.map((n) => n.homeLocationSlug).filter((s): s is string => !!s))];
  const homeLocations = homeSlugs.length
    ? await prisma.location.findMany({ where: { worldId, slug: { in: homeSlugs } }, select: { slug: true, region: true } })
    : [];
  const regionByHomeSlug = new Map(homeLocations.map((l) => [l.slug, l.region]));

  return npcs
    .filter((npc) => !excludeIds.has(npc.id))
    .filter((npc) => {
      if (questTargetIds.has(npc.id)) return true;
      if (encounteredIds.has(npc.id)) return true;
      if (npc.nucleoJugable === false) return false;
      if (npc.kind === 'PRINCIPAL') return true;
      if (npc.homeLocationSlug === null) return true;
      if (!currentLocation) return true;
      if (npc.homeLocationSlug === currentLocation.slug) return true;
      return regionByHomeSlug.get(npc.homeLocationSlug) === currentLocation.region;
    })
    .map((npc) => npc.name);
}

/// Escala de calibración de dificultad por diferencia de nivel (§ 2.2) — el backend calcula la
/// diferencia y le pasa al clasificador la frase ya masticada; el modelo conecta, no aritmetiza.
export function difficultyHintFor(npcLevel: number, playerLevel: number): { dificultad: number; label: string } {
  const diff = npcLevel - playerLevel;
  if (diff <= -2) return { dificultad: 12, label: 'Fácil (12)' };
  if (diff <= 1) return { dificultad: 15, label: 'Media (15)' };
  if (diff <= 4) return { dificultad: 18, label: 'Difícil (18)' };
  return { dificultad: 22, label: 'Muy difícil (22)' };
}

/// Escala de dificultad SOLO para habilidades de utilidad no reactivas (hallazgo 12,
/// revisar-partida-hallazgos.md 2026-09-06) — a diferencia de difficultyHintFor (nivel, usada en
/// ataque/defensa tabulado y como referencia de XP), esta compara la SUMA de los 7 atributos de
/// cada lado: lo que de verdad mide "cuánto le cuesta resistir/superar la acción" a un objetivo
/// concreto, no un proxy de nivel. Solo aplica cuando la utilidad NO responde a un ataque entrante
/// (ver isReactiveUtility/combatExchange.ts) — Analizar y cualquier utilidad usada sin ataque
/// entrante del rival caen aquí; Contraataque/Grito de Guerra/Instinto Salvaje respondiendo a un
/// golpe siguen con tirada-vs-tirada directa (resolveExchange), sin dificultad de por medio.
/// Umbrales de diferencia recalibrables jugando, igual que DECISIVE_MARGIN (combatExchange.ts) —
/// primer valor, no verificado en partidas largas todavía.
export function utilityDifficultyFor(objetivoAttrs: AttributeBlock, propiosAttrs: AttributeBlock): { dificultad: number; label: string } {
  const diff = sumAttributes(objetivoAttrs) - sumAttributes(propiosAttrs);
  if (diff <= -8) return { dificultad: 6, label: 'Fácil (6)' };
  if (diff <= 4) return { dificultad: 12, label: 'Media (12)' };
  if (diff <= 16) return { dificultad: 15, label: 'Difícil (15)' };
  return { dificultad: 18, label: 'Muy difícil (18)' };
}

/// Escala DISTINTA para el contraataque del NPC en combate (turnResolution.ts, roadmap 2026-07-19
/// "roadmap 2" — hallazgo de Fable: reutilizar difficultyHintFor aquí hacía que un jugador de
/// nivel bajo contra un NPC de nivel alto recibiera golpes ~90% de los turnos, con 4 escalones
/// hasta MUERTO — muerte casi garantizada en 4-5 turnos, mientras el NPC siempre muere igual de
/// rápido. Tope en "difícil" (nunca "muy difícil"): sigue siendo peligroso enfrentarse a un NPC
/// muy por encima de nivel, pero no una sentencia de muerte automática.
/// `defensa` (roadmap 2026-07-19, slot de defensa): suma de `effectiveDefense()` sobre el equipo
/// puesto — resta directamente de la dificultad, con suelo en 8 (nunca "trivial" deja de requerir
/// tirada del todo). Llevar armadura/escudo real hace más fácil esquivar/bloquear al NPC.
export function contraataqueDifficultyFor(npcLevel: number, playerLevel: number, defensa = 0): number {
  const diff = npcLevel - playerLevel;
  const base = diff <= -2 ? 8 : diff <= 1 ? 12 : diff <= 4 ? 15 : 18;
  return Math.max(8, base - defensa);
}

/// Negación cerca de una coincidencia (auditoría 2026-07-24, "revisa todo bien bien"): tras dos
/// rondas ampliando `HOSTILE_SEARCH_REGEX` hasta dejar "pelear"/"luchar"/"combatir" sueltos sin
/// exigir ninguna preposición detrás, "decido NO luchar por esto" o "prefiero no atacar" disparaban
/// igual la detección hostil — el jugador diciendo explícitamente que NO quiere pelear forzaba
/// combate de todos modos. Ventana corta (3 palabras) INMEDIATAMENTE antes de la coincidencia — la
/// construcción real casi siempre pega la negación justo al verbo ("no quiero luchar", "prefiero no
/// atacar"); una ventana más ancha arriesgaría apagar un ataque real por un "no" suelto de antes en
/// la misma frase, sin relación real con el verbo de intención.
const NEGATION_REGEX = /\b(no|nunca|jamas)\b/;

function isNegatedMatch(normalized: string, matchIndex: number): boolean {
  const before = normalized.slice(0, matchIndex).trim();
  const window = before.split(/\s+/).slice(-3).join(' ');
  return NEGATION_REGEX.test(window);
}

/// Verbo de ataque directo (roadmap 2026-07-19: "roadmap 2" de calibración de combate, y
/// reutilizado por la clasificación tabulada en turn.ts) — mismo regex que la red de seguridad de
/// `combateIniciado` en turnResolution.ts, vive aquí para no duplicarlo entre los dos módulos.
const ATTACK_INTENT_REGEX = /atac|cargo contra|golpe|asalt|hachazo|apunal|dispar|arremet|hiere|hiero/;

// Auditoría de typo-tolerance (roadmap 2026-07-19, P0.4 de Fable): mismo patrón que
// matchNpcAliases — solo los stems literales de 5+ letras entran en la tolerancia a erratas;
// "atac" (4) y la frase "cargo contra" se quedan con la coincidencia exacta del regex.
const ATTACK_INTENT_STEMS = ['asalt', 'golpe', 'hachazo', 'apunal', 'dispar', 'arremet', 'hiere', 'hiero', 'amputo','lacer','asesin','espadazo'];

// Auditoría 2026-07-29 (tras el bug real de "ataque"~"saque" en turnResolution.ts § LOOT_INTENT):
// "hierro" está a distancia 1-2 de "hiero"/"hiere" — un material/nombre de habilidad normal
// ("Puño de Hierro", armadura de hierro...) disparaba intención de ataque sin que el jugador
// atacara de verdad, en sitios donde detectsAttackIntent decide combate/hostilidad fuera de una
// habilidad ya resuelta (narrador.ts § hostileEngagement, turnResolution.ts sin NPC en escena).
const ATTACK_FUZZY_EXCLUSIONS = new Set(['hierro']);

export function detectsAttackIntent(action: string): boolean {
  const normalized = normalizeText(action);
  const match = normalized.match(ATTACK_INTENT_REGEX);
  // Bug real (auditoría 2026-07-24): la primera versión de este arreglo solo comprobaba negación
  // en la coincidencia EXACTA — "prefiero no golpear" caía igual en el `return true` de la
  // tolerancia a erratas de abajo (Levenshtein("golpear","golpe")=2), porque esa rama nunca sabía
  // que la palabra ya había salido negada. Si hay coincidencia exacta, decide ella sola (nunca cae
  // a la tolerancia a erratas por detrás) — evita el doble camino que dejaba un hueco.
  if (match && match.index !== undefined) return !isNegatedMatch(normalized, match.index);
  const words = fuzzyMatchCandidates(normalized).filter((w) => !ATTACK_FUZZY_EXCLUSIONS.has(w));
  return words.some((w) => {
    if (!fuzzyMatchesAnyStem(w, ATTACK_INTENT_STEMS)) return false;
    const wordIndex = normalized.indexOf(w);
    return wordIndex === -1 || !isNegatedMatch(normalized, wordIndex);
  });
}

/// Red de seguridad de `combateIniciado` reforzada (bug real jugando, 2026-07-22): "Busco a X en
/// busca de pelea" encuentra al NPC pero no dispara `detectsAttackIntent` (no hay verbo de ataque
/// literal, es una intención de enfrentamiento declarada mientras se BUSCA a alguien) — el modelo
/// tampoco marcó "combateIniciado" pese a narrar al NPC como hostil, así que el botón de Combatir
/// nunca salió. Distinto de `detectsAttackIntent` a propósito: ese vive también dentro del popup
/// de combate para decidir si UNA acción concreta cuenta como golpe; este solo se usa para decidir
/// si iniciar el combate, nunca dentro de él.
// Ampliado dos veces seguidas (bugs reales, 2026-07-23, "revisar partida"): primero "Busco
// combatir CONTRA el Orco Enfurecido" (sin verbo de ataque literal), luego "Entro en combate CON
// 'Orco enfurecido'" — la versión con "contra" no cubría "con". En vez de seguir enumerando
// preposición por preposición (la siguiente variante seguro que tampoco encaja), los verbos
// "combatir"/"combate"/"pelear"/"luchar" ya bastan por sí solos, sin exigir ninguna preposición
// concreta detrás — declarar intención de pelea con cualquiera de estas palabras es una señal
// de sobra fuerte, y la banda a la que afecta esto solo puede forzarse a instantánea (nunca
// abre combate por sí sola, eso lo decide `shouldForceCombat` en turnResolution.ts aparte).
// Bug real encontrado jugando en vivo (2026-07-24, "sigue con las pruebas"): "Acabaré con el que
// te persigue" (futuro, aceptando ayudar a Gistera Koh) se clasificó como banda "larga"/4320 min
// (3 días) para una simple frase hablada — `acabar con` (infinitivo) no matcheaba "acabare con"
// (normalizeText ya quita el acento de "acabaré", pero la "e" del futuro rompe la coincidencia
// literal exacta). Mismo patrón que el resto de esta sesión: no enumerar conjugación por
// conjugación, `acabar(?:e)? con` cubre infinitivo y futuro sin más casuística.
//
// `enfrent` en vez de `enfrentarse a` (bug real jugando en vivo, 2026-07-24): "Me enfrento a 'Orco
// enfurecido'" no matcheaba el infinitivo reflexivo exacto — mismo patrón exacto que el de arriba,
// solo que sin arreglar todavía para este verbo. Sin abrir combate, cayó en el clasificador
// general como banda "larga"/1440 min (24h) con atributo carisma, dejando al jugador "ocupado" en
// un CharacterTransit real en vez de luchar. Stem sin conjugar cubre enfrento/enfrenta/enfrentar/
// enfrentaré/enfrentarse por igual.
//
// `acabar(?:e)? con` SIN el listado de artículos que llevaba detrás (bug real jugando en vivo,
// 2026-07-28, "revisar partida" — misma familia exacta que el bug de "Acabaré con el que te
// persigue" de arriba, pero sin cubrir del todo): "Yo me encargaré de acabar con TU perseguidor"
// no matcheaba porque el listado (el|ella|es[et]|los|las) nunca incluyó posesivos ("tu"/"su"/"mi")
// ni nombres propios — cayó en el clasificador general como banda larga, dejó al jugador ~11 min
// reales "ocupado", y cuando el CharacterTransit se resolvió en diferido, el Narrador contradijo
// la propia promesa del jugador ("no es mi problema" tras comprometerse a acabar con el
// perseguidor). Mismo criterio que combatir/pelear/luchar/enfrent arriba: el verbo solo ya es
// señal de sobra fuerte, sin enumerar qué palabra puede seguirle — esto NUNCA abre combate por sí
// solo (eso lo decide `shouldForceCombat` en turnResolution.ts aparte), solo evita la banda larga.
//
// `\bcaz[oae]\b|cazando|\bcazar\b` (hallazgo real jugando en vivo, 2026-09-15, "caza fantasma"):
// "Intento cazar a Quio con sigilo" nunca disparaba ningún mecanismo determinista — ni
// `ATTACK_INTENT_REGEX` (sin verbo de ataque literal) ni este regex (sin "cazar" en absoluto) —
// así que el turno caía a narración libre, y el LLM narró una caza "consumada" (fauna herida/
// muerta, sangre) sin que el motor moviera `NpcState.condicionFisica`/generara ningún
// `HarvestYield` real: el narrador decidió un desenlace mecánico que el motor nunca ejecutó,
// justo el patrón que `harvest.ts` ya documenta como diseño ("el cazar en sí lo resuelve el
// combate — el despiece es solo lo posterior"). Con el verbo aquí, "cazar" abre combate real
// igual que "atacar", y es el motor de combate quien decide el desenlace. Boundary de palabra
// (`\b`) + conjugaciones cortas explícitas en vez de un stem suelto tipo `caz` — evita que
// "Cazadora Serhu"/"cazador" (sustantivo de nombre/clase, sin intención de atacar) disparen
// combate solo por compartir la raíz.
const HOSTILE_SEARCH_REGEX =
  /busca de pelea|busca de camorra|buscar pelea|buscando pelea|busca de guerra|en busca de sangre|para matar|acabar(?:e)? con|vengarse de|enfrent|combatir|combate\s+(?:contra|con)|pelear|luchar|\bcaz[oae]\b|cazando|\bcazar\b/;

export function detectsHostileSearchIntent(action: string): boolean {
  const normalized = normalizeText(action);
  const match = normalized.match(HOSTILE_SEARCH_REGEX);
  return !!match && match.index !== undefined && !isNegatedMatch(normalized, match.index);
}

// Movido desde turnResolution.ts, donde vivía como `ACEPTA_AYUDAR_GISTERA_REGEX` (sesión de diseño
// 2026-07-23) — generalizado (auditoría 2026-07-24, bug real jugando en vivo, decisión explícita
// de la usuaria: "aceptar ayudar solo crea la misión, nunca abre combate"). El problema real: una
// promesa verbal ("Cuenta conmigo. Acabaré con el que te persigue.") comparte vocabulario con
// `detectsHostileSearchIntent` ("acabar(e)? con") — necesario para que el clasificador la trate
// como instantánea (sigue siendo solo hablar), pero NUNCA debe abrir combate de verdad contra
// quien sea que esté en escena en ese momento (aliados, fauna de paso...) — aceptar no es atacar.
// `shouldForceCombat` (turnResolution.ts) y la tabulación de `turn.ts` comprueban esto para
// suprimir el combate/la tabulación específicamente cuando la señal hostil viene de una promesa,
// nunca de una declaración de intención inmediata real (esa sigue abriendo combate igual).
// `me encarg(?:o|are)` (bug real, "revisar partida" 2026-07-25): "me encargo" (presente) no
// matcheaba "me encargare" (futuro, tras quitar tilde de "encargaré") — mismo patrón exacto que
// ya se arregló arriba para "acabar(e)? con", pero se quedó sin aplicar aquí. Con esto, la misión
// determinista de turnResolution.ts sí se disparaba con "Yo me encargaré de tu perseguidor...".
// `me ocup(?:o|are)` (bug real, "revisar partida" 2026-07-30): "Yo me ocupo de él, no te
// preocupes" narró un combate completo y "ganado" sin que ningún intercambio mecánico real se
// hubiera resuelto — la promesa nunca abrió combate (correcto), pero SÍ se clasificó como banda
// "larga" (varios minutos reales de espera) porque ningún regex de aceptación verbal cubría el
// verbo "ocuparse de", solo "encargarse de"/"acabar con". Mismo patrón exacto, verbo distinto.
const VERBAL_ACCEPTANCE_REGEX =
  /me encarg(?:o|are)|me ocup(?:o|are)|acepto ayudar|te ayudo|cuenta conmigo|lo hare\b|acabare con|dalo por hecho|no te preocupes|de acuerdo/;

export function detectsVerbalAcceptanceIntent(action: string): boolean {
  return VERBAL_ACCEPTANCE_REGEX.test(normalizeText(action));
}

// Movido desde turnResolution.ts (refactor de deuda técnica 2026-08-13) — detectores puros
// `(action) => boolean` sin relación con narrar/persistir un turno, misma familia que el resto de
// `detectsXxx` de este archivo (loot/decapitar están conceptualmente ligados a un NPC en escena).
const LOOT_INTENT_REGEX = /registr|saque|desped|coj|robo|compr|qued/;

// Auditoría de typo-tolerance (roadmap 2026-07-19, P0.4 de Fable): mismo patrón que
// matchNpcAliases/detectsAttackIntent — solo los stems literales de 5+ letras entran en la
// tolerancia a erratas; "coj"/"robo"/"qued" (≤4 letras) se quedan solo con el regex exacto.
const LOOT_INTENT_STEMS = ['registr', 'saque', 'desped', 'compr'];

// Bug real (2026-07-29, jugando en vivo — "hice yo el daño al enemigo pero el daño lo recibí yo"):
// la tolerancia a erratas de abajo (distancia Levenshtein ≤2) confunde palabras normales y muy
// comunes con los stems de saqueo — "ataque"/"atacar"/"ataco" con "saque", "desde"/"después"/
// "despido" con "desped", "coger" con "compr". Cualquier turno de combate que usara alguna de
// estas (literal en varias habilidades de arma/raciales, ver weaponAbilities.ts/berigLore.ts, o
// simplemente frecuente en cualquier narración) se clasificaba como saqueo — eso fuerza
// `combateActivo` a false en turnResolution.ts: el intercambio real nunca se resolvía y el
// jugador podía acabar herido solo por la propuesta libre del narrador, sin ningún golpe mecánico
// real detrás. Reducir la tolerancia global a distancia 1 rompería el test ya existente de erratas
// reales ("saqeo" a distancia 2 de "saque") — se excluyen por nombre en vez de eso, mismo criterio
// que el resto de listas curadas del proyecto (nunca un regex/tolerancia genérica sin acotar).
// La familia "atac-" (atacar/ataque/ataco/atacando/atacas/atacamos/atacan...) se excluye por
// prefijo, ya que cubre muchas conjugaciones; el resto son colisiones sueltas sin prefijo común.
// "comer"/"comió" (2026-07-29, auditoría tras el bug de "ataque"): colisionan con "compr" —
// justo la palabra que usaría cualquier acción de comer un consumible para recuperar energía
// (energy.ts/itemReference.ts § detectEnergyItemUse), encontrada auditando el resto de listas de
// tolerancia a erratas del proyecto en busca de la misma clase de bug.
const LOOT_FUZZY_EXCLUSIONS = new Set(['desde', 'despues', 'despido', 'coger', 'cogido', 'comer', 'comio']);

export function detectsLootIntent(action: string): boolean {
  const normalized = normalizeText(action);
  if (LOOT_INTENT_REGEX.test(normalized)) return true;
  const words = fuzzyMatchCandidates(normalized).filter((w) => !/^ata/.test(w));
  return !!findFuzzyStemMatch(words, LOOT_INTENT_STEMS, LOOT_FUZZY_EXCLUSIONS);
}

// Revisar inventario/equipo (auditoría 2026-08-11, "pruebas por API" — ver hasFalseInventoryReview
// en narrador.ts). Sin tolerancia a erratas a propósito: una detección de menos aquí solo pierde
// el chequeo extra de esta acción concreta (sin coste real), mientras que sumar otra lista de
// stems de 5+ letras es exactamente la clase de riesgo de colisión que ya causó el bug real de
// "cazar"~"hagar" más arriba en este mismo archivo — no vale la pena para un detector de bajo
// riesgo como este.
const INVENTORY_REVIEW_INTENT_REGEX = /\brevis\w*\s+(mi|el|su|los?|las?)\s+(equipo|inventario|mochila|pertenencias|objetos)\b|\b(compruebo|comprueba|inspeccion\w*)\s+(mi|el|su|lo que)\s*(equipo|inventario|mochila|llevo|lleva)?\b|\bmiro (mi|el|su) (inventario|equipo|mochila)\b/;

export function detectsInventoryReviewIntent(action: string): boolean {
  return INVENTORY_REVIEW_INTENT_REGEX.test(normalizeText(action));
}

/// Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida"): una
/// pregunta directa a un NPC en escena ("Soy Gorhorn Maktor, quien eres y que buscas?") se
/// clasificó como banda "extendida"/60 min con tirada de Destreza — el clasificador la leyó como
/// "acción directa contra un personaje de nivel superior" en vez de como el saludo/pregunta que
/// era, dejando al jugador atascado en un CharacterTransit real esperando una respuesta que nunca
/// llegaba en el mismo turno. Las propias reglas del clasificador ya dicen que "hablar" es
/// instantáneo (fixedInstructions en narrador.ts) — esto es la red de seguridad determinista,
/// mismo patrón que ya usa `detectsAttackIntent` más arriba (turn.ts fuerza banda "instantanea" si
/// el clasificador se equivoca). Signos de interrogación/exclamación, comillas de diálogo directo,
/// o verbos de habla explícitos — cualquiera de los tres basta.
const DIALOGUE_INTENT_REGEX = /[?¿!¡]|["“”«»]|\bdigo\b|\bpregunt|\bcontest|\brespond|\bhablo\b|\bhablar\b|\bsusurr|\bgrito\b|\bgrita\b|\bsaludo\b|me presento/;

export function detectsDialogueIntent(action: string): boolean {
  return DIALOGUE_INTENT_REGEX.test(normalizeText(action));
}

/// Paleta de verbos + clasificación tabulada (roadmap de velocidad, 2026-07-19, prioridad 2): un
/// ataque dentro del popup de combate contra un NPC ya en escena no necesita gastar una llamada
/// entera al clasificador (25-50s) solo para que el modelo elija el mismo atributo de siempre —
/// heurística barata por palabra clave, igual de determinista que el resto del motor. 'fuerza' por
/// defecto porque Gorhorn es guerrero cuerpo a cuerpo (arma principal/secundaria); el jugador puede
/// forzar sigilo/destreza mencionándolo explícitamente en la acción.
export function tabulatedAttackAttribute(action: string): Attribute {
  const normalized = normalizeText(action);
  // Rediseño de atributos (2026-07-29): sigilo bajó a secundario — una emboscada/ataque furtivo
  // sigue siendo agilidad/reflejos aplicados con sigilo, no un atributo de tirada aparte.
  if (/sigilo|escond|sorpresa|emboscad|espalda|furtiv|esquiv|agilidad|flecha|arco|disparo/.test(normalized)) return 'destreza';
  return 'fuerza';
}

export interface AmbientEncounterCandidate {
  slug: string;
  name: string;
  role: string;
  /// Peso relativo de selección (docs/16-poblacion-dinamica.md, 2026-08-03: antes se elegía
  /// siempre uniforme entre TODA la fauna itinerante del mundo, sin mirar abundancia real ni
  /// región). Por defecto 1 — mismo comportamiento uniforme que antes si no se especifica.
  weight?: number;
}

/// Puro: elige un candidato de encuentro ambiental con probabilidad proporcional a `weight`
/// (checklist 2026-07-21/22, punto 3 — "más NPCs/fauna itinerante para encuentros casuales más
/// frecuentes"; ponderado por población real desde docs/16-poblacion-dinamica.md). Exportado sin
/// envolver en Math.random directamente en turnResolution.ts para poder testearlo con una función
/// de aleatoriedad inyectada, como el resto del proyecto.
export function pickAmbientEncounterCandidate(
  candidates: AmbientEncounterCandidate[],
  random: () => number = Math.random,
): AmbientEncounterCandidate | null {
  if (candidates.length === 0) return null;
  const totalWeight = candidates.reduce((sum, c) => sum + (c.weight ?? 1), 0);
  if (totalWeight <= 0) return null;
  let roll = random() * totalWeight;
  for (const candidate of candidates) {
    roll -= candidate.weight ?? 1;
    if (roll < 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

function itemsLine(items: NpcItemInScene[]): string {
  if (items.length === 0) return '(no lleva nada de interés)';
  // `notas` (personalización de ESTE NpcItem concreto) gana si existe; sin ella, cae a la
  // `description` real de catálogo en vez de dejar el nombre pelado (ver comentario del campo).
  return items
    .map((i) => (i.cantidad > 1 ? `${i.name} ×${i.cantidad}` : i.name) + ` (${i.notas ?? i.description})`)
    .join(', ');
}

/// Bloque "PERSONAJE EN ESCENA" (§ 2.5) para el prompt de narración — personalidad + equipo
/// cerrado. El clasificador recibe solo la línea de calibración (calibrationLineFor), más corta.
///
/// `bio` añadida (bug real jugando en vivo, 2026-07-24, "ha generado una descripción errónea"):
/// Múrgol apareció en escena narrado como "reconoce los rasgos familiares del Clan Maktor en él"
/// — invención completa, el propio catálogo dice que solo el Clan Serhu marca a sus múrgoles
/// (`bio`, nunca antes incluida aquí). Sin la descripción física/hechos ya establecidos de la
/// propia entidad, el modelo no tenía NADA con qué contrastar antes de improvisar un detalle —
/// mismo principio que el resto del motor: dale el hecho real en vez de esperar que no invente.
// Bug real (2026-07-25, "revisar partida"): esta función describía a CUALQUIER NPC detectado en
// escena como presente y con todo su equipo disponible, sin mirar nunca su condicionFisica/
// saqueado real — un NPC ya CONVALECIENTE/MUERTO/saqueado (el Orco Enfurecido, derrotado y
// registrado hace turnos) "emergía de la oscuridad" con un rugido en cuanto su nombre volvía a
// mencionarse, como si nunca hubiera caído. `detectNpcsInScene` ya consultaba el estado real —
// simplemente no llegaba a usarse aquí. Mismo patrón que la clase de fallo "NPCs que resucitan"
// ya documentada en docs/revisar-partida.md.
function npcYaResuelto(npc: NpcInScene): boolean {
  return npc.condicionFisica === 'CONVALECIENTE' || npc.condicionFisica === 'MUERTO' || npc.saqueado;
}

/// Refuerza el género/artículo correcto de un nombre descriptivo directamente en cómo se presenta
/// (2026-07-31, bug real jugando: "se gira hacia la orca enfurecida... el Orco Enfurecido salta
/// hacia él" — el modelo confundió el género del Orco Enfurecido con el de Gistera Koh, ambas
/// orcas en la misma escena, en el mismo párrafo). Reforzar el hecho correcto en el propio
/// contexto ("el Orco Enfurecido") es más seguro que corregir la prosa después con un reemplazo
/// de texto a ciegas, que podría corromper una mención legítima en femenino de OTRO NPC real
/// (Gistera Koh) presente en la misma escena.
function displayName(npc: NpcInScene): string {
  return npc.articulo ? `${npc.articulo} ${npc.name}` : npc.name;
}

/// Refuerzo explícito de género para NOMBRES PROPIOS (bug real jugando, 2026-07-30: Gistera Koh,
/// femenino ya explícito como primera palabra de su `bio`, narrada como "el orco" al referirse a
/// ella de forma genérica en vez de por su nombre) — `articulo`/`displayName` de arriba ya cubren
/// el caso de un NOMBRE que es en sí un rol/descripción ("Orco Enfurecido"); esto cubre el
/// contrario. Mismo espíritu que protectedFactsFor: una prohibición explícita ("nunca en
/// masculino") se respeta mejor en un 7B local que un hecho implícito dentro de un párrafo largo
/// de bio.
function generoHintFor(npc: NpcInScene): string {
  if (!npc.genero) return '';
  const [propio, opuesto] = npc.genero === 'F' ? ['femenino ("ella"/"la")', 'masculino ("él"/"el")'] : ['masculino ("él"/"el")', 'femenino ("ella"/"la")'];
  return ` GÉNERO DE ${npc.name.toUpperCase()}: ${propio} — si te refieres a ${npc.name} sin usar su nombre (p.ej. por su raza o rol), hazlo siempre en ${propio}, NUNCA en ${opuesto}, aunque su raza o rol suene distinto por defecto.`;
}

/// Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 1: el narrador conocía el
/// NOMBRE de la facción de un NPC pero nunca si el jugador es Aliado/Enemigo de ella en esta
/// partida — podía narrar una bienvenida calurosa donde el motor ya sabe que hay hostilidad
/// acumulada, o frialdad con una facción con la que ya se hicieron las paces). Reutiliza
/// `effectiveTemperamento` (reputation.ts, ya usado mecánicamente para decidir si el NPC fuerza
/// combate) — mismo cálculo, solo se traduce a texto en vez de quedarse solo en la decisión
/// mecánica. `factionsStatus` opcional (default `{}` = reputación neutra) para no romper los
/// llamadores de `distillationScenarios.ts` que no tienen este dato disponible.
function facRepHintFor(npc: NpcInScene, factionsStatus: Record<string, number>): string {
  if (!npc.faction) return '';
  const t = effectiveTemperamento(npc.temperamento, npc.faction, factionsStatus);
  if (t === npc.temperamento) return '';
  const desc: Record<Temperamento, string> = {
    AMIGABLE: 'con clara cordialidad — el jugador ya se ha ganado una buena relación con esta facción',
    INOFENSIVO: 'con cierta cordialidad — el trato con esta facción ha mejorado respecto a lo habitual',
    CAUTELOSO: 'con cautela neutra',
    AGRESIVO: 'con hostilidad evidente — el jugador ya ha dañado su relación con esta facción',
    ENEMIGO: 'con hostilidad abierta y desconfianza total — el jugador es visto como un enemigo declarado de esta facción',
  };
  return ` RELACIÓN CON ${npc.faction.toUpperCase()}: el jugador trata a ${npc.name} ${desc[t]} — refleja este trato en el tono de la escena, no lo narres neutro por defecto.`;
}

/// Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 3: `clase`/`especializacion`
/// ya viajaban hasta el objeto `NpcInScene` — usados mecánicamente para escalar atributos — pero
/// `npcSceneBlockFor`/`npcSceneLineFor` nunca los convertían a texto. El narrador podía narrar
/// tácticas incoherentes con la clase real, p.ej. un Hechicero cargando cuerpo a cuerpo).
function claseHintFor(npc: NpcInScene): string {
  if (!npc.clase) return '';
  const especializacionTxt = npc.especializacion ? `, especializado en ${npc.especializacion}` : '';
  return ` CLASE DE ${npc.name.toUpperCase()}: ${npc.clase}${especializacionTxt} — su forma de combatir/actuar debe encajar con esta identidad (estilo de arma, tácticas, actitud), no la narres genérica.`;
}

/// Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 4: los 5 `*Pct` ya
/// determinaban mecánicamente la tirada real de comerciar/reclutar/domesticar/cortejar/capturar
/// — companeros.ts/cazar.ts — pero el narrador no sabía nada de ellos. Ejemplo real del catálogo:
/// Torgash Ketg tiene `reclutablePct: 5` ("tan fácil de convencer como uno entre veinte") — sin
/// este hecho, el narrador podía narrar una negociación fluida justo antes de que la tirada real
/// fallara casi siempre, contradiciendo su propia prosa). Solo se anota cuando el porcentaje es
/// bajo — un valor alto no necesita advertencia, es el caso "normal" sin sorpresas.
const LOW_RECEPTIVITY_THRESHOLD = 20;
function receptividadHintFor(npc: NpcInScene): string {
  const bajos: string[] = [];
  if (npc.comerciablePct > 0 && npc.comerciablePct < LOW_RECEPTIVITY_THRESHOLD) bajos.push('comerciar');
  if (npc.reclutablePct > 0 && npc.reclutablePct < LOW_RECEPTIVITY_THRESHOLD) bajos.push('reclutarlo/a');
  if (npc.domesticablePct > 0 && npc.domesticablePct < LOW_RECEPTIVITY_THRESHOLD) bajos.push('domesticarlo/a');
  if (npc.cortejablePct > 0 && npc.cortejablePct < LOW_RECEPTIVITY_THRESHOLD) bajos.push('cortejarlo/a');
  if (npc.capturablePct > 0 && npc.capturablePct < LOW_RECEPTIVITY_THRESHOLD) bajos.push('capturarlo/a');
  if (bajos.length === 0) return '';
  return ` ${npc.name} es MUY POCO RECEPTIVO a intentar ${bajos.join('/')} — si la acción va en esa dirección, no narres el intento como si fuera a salir bien, deja la duda/dificultad real abierta hasta que la tirada lo decida.`;
}

/// Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 6: `activeEffects`
/// (AUMENTO/DEBILIDAD/CONTROL...) ya viajaban hasta el objeto pero nunca se traducían a texto —
/// el narrador podía narrar al NPC actuando con normalidad mientras mecánicamente estaba
/// potenciado/debilitado, chocando con el resultado numérico del intercambio que sigue).
function activeEffectsHintFor(npc: NpcInScene): string {
  if (npc.activeEffects.length === 0) return '';
  const desc = npc.activeEffects
    .map((e) => `${e.magnitude > 0 ? '+' : ''}${e.magnitude} ${e.attribute} por "${e.sourceAbility}" (${e.turnsRemaining} turnos restantes)`)
    .join(', ');
  return ` ESTADO ACTIVO DE ${npc.name.toUpperCase()}: ${desc} — refleja este estado en cómo actúa/se mueve este turno (más fuerte/débil de lo normal según corresponda), no lo narres como si estuviera en condición normal.`;
}

export function npcSceneBlockFor(npc: NpcInScene, playerLevel: number, factionsStatus: Record<string, number> = {}): string {
  if (npcYaResuelto(npc)) {
    const estado = npc.condicionFisica === 'MUERTO' ? 'muerto' : 'convaleciente';
    // Bug real jugando en vivo (2026-07-31): un cuerpo CONVALECIENTE/MUERTO todavía sin saquear
    // dejaba de listar su equipo aquí (correcto, para no describirlo como amenaza activa) — pero
    // eso significa que en el turno EXACTO de saquearlo, el Narrador no tenía ni idea de qué había
    // encima, e inventaba objetos que no existen ("monedas de cobre", material prohibido incluido)
    // mientras el inventario real recibía otros completamente distintos. Ya resuelto como amenaza,
    // pero su equipo real se sigue listando hasta que `saqueado` sea true.
    const loot = npc.saqueado
      ? ' y su cuerpo ya fue registrado (no lleva nada más encima, ya no hay botín que ofrecer)'
      : `, todavía sin registrar. Si esta acción es saquearlo/registrarlo, esto es TODO lo que lleva encima, no existe ningún otro objeto: ${itemsLine(npc.items)}`;
    return `PERSONAJE MENCIONADO, YA RESUELTO: ${displayName(npc)} — ${npc.role}${npc.faction ? `, ${npc.faction}` : ''}. Ya está ${estado}${loot}. NO lo narres como una amenaza activa: no ataca, no persigue, no "aparece de la nada" — si la escena lo menciona, es solo un cadáver ya visto, un recuerdo o una referencia al pasado, nunca un encuentro nuevo.${generoHintFor(npc)}`;
  }
  const { label } = difficultyHintFor(npc.level, playerLevel);
  // Bug real jugando en vivo (2026-08-15, "revisar partida" — el Zense Ceniza, fauna sin habla,
  // dio una réplica completa entre comillas y encima llamó "humano" al jugador): el bloque de
  // diálogo (`generateNpcReply`, más arriba en narrador.ts) ya evita esto para el camino de
  // conversación fuera de combate, pero en pleno combate el modelo narra libremente y nada le
  // impedía inventar diálogo para un animal. `ataqueNatural !== null` es el mismo marcador ya
  // usado en todo el proyecto para "esto es fauna, no un personaje sintiente" (ver
  // `carcassCandidatesFor`, recolectar.ts) — instrucción explícita en vez de confiar en que el
  // modelo lo infiera solo de la bio/personalidad.
  const faunaSinHablaHint = npc.ataqueNatural !== null ? ` ES UN ANIMAL, NO PUEDE HABLAR: nunca le pongas diálogo entre comillas ni palabras humanas — solo comportamiento animal (gruñidos, chillidos, gestos, movimientos).` : '';
  return `PERSONAJE EN ESCENA: ${displayName(npc)} — ${npc.role}${npc.faction ? `, ${npc.faction}` : ''}, nivel ${npc.level} (acciones directas contra él/ella tienden a ${label}).${generoHintFor(npc)}${faunaSinHablaHint}${facRepHintFor(npc, factionsStatus)}${claseHintFor(npc)}${receptividadHintFor(npc)}${activeEffectsHintFor(npc)}
Descripción/hechos ya establecidos (nunca los contradigas): ${npc.bio}
Personalidad: ${npc.personality}
LLEVA ENCIMA: ${itemsLine(npc.items)}. Si es derrotado, registrado o comercia, lo que lleva encima es TODO lo que puede aparecer — no existe ningún otro objeto.`;
}

/// Línea corta para el narrador (2026-08-28, tope de contexto — "cuelgue con modelo grande",
/// `contextBlocks` sin límite crecía sin tope con cada NPC en escena, 1104 tokens medidos para solo
/// 3 NPCs reales). Se usa para los NPCs que quedan FUERA del tope de bloque completo
/// (`npcSceneBlockFor`) — sin bio/personalidad/items, pero conservando las 3 señales de las que
/// dependen guards deterministas ya existentes: estado ya resuelto (`hasResurrectedDeadNpc`),
/// género (`generoHintFor`) y fauna-sin-habla (`faunaSinHablaHint`) — omitirlas reintroduciría esos
/// bugs para cualquier NPC que caiga en esta rama.
export function npcSceneLineFor(npc: NpcInScene, playerLevel: number): string {
  if (npcYaResuelto(npc)) {
    const estado = npc.condicionFisica === 'MUERTO' ? 'muerto' : 'convaleciente';
    return `PERSONAJE MENCIONADO, YA RESUELTO: ${displayName(npc)} — ya está ${estado}. NO lo narres como amenaza activa.${generoHintFor(npc)}`;
  }
  const { label } = difficultyHintFor(npc.level, playerLevel);
  const faunaSinHablaHint = npc.ataqueNatural !== null ? ` ES UN ANIMAL, NO PUEDE HABLAR.` : '';
  return `PERSONAJE EN ESCENA (de fondo): ${displayName(npc)} — ${npc.role}, nivel ${npc.level} (acciones directas tienden a ${label}).${generoHintFor(npc)}${faunaSinHablaHint}`;
}

/// Línea corta para el clasificador (§ 2.2) — solo la calibración de dificultad, sin equipo.
export function calibrationLineFor(npcs: NpcInScene[], playerLevel: number): string | null {
  if (npcs.length === 0) return null;
  return npcs
    .map((npc) => {
      const { label } = difficultyHintFor(npc.level, playerLevel);
      return `Hay un personaje en escena, ${displayName(npc)} (nivel ${npc.level}) — las acciones directas contra él/ella tienden a ${label}.`;
    })
    .join(' ');
}
