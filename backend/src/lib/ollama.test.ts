import { describe, it, expect } from 'vitest';
import { queueTimeoutFor } from './ollama.js';

// Bug real (2026-08-31): `ollamaQueue.enqueue` nunca recibía `queueTimeoutMs` explícito desde
// `ollama.ts`, así que siempre usaba el default de la cola (150s) — pero `narrador.ts` pide
// `timeoutMs: 240_000` para el reintento de narración (attempt2), más largo que ese default. El
// guard de cola disparaba ANTES de que el AbortController interno, más largo, tuviera ocasión de
// actuar, cortando intentos legítimos de forma prematura. `queueTimeoutFor` cierra ese hueco.
describe('queueTimeoutFor', () => {
  it('añade 30s de margen sobre el timeoutMs pedido, para que el AbortController interno actúe primero', () => {
    expect(queueTimeoutFor({ model: 'x', prompt: 'y', timeoutMs: 90_000 })).toBe(120_000);
    expect(queueTimeoutFor({ model: 'x', prompt: 'y', timeoutMs: 240_000 })).toBe(270_000);
  });

  it('sin timeoutMs, no impone ningún guard de cola propio (usa el default de la cola)', () => {
    expect(queueTimeoutFor({ model: 'x', prompt: 'y' })).toBeUndefined();
  });
});
