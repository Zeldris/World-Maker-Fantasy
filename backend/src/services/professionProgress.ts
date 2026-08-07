/// Niveles de oficio (sesión de diseño 2026-07-23) — eje independiente del nivel de personaje
/// (progression.ts): cada profesión (id de professions.ts) tiene su propia XP/nivel, que sube
/// solo craftereando/construyendo con ese oficio. Determinista, sin IA, mismo estilo puro que
/// progression.ts. Esto recuerda el nivel de CADA oficio practicado alguna vez, independiente de
/// los demás (rediseño de profesiones, 2026-08-07: ya no hay una única "profesión activa" —
/// `Save.profession` y el botón "Adoptar" se quitaron por completo, no enganchaban con ninguna
/// mecánica real).

/// Tabla de niveles mucho más corta que la de personaje (20 niveles D&D) — un oficio no es una
/// segunda vida de aventurero, es una progresión de artesano: 5 niveles bastan para que "alivio de
/// requisitos" tenga recorrido real sin inflar los números del mundo (ver requisitos.ts).
const PROFESSION_LEVEL_THRESHOLDS: number[] = [0, 50, 150, 350, 700];
const MAX_PROFESSION_LEVEL = PROFESSION_LEVEL_THRESHOLDS.length;

export function professionLevelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < PROFESSION_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= PROFESSION_LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(level, MAX_PROFESSION_LEVEL);
}

/// XP de oficio por tier de la receta craftada/construida (1-5) — escala propia, distinta de
/// XP_BY_DIFFICULTY (progression.ts): un crafteo no es una tirada de d20, es un éxito determinista
/// ya filtrado por `canCraft`/`checkRecipe`, así que hasta el tier 1 da algo por el mero acierto.
const XP_BY_TIER: Record<number, number> = { 1: 10, 2: 25, 3: 50, 4: 100, 5: 200 };

export function xpForCraftSuccess(tier: number | undefined): number {
  return XP_BY_TIER[tier ?? 1] ?? 10;
}

/// Alivio de requisitos (requisitos.ts): nivel 1 = sin alivio, cada nivel siguiente resta 1 al
/// mínimo exigido — solo dentro de recetas de ESE MISMO oficio, nunca toca la tirada general
/// (docs/10-niveles-xp-reino.md § 4.1 ya identificó ese error para un bonificador global).
export function alivioForLevel(nivel: number): number {
  return Math.max(0, nivel - 1);
}

export interface ProfessionProgressResult {
  xpDelta: number;
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
}

/// Aplica un delta de XP de oficio. No toca la base de datos — el caller decide cómo persistir
/// (ProfessionProgress.xp/nivel), mismo patrón que applyXp (progression.ts).
export function applyProfessionXp(currentXp: number, currentLevel: number, xpDelta: number): ProfessionProgressResult {
  const newXp = currentXp + xpDelta;
  const newLevel = professionLevelForXp(newXp);
  return { xpDelta, newXp, newLevel, leveledUp: newLevel > currentLevel };
}

export { MAX_PROFESSION_LEVEL };
