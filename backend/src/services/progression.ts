/// Servicio de progresión (docs/10-niveles-xp-reino.md) — reversión de la decisión de mecánicas 4.
/// Todo determinista, sin IA: el modelo nunca decide cuánta XP se gana, igual que nunca decide
/// si una tirada tiene éxito.
import { WEAPON_ABILITY_LEVEL_AVANZADA } from './weaponAbilities.js';

/// Tabla de XP por nivel — valores exactos de D&D 5e (§ 2), nivel máximo 20.
const LEVEL_THRESHOLDS: number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
  165000, 195000, 225000, 265000, 305000, 355000,
];

const MAX_LEVEL = LEVEL_THRESHOLDS.length;
const ASI_LEVELS = new Set([4, 8, 12, 16, 19]);
const MAX_ATTRIBUTE = 18;

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(level, MAX_LEVEL);
}

/// Tope real de habilidades de combate activas (2026-07-29, rediseño "tope de 10": 2 raciales
/// ataque+defensa + 2 de arma [4 desde el nivel de arma avanzada] + 4 de clase) — reemplaza a la
/// vieja `habilidadSlotsForLevel`, que crecía suave con el nivel (3 + nivel/2) de cuando las
/// habilidades de combate eran una lista progresiva de 12; ya no lo son, así que ese crecimiento
/// no reflejaba nada real y el contador de HabilidadesPanel mentía sobre cuántos huecos había.
export function maxCombatAbilitiesFor(level: number): number {
  return 2 + (level >= WEAPON_ABILITY_LEVEL_AVANZADA ? 4 : 2) + 4;
}

const XP_BY_DIFFICULTY: Record<number, number> = {
  8: 0, // trivial
  12: 5, // fácil
  15: 25, // media
  18: 50, // difícil
  22: 100, // muy difícil
};

/// XP del canal automático (§ 3.1): solo en éxito, según la dificultad ya fijada por la clasificación.
export function xpForRollSuccess(difficulty: number, success: boolean): number {
  if (!success) return 0;
  return XP_BY_DIFFICULTY[difficulty] ?? 0;
}

export type HitoTipo = 'descubrimiento' | 'objetivo_menor' | 'objetivo_mayor' | 'capitulo';

const XP_BY_HITO: Record<HitoTipo, number> = {
  descubrimiento: 50,
  objetivo_menor: 100,
  objetivo_mayor: 300,
  capitulo: 500,
};

/// De la lista de hitos que propone el modelo (solo el tipo) más los eventos deterministas de
/// Reino, se queda con el de mayor valor — tope 1 hito/turno (§ 3.2, § 5.4).
export function xpForHitos(hitoTipos: HitoTipo[]): number {
  if (hitoTipos.length === 0) return 0;
  return Math.max(...hitoTipos.map((t) => XP_BY_HITO[t] ?? 0));
}

export interface ProgressionResult {
  xpDelta: number;
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  attributePointsGained: number;
}

/// Aplica un delta de XP a una partida y calcula si sube de nivel (§ 7). No toca la base de
/// datos — el caller decide cómo persistir (Save.xp/level/pendingAttributePoints, LogEntry.xpDelta).
export function applyXp(currentXp: number, currentLevel: number, xpDelta: number): ProgressionResult {
  const newXp = currentXp + xpDelta;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > currentLevel;

  let attributePointsGained = 0;
  if (leveledUp) {
    for (let lvl = currentLevel + 1; lvl <= newLevel; lvl++) {
      if (ASI_LEVELS.has(lvl)) attributePointsGained += 2;
    }
  }

  return { xpDelta, newXp, newLevel, leveledUp, attributePointsGained };
}

export { MAX_ATTRIBUTE, MAX_LEVEL };
