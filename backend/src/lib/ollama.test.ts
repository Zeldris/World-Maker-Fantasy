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

// Registro opt-ai: cada llamada anota su tarea y los tiempos de Ollama (ns -> ms).
describe('registro opt-ai en ollamaGenerate', () => {
  it('registra la tarea, los tokens y los tiempos', async () => {
    vi.resetModules();
    const registrarLlamada = vi.fn();
    vi.doMock('./iaRegistro.js', async (orig) => ({ ...(await orig<typeof import('./iaRegistro.js')>()), registrarLlamada }));
    const raw = {
      response: 'hola',
      total_duration: 3_000_000_000,
      load_duration: 1_000_000_000,
      prompt_eval_duration: 500_000_000,
      eval_duration: 1_500_000_000,
      prompt_eval_count: 4096,
      eval_count: 20,
      done_reason: 'stop',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => raw }));
    const { ollamaGenerate: generar } = await import('./ollama.js');
    await generar({ model: 'm', prompt: 'p', tarea: 'clasificar', numCtx: 4096 });
    expect(registrarLlamada).toHaveBeenCalledTimes(1);
    expect(registrarLlamada.mock.calls[0][0]).toMatchObject({
      operation: 'text_completion',
      task: 'clasificar',
      model: 'm',
      durationMs: 3000,
      loadMs: 1000,
      prefillMs: 500,
      decodeMs: 1500,
      inputTokens: 4096,
      outputTokens: 20,
      truncated: true,
    });
    vi.unstubAllGlobals();
    vi.doUnmock('./iaRegistro.js');
  });
});
