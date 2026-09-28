/// Indicador de dificultad antes de pulsar "Combatir" (2026-07-29, petición explícita: "que
/// aparezca un texto en color gris, verde, amarillo, naranja o rojo que me indique la dificultad
/// según los niveles... que me saque de diferencia"). Los tres tramos centrales son un espejo
/// exacto de `difficultyHintFor` (backend, npcScene.ts) — la MISMA diferencia de nivel que decide
/// la dificultad real de la tirada en combate, nunca un cálculo aparte que pudiera desincronizarse
/// y mentir sobre lo duro que va a ser el combate de verdad. El tramo gris de abajo es el único
/// añadido (división extra de "Fácil" para tener los 5 colores pedidos, con la misma etiqueta).
export interface CombatDifficulty {
  label: string
  colorClass: string
}

export function combatDifficultyFor(levelDiff: number): CombatDifficulty {
  // B22 (pruebas 2026-09-28): este tramo decía "Trivial" y la tirada del mismo rival "Fácil (12)" —
  // la dificultad real de la tirada es la misma que el tramo Fácil, así que comparte nombre; solo
  // el gris distingue que el rival está muy por debajo de tu nivel.
  if (levelDiff <= -5) return { label: 'Fácil', colorClass: 'text-wood-500' }
  if (levelDiff <= -2) return { label: 'Fácil', colorClass: 'text-emerald-400' }
  if (levelDiff <= 1) return { label: 'Media', colorClass: 'text-yellow-400' }
  if (levelDiff <= 4) return { label: 'Difícil', colorClass: 'text-orange-400' }
  return { label: 'Muy difícil', colorClass: 'text-red-400' }
}
