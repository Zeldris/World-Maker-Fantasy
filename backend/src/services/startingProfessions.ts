/// Oficios "de serie" (rediseño de profesiones, 2026-08-07, petición explícita) — Gorhorn, por su
/// pasado como superviviente del Clan Maktor, empieza la partida con 7 oficios ya a nivel 1 (no
/// nivel 0 = no aprendida todavía): herrería, minería, desuello, peletería (`curtidor`, ya existe
/// en professions.ts — no duplicar), tala, carpintería, construcción. Mismo patrón que
/// startingAbilitiesFor/startingInventoryFor: se siembra al crear partida y al reiniciarla.
const GORHORN_STARTING_PROFESSIONS = ['herrero', 'minero', 'desollador', 'curtidor', 'talador', 'carpintero', 'constructor'];

export function startingProfessionsFor(characterName: string): string[] {
  if (characterName === 'Gorhorn') return GORHORN_STARTING_PROFESSIONS;
  return [];
}
