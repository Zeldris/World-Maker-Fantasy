// Duración de las tiradas de dados (CFG-20, hito 0.2 — roadmap-front.md § 2.4). La animación de
// siempre dura ROLL_DURATION_MS por dado; el ajuste «Velocidad de las tiradas» la multiplica por un
// factor (Dramática 1 · Normal 0,6 · Rápida 0,3 · Instantánea 0). Todo lo que espera a que los
// dados aterricen (aplicar vida, revelar consecuencias…) lee `duracionTirada()`, no la constante.

/// Duración de la caída de UN dado a velocidad «Dramática» — SECUENCIAL en `DiceRollVs` (el segundo
/// no empieza a girar hasta que el primero ya aterrizó), ~10 s en total para un «vs» completo.
export const ROLL_DURATION_MS = 5000

let factor = 1
let cacheRetardos: { ms: number; retardos: number[] } | null = null

export function setFactorDados(f: number): void {
  factor = Math.max(0, f)
}

export function duracionTirada(): number {
  return Math.round(ROLL_DURATION_MS * factor)
}

/// Cadencia de la tirada (ms entre cada número al azar que se enseña) — arranca rápida (30 ms) y se
/// va frenando (×1.06 por paso, tope 180 ms) antes de aterrizar, sin física real ni librería de
/// animación: generada para sumar justo `totalMs`.
export function buildRollTickDelays(totalMs: number): number[] {
  const delays: number[] = []
  let elapsed = 0
  let delay = 30
  while (elapsed + delay < totalMs) {
    delays.push(delay)
    elapsed += delay
    delay = Math.min(180, Math.round(delay * 1.06))
  }
  return delays
}

export function retardosTirada(): number[] {
  const ms = duracionTirada()
  if (!cacheRetardos || cacheRetardos.ms !== ms) cacheRetardos = { ms, retardos: buildRollTickDelays(ms) }
  return cacheRetardos.retardos
}
