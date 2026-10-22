import { describe, it, expect, vi, beforeEach } from 'vitest';

const fakeEnv = vi.hoisted(() => ({ iaRegistro: undefined as string | undefined, iaCasos: undefined as string | undefined, iaPerfil: 'desconocido', ollamaKeepAlive: '5m' }));
const appendFile = vi.hoisted(() => vi.fn());
vi.mock('../config/env.js', () => ({ env: fakeEnv }));
vi.mock('node:fs/promises', () => ({ appendFile }));

import { registrarLlamada, registrarCaso, lineaRegistro, nsToMs, calcularTruncated, _reiniciarAviso, abrirTurnoIa, seguirTurnoIa, ambitoTurnoIa } from './iaRegistro.js';

beforeEach(() => {
  appendFile.mockReset();
  appendFile.mockResolvedValue(undefined);
  fakeEnv.iaRegistro = undefined;
  fakeEnv.iaCasos = undefined;
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
    // QA-162: Ollama ya recortado cuenta lo que queda; el largo del prompt lo delata.
    expect(calcularTruncated(2050, 4096, 20_000)).toBe(true);
    expect(calcularTruncated(3000, 8192, 20_000)).toBe(false);
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

  it('evento de rechazo: sin operación, con intento y motivo (QA-162)', () => {
    const o = JSON.parse(lineaRegistro({ evento: 'rechazo', task: 'narrar', intento: 1, rechazo: 'segunda persona' }, 'deck'));
    expect(o).toMatchObject({ 'app.evento': 'rechazo', 'app.task': 'narrar', 'app.intento': 1, 'app.rechazo': 'segunda persona' });
    expect(o['gen_ai.operation.name']).toBeUndefined();
  });

  it('classify abre el turno y narrate de la misma partida lo sigue (QA-162)', async () => {
    fakeEnv.iaRegistro = '/tmp/x.jsonl';
    const turnoDe = async (fn: () => void) => {
      let id: unknown;
      await new Promise<void>((resolve) =>
        setImmediate(async () => {
          fn();
          await Promise.resolve();
          id = JSON.parse(lineaRegistro({ operation: 'text_completion' }, 'deck'))['app.turno'];
          resolve();
        }),
      );
      return id;
    };
    const abierto = await turnoDe(() => abrirTurnoIa('p1'));
    expect(typeof abierto).toBe('string');
    expect(await turnoDe(() => seguirTurnoIa('p1'))).toBe(abierto);
    const suelto = await turnoDe(() => seguirTurnoIa('p1'));
    expect(suelto).not.toBe(abierto); // narrate sin classify antes: turno nuevo
  });

  it('el turno no pasa a la petición siguiente: cada una abre su ámbito', async () => {
    fakeEnv.iaRegistro = '/tmp/x.jsonl';
    const enPeticion = (fn: () => void) =>
      new Promise<unknown>((resolve) =>
        ambitoTurnoIa(() => {
          fn();
          setImmediate(() => resolve(JSON.parse(lineaRegistro({ operation: 'text_completion' }, 'deck'))['app.turno']));
        }),
      );
    expect(typeof (await enPeticion(() => abrirTurnoIa('p3')))).toBe('string');
    expect(await enPeticion(() => {})).toBeUndefined();
  });

  it('sin IA_REGISTRO no hay turno', async () => {
    let id: unknown = 'x';
    await new Promise<void>((resolve) =>
      setImmediate(() => {
        abrirTurnoIa('p2');
        id = JSON.parse(lineaRegistro({ operation: 'text_completion' }, 'deck'))['app.turno'];
        resolve();
      }),
    );
    expect(id).toBeUndefined();
  });
});

describe('registrarCaso (QA-176)', () => {
  const caso = { tarea: 'narrar', modelo: 'm', prompt: 'P completo', temperature: 0.7, numCtx: 8192, salida: 'texto' };

  it('sin IA_CASOS no escribe nada', () => {
    registrarCaso(caso);
    expect(appendFile).not.toHaveBeenCalled();
  });

  it('con IA_CASOS escribe el caso en el formato de banco-calidad.py, sin campos vacíos', () => {
    fakeEnv.iaCasos = '/tmp/casos.jsonl';
    registrarCaso(caso);
    const [ruta, linea] = appendFile.mock.calls[0] as [string, string];
    expect(ruta).toBe('/tmp/casos.jsonl');
    const o = JSON.parse(linea);
    expect(o.id).toMatch(/^narrar-[0-9a-f]{8}$/);
    expect(o).toMatchObject({ tarea: 'narrar', modelo: 'm', prompt: 'P completo', opciones: { temperature: 0.7, num_ctx: 8192 }, salida: 'texto' });
    expect('system' in o).toBe(false);
    expect('max_tokens' in o.opciones).toBe(false);
  });

  it('guarda el JSON Schema de las llamadas estructuradas, para volver a pedirlas igual', () => {
    fakeEnv.iaCasos = '/tmp/casos.jsonl';
    registrarCaso({ ...caso, format: { type: 'object' } });
    const o = JSON.parse((appendFile.mock.calls[0] as [string, string])[1]);
    expect(o.opciones.format).toEqual({ type: 'object' });
  });
});
