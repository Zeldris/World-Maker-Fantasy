const MAX_FACTS = 10;
const DUPLICATE_THRESHOLD = 0.7;

function normalize(fact: string): string {
  return fact
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

function similarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' '));
  const wordsB = new Set(normalize(b).split(' '));
  if (!wordsA.size || !wordsB.size) return 0;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / Math.max(wordsA.size, wordsB.size);
}

/// Añade newFacts a la lista existente, descartando los que son casi idénticos a uno ya
/// presente y recortando al final a los MAX_FACTS más recientes. Sin esto, `sessionFacts`
/// crecía sin límite turno a turno y una alucinación puntual del narrador (ej. un nombre mal
/// escrito) se guardaba como hecho permanente y se repetía palabra por palabra en cada turno
/// futuro — visto en una partida real, 2026-07-18 (ver memoria del proyecto).
export function mergeFacts(existing: string[], newFacts: string[]): string[] {
  const merged = [...existing];
  for (const fact of newFacts) {
    const isDuplicate = merged.some((f) => similarity(f, fact) >= DUPLICATE_THRESHOLD);
    if (!isDuplicate) merged.push(fact);
  }
  return merged.slice(-MAX_FACTS);
}
