import { describe, it, expect, vi, beforeEach } from 'vitest';

const fakeEnv = vi.hoisted(() => ({ iaRegistro: undefined as string | undefined, iaPerfil: 'desconocido', ollamaKeepAlive: '5m' }));
const appendFile = vi.hoisted(() => vi.fn());
vi.mock('../config/env.js', () => ({ env: fakeEnv }));
vi.mock('node:fs/promises', () => ({ appendFile }));

import { registrarLlamada, lineaRegistro, nsToMs, calcularTruncated, _reiniciarAviso } from './iaRegistro.js';

beforeEach(() => {
  appendFile.mockReset();
  appendFile.mockResolvedValue(undefined);
  fakeEnv.iaRegistro = undefined;
  fakeEnv.iaPerfil = 'desconocido';
  _reiniciarAviso();
});

describe('iaRegistro', () => {
  it('sin IA_REGISTRO no escribe nada', () => {
    registrarLlamada({ operation: 'text_completion' });
    expect(appendFile).not.toHaveBeenCalled();
  });

  it('con IA_REGISTRO escribe una línea JSON con los campos y sin null', () => {
    fakeEnv.iaRegistro = '/tmp/x.jsonl';
    fakeEnv.iaPerfil = 'deck';
    registrarLlamada({ operation: 'text_completion', provider: 'ollama', model: 'm', task: 'narrar', inputTokens: 10, error: undefined });
    expect(appendFile).toHaveBeenCalledTimes(1);
    const [ruta, linea] = appendFile.mock.calls[0] as [string, string];
    expect(ruta).toBe('/tmp/x.jsonl');
    expect(linea.endsWith('\n')).toBe(true);
    const o = JSON.parse(linea);
    expect(o).toMatchObject({
      'gen_ai.operation.name': 'text_completion',
      'gen_ai.provider.name': 'ollama',
      'gen_ai.request.model': 'm',
      'gen_ai.usage.input_tokens': 10,
      'app.task': 'narrar',
      'app.machine_profile': 'deck',
    });
    expect(typeof o.ts).toBe('string');
    expect(linea).not.toContain('null');
    expect(o['app.error']).toBeUndefined();
  });

  it('pasa ns a ms y calcula truncated', () => {
    expect(nsToMs(1_500_000)).toBe(1.5);
    expect(nsToMs(undefined)).toBeUndefined();
    expect(calcularTruncated(4096, 4096)).toBe(true);
    expect(calcularTruncated(100, 4096)).toBe(false);
    expect(calcularTruncated(100, undefined)).toBeUndefined();
    const o = JSON.parse(lineaRegistro({ operation: 'text_completion', loadMs: nsToMs(2e9), truncated: false }, 'cpu'));
    expect(o['app.load_ms']).toBe(2000);
    expect(o['app.truncated']).toBe(false);
  });

  it('no lanza si falla la escritura (aviso único)', async () => {
    fakeEnv.iaRegistro = '/no/existe/x.jsonl';
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    appendFile.mockRejectedValue(new Error('ENOENT'));
    expect(() => registrarLlamada({ operation: 'embeddings' })).not.toThrow();
    expect(() => registrarLlamada({ operation: 'embeddings' })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(aviso).toHaveBeenCalledTimes(1);
    appendFile.mockImplementation(() => {
      throw new Error('síncrono');
    });
    expect(() => registrarLlamada({ operation: 'embeddings' })).not.toThrow();
    aviso.mockRestore();
  });
});
