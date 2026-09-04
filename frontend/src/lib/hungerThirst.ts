/// Espejo del backend para la habilidad "Comer/Beber" (2026-09-04, companionSupervivencia.ts) —
/// mismo criterio que applySequentialHeals (health.ts): la vista previa en vivo del modal nunca se
/// calcula de forma independiente, para que no pueda desincronizarse de lo que el motor real hace
/// al confirmar. A diferencia del backend (que trabaja sobre timestamps `lastAt(...)Minutes` y
/// deriva el pct desde ahí), aquí solo hace falta el pct actual — ya viaja como tal en `NarrateResponse`/
/// `Save` — así que la vista previa suma la ganancia directamente y topa a 100, sin reconstruir
/// ningún timestamp (la fórmula exacta del backend redondea a tramos de 25%, pero para "cuánto va
/// a subir la barra antes de confirmar" un tope simple a 100 es la vista previa correcta: el motor
/// real es quien decide el tramo final al persistir).
export function applySequentialHunger(current: number, gananciaTotal: number): number {
  return Math.min(100, Math.max(0, current + Math.max(0, gananciaTotal)))
}

export function applySequentialThirst(current: number, beberAgua: boolean): number {
  return beberAgua ? 100 : current
}
