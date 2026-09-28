/// Fase 4 (2026-09-28, `docs/runbooks/plan-mecanicas-por-zona-2026-09-28.md`, B25) — habilidades de
/// recolección/caza que cubre ya el mapa de la zona (tarjeta de encuentro → Cazar / Interactuar).
/// Las partidas nuevas ya no las reciben; las partidas antiguas las tienen sembradas en BD y aquí
/// se ocultan (nunca se borran filas), mismo criterio de nombre fijo que `ABILITIES_REQUIEREN_MONTURA`.
export const ABILITIES_RETIRADAS_FASE4 = new Set([
  'Cazar',
  'Minar',
  'Talar',
  'Recolectar hierbas',
  'Recoger',
  'Pescar',
  'Buscar',
  // Fase 5 (2026-09-28): saquear se hace desde el pin del cadáver en el mapa de la zona (y con
  // "Saquear todo" al acabar un combate).
  'Saquear',
])

export function sinHabilidadesRetiradas<T extends { name: string }>(abilities: T[]): T[] {
  return abilities.filter((a) => !ABILITIES_RETIRADAS_FASE4.has(a.name))
}
