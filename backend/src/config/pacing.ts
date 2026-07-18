/// Decisión técnica 5 (docs/04-decisiones-tecnicas.md): ritmo de generación en sesión activa.
/// Distinto del tick del worker de fondo (config/env.ts worldTickIntervalMinutes, escala de minutos).
export const pacing = {
  minDelayMs: Number(process.env.PACING_MIN_MS ?? 3000),
  maxDelayMs: Number(process.env.PACING_MAX_MS ?? 10000),
};

export function randomPacingDelayMs(): number {
  const { minDelayMs, maxDelayMs } = pacing;
  return minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
}
