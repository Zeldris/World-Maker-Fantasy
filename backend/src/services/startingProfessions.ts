/// Oficios "de serie" (rediseño de profesiones, 2026-08-07, petición explícita) — Gorhorn, por su
/// pasado como superviviente del Clan Maktor, empieza la partida con 7 oficios ya a nivel 1 (no
/// nivel 0 = no aprendida todavía): herrería, minería, desuello, peletería (`curtidor`, ya existe
/// en professions.ts — no duplicar), tala, carpintería, construcción. Mismo patrón que
/// startingAbilitiesFor/startingInventoryFor: se siembra al crear partida y al reiniciarla.
///
/// Ids actualizados (2026-08-09, professions.ts ahora escala cada oficio por raza+región — ver su
/// comentario de cabecera): Gorhorn es un orco de las Llanuras del Viento Rojo (berigLore.ts,
/// "Orcos de las Llanuras, Clan Maktor"), así que toma la variante orco+Llanuras de cada oficio
/// (minero/talador siguen sin variante racial, solo regional — desollador SÍ la tiene desde que
/// se escaló a los mismos combos raza+región que su creadora, peletero). Se copian tal cual están
/// escritos en professions.ts, incluida su inconsistencia singular/plural real ("herrero-orco-"
/// vs "curtidor-orcos-"/"carpintero-orcos-"/"constructor-orcos-"/"desollador-orcos-") — no se
/// corrige aquí para no desincronizarse de la fuente real.
const GORHORN_STARTING_PROFESSIONS = [
  'herrero-orco-llanuras',
  'minero-llanuras',
  'desollador-orcos-llanuras',
  'curtidor-orcos-llanuras',
  'talador-llanuras',
  'carpintero-orcos-llanuras',
  'constructor-orcos-llanuras',
];

export function startingProfessionsFor(characterName: string): string[] {
  if (characterName === 'Gorhorn') return GORHORN_STARTING_PROFESSIONS;
  return [];
}
