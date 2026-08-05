import type { Temperamento } from '@prisma/client';

/// Reputación de facción (2026-07-29, "la reputación que tengas con cada raza o reino influirá
/// en los valores de combate"): sustituye al viejo `WorldState.factionsStatus` sin límite (±1,
/// nunca leído de vuelta) por un medidor acotado 0-5000 por facción, mismo concepto que la barra
/// de XP de personaje. 2500 = punto neutro (equivale a CAUTELOSO, el temperamento de catálogo
/// típico); sube o baja desde ahí sin salirse nunca de [0, 5000].
export const FACTION_REP_MIN = 0;
export const FACTION_REP_MAX = 5000;
export const FACTION_REP_DEFAULT = 2500;

/// Deltas deliberadamente asimétricos — para que caer en ENEMIGO sea un pozo real y no solo de
/// nombre, atacar cuesta 5x más de lo que se recupera resolviendo algo en paz. Sin esto, subir y
/// bajar a la misma velocidad haría trivial entrar y salir de cualquier banda.
export const FACTION_REP_ATTACK_DELTA = -150;
export const FACTION_REP_PEACE_DELTA = 30;

/// Orden de menos a más hostil — mismo orden que el enum `Temperamento` en schema.prisma, el
/// índice en este array es lo que desplaza `effectiveTemperamento` de abajo.
const TEMPERAMENTO_ORDER: Temperamento[] = ['AMIGABLE', 'INOFENSIVO', 'CAUTELOSO', 'AGRESIVO', 'ENEMIGO'];

export function factionRepFor(factionsStatus: Record<string, number>, faction: string): number {
  return factionsStatus[faction] ?? FACTION_REP_DEFAULT;
}

/// Puro — no toca la base de datos, solo calcula el próximo valor acotado. El caller decide
/// cuándo persistirlo (turnResolution.ts, mismo sitio de siempre).
export function applyFactionRepDelta(factionsStatus: Record<string, number>, faction: string, delta: number): Record<string, number> {
  const next = Math.max(FACTION_REP_MIN, Math.min(FACTION_REP_MAX, factionRepFor(factionsStatus, faction) + delta));
  return { ...factionsStatus, [faction]: next };
}

/// Temperamento efectivo EN ESTA PARTIDA: el de catálogo (fijo, worldCatalog.ts) desplazado por
/// la banda de reputación de su facción. 5 bandas iguales de 1000 sobre [0, 5000], banda 2
/// (2000-2999, donde cae el default 2500) es la neutra — sin desplazamiento. Reputación pésima
/// (banda 0) empuja +2 escalones hacia ENEMIGO; reputación excelente (banda 4) empuja -2 hacia
/// AMIGABLE. Un NPC con `faction: null` (fauna, independientes) no tiene de qué desplazarse —
/// se devuelve tal cual su valor de catálogo.
export function effectiveTemperamento(catalogTemperamento: Temperamento, faction: string | null, factionsStatus: Record<string, number>): Temperamento {
  if (!faction) return catalogTemperamento;
  const rep = factionRepFor(factionsStatus, faction);
  const bandIndex = Math.min(4, Math.floor(rep / 1000));
  const shift = 2 - bandIndex;
  const catalogIndex = TEMPERAMENTO_ORDER.indexOf(catalogTemperamento);
  const effectiveIndex = Math.max(0, Math.min(TEMPERAMENTO_ORDER.length - 1, catalogIndex + shift));
  return TEMPERAMENTO_ORDER[effectiveIndex];
}

/// Fundación de reino (2026-08-04, docs/17-reglas-construcciones-reino.md) — qué facción(es) son
/// dueñas de cada región de Berig según el lore (docs/rpgtarkor/areas.md), seedeado a mano: no
/// existe ninguna tabla real de "región → facción" en la base de datos, solo `Npc.faction` (libre
/// por NPC) y `World.factions` (catálogo suelto). Ciénaga Troncal y El Margen Silencioso quedan
/// sin entrada a propósito — sus clanes de lore (Goshg, Nabieus/Faerus) todavía no tienen ningún
/// NPC seedeado con ese `faction` exacto, así que mecánicamente hoy son "sin dueño".
export const REGION_OWNING_FACTIONS: Record<string, string[]> = {
  'Las Llanuras del Viento Rojo': ['Clan Serhu'],
  'La Meseta del Orden': ['Concordia de Hierro'],
  'Cristal Helado': ['Clan Helsig'],
};

export type FoundingOutcome = 'SIN_DUENO' | 'PACIFICA' | 'CONFLICTO';

/// Puro — decide qué pasa al fundar un Ayuntamiento (tier 1) en esta región, según tu reputación
/// con SUS facciones dueñas. `SIN_DUENO` (ninguna facción conocida reclama la región) y
/// `PACIFICA` (reputación ≥ neutral con TODAS las dueñas) resultan en territorio tuyo sin más;
/// `CONFLICTO` (peor que neutral con alguna) dice que la región queda en disputa — más de una
/// facción ocupando el mismo territorio.
export function resolveFoundingOutcome(region: string | null, factionsStatus: Record<string, number>): FoundingOutcome {
  const owners = (region && REGION_OWNING_FACTIONS[region]) || [];
  if (owners.length === 0) return 'SIN_DUENO';
  const hostile = owners.some((faction) => factionRepFor(factionsStatus, faction) < FACTION_REP_DEFAULT);
  return hostile ? 'CONFLICTO' : 'PACIFICA';
}
