/// Niveles de oficio (sesión de diseño 2026-07-23) — eje independiente del nivel de personaje
/// (progression.ts): cada profesión (id de professions.ts) tiene su propia XP/nivel, que sube
/// solo craftereando/construyendo con ese oficio. Determinista, sin IA, mismo estilo puro que
/// progression.ts. Esto recuerda el nivel de CADA oficio practicado alguna vez, independiente de
/// los demás (rediseño de profesiones, 2026-08-07: ya no hay una única "profesión activa" —
/// `Save.profession` y el botón "Adoptar" se quitaron por completo, no enganchaban con ninguna
/// mecánica real).

/// Tabla de niveles mucho más corta que la de personaje (20 niveles D&D) — un oficio no es una
/// segunda vida de aventurero, es una progresión de artesano.
///
/// Ampliada de 5 a 9 niveles (2026-09-02, mecánica de pesca/doble tirada): con el mapeo real
/// "nivel de oficio = tier máximo recolectable/crafteable" (recolectar.ts § pasaFiltroNivelOficio),
/// un tope de 5 dejaba inalcanzable para siempre cualquier tier 6-9 ya real del catálogo (esquirla
/// celeste, tier 9; Toluh, tier 7) — no solo pesca, cualquier oficio con contenido de tier alto
/// tenía el mismo problema de fondo, solo que nadie lo había notado hasta ahora. Los 4 tramos
/// nuevos siguen la misma curva de crecimiento (~doble cada tramo) que los 5 originales.
const PROFESSION_LEVEL_THRESHOLDS: number[] = [0, 50, 150, 350, 700, 1300, 2400, 4400, 8000];
const MAX_PROFESSION_LEVEL = PROFESSION_LEVEL_THRESHOLDS.length;

export function professionLevelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < PROFESSION_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= PROFESSION_LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(level, MAX_PROFESSION_LEVEL);
}

/// XP de oficio por tier de la receta craftada/construida — escala propia, distinta de
/// XP_BY_DIFFICULTY (progression.ts): un crafteo no es una tirada de d20, es un éxito determinista
/// ya filtrado por `canCraft`/`checkRecipe`, así que hasta el tier 1 da algo por el mero acierto.
/// Ampliada de tier 1-5 a 1-9 (2026-09-02, junto a PROFESSION_LEVEL_THRESHOLDS) — ya había recetas
/// reales de tier 7 en crafting.ts sin ninguna entrada aquí (caían al fallback `?? 10`, mismo XP
/// que un tier 1), deuda preexistente que se cierra de paso al ampliar el rango de niveles.
const XP_BY_TIER: Record<number, number> = { 1: 10, 2: 25, 3: 50, 4: 100, 5: 200, 6: 350, 7: 550, 8: 800, 9: 1100 };

export function xpForCraftSuccess(tier: number | undefined): number {
  return XP_BY_TIER[tier ?? 1] ?? 10;
}

/// Alivio de requisitos (requisitos.ts): nivel 1 = sin alivio, cada nivel siguiente resta 1 al
/// mínimo exigido — solo dentro de recetas de ESE MISMO oficio, nunca toca la tirada general
/// (docs/mecanicas/10-niveles-xp-reino.md § 4.1 ya identificó ese error para un bonificador global).
export function alivioForLevel(nivel: number): number {
  return Math.max(0, nivel - 1);
}

export { MAX_PROFESSION_LEVEL };
