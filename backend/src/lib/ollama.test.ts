import { describe, it, expect, vi, afterEach } from 'vitest';
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('./iaRegistro.js');
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
      durationMs: expect.any(Number),
      loadMs: 1000,
      prefillMs: 500,
      decodeMs: 1500,
      inputTokens: 4096,
      outputTokens: 20,
      truncated: true,
    });
  });
});

// QA-162: sin `numCtx` en la llamada, el registro saca el contexto efectivo de Ollama y el intento.
describe('num_ctx efectivo e intento en el registro', () => {
  const raw = { response: '{}', prompt_eval_count: 2050, eval_count: 5, done_reason: 'stop' };
  // `ps`: lo que hay cargado; `parametros`: los del Modelfile en /api/show.
  async function preparar(ps: { name: string; context_length: number }[], parametros = '') {
    vi.resetModules();
    vi.useFakeTimers();
    const registrarLlamada = vi.fn();
    vi.doMock('./iaRegistro.js', async (orig) => ({ ...(await orig<typeof import('./iaRegistro.js')>()), registrarLlamada }));
    vi.doMock('../config/env.js', async (orig) => {
      const real = await orig<typeof import('../config/env.js')>();
      return { env: { ...real.env, iaRegistro: '/tmp/x.jsonl' } };
    });
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/api/ps')
        ? { ok: true, json: async () => ({ models: ps }) }
        : url.endsWith('/api/show')
          ? { ok: true, json: async () => ({ parameters: parametros }) }
          : { ok: true, json: async () => raw },
    );
    vi.stubGlobal('fetch', fetchMock);
    const { ollamaGenerate } = await import('./ollama.js');
    return { generar: ollamaGenerate, registrarLlamada, fetchMock };
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock('../config/env.js');
  });

  it('sin num_ctx en el Modelfile, lee context_length de /api/ps a los 4 s y lo usa en las llamadas siguientes', async () => {
    const { generar, registrarLlamada } = await preparar([{ name: 'q:1.5b', context_length: 4096 }]);
    await generar({ model: 'q:1.5b', prompt: 'x'.repeat(20_000), intento: 3 });
    expect(registrarLlamada.mock.calls[0][0]).toMatchObject({ intento: 3 });
    expect(registrarLlamada.mock.calls[0][0].numCtx).toBeUndefined();
    await vi.advanceTimersByTimeAsync(4_000);
    await generar({ model: 'q:1.5b', prompt: 'x'.repeat(20_000) });
    expect(registrarLlamada.mock.calls[1][0]).toMatchObject({ numCtx: 4096, truncated: true });
  });

  it('el Modelfile manda sobre el runner cargado con otro numCtx, y solo se anota el modelo pedido', async () => {
    const { generar, registrarLlamada } = await preparar(
      [
        { name: 'q:1.5b', context_length: 8192 },
        { name: 'narrador:latest', context_length: 8192 },
      ],
      'num_ctx 4096\ntemperature 0.7',
    );
    await generar({ model: 'q:1.5b', prompt: 'p' });
    await vi.advanceTimersByTimeAsync(4_000);
    await generar({ model: 'q:1.5b', prompt: 'p' });
    expect(registrarLlamada.mock.calls[1][0].numCtx).toBe(4096);
    const { ctxEfectivo } = await import('./ollama.js');
    expect(ctxEfectivo('narrador')).toBeUndefined();
  });

  it('una sola consulta por modelo aunque lleguen varias llamadas antes de la respuesta', async () => {
    const { generar, fetchMock } = await preparar([{ name: 'q:1.5b', context_length: 4096 }]);
    await Promise.all([generar({ model: 'q:1.5b', prompt: 'p' }), generar({ model: 'q:1.5b', prompt: 'p' })]);
    await vi.advanceTimersByTimeAsync(4_000);
    const consultas = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/show') || String(url).endsWith('/api/ps'));
    expect(consultas).toHaveLength(2);
  });
});

function streamDe(lineas: string[], finalSinSalto = false, cancel = vi.fn(async () => {})) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < lineas.length
            ? { done: false, value: enc.encode(lineas[i++] + (finalSinSalto && i === lineas.length ? '' : '\n')) }
            : { done: true, value: undefined },
        cancel,
      }),
    },
  };
}

async function cargar() {
  vi.resetModules();
  const registrarLlamada = vi.fn();
  vi.doMock('./iaRegistro.js', async (orig) => ({ ...(await orig<typeof import('./iaRegistro.js')>()), registrarLlamada }));
  const mod = await import('./ollama.js');
  return { registrarLlamada, ...mod };
}

describe('registro opt-ai en ollamaGenerateStream', () => {
  it('una línea con error lanza y se registra como error', async () => {
    const { registrarLlamada, ollamaGenerateStream } = await cargar();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamDe([JSON.stringify({ response: 'ho' }), JSON.stringify({ error: 'modelo roto' })])));
    await expect(ollamaGenerateStream({ model: 'm', prompt: 'p' }, () => {})).rejects.toThrow('modelo roto');
    expect(registrarLlamada.mock.calls[0][0]).toMatchObject({ finishReason: 'error', error: 'modelo roto' });
  });

  it('procesa la última línea aunque no acabe en salto de línea', async () => {
    const { registrarLlamada, ollamaGenerateStream } = await cargar();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamDe([JSON.stringify({ response: 'a' }), JSON.stringify({ response: 'b', done: true, done_reason: 'stop', eval_count: 7 })], true)));
    const r = await ollamaGenerateStream({ model: 'm', prompt: 'p' }, () => {});
    expect(r.text).toBe('ab');
    expect(registrarLlamada.mock.calls[0][0].error).toBeUndefined();
    expect(registrarLlamada.mock.calls[0][0]).toMatchObject({ outputTokens: 7 });
  });

  it('ante una línea de error cancela la lectura antes de lanzar', async () => {
    const { ollamaGenerateStream } = await cargar();
    const cancel = vi.fn(async () => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamDe([JSON.stringify({ error: 'roto' })], false, cancel)));
    await expect(ollamaGenerateStream({ model: 'm', prompt: 'p' }, () => {})).rejects.toThrow('roto');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('un stream sin done:true se registra como «stream incompleto»', async () => {
    const { registrarLlamada, ollamaGenerateStream } = await cargar();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamDe([JSON.stringify({ response: 'hola' })])));
    const r = await ollamaGenerateStream({ model: 'm', prompt: 'p' }, () => {});
    expect(r.text).toBe('hola');
    expect(registrarLlamada.mock.calls[0][0]).toMatchObject({ finishReason: 'error', error: 'stream incompleto' });
  });

  it('un stream completo no suma undefined y no registra error', async () => {
    const { registrarLlamada, ollamaGenerateStream } = await cargar();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamDe([JSON.stringify({ response: 'a' }), JSON.stringify({ done: true, done_reason: 'stop' })])));
    const r = await ollamaGenerateStream({ model: 'm', prompt: 'p' }, () => {});
    expect(r.text).toBe('a');
    expect(registrarLlamada.mock.calls[0][0].error).toBeUndefined();
  });
});

describe('timeout en ollamaGenerate', () => {
  it('app.error lleva el mensaje traducido, no el del AbortError', async () => {
    const { registrarLlamada, ollamaGenerate } = await cargar();
    const abort = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(ollamaGenerate({ model: 'm', prompt: 'p', timeoutMs: 50 })).rejects.toThrow(/no respondió en 50ms/);
    expect(registrarLlamada.mock.calls[0][0].error).toMatch(/no respondió en 50ms/);
  });
});
