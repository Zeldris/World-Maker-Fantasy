/// Oficios "de serie" (rediseño de profesiones, 2026-08-07, petición explícita) — Gorhorn, por su
/// pasado como superviviente del Clan Maktor, empieza la partida con 8 oficios ya a nivel 1 (no
/// nivel 0 = no aprendida todavía): herrería, minería, desuello, peletería (`curtidor`, ya existe
/// en professions.ts — no duplicar), tala, carpintería, construcción, herboristería (2026-08-13,
/// petición explícita: "para que esto funcione y pueda probarlo tienes que añadir también la
/// profesión de herboristería a Gorhorn" — sin ella no hay forma de subir de nivel recolectando la
/// salvia del polvo/pétalos de Flor de Ceniza que consumen las recetas de primeros auxilios de
/// abajo). Mismo patrón que startingAbilitiesFor/startingInventoryFor: se siembra al crear partida
/// y al reiniciarla.
///
/// Slugs unificados (H-10, 2026-09): `<oficio>-<raza en plural>-<región>` (fuente única:
/// backend/src/data/professions.ts; minero/talador solo llevan región). Ids (2026-08-09, professions.ts ahora escala cada oficio por raza+región — ver su
/// comentario de cabecera): Gorhorn es un orco de las Llanuras del Viento Rojo (berigLore.ts,
/// "Orcos de las Llanuras, Clan Maktor"), así que toma la variante orco+Llanuras de cada oficio
/// (minero/talador siguen sin variante racial, solo regional — desollador SÍ la tiene desde que
/// se escaló a los mismos combos raza+región que su creadora, peletero). Se copian tal cual están
/// escritos en professions.ts, incluida su inconsistencia singular/plural real ("herrero-orcos-"
/// vs "curtidor-orcos-"/"carpintero-orcos-"/"constructor-orcos-"/"desollador-orcos-") — no se
/// corrige aquí para no desincronizarse de la fuente real.
const GORHORN_STARTING_PROFESSIONS = [
  'herrero-orcos-llanuras',
  'minero-llanuras',
  'desollador-orcos-llanuras',
  'curtidor-orcos-llanuras',
  'talador-llanuras',
  'carpintero-orcos-llanuras',
  'constructor-orcos-llanuras',
  'herborista-orcos-llanuras',
];

/// Primeros auxilios (2026-08-13, petición explícita: "todos los pjs jugables empiezan como mínimo
/// con esta profesión") — a diferencia del resto de GORHORN_STARTING_PROFESSIONS (su kit personal
/// de superviviente del Clan Maktor, solo tiene sentido PARA Gorhorn), primeros auxilios es un
/// oficio básico que cualquier personaje jugable debería llevar de serie, sea quien sea — así que
/// se calcula aquí a partir de su raza+región real (berigLore.ts § razaFor / la región de su
/// ubicación inicial) en vez de vivir hardcodeado en la lista de arriba. Hoy solo Gorhorn tiene
/// raza+ubicación inicial resueltas (berigLore.ts: "no hay todavía un flujo de creación de
/// personaje libre" para los otros 3 personajes jugables de Berig) — el día que lo tengan, esto
/// les da su primeros-auxilios real sin tocar ni una línea más de este archivo.
///
/// Mismos 9 combos raza+región que peletero/curtidor/desollador/carpintero/constructor
/// (professions.ts): orcos (llanuras/cristal/ciénaga), nabieus (ciénaga/margen), faerus
/// (llanuras/margen), goirntes (margen/meseta). `raza` es el slug real de razaFor (berigLore.ts:
/// 'orcos', o null si el personaje/raza no está implementado todavía); el token de oficio es ese
/// mismo slug (H-10: ya no hay traducción nabieus→nabierus).
const RAZA_PROFESSION_TOKEN: Record<string, string> = {
  orcos: 'orcos',
  nabieus: 'nabieus',
  faerus: 'faerus',
  goirntes: 'goirntes',
};

/// Claves = `Location.region` tal cual se siembra en worldCatalog.ts (con artículo completo).
const REGION_PROFESSION_TOKEN: Record<string, string> = {
  'Las Llanuras del Viento Rojo': 'llanuras',
  'Cristal Helado': 'cristal',
  'Ciénaga Troncal': 'cienaga',
  'El Margen Silencioso': 'margen',
  'La Meseta del Orden': 'meseta',
};

const VALID_PRIMEROS_AUXILIOS_COMBOS = new Set([
  'orcos-llanuras',
  'orcos-cristal',
  'orcos-cienaga',
  'nabieus-cienaga',
  'nabieus-margen',
  'faerus-llanuras',
  'faerus-margen',
  'goirntes-margen',
  'goirntes-meseta',
]);

export function primerosAuxiliosProfessionFor(raza: string | null, region: string | null): string | null {
  if (!raza || !region) return null;
  const razaToken = RAZA_PROFESSION_TOKEN[raza];
  const regionToken = REGION_PROFESSION_TOKEN[region];
  if (!razaToken || !regionToken) return null;
  const combo = `${razaToken}-${regionToken}`;
  if (!VALID_PRIMEROS_AUXILIOS_COMBOS.has(combo)) return null;
  return `primeros-auxilios-${combo}`;
}

export function startingProfessionsFor(characterName: string, raza: string | null, region: string | null): string[] {
  const base = characterName === 'Gorhorn' ? GORHORN_STARTING_PROFESSIONS : [];
  const primerosAuxilios = primerosAuxiliosProfessionFor(raza, region);
  return primerosAuxilios ? [...base, primerosAuxilios] : base;
}
