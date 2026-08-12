/// Validador de "grounding" de la acción del JUGADOR contra el estado real de la partida — lado
/// simétrico de la familia de detectores "narración-vs-mecánica" (narrador.ts), que ya protege al
/// Narrador de inventar NPCs/objetos/viajes. Ver docs/18-validacion-accion-jugador.md para el
/// diseño completo por fases; este archivo implementa la Fase 0 (mecanismo) + el primer chequeo
/// de la Fase 1 (arma que no llevas). Regla de diseño fija: nunca una lista de entidades quemada
/// en el código — solo lo que ya trae la propia partida (equipo real, NPCs en escena...), para
/// que crecer el catálogo del mundo no obligue nunca a tocar este archivo.
///
/// Se llama al principio de `POST /turn/classify` (turn.ts), ANTES de la primera llamada a IA
/// (`classifyAction`, narrador.ts) — si detecta una violación, el turno se resuelve aquí mismo con
/// una frase determinista en la voz de Gorhorn, sin gastar ni un segundo de generación.
import { normalizeText } from './travel.js';
import { matchNpcAliases, detectsAttackIntent, detectsDialogueIntent, detectsHostileSearchIntent } from './npcScene.js';
import { ANACHRONISM_REGEX } from './narrador.js';
import { matchHarvestSource, matchesVerbForMetodo } from './harvest.js';
import { stripRegionArticle } from './population.js';
import { harvestSourceRegion } from '../scripts/worldCatalog.js';
import { CONSTRUCTION_RECIPES } from './construction.js';
import { prisma } from '../lib/prisma.js';

/// Anacronismo en el propio texto del JUGADOR ("me monto en mi nave espacial") — reutiliza
/// `ANACHRONISM_REGEX` (narrador.ts), la misma fuente de verdad que ya protege la salida del
/// Narrador, en vez de mantener una segunda lista de términos prohibidos que desincronizarse de
/// ella. A diferencia del chequeo de arma, no exige ningún verbo: mencionar pólvora/electricidad/
/// tecnología moderna en un mundo medieval-fantástico es ya la violación en sí, no hace falta que
/// el jugador reclame usarla de verdad.
export function detectsPlayerAnachronism(action: string): boolean {
  return ANACHRONISM_REGEX.test(action);
}

/// Mismo criterio que el resto — pool de 5, 1 cómica menos frecuente. Borrador de la sesión de
/// diseño (docs/18-validacion-accion-jugador.md § "Borrador de frases").
const ANACHRONISM_LINES: string[] = [
  'Gorhorn frunce el ceño ante su propia idea, como si tratara de masticar algo que no existe. No hay ningún camino a lo que describe, ni en Helek Sirik ni en ningún sitio que él conozca.',
  'Gorhorn se detiene en seco. Sea lo que sea eso, no tiene nombre en ninguna lengua que hable un orco — y él ya ha viajado bastante como para saberlo.',
  'El pensamiento se disuelve antes de convertirse en acción, como humo que no encuentra madera que quemar. Gorhorn ni siquiera sabría por dónde empezar.',
  'Gorhorn sacude la cabeza, casi con lástima por sí mismo. Lo que acaba de pensar no tiene sitio en este mundo, y una parte de él lo sabe antes de intentarlo.',
  'Gorhorn se palpa la cabeza, extrañado. «Será el calor, será el viento, será que llevo ya demasiado tiempo hablando solo con cadáveres... porque juraría que acabo de pensar en algo que no existe.» Sacude la cabeza y vuelve a lo suyo.',
];

export function anachronismNarrationFor(): string {
  return ANACHRONISM_LINES[Math.floor(Math.random() * ANACHRONISM_LINES.length)];
}

/// Sustantivos de categoría de arma en español coloquial (mismo enum `WeaponCategory` de Prisma:
/// HACHA/MAZA/GARROTE/PICA/LANZA/CUCHILLO/DAGA/ESPADA/ESCUDO) — vocabulario cerrado a propósito,
/// no una lista de nombres de objetos concretos del catálogo (esos sí crecerán con el lore; las
/// categorías de arma son un conjunto fijo del propio sistema de reglas, no de contenido).
const WEAPON_CATEGORY_NOUNS: Record<string, RegExp> = {
  hacha: /\bhachas?\b/,
  maza: /\bmazas?\b/,
  garrote: /\bgarrotes?\b/,
  pica: /\bpicas?\b/,
  lanza: /\blanzas?\b/,
  cuchillo: /\bcuchillos?\b/,
  daga: /\bdagas?\b/,
  espada: /\bespadas?\b/,
  escudo: /\bescudos?\b/,
};

/// Sustantivo + verbo de uso/ataque en la MISMA frase (mismo criterio que `hasFalseItemUse`,
/// narrador.ts) — una mención suelta sin verbo de acción ("recuerdo mi vieja espada") es un
/// recuerdo/referencia legítima, no una reclamación de uso ahora mismo, y no debe disparar. Sin
/// "lanz*" a propósito: colisiona con el propio sustantivo "lanza" (arma) — más vale un falso
/// negativo raro ("Lanzo mi lanza" sin nada más) que arriesgarse a bloquear una acción legítima
/// del jugador por error (bloquear pesa más que reintentar, a diferencia de los detectores de
/// salida del narrador).
const WEAPON_WIELD_VERB_REGEX = /\b(atac\w*|golpe\w*|descarg\w*|blandi\w*|empun\w*|us[oa]\w*|clav\w*|cort\w*|asest\w*|hier[oe]\w*|rebana\w*)\b/i;

export interface UnequippedWeaponClaim {
  /// Sustantivo de categoría reclamado por el jugador ("lanza") — para elegir la frase de vuelta.
  claimedNoun: string;
}

/// Detecta si la acción del jugador reclama usar un arma de una categoría que no lleva equipada
/// ahora mismo ("uso mi lanza" con una maza equipada). Solo dispara si el jugador lleva AL MENOS
/// un arma puesta — sin ninguna equipada, reclamar cualquier arma es un caso distinto (ir
/// desarmado), fuera de alcance de este chequeo concreto.
export function detectsUnequippedWeaponClaim(action: string, equippedWeaponNames: string[]): UnequippedWeaponClaim | null {
  if (equippedWeaponNames.length === 0) return null;
  const normalizedEquipped = equippedWeaponNames.map(normalizeText);
  const sentences = action.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const normalizedSentence = normalizeText(sentence);
    if (!WEAPON_WIELD_VERB_REGEX.test(normalizedSentence)) continue;
    for (const [noun, regex] of Object.entries(WEAPON_CATEGORY_NOUNS)) {
      if (!regex.test(normalizedSentence)) continue;
      const isEquipped = normalizedEquipped.some((name) => name.includes(noun));
      if (!isEquipped) return { claimedNoun: noun };
    }
  }
  return null;
}

/// Pool de respuestas en la voz de Gorhorn (borrador de la sesión de diseño, docs/18) — épico con
/// 1 variante cómica (la última, deliberadamente menos frecuente: ver `wrongWeaponNarrationFor`).
/// Selección aleatoria simple para esta primera versión — anti-repetición consecutiva estricta
/// (mismo patrón que `isTooSimilarToLast`) queda como refinamiento futuro, no bloqueante: el pool
/// tiene 5 frases y este chequeo dispara raramente, el riesgo de repetición consecutiva es bajo.
const WRONG_WEAPON_LINES: ((armaReal: string) => string)[] = [
  (armaReal) => `Gorhorn baja la vista a sus manos. Lo que empuña de verdad es ${armaReal}, no lo que acaba de nombrar. Actúa con lo que de verdad lleva encima.`,
  (armaReal) => `Un instante de confusión le cruza el rostro: no lleva lo que acaba de decir. ${armaReal}, eso es lo que tiene, y con eso golpea.`,
  (armaReal) => `Gorhorn nota el peso equivocado en la mente antes que en la mano — lo que lleva de verdad es ${armaReal}.`,
  () => `El arma que Gorhorn describe no es la que pesa en su mano ahora mismo. Se corrige él solo antes de moverse.`,
  (armaReal) => `Gorhorn mira su mano, luego otra vez, como si el arma fuera a cambiar de opinión. «¿Qué arma? Llevo ${armaReal} desde esta mañana, orco de piedra que soy...» Menea la cabeza y sigue con lo que de verdad tiene.`,
];

export function wrongWeaponNarrationFor(armaReal: string): string {
  const line = WRONG_WEAPON_LINES[Math.floor(Math.random() * WRONG_WEAPON_LINES.length)];
  return line(armaReal);
}

export interface AbsentSceneNpcClaim {
  /// Nombre real de catálogo del NPC/fauna reclamado ("Torgash") — para la frase de vuelta.
  name: string;
}

/// Detecta si la acción del jugador interactúa con un NPC/fauna REAL de catálogo (existe de
/// verdad en algún sitio del mundo) que no está en la lista de NPCs realmente en escena este
/// turno (`detectNpcsInScene`, npcScene.ts) — "existe pero no está aquí" (Fase 1 de
/// docs/18-validacion-accion-jugador.md; el caso "no existe en ningún sitio" es Fase 3, aparcado
/// a propósito por la dificultad de distinguir mención/recuerdo de afirmación de presencia).
///
/// Reutiliza `matchNpcAliases` (mismo motor de coincidencia — boundary + tolerancia a erratas —
/// que ya usa `detectNpcsInScene`) contra el catálogo COMPLETO del mundo, no solo los candidatos
/// de esta escena, para no mantener ninguna lista propia que desincronizarse del catálogo real.
/// Solo dispara con intención real de interacción (mismos detectores que ya usa `turn.ts` para
/// decidir diálogo/ataque/búsqueda hostil) — una mención de pasada sin intención de interactuar
/// no es una reclamación de presencia.
export async function detectsAbsentSceneNpcClaim(action: string, worldId: string, npcsInSceneSlugs: string[]): Promise<AbsentSceneNpcClaim | null> {
  if (!detectsAttackIntent(action) && !detectsDialogueIntent(action) && !detectsHostileSearchIntent(action)) return null;
  const allNpcs = await prisma.npc.findMany({ where: { worldId }, select: { slug: true, name: true, aliases: true } });
  const matchable = allNpcs.map((n) => ({ id: n.slug, aliases: [n.name, ...n.aliases] }));
  const matchedSlugs = new Set(matchNpcAliases(action, matchable));
  const absent = allNpcs.find((n) => matchedSlugs.has(n.slug) && !npcsInSceneSlugs.includes(n.slug));
  return absent ? { name: absent.name } : null;
}

/// Mismo criterio que `WRONG_WEAPON_LINES` — pool de 5, 1 cómica menos frecuente.
const ABSENT_NPC_LINES: ((nombre: string) => string)[] = [
  (nombre) => `Gorhorn mira alrededor, extrañado. No hay ni rastro de ${nombre} por aquí — quienquiera que sea, no está en este lugar.`,
  (nombre) => `El nombre de ${nombre} se queda flotando en el aire, sin nadie a quien dirigirlo. Aquí no hay nadie así.`,
  () => `Gorhorn se detiene, buscando con la mirada a alguien que no está. Sea quien sea, no se encuentra en este lugar ahora mismo.`,
  (nombre) => `No hay ningún ${nombre} al que dirigirse aquí — Gorhorn lo comprueba con la mirada antes de actuar en vano.`,
  (nombre) => `Gorhorn frunce el ceño. «¿${nombre}? Aquí no hay nadie con ese nombre, que yo vea...» Baja la guardia, un poco confuso.`,
];

export function absentSceneNpcNarrationFor(nombre: string): string {
  const line = ABSENT_NPC_LINES[Math.floor(Math.random() * ABSENT_NPC_LINES.length)];
  return line(nombre);
}

export interface WrongRegionHarvestClaim {
  /// Nombre de la fuente reclamada, tal como la nombró el jugador (se usa el propio texto de
  /// `matchHarvestSource`, que no expone un nombre "bonito" — se resuelve en turn.ts si hace
  /// falta un nombre más presentable).
  sourceSlug: string;
}

/// Fase 2 de docs/18-validacion-accion-jugador.md: detecta si el jugador reclama recolectar/
/// talar/minar/despiezar una fuente REAL de catálogo (`harvestSourceAliases`,
/// worldCatalog.ts) cuya región conocida (`harvestSourceRegion`) NO coincide con la región
/// actual — reutiliza `matchHarvestSource` (harvest.ts), el mismo matcher que ya usa el flujo
/// real de recolección, así que nunca se desincroniza de cómo el resto del motor interpreta este
/// texto. Solo dispara con verbo real de recolección (`matchesVerbForMetodo` contra los 4
/// métodos) en la MISMA acción — mismo criterio de "verbo + entidad" que el resto de esta
/// familia. Sin datos suficientes (fuente sin región conocida, o ubicación actual desconocida a
/// media transición), no dispara — más vale dejar pasar que bloquear con dudas.
export function detectsWrongRegionHarvestClaim(action: string, currentRegion: string | null): WrongRegionHarvestClaim | null {
  if (!currentRegion) return null;
  const hasHarvestVerb = (['CAZA', 'TALA', 'MINERIA', 'EXTRACCION'] as const).some((metodo) => matchesVerbForMetodo(action, metodo));
  if (!hasHarvestVerb) return null;
  const sourceSlug = matchHarvestSource(action);
  if (!sourceSlug) return null;
  const sourceRegion = harvestSourceRegion[sourceSlug];
  if (!sourceRegion) return null;
  if (stripRegionArticle(sourceRegion) === stripRegionArticle(currentRegion)) return null;
  return { sourceSlug };
}

/// Mismo criterio que el resto — pool de 5, 1 cómica menos frecuente. `nombre` ya viene resuelto
/// (turn.ts, `harvestSourceDescriptions`/nombre de catálogo) a un nombre presentable.
const WRONG_REGION_HARVEST_LINES: ((nombre: string) => string)[] = [
  (nombre) => `Gorhorn busca con la mirada, pero no hay ni rastro de ${nombre} por aquí — no es cosa de esta tierra.`,
  (nombre) => `Nada de ${nombre} crece ni se encuentra en estos parajes. Gorhorn lo sabe con solo mirar alrededor.`,
  () => `Gorhorn se agacha a mirar el suelo, pero no encuentra lo que buscaba — no es nada que se dé en esta tierra.`,
  (nombre) => `${nombre} no tiene sitio aquí — Gorhorn ha recorrido bastante mundo como para reconocer lo que falta.`,
  (nombre) => `Gorhorn rebusca un momento, luego se rinde. «¿${nombre}? Aquí no, desde luego...» Sacude la cabeza y sigue camino.`,
];

export function wrongRegionHarvestNarrationFor(nombre: string): string {
  const line = WRONG_REGION_HARVEST_LINES[Math.floor(Math.random() * WRONG_REGION_HARVEST_LINES.length)];
  return line(nombre);
}

/// Verbo de construcción para ESTE chequeo — deliberadamente MÁS ESTRECHO que el `BUILD_VERB_REGEX`
/// interno de construction.ts (que incluye "mejor"/"ampl"/"mont[ao]"). Ahí la ambigüedad no importa
/// porque siempre se combina con el sustantivo de una receta YA conocida; aquí la ausencia de
/// receta conocida es la propia señal de violación, así que un verbo tan genérico como "mejorar"
/// (ampliamente usado para cosas que no son construir, "mejoro mi puntería") dispararía en falso
/// constantemente. Solo los verbos inequívocos de "construir algo desde cero".
const STRICT_BUILD_VERB_REGEX = /\b(constru|levant|erig)\w*\b/i;

/// Fase 2 de docs/18-validacion-accion-jugador.md: detecta si el jugador reclama construir un
/// tipo de edificio que no coincide con ninguna receta real (`CONSTRUCTION_RECIPES`,
/// construction.ts) — "construyo una Torre de Cristal" cuando solo existen campamento/choza/
/// ayuntamiento. Reutiliza el `nounRegex` de cada receta real, nunca una lista propia.
export function detectsUnknownConstructionClaim(action: string): boolean {
  const normalized = normalizeText(action);
  if (!STRICT_BUILD_VERB_REGEX.test(normalized)) return false;
  return !CONSTRUCTION_RECIPES.some((recipe) => recipe.nounRegex.test(normalized));
}

/// Mismo criterio que el resto — pool de 5, 1 cómica menos frecuente.
const UNKNOWN_CONSTRUCTION_LINES: string[] = [
  'Gorhorn se detiene a pensarlo mejor. No sabría ni por dónde empezar a levantar algo así — no es nada que conozca.',
  'La idea se desvanece antes de convertirse en un plan real. Gorhorn no tiene ni la más remota idea de cómo se construye algo así.',
  'Gorhorn mira alrededor, buscando algo con lo que empezar, pero no encuentra ni la forma de plantearlo.',
  'No es una construcción que Gorhorn sepa levantar — ni con todo el tiempo y los materiales del mundo.',
  'Gorhorn se rasca la nuca. «¿Eso? Ni idea de cómo se hace algo así, la verdad...» Se ríe entre dientes y lo deja estar.',
];

export function unknownConstructionNarrationFor(): string {
  return UNKNOWN_CONSTRUCTION_LINES[Math.floor(Math.random() * UNKNOWN_CONSTRUCTION_LINES.length)];
}
