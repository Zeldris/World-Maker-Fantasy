/// Validador de "grounding" de la acción del JUGADOR contra el estado real de la partida — lado
/// simétrico de la familia de detectores "narración-vs-mecánica" (narrador.ts), que ya protege al
/// Narrador de inventar NPCs/objetos/viajes. Ver docs/mecanicas/18-validacion-accion-jugador.md para el
/// diseño completo por fases; este archivo implementa las Fases 0-3 (Fase 3 acotada a nombre
/// citado entre comillas, para no arriesgar falsos positivos sobre prosa libre). Regla de diseño
/// fija: nunca una lista de entidades quemada en el código — solo lo que ya trae la propia
/// partida (equipo real, NPCs en escena...) o el catálogo real del mundo, para que crecer el
/// catálogo no obligue nunca a tocar este archivo.
///
/// Se llama al principio de `POST /turn/classify` (turn.ts), ANTES de la primera llamada a IA
/// (`classifyAction`, narrador.ts) — si detecta una violación, el turno se resuelve aquí mismo con
/// una frase determinista en la voz de Gorhorn, sin gastar ni un segundo de generación.
import { normalizeText, detectsTravelIntent, detectsVagueMovementIntent, matchDestination } from './travel.js';
import { matchNpcAliases, detectsAttackIntent, detectsDialogueIntent, detectsHostileSearchIntent, candidateNpcNamesNotInScene } from './npcScene.js';
import { detectsSearchIntent } from './discovery.js';
import { ANACHRONISM_REGEX } from './narrador.js';
import { matchHarvestSource, matchesVerbForMetodo, matchesAnyHarvestVerb } from './harvest.js';
import { harvestAbilityForMetodo } from './harvestAbilities.js';
import { stripRegionArticle } from './population.js';
import { harvestSourceRegion, harvestSourceAliases } from '../scripts/worldCatalog.js';
import { CONSTRUCTION_RECIPES } from './construction.js';
import { prisma } from '../lib/prisma.js';

/// Elección aleatoria simple (auditoría de deuda técnica 2026-08-21): el mismo `Math.floor(Math.random()
/// * lines.length)]` se repetía en las 7 funciones `xxxNarrationFor` de este archivo, una por pool
/// de líneas. Centralizado en un solo helper genérico — el criterio de selección (uniforme, sin
/// anti-repetición consecutiva) sigue siendo el mismo documentado en `WRONG_WEAPON_LINES`.
function pickRandomLine<T>(lines: T[]): T {
  return lines[Math.floor(Math.random() * lines.length)];
}

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
/// diseño (docs/mecanicas/18-validacion-accion-jugador.md § "Borrador de frases").
const ANACHRONISM_LINES: string[] = [
  'Gorhorn frunce el ceño ante su propia idea, como si tratara de masticar algo que no existe. No hay ningún camino a lo que describe, ni en Helek Sirik ni en ningún sitio que él conozca.',
  'Gorhorn se detiene en seco. Sea lo que sea eso, no tiene nombre en ninguna lengua que hable un orco — y él ya ha viajado bastante como para saberlo.',
  'El pensamiento se disuelve antes de convertirse en acción, como humo que no encuentra madera que quemar. Gorhorn ni siquiera sabría por dónde empezar.',
  'Gorhorn sacude la cabeza, casi con lástima por sí mismo. Lo que acaba de pensar no tiene sitio en este mundo, y una parte de él lo sabe antes de intentarlo.',
  'Gorhorn se palpa la cabeza, extrañado. «Será el calor, será el viento, será que llevo ya demasiado tiempo hablando solo con cadáveres... porque juraría que acabo de pensar en algo que no existe.» Sacude la cabeza y vuelve a lo suyo.',
];

export function anachronismNarrationFor(): string {
  return pickRandomLine(ANACHRONISM_LINES);
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
  const line = pickRandomLine(WRONG_WEAPON_LINES);
  return line(armaReal);
}

export interface AbsentSceneNpcClaim {
  /// Nombre real de catálogo del NPC/fauna reclamado ("Torgash") — para la frase de vuelta.
  name: string;
}

/// Detecta si la acción del jugador interactúa con un NPC/fauna REAL de catálogo (existe de
/// verdad en algún sitio del mundo) que no está en la lista de NPCs realmente en escena este
/// turno (`detectNpcsInScene`, npcScene.ts) — "existe pero no está aquí" (Fase 1 de
/// docs/mecanicas/18-validacion-accion-jugador.md; el caso "no existe en ningún sitio" es Fase 3, aparcado
/// a propósito por la dificultad de distinguir mención/recuerdo de afirmación de presencia).
///
/// Reutiliza `matchNpcAliases` (mismo motor de coincidencia — boundary + tolerancia a erratas —
/// que ya usa `detectNpcsInScene`) contra el catálogo COMPLETO del mundo, no solo los candidatos
/// de esta escena, para no mantener ninguna lista propia que desincronizarse del catálogo real.
/// Solo dispara con intención real de interacción (mismos detectores que ya usa `turn.ts` para
/// decidir diálogo/ataque/búsqueda hostil) — una mención de pasada sin intención de interactuar
/// no es una reclamación de presencia.
/// Mismo vocabulario EXACTO que la inyección determinista del perseguidor de Gistera Koh en
/// `turnResolution.ts` (bloque junto a `PURSUER_REFERENCE_REGEX`/`PURSUER_NAME_REFERENCE_REGEX`) —
/// exportadas aquí para que ambos puntos del pipeline compartan una sola fuente de verdad del
/// vocabulario, en vez de dos copias de los mismos regex que podrían desincronizarse.
export const PURSUER_REFERENCE_REGEX = /pers[ei]g\w*|pisa(?:n)? los talones/i;
export const PURSUER_NAME_REFERENCE_REGEX = /orco\s+enfurecido/i;

/// Bug real jugando en vivo (2026-09-07, "Ataco al 'Orco enfurecido' que persigue a 'Gistera
/// Koh'." rechazado con "No hay ningún Gistera Koh al que dirigirse aquí"): el validador de
/// `turn.ts` corre ANTES que la inyección determinista del perseguidor en `turnResolution.ts` —
/// construye su propia lista de "quién está en escena" (`detectNpcsInScene`) sin conocer esa
/// inyección ad-hoc, así que el Orco Enfurecido (el objetivo REAL del ataque) nunca contaba como
/// presente para el validador, aunque sí lo estuviera un instante después en la fase de
/// narración. El propio Orco no citaba ningún alias de catálogo salvo su nombre exacto, así que el
/// guard "existe pero no está aquí" nunca disparaba sobre él — pero el SEGUNDO nombre citado en la
/// misma frase (Gistera Koh, mencionada solo como contexto: "que persigue a Y") sí, y `.find()`
/// (más abajo) devolvía ese antes, bloqueando el turno entero con un mensaje que no menciona en
/// absoluto al objetivo real. Misma consulta (`prisma.quest.findFirst({ title: { contains: 'Orco
/// Enfurecido' } } })`) y mismo criterio `status === 'ACTIVA'` que `gisteraQuestYaExiste` en
/// turnResolution.ts — este validador corre antes en el pipeline y no tiene acceso a esa variable
/// ya cargada, así que paga su propia consulta (barata, sin narración de por medio).
export async function isPursuerOrcoInScene(action: string, saveId: string): Promise<boolean> {
  if (!PURSUER_REFERENCE_REGEX.test(action) && !PURSUER_NAME_REFERENCE_REGEX.test(action)) return false;
  if (!detectsSearchIntent(action) && !detectsAttackIntent(action) && !detectsHostileSearchIntent(action)) return false;
  const gisteraQuest = await prisma.quest.findFirst({ where: { saveId, title: { contains: 'Orco Enfurecido' } } });
  return gisteraQuest?.status === 'ACTIVA';
}

/// Primer nombre citado entre comillas simples ("Ataco al 'X' que hace algo a 'Y'.") — mismo
/// patrón/regex que ya usa `resolverObjetivoPorTexto` (combateMultiple.ts) para decidir a quién
/// apunta de verdad un ataque citado entre varios candidatos: la convención del resto del motor es
/// que el PRIMER nombre citado tras el verbo de intención es el objetivo real de la frase — el
/// resto de nombres citados (cláusulas subordinadas: "que persigue a...", "que viene de...") son
/// contexto, no el destinatario de la acción.
const QUOTED_NAME_MATCH_REGEX = /'([^']+)'/;

export async function detectsAbsentSceneNpcClaim(action: string, worldId: string, saveId: string, npcsInSceneSlugs: string[]): Promise<AbsentSceneNpcClaim | null> {
  if (!detectsAttackIntent(action) && !detectsDialogueIntent(action) && !detectsHostileSearchIntent(action)) return null;
  const allNpcs = await prisma.npc.findMany({ where: { worldId }, select: { slug: true, name: true, aliases: true } });
  const matchable = allNpcs.map((n) => ({ id: n.slug, aliases: [n.name, ...n.aliases] }));
  const matchedSlugs = new Set(matchNpcAliases(action, matchable));
  const effectiveSceneSlugs = (await isPursuerOrcoInScene(action, saveId))
    ? [...npcsInSceneSlugs, 'orco-enfurecido-hondonada']
    : npcsInSceneSlugs;
  // Bug real jugando en vivo (2026-09-07, ver comentario largo de `isPursuerOrcoInScene`): con
  // MÁS de un nombre citado en la misma frase, si el PRIMERO (el objetivo real de la acción) sí
  // está disponible, el turno no debe bloquearse solo porque un nombre secundario (mención de
  // contexto en una cláusula subordinada) esté ausente — el jugador nunca pretendió dirigirse a
  // ese segundo nombre.
  const quotedMatch = action.match(QUOTED_NAME_MATCH_REGEX);
  if (quotedMatch) {
    const quotedNpc = allNpcs.find((n) => matchNpcAliases(`'${quotedMatch[1]}'`, [{ id: n.slug, aliases: [n.name, ...n.aliases] }]).includes(n.slug));
    if (quotedNpc && effectiveSceneSlugs.includes(quotedNpc.slug)) return null;
  }
  const absent = allNpcs.find((n) => matchedSlugs.has(n.slug) && !effectiveSceneSlugs.includes(n.slug));
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
  const line = pickRandomLine(ABSENT_NPC_LINES);
  return line(nombre);
}

/// Verbo/preposición de diálogo DIRIGIDO a una persona concreta — más estrecho a propósito que
/// `DIALOGUE_INTENT_REGEX` (npcScene.ts), que dispara con cualquier "?"/"!"/comillas sueltas y
/// serviría de poco aquí (demasiado amplio). También más estrecho que un primer intento con "me
/// acerco a"/"me dirijo a"/"miro a(cia)" — esas formas son ambiguas con un LUGAR ("me acerco a la
/// cueva", "me dirijo a la aldea"), no solo con una persona, y hubieran bloqueado turnos de
/// movimiento normal por error. Solo verbos de habla en sí, que no tienen lectura de movimiento.
const DIALOGUE_TARGET_REGEX = /\bhablo con\b|\bhablar con\b|\bpregunto a\b|\ble pregunto\b/i;

/// Hallazgo real jugando en vivo (2026-09-15): con Gistera Koh (ya conocida, mencionada varias
/// veces en el log) presente en escena, dirigirse a ella por DESCRIPCIÓN libre ("la mujer orca del
/// Clan Serhu") en vez de su nombre propio no matchea ningún alias real (`matchNpcAliases` solo
/// compara contra `npc.aliases`, curados a mano, nunca contra descripciones genéricas) — el turno
/// caía a narración libre sin ningún guard, y el LLM improvisaba a quién responde: una vez
/// confundiéndola con "Bulco de Arena" (un ItemCatalog de comida, sin relación), otra citando un
/// NPC real del catálogo pero de otra escena por completo ("Sella Marn", ya protegido de aparecer
/// como candidato de escena por `nucleoJugable === false` en `detectNpcsInScene` — el motor nunca
/// lo resolvió como presente, pero el LLM lo conocía igual por su propio entrenamiento y lo citó).
///
/// Mismo patrón que el resto de esta familia: si hay al menos un NPC real CANDIDATO en esta escena/
/// región (mismo filtro que `detectNpcsInScene` usa internamente, expuesto vía
/// `candidateNpcNamesNotInScene` con `excludeIds` vacío — así "candidatos" incluye a TODOS los
/// plausibles, ya autorizados o no) y el jugador claramente dirige la acción hacia "alguien"
/// (`DIALOGUE_TARGET_REGEX`) sin que `detectNpcsInScene` haya resuelto a NADIE (`npcsInSceneSlugs`
/// vacío pese a haber candidatos), el motor bloquea ANTES de narrar en vez de dejar que el LLM
/// decida a quién responde. Deliberadamente NO se amplía `matchNpcAliases` con descripciones
/// genéricas (raza/clan/rol) — historial real del proyecto (`NPC_ALIAS_FUZZY_EXCLUSIONS`,
/// npcScene.ts) ya documenta que una palabra de clan/facción suelta ("Serhu") confunde a varios NPC
/// del mismo clan entre sí (Torgash/Ulkha con Gistera) — más barato y seguro pedirle al jugador que
/// use el nombre ya revelado que arriesgar ese mismo bug de nuevo con una lista curada a mano.
export async function detectsUnresolvedDialogueTargetClaim(
  action: string,
  npcsInSceneSlugs: string[],
  worldId: string,
  saveId: string,
  currentLocationId: string | null,
): Promise<boolean> {
  if (npcsInSceneSlugs.length > 0) return false;
  if (!DIALOGUE_TARGET_REGEX.test(action)) return false;
  const candidateNames = await candidateNpcNamesNotInScene(worldId, saveId, currentLocationId, new Set());
  return candidateNames.length > 0;
}

/// Mismo criterio que `ABSENT_NPC_LINES` — pool de 5, sin nombre concreto (a diferencia de esa
/// familia, aquí no hay ningún nombre real que citar: el jugador nunca llegó a nombrar a nadie).
const UNRESOLVED_DIALOGUE_TARGET_LINES: string[] = [
  'Gorhorn no tiene claro a quién se dirige exactamente. «¿A quién te refieres?», pregunta, esperando un nombre.',
  'Gorhorn duda un instante — hay más de una posibilidad aquí. Necesita saber a quién se refiere con claridad.',
  'No queda claro con quién quiere hablar Gorhorn. Se detiene, esperando que quede más claro a quién se dirige.',
  'Gorhorn frunce el ceño. La descripción no basta para saber a quién se dirige — necesita un nombre.',
  'Gorhorn mira alrededor, sin saber bien a quién dirigirse. «¿Quién, exactamente?», pregunta en voz alta.',
];

export function unresolvedDialogueTargetNarrationFor(): string {
  return pickRandomLine(UNRESOLVED_DIALOGUE_TARGET_LINES);
}

export interface FabricatedNpcClaim {
  /// Nombre citado por el jugador tal cual, entre comillas.
  quotedName: string;
}

/// Nombre citado entre comillas simples ("ataco a 'el Dragón de Fuego Eterno'") — mismo patrón
/// que ya usa `itemReference.ts`/`turnResolution.ts` para objetivo explícito de combate.
const QUOTED_NAME_REGEX = /'([^']+)'/;

/// Por debajo de esto no dispara — evita falsos positivos con comillas triviales ("digo 'hola'"),
/// mismo criterio que `MIN_PATTERN_LENGTH` del índice de Enciclopedia del frontend.
const MIN_QUOTED_NAME_LENGTH = 3;

/// Fase 3 de docs/mecanicas/18-validacion-accion-jugador.md, ACOTADA a nombre entre comillas (decisión de
/// diseño explícita, 2026-08-13, para acotar el riesgo de falso positivo que el propio documento
/// señala como el obstáculo principal de esta fase): detecta si el jugador nombra ENTRE COMILLAS
/// un NPC/fauna que no existe en NINGÚN sitio del catálogo del mundo — a diferencia de
/// `detectsAbsentSceneNpcClaim` (existe de verdad, pero no en esta escena), aquí no existe en
/// absoluto. Texto libre SIN comillas queda fuera a propósito: "ataco al Dragón de Fuego Eterno"
/// sin comillas no dispara — prosa descriptiva legítima que solo SUENA a nombre propio no debe
/// bloquearse; las comillas son la señal deliberada de "esto es un nombre concreto", el mismo
/// criterio que ya usa el resto del motor para elegir un objetivo explícito de combate.
///
/// `detectsDialogueIntent` EXCLUIDA a propósito de este trigger (bug real jugando en vivo,
/// 2026-08-20: "Me acerco a ella y digo: 'Quien eres y a donde vas con tanta prisa?'" bloqueó el
/// turno entero con "El nombre de Quien eres y a donde vas con tanta prisa? no le suena a nada" —
/// las comillas ahí no nombran a nadie, son la réplica hablada del propio jugador, la MISMA
/// convención que usa el resto del motor para diálogo ("Escribe tu réplica entre comillas"). A
/// diferencia de un objetivo de ataque/búsqueda hostil (donde citar un nombre entre comillas es
/// casi siempre "esto es lo que ataco/busco"), en una acción de diálogo el contenido entre comillas
/// es casi siempre la frase completa que el jugador dice, nunca el nombre de a quién se la dice —
/// no hay forma fiable de distinguir "cito el nombre de un NPC inventado" de "cito mis propias
/// palabras" solo con esta señal, así que se prefiere el falso negativo (dejar pasar un NPC
/// inventado nombrado en diálogo) al falso positivo (bloquear cualquier diálogo normal con
/// comillas) — mismo criterio ya usado en el resto de esta familia de detectores ("más vale dejar
/// pasar que bloquear con dudas", ver `detectsWrongRegionHarvestClaim`).
export async function detectsFabricatedNpcClaim(action: string, worldId: string): Promise<FabricatedNpcClaim | null> {
  const quotedMatch = action.match(QUOTED_NAME_REGEX);
  if (!quotedMatch) return null;
  const quotedName = quotedMatch[1].trim();
  if (quotedName.length < MIN_QUOTED_NAME_LENGTH) return null;
  if (!detectsAttackIntent(action) && !detectsHostileSearchIntent(action)) return null;
  const allNpcs = await prisma.npc.findMany({ where: { worldId }, select: { slug: true, name: true, aliases: true } });
  const matchable = allNpcs.map((n) => ({ id: n.slug, aliases: [n.name, ...n.aliases] }));
  const matched = matchNpcAliases(quotedName, matchable);
  return matched.length === 0 ? { quotedName } : null;
}

/// Mismo criterio que el resto — pool de 5, 1 cómica menos frecuente. A diferencia de
/// `ABSENT_NPC_LINES`, insiste en "no existe" en vez de "no está aquí".
const FABRICATED_NPC_LINES: ((nombre: string) => string)[] = [
  (nombre) => `Gorhorn repite el nombre para sus adentros, buscándole algún eco real. No conoce a nadie llamado ${nombre}, ni ha oído hablar de tal cosa en ninguna tierra que haya pisado.`,
  (nombre) => `El nombre de ${nombre} no le suena a nada — ni persona, ni bestia, ni nada que camine sobre Helek Sirik que Gorhorn sepa.`,
  (nombre) => `Gorhorn frunce el ceño. ${nombre} no es nadie que él conozca, ni siquiera de oídas — y él ha oído hablar de más de una leyenda dudosa.`,
  () => `No hay nadie así en este mundo que Gorhorn sepa, ni entre los vivos ni en las historias que se cuentan junto al fuego.`,
  (nombre) => `Gorhorn se rasca la barbilla. «¿${nombre}? Suena a nombre inventado por un borracho de taberna...» Sacude la cabeza y sigue con lo suyo.`,
];

export function fabricatedNpcNarrationFor(nombre: string): string {
  const line = pickRandomLine(FABRICATED_NPC_LINES);
  return line(nombre);
}

export interface WrongRegionHarvestClaim {
  /// Nombre de la fuente reclamada, tal como la nombró el jugador (se usa el propio texto de
  /// `matchHarvestSource`, que no expone un nombre "bonito" — se resuelve en turn.ts si hace
  /// falta un nombre más presentable).
  sourceSlug: string;
}

/// Fase 2 de docs/mecanicas/18-validacion-accion-jugador.md: detecta si el jugador reclama recolectar/
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
  const line = pickRandomLine(WRONG_REGION_HARVEST_LINES);
  return line(nombre);
}

export interface FabricatedHarvestSourceClaim {
  /// Nombre citado por el jugador tal cual, entre comillas.
  quotedName: string;
}

/// Fase 3 de docs/mecanicas/18-validacion-accion-jugador.md, ACOTADA a nombre entre comillas — mismo
/// criterio y misma razón que `detectsFabricatedNpcClaim`. A diferencia de
/// `detectsWrongRegionHarvestClaim` (existe de verdad, pero en otra región), aquí la fuente citada
/// no existe en absoluto en `harvestSourceAliases` (worldCatalog.ts). Puro, sin BD (mismo criterio
/// que `matchHarvestSource`, del que reutiliza el matcher tal cual sobre el nombre citado).
export function detectsFabricatedHarvestSourceClaim(action: string): FabricatedHarvestSourceClaim | null {
  const quotedMatch = action.match(QUOTED_NAME_REGEX);
  if (!quotedMatch) return null;
  const quotedName = quotedMatch[1].trim();
  if (quotedName.length < MIN_QUOTED_NAME_LENGTH) return null;
  const hasHarvestVerb = (['CAZA', 'TALA', 'MINERIA', 'EXTRACCION'] as const).some((metodo) => matchesVerbForMetodo(action, metodo));
  if (!hasHarvestVerb) return null;
  return matchHarvestSource(quotedName) === undefined ? { quotedName } : null;
}

/// Mismo criterio que el resto — pool de 5, 1 cómica menos frecuente. A diferencia de
/// `WRONG_REGION_HARVEST_LINES`, insiste en "no existe" en vez de "no crece aquí".
const FABRICATED_HARVEST_SOURCE_LINES: ((nombre: string) => string)[] = [
  (nombre) => `Gorhorn no tiene ni idea de qué es ${nombre} — ni lo ha visto, ni lo ha oído nombrar en ningún sitio de Helek Sirik.`,
  (nombre) => `El nombre no le dice nada a Gorhorn. Sea lo que sea ${nombre}, no es nada que sepa reconocer, y mucho menos recolectar.`,
  (nombre) => `Gorhorn busca en su memoria y no encuentra nada parecido a ${nombre} — ni planta, ni mineral, ni nada que pueda arrancarse de la tierra.`,
  () => `No existe tal cosa, que Gorhorn sepa — ni en estas tierras ni en ninguna otra que haya recorrido.`,
  (nombre) => `Gorhorn se rasca la cabeza. «¿${nombre}? A saber qué es eso... suena inventado.» Se encoge de hombros y sigue a lo suyo.`,
];

export function fabricatedHarvestSourceNarrationFor(nombre: string): string {
  const line = pickRandomLine(FABRICATED_HARVEST_SOURCE_LINES);
  return line(nombre);
}

/// Verbo de construcción para ESTE chequeo — deliberadamente MÁS ESTRECHO que el `BUILD_VERB_REGEX`
/// interno de construction.ts (que incluye "mejor"/"ampl"/"mont[ao]"). Ahí la ambigüedad no importa
/// porque siempre se combina con el sustantivo de una receta YA conocida; aquí la ausencia de
/// receta conocida es la propia señal de violación, así que un verbo tan genérico como "mejorar"
/// (ampliamente usado para cosas que no son construir, "mejoro mi puntería") dispararía en falso
/// constantemente. Solo los verbos inequívocos de "construir algo desde cero".
const STRICT_BUILD_VERB_REGEX = /\b(constru|levant|erig)\w*\b/i;

/// Fase 2 de docs/mecanicas/18-validacion-accion-jugador.md: detecta si el jugador reclama construir un
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
  return pickRandomLine(UNKNOWN_CONSTRUCTION_LINES);
}

/// "Mundo determinista, el narrador solo narra" (petición explícita de la usuaria, 2026-09-03,
/// Pieza 6): antes, cuando el texto libre mencionaba verbo+sustantivo de una receta real de
/// crafteo/construcción pero el precheck determinista (`detectDeterministicCraft`/
/// `planDeterministicBuild`) fallaba por falta de materiales/ubicación/nivel de oficio, el turno
/// caía al narrador libre, que podía inventar un objeto/edificio fabricado nunca persistido — el
/// caso 2 del principio ("no se puede lanzar la acción determinista") se quedaba sin mensaje
/// determinista propio, a diferencia de `UNKNOWN_CONSTRUCTION_LINES` (que solo cubre "esa receta
/// no existe en absoluto", no "existe pero no se puede ahora mismo"). Mismo criterio que el resto
/// del archivo — pool de 5, 1 cómica menos frecuente, sin revelar el motivo técnico exacto (no
/// hace falta que Gorhorn sepa que le falta tal material concreto, ya lo sabe el jugador mirando
/// su inventario/las Habilidades > Profesiones).
const DETERMINISTIC_ACTION_UNAVAILABLE_LINES: string[] = [
  'Gorhorn lo intenta, pero algo no encaja — no tiene lo necesario para conseguirlo aquí, ahora mismo.',
  'Sus manos se detienen a medio camino. Le falta algo para poder hacerlo de verdad, y lo sabe sin necesidad de intentarlo más.',
  'Gorhorn evalúa lo que tiene a mano y sacude la cabeza — así no va a poder ser, no todavía.',
  'No es el momento ni el lugar para eso. Gorhorn lo deja para más adelante, cuando reúna lo que le falta.',
  'Gorhorn se rasca la cabeza. «Buena idea, pero me falta de todo para hacerlo ahora mismo...» Se encoge de hombros y sigue a lo suyo.',
];

export function deterministicActionUnavailableNarrationFor(): string {
  return pickRandomLine(DETERMINISTIC_ACTION_UNAVAILABLE_LINES);
}

/// Verbos de atadura/inmovilización (hallazgo real jugando en vivo, 2026-09-15: "Intento capturar
/// al Orco Enfurecido convaleciente, atándolo" se narró con éxito — "le ata las muñecas con un
/// trozo de cuero curado" — SIN que el jugador tuviera cuerdas en el inventario. El botón dedicado
/// "Capturar en la zona" (`companeros.ts`, `POST /saves/:id/capturar/:npcSlug`) SÍ exige cuerdas
/// reales y bloquea sin ellas — el camino de texto libre no consultaba el inventario en absoluto
/// antes de dejar narrar la atadura). Mismo criterio que `WEAPON_WIELD_VERB_REGEX`: solo dispara
/// con verbo de intención real en la misma frase, nunca por mención suelta ("recuerdo que até a
/// alguien una vez" no debe bloquear).
/// Bug real cazado por los propios tests de esta pieza (2026-09-15), dos rondas:
/// 1. La primera versión usaba `at[oaáé]\w*` para cubrir "ato/ata/até" — coincide también con
///    "ataco"/"atacar"/"atacó", que bloqueaba prácticamente CUALQUIER acción de combate normal sin
///    cuerdas. Acotado a las formas reales de "atar" (nunca "atac-"): deliberadamente NO usa `\w*`
///    suelto tras la raíz corta, para no volver a capturar ningún otro verbo que empiece igual.
/// 2. Con el verbo ya acotado, seguía colisionando con un caso real EXISTENTE del proyecto:
///    "Ato un vendaje con mi manojo de salvia del polvo" (crafteo real, "atar" = "confeccionar/
///    vendar", nunca dirigido a una persona). El regex del verbo por sí solo no puede distinguir
///    "atar un objeto" de "atar a alguien" — el caller (`turn.ts`) exige ADEMÁS que la frase
///    mencione a un NPC real presente en la escena (`npcsInSceneForValidation.length > 0`) antes de
///    llamar a este detector: craftear un objeto nunca menciona a ningún NPC, atar a alguien sí.
export const BINDING_VERB_REGEX = /\b(atar\w*|atas|at[oaáé]|atad\w*|atand\w*|amarr\w*|maniat\w*|inmoviliz\w*|amordaz\w*)\b/i;

export interface BindingWithoutRopesClaim {
  /// Verbo/fragmento que disparó el chequeo — solo para depuración, no se usa en la narración
  /// (la frase de vuelta no necesita citar el verbo exacto).
  matchedVerb: string;
}

/// Detecta si el jugador reclama atar/inmovilizar a alguien SIN tener cuerdas reales en el
/// inventario — mismo espíritu que `detectsUnequippedWeaponClaim` (reclamar usar algo que no se
/// tiene), pero contra el inventario general (`InventoryItem.catalogSlug`), no contra equipo
/// puesto. `tieneCuerdas` lo resuelve el caller con una única consulta barata (mismo criterio que
/// `cuerdasItem` en `companeros.ts`) — este detector no toca Prisma, solo texto. El caller también
/// exige que haya un NPC real en escena antes de llamar aquí (ver comentario de `BINDING_VERB_REGEX`
/// sobre "atar un objeto" vs. "atar a alguien") — este detector en sí NO lo comprueba.
export function detectsBindingWithoutRopesClaim(action: string, tieneCuerdas: boolean): BindingWithoutRopesClaim | null {
  if (tieneCuerdas) return null;
  const match = action.match(BINDING_VERB_REGEX);
  return match ? { matchedVerb: match[0] } : null;
}

/// Mismo criterio que el resto del archivo — pool de 5, 1 cómica menos frecuente.
const BINDING_WITHOUT_ROPES_LINES: string[] = [
  'Gorhorn busca con qué atarlo, pero no lleva nada capaz de sujetar a nadie de verdad. La idea se queda en eso, una idea.',
  'Sus manos se cierran en el aire, buscando una cuerda que no tiene. Sin nada con qué atar, no hay atadura posible.',
  'Gorhorn palpa su equipo, pero no encuentra nada con lo que inmovilizar a nadie — necesitaría cuerdas de verdad para eso.',
  'No lleva encima nada que sirva para atar a alguien. Gorhorn lo deja estar, por ahora.',
  'Gorhorn se mira las manos vacías. «¿Con qué le ato, con mis propios dedos?» Resopla y abandona la idea.',
];

export function bindingWithoutRopesNarrationFor(): string {
  return pickRandomLine(BINDING_WITHOUT_ROPES_LINES);
}

/// Dirección cardinal mencionada en el texto ("camino hacia el norte", "me dirijo al sur") — hoy no
/// existe ningún sistema de movimiento por dirección cardinal ENTRE ubicaciones del mundo (mundo
/// determinista, 2026-09-03: `cardinalDirectionBetween`, travel.ts, solo describe la dirección de
/// un destino YA conocido — no resuelve texto libre). Decisión explícita de la usuaria: las
/// cardinales son para moverse DENTRO de una zona/interior, no para saltar entre ubicaciones del
/// mapa — mencionar una no es una reclamación de un lugar inventado, es prosa de rumbo genérico que
/// debe seguir cayendo al narrador libre como hoy, nunca bloquearse como "destino desconocido".
const CARDINAL_DIRECTION_REGEX = /\b(norte|noreste|este|sureste|sur|suroeste|oeste|noroeste)\b/;

/// Mundo determinista, el narrador solo narra (Pieza 6c, 2026-09-03): declarar viaje hacia un
/// destino con un verbo inequívoco (`detectsTravelIntent` — "voy a", "me dirijo", "parto hacia"...)
/// que no coincide con ningún alias real de ubicación conocida del mundo (`matchDestination` no
/// resuelve nada) — antes esto caía sin más al narrador libre, que podía narrar la salida/llegada a
/// un sitio que no existe en el catálogo. Excluido a propósito `detectsVagueMovementIntent`
/// (`travel.ts`, "sigo/avanzo/continúo por el camino" SIN nombrar destino): ese es un caso
/// LEGÍTIMO y distinto — `resolveTravel` solo lo resuelve si hay una única salida real conocida, y
/// con 2+ salidas el turno debe seguir su curso normal para que el jugador elija (comentario de
/// cabecera de `resolveTravel`) — bloquear ahí sería una regresión real, no un fix. También excluida
/// cualquier mención de dirección cardinal (`CARDINAL_DIRECTION_REGEX`, bug real encontrado en la
/// propia suite: "Salgo de la hondonada y camino hacia el norte" no nombra ningún lugar inventado,
/// solo describe rumbo genérico) — más vale dejar pasar que bloquear con dudas, mismo criterio que
/// el resto de esta familia de detectores. Y excluida cualquier intención de ataque/búsqueda hostil
/// (`detectsAttackIntent`/`detectsHostileSearchIntent`, npcScene.ts — bug real encontrado en la
/// propia suite: "Voy a luchar contra 'Orco enfurecido'" dispara `TRAVEL_INTENT_REGEX` por "voy a",
/// pero es intención de combate, no de viaje).
export async function detectsUnknownDestinationClaim(action: string, worldId: string): Promise<boolean> {
  if (!detectsTravelIntent(action) || detectsVagueMovementIntent(action)) return false;
  if (detectsAttackIntent(action) || detectsHostileSearchIntent(action)) return false;
  const normalized = normalizeText(action);
  if (CARDINAL_DIRECTION_REGEX.test(normalized)) return false;
  const locations = await prisma.location.findMany({ where: { worldId }, select: { id: true, slug: true, name: true, aliases: true } });
  return !matchDestination(action, locations);
}

/// Mismo criterio que el resto — pool de 5, 1 cómica menos frecuente.
const UNKNOWN_DESTINATION_LINES: string[] = [
  'Gorhorn se detiene a pensarlo. No sabría ni por dónde tirar hacia allí — no es un lugar que conozca.',
  'El nombre no le dice nada a Gorhorn. No hay ningún camino que él sepa que lleve hasta ahí.',
  'Gorhorn mira alrededor, buscando alguna referencia, pero no reconoce el lugar del que habla.',
  'No es un sitio que Gorhorn tenga marcado en su cabeza, ni recuerde haber oído nombrar.',
  'Gorhorn se rasca la nuca. «¿Eso? Ni idea de por dónde caerá...» Se encoge de hombros y se queda donde está.',
];

export function unknownDestinationNarrationFor(): string {
  return pickRandomLine(UNKNOWN_DESTINATION_LINES);
}

export interface HarvestSkillMisuseClaim {
  sourceSlug: string;
  sourceName: string;
  oficio: string;
  abilityLabel: string;
}

/// Mundo determinista, el narrador solo narra (Pieza 6d, 2026-09-03): a diferencia de crafteo/
/// construcción/viaje (6a-6c, donde el hueco era "cae al narrador libre sin mensaje"), aquí el
/// hueco es más grave — el texto libre "Mino Yerreo" NO caía al narrador libre, se RESOLVÍA de
/// verdad (`detectHarvest`, harvest.ts) pero por una vía paralela y más fácil que el modal
/// "oficial" (`recolectar.ts`/`HarvestSelectionModal.tsx`): tirada genérica del LLM (sin conocer
/// tier del recurso ni nivel de oficio), sin comprobar herramienta requerida, y sin depletar
/// `WorldPopulation` (no agota nada del mundo). Decisión explícita de la usuaria: cortar esta vía
/// para MINERIA/TALA/EXTRACCION/PESCA/BUSQUEDA — CAZA (desuello) se deja intacta a propósito,
/// porque ahí ambos caminos ya comparten el mismo criterio real (`hasPendingLoot`/`saqueado`, sin
/// la divergencia de tirada de arriba) y el modal de Desollar es solo un aviso pasivo, no una
/// acción proactiva equivalente.
///
/// SÍ exige `matchesVerbForMetodo` (a diferencia del primer intento de este guard, revertido tras
/// un falso positivo real encontrado por la propia suite: "Cargo mi escudo con todo mi peso y
/// golpeo..." — sin relación alguna con recolectar — matcheaba `matchHarvestSource` por fuzzy
/// matching contra 'roca-pilares-rotos' sin más contexto). Mismo criterio de precisión que
/// `detectHarvest` ya usaba internamente (harvest.ts:140) — exigir el verbo correcto del método
/// real de esa fuente es lo que distingue "de verdad quiere recolectar esto" de una mención
/// incidental. El caso "fuente real + verbo equivocado" simplemente no dispara (tampoco lo hacía
/// `detectHarvest` antes), sin pérdida real de cobertura frente al diseño original.
export async function detectsHarvestSkillMisuseClaim(action: string, worldId: string): Promise<HarvestSkillMisuseClaim | null> {
  if (!matchesAnyHarvestVerb(action)) return null;
  const sourceSlug = matchHarvestSource(action);
  if (!sourceSlug) return null;
  const rows = await prisma.harvestYield.findMany({ where: { worldId, sourceSlug }, select: { metodoObtencion: true }, take: 1 });
  if (rows.length === 0 || rows[0].metodoObtencion === 'CAZA' || rows[0].metodoObtencion === 'PASIVO') return null;
  if (!matchesVerbForMetodo(action, rows[0].metodoObtencion)) return null;
  const entry = harvestAbilityForMetodo(rows[0].metodoObtencion);
  if (!entry) return null;
  const sourceName = harvestSourceAliases[sourceSlug]?.[0] ?? sourceSlug.replace(/-/g, ' ');
  return { sourceSlug, sourceName, oficio: entry.oficio, abilityLabel: entry.ability.name };
}

/// Mismo criterio que el resto — pool de 5, 1 cómica menos frecuente. A diferencia del resto de
/// esta familia, no insiste en "no existe"/"no está aquí" — la fuente SÍ existe y SÍ está bien de
/// región, solo que esto se hace con la habilidad real, no al vuelo.
const HARVEST_SKILL_MISUSE_LINES: ((nombre: string) => string)[] = [
  (nombre) => `Gorhorn sabe que ${nombre} no se consigue de palabra — hay que dar con ello en el terreno. Busca ${nombre} en el mapa de la zona.`,
  (nombre) => `No es cosa de improvisar con ${nombre}. Gorhorn tendrá que encontrarlo de verdad: búscalo en el mapa de la zona y acércate.`,
  (nombre) => `Gorhorn se detiene. «¿${nombre} así, sin más?» Primero hay que llegar hasta ello — búscalo en el mapa de la zona.`,
];

export function harvestSkillMisuseNarrationFor(nombre: string): string {
  const line = pickRandomLine(HARVEST_SKILL_MISUSE_LINES);
  return line(nombre);
}
