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
