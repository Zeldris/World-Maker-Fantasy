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

// ─── Saltar las tiradas (CFG-20 / DAD-8) ───
// Todo lo que espera a que los dados aterricen se programa con `temporizadorTirada` en vez de
// `setTimeout`. Un clic en los dados o `Espacio` (fuera de un campo de texto) llama a
// `saltarTiradas()`: lo pendiente se dispara ya, en el orden en que iba a ocurrir. Lo que se
// programe mientras tanto (la tirada siguiente) no se salta: hace falta otro clic.

type Pendiente = { fn: () => void; vence: number; orden: number }
const pendientes = new Map<ReturnType<typeof setTimeout>, Pendiente>()
let contador = 0

function escuchaTeclado(activa: boolean) {
  if (typeof document === 'undefined') return
  if (activa) document.addEventListener('keydown', alPulsarTecla)
  else document.removeEventListener('keydown', alPulsarTecla)
}

function alPulsarTecla(e: KeyboardEvent) {
  if (e.key !== ' ' || e.repeat) return
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))) return
  e.preventDefault()
  saltarTiradas()
}

/// Como `setTimeout`, pero `saltarTiradas()` lo adelanta. Se cancela con `cancelarTirada`.
export function temporizadorTirada(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const handle = setTimeout(() => {
    pendientes.delete(handle)
    if (pendientes.size === 0) escuchaTeclado(false)
    fn()
  }, ms)
  if (pendientes.size === 0) escuchaTeclado(true)
  pendientes.set(handle, { fn, vence: Date.now() + ms, orden: contador++ })
  return handle
}

export function cancelarTirada(handle: ReturnType<typeof setTimeout> | null | undefined): void {
  if (handle == null) return
  clearTimeout(handle)
  pendientes.delete(handle)
  if (pendientes.size === 0) escuchaTeclado(false)
}

/// Promesa que se resuelve al aterrizar los dados (o al saltarlos).
export function esperarTirada(ms: number): Promise<void> {
  return new Promise((resolve) => temporizadorTirada(resolve, ms))
}

export function hayTiradasEnCurso(): boolean {
  return pendientes.size > 0
}

const oyentesSalto = new Set<() => void>()

/// Avisa cuando se saltan las tiradas (lo que no espera con un temporizador, como un retraso CSS).
export function alSaltarTiradas(cb: () => void): () => void {
  oyentesSalto.add(cb)
  return () => {
    oyentesSalto.delete(cb)
  }
}

export function saltarTiradas(): void {
  oyentesSalto.forEach((cb) => cb())
  const ahora = [...pendientes.entries()].sort(([, a], [, b]) => a.vence - b.vence || a.orden - b.orden)
  for (const [handle, p] of ahora) {
    // Uno anterior pudo cancelarlo al dispararse.
    if (!pendientes.has(handle)) continue
    clearTimeout(handle)
    pendientes.delete(handle)
    if (pendientes.size === 0) escuchaTeclado(false)
    p.fn()
  }
}
