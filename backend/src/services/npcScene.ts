import { prisma } from '../lib/prisma.js';
import { normalizeText, levenshtein } from './travel.js';
import type { NpcKind, CondicionFisica } from '@prisma/client';
import type { Attribute } from './dice.js';

/// Detección determinista de "NPC en escena" (docs/12-mundo-estructurado.md § 2.5) — sin llamada
/// extra a Ollama: se busca Npc.aliases (normalizados) en el texto de la acción y en los hechos
/// de la sesión. Los números y el equipo del NPC SIEMPRE llegan por esta vía, nunca los inventa
/// el modelo (§ 2.1).

export interface NpcItemInScene {
  name: string;
  cantidad: number;
  notas: string | null;
  /// Bonificador de equipo (2026-07-19) — se copia al InventoryItem real si se saquea (ver
  /// turnResolution.ts), para que un hacha robada siga dando su bonificador al equiparla.
  statBonusAttribute: string | null;
  statBonusAmount: number | null;
  /// Slug de ItemCatalog (sesión de diseño 2026-07-23) — se copia al InventoryItem.catalogSlug
  /// real si se saquea, para poder mirar sus requisitos de equipar (ver requisitos.ts).
  catalogSlug: string;
}

export interface NpcInScene {
  id: string;
  slug: string;
  name: string;
  kind: NpcKind;
  level: number;
  role: string;
  faction: string | null;
  personality: string;
  bio: string;
  items: NpcItemInScene[];
  /// Estado persistido POR PARTIDA (NpcState, roadmap 2026-07-19 "roadmap 3") — antes cada
  /// escena leía siempre el Npc estático, así que "Torgash resucita" cada vez que aparece.
  /// ILESO/false si todavía no existe fila (nunca se ha enfrentado a este NPC en esta partida).
  condicionFisica: CondicionFisica;
  saqueado: boolean;
}

interface NpcWithAliases {
  id: string;
  aliases: string[];
}

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
  const haystackWords = normalized.split(/\s+/).filter((w) => w.length >= 5);
  const matched: string[] = [];
  for (const npc of npcs) {
    const hit = npc.aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      if (normalizedAlias.length === 0) return false;
      if (normalized.includes(normalizedAlias)) return true;
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
      return haystackWords.some((hw) => levenshtein(hw, normalizedAlias) <= 2);
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

/// Busca NPCs en escena a partir del texto de la acción Y de los hechos ya establecidos de la
/// sesión (para que un NPC mencionado en un turno anterior "el Kort'ikar Torgash llegó" siga
/// reconociéndose en turnos siguientes aunque el jugador ya no repita su nombre completo).
export async function detectNpcsInScene(params: {
  action: string;
  worldId: string;
  sessionFacts: string[];
  saveId: string;
  currentLocationId: string | null;
}): Promise<NpcInScene[]> {
  const npcs = await prisma.npc.findMany({
    where: { worldId: params.worldId },
    include: { items: { include: { item: true } } },
  });
  if (npcs.length === 0) return [];

  const haystack = [params.action, ...params.sessionFacts].join('\n');
  const matchedIds = new Set(matchNpcAliases(haystack, npcs));
  const matchedNpcs = npcs.filter((npc) => matchedIds.has(npc.id));
  if (matchedNpcs.length === 0) return [];

  // Sin filtrar por `scope` en la consulta (varía por NPC según su `kind`, no es un único valor
  // para todo el `in`) — el volumen de NPCs en escena es siempre pequeño, se filtra en memoria.
  const states = await prisma.npcState.findMany({
    where: { saveId: params.saveId, npcId: { in: matchedNpcs.map((n) => n.id) } },
  });
  const stateByKey = new Map(states.map((s) => [`${s.npcId}|${s.scope}`, s]));

  return matchedNpcs.map((npc) => {
    const state = stateByKey.get(`${npc.id}|${scopeFor(npc.kind, params.currentLocationId)}`);
    return {
      id: npc.id,
      slug: npc.slug,
      name: npc.name,
      kind: npc.kind,
      level: npc.level,
      role: npc.role,
      faction: npc.faction,
      personality: npc.personality,
      bio: npc.bio,
      items: npc.items.map((i) => ({
        name: i.item.name,
        cantidad: i.cantidad,
        notas: i.notas,
        statBonusAttribute: i.item.statBonusAttribute,
        statBonusAmount: i.item.statBonusAmount,
        catalogSlug: i.item.slug,
      })),
      condicionFisica: state?.condicionFisica ?? 'ILESO',
      saqueado: state?.saqueado ?? false,
    };
  });
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
const ATTACK_INTENT_STEMS = ['asalt', 'golpe', 'hachazo', 'apunal', 'dispar', 'arremet', 'hiere', 'hiero'];

export function detectsAttackIntent(action: string): boolean {
  const normalized = normalizeText(action);
  const match = normalized.match(ATTACK_INTENT_REGEX);
  // Bug real (auditoría 2026-07-24): la primera versión de este arreglo solo comprobaba negación
  // en la coincidencia EXACTA — "prefiero no golpear" caía igual en el `return true` de la
  // tolerancia a erratas de abajo (Levenshtein("golpear","golpe")=2), porque esa rama nunca sabía
  // que la palabra ya había salido negada. Si hay coincidencia exacta, decide ella sola (nunca cae
  // a la tolerancia a erratas por detrás) — evita el doble camino que dejaba un hueco.
  if (match && match.index !== undefined) return !isNegatedMatch(normalized, match.index);
  const words = normalized.split(/\s+/).filter((w) => w.length >= 5);
  return ATTACK_INTENT_STEMS.some((stem) =>
    words.some((w) => {
      if (levenshtein(w, stem) > 2) return false;
      const wordIndex = normalized.indexOf(w);
      return wordIndex === -1 || !isNegatedMatch(normalized, wordIndex);
    }),
  );
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
const HOSTILE_SEARCH_REGEX =
  /busca de pelea|busca de camorra|buscar pelea|buscando pelea|busca de guerra|en busca de sangre|para matar|acabar(?:e)? con (?:el|ella|es[et]|los|las)|vengarse de|enfrentarse a|combatir|combate\s+(?:contra|con)|pelear|luchar/;

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
const VERBAL_ACCEPTANCE_REGEX =
  /me encargo|acepto ayudar|te ayudo|cuenta conmigo|lo hare\b|acabare con|dalo por hecho|no te preocupes|de acuerdo/;

export function detectsVerbalAcceptanceIntent(action: string): boolean {
  return VERBAL_ACCEPTANCE_REGEX.test(normalizeText(action));
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
  if (/sigilo|escond|sorpresa|emboscad|espalda|furtiv/.test(normalized)) return 'sigilo';
  if (/esquiv|agilidad|flecha|arco|disparo/.test(normalized)) return 'destreza';
  return 'fuerza';
}

export interface AmbientEncounterCandidate {
  slug: string;
  name: string;
  role: string;
}

/// Puro: elige al azar un candidato de encuentro ambiental de entre los itinerantes disponibles
/// (checklist 2026-07-21/22, punto 3 — "más NPCs/fauna itinerante para encuentros casuales más
/// frecuentes"). Exportado sin envolver en Math.random directamente en turnResolution.ts para
/// poder testearlo con una función de aleatoriedad inyectada, como el resto del proyecto.
export function pickAmbientEncounterCandidate(
  candidates: AmbientEncounterCandidate[],
  random: () => number = Math.random,
): AmbientEncounterCandidate | null {
  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)];
}

function itemsLine(items: NpcItemInScene[]): string {
  if (items.length === 0) return '(no lleva nada de interés)';
  return items.map((i) => (i.cantidad > 1 ? `${i.name} ×${i.cantidad}` : i.name) + (i.notas ? ` (${i.notas})` : '')).join(', ');
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
export function npcSceneBlockFor(npc: NpcInScene, playerLevel: number): string {
  const { label } = difficultyHintFor(npc.level, playerLevel);
  return `PERSONAJE EN ESCENA: ${npc.name} — ${npc.role}${npc.faction ? `, ${npc.faction}` : ''}, nivel ${npc.level} (acciones directas contra él/ella tienden a ${label}).
Descripción/hechos ya establecidos (nunca los contradigas): ${npc.bio}
Personalidad: ${npc.personality}
LLEVA ENCIMA: ${itemsLine(npc.items)}. Si es derrotado, registrado o comercia, lo que lleva encima es TODO lo que puede aparecer — no existe ningún otro objeto.`;
}

/// Línea corta para el clasificador (§ 2.2) — solo la calibración de dificultad, sin equipo.
export function calibrationLineFor(npcs: NpcInScene[], playerLevel: number): string | null {
  if (npcs.length === 0) return null;
  return npcs
    .map((npc) => {
      const { label } = difficultyHintFor(npc.level, playerLevel);
      return `Hay un personaje en escena, ${npc.name} (nivel ${npc.level}) — las acciones directas contra él/ella tienden a ${label}.`;
    })
    .join(' ');
}
