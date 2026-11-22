import { describe, it, expect, vi, beforeEach } from 'vitest';

const fakeEnv = vi.hoisted(() => ({ iaRegistro: undefined as string | undefined, iaCasos: undefined as string | undefined, iaPerfil: 'desconocido', ollamaKeepAlive: '5m' }));
const appendFile = vi.hoisted(() => vi.fn());
vi.mock('../config/env.js', () => ({ env: fakeEnv }));
vi.mock('node:fs/promises', () => ({ appendFile }));

import { registrarLlamada, registrarCaso, lineaRegistro, prefijoComun, prefijoBloque, prefijoBloqueYLinea, prefijoBloqueAjeno, nsToMs, calcularTruncated, _reiniciarAviso, abrirTurnoIa, seguirTurnoIa, ambitoTurnoIa, fijarViaTurnoIa } from './iaRegistro.js';

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
    const t = JSON.parse(lineaRegistro({ evento: 'rechazo', task: 'narrar', intento: 1, rechazo: 'segunda persona', rechazoTexto: 'Miras al norte.' }, 'deck'));
    expect(t['app.rechazo_texto']).toBe('Miras al norte.');
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

  it('QA-510: la vía y el interlocutor del turno salen en sus líneas, y no en el turno siguiente', async () => {
    fakeEnv.iaRegistro = '/tmp/x.jsonl';
    const leer = (fn: () => void) =>
      new Promise<Record<string, unknown>>((resolve) =>
        ambitoTurnoIa(() => {
          fn();
          setImmediate(() => resolve(JSON.parse(lineaRegistro({ operation: 'text_completion' }, 'deck'))));
        }),
      );
    const dialogo = await leer(() => fijarViaTurnoIa('dialogo_puro', 'ulkha-ketg'));
    expect(dialogo['app.via']).toBe('dialogo_puro');
    expect(dialogo['app.interlocutor']).toBe('ulkha-ketg');
    const narrar = await leer(() => fijarViaTurnoIa('narrar', null));
    expect(narrar['app.via']).toBe('narrar');
    expect('app.interlocutor' in narrar).toBe(false);
    const nada = await leer(() => {});
    expect('app.via' in nada).toBe(false);
  });

  it('QA-510: sin IA_REGISTRO la vía no se apunta', async () => {
    const linea = await new Promise<Record<string, unknown>>((resolve) =>
      ambitoTurnoIa(() => {
        fijarViaTurnoIa('narrar', 'x');
        setImmediate(() => resolve(JSON.parse(lineaRegistro({ operation: 'text_completion' }, 'deck'))));
      }),
    );
    expect('app.via' in linea).toBe(false);
  });

  it('QA-510: una fila rechazo lleva app.prompt_chars', () => {
    const l = JSON.parse(lineaRegistro({ evento: 'rechazo', task: 'narrar', intento: 1, rechazo: 'x', promptChars: 1234 }, 'deck'));
    expect(l['app.prompt_chars']).toBe(1234);
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

describe('prefijoComun (QA-502)', () => {
  it('cuenta los caracteres que comparte con la llamada anterior del mismo modelo, no de otro', () => {
    expect(prefijoComun('qa502-a', 'CABECERA hechos 1')).toEqual({ promptChars: 17, prefijoComunChars: 0 });
    expect(prefijoComun('qa502-b', 'CABECERA otra cosa')).toEqual({ promptChars: 18, prefijoComunChars: 0 });
    expect(prefijoComun('qa502-a', 'CABECERA hechos 2 y más')).toEqual({ promptChars: 23, prefijoComunChars: 16 });
  });

  it('va al registro como app.prompt_chars y app.prefijo_comun_chars', () => {
    const o = JSON.parse(lineaRegistro({ operation: 'text_completion', promptChars: 100, prefijoComunChars: 40 }, 'deck'));
    expect(o['app.prompt_chars']).toBe(100);
    expect(o['app.prefijo_comun_chars']).toBe(40);
  });
});

describe('prefijoBloque (QA-507)', () => {
  const b = (...t: string[]) => t.map((texto, i) => ({ nombre: `b${i}`, texto }));

  it('da el primer bloque que difiere de la última lista del mismo modelo', () => {
    expect(prefijoBloque('qa507-a', b('x', 'y', 'z'))).toBe('inicio');
    expect(prefijoBloque('qa507-b', b('x', 'q'))).toBe('inicio');
    expect(prefijoBloque('qa507-a', b('x', 'y2', 'z2'))).toBe('b1');
    expect(prefijoBloque('qa507-a', b('x', 'y2', 'z2'))).toBe('ninguno');
    expect(prefijoBloque('qa507-a', b('x', 'y2', 'z2', 'extra'))).toBe('b3');
    expect(prefijoBloque('qa507-a', b('x2'))).toBe('b0');
  });

  it('una llamada al modelo sin bloques desaloja la caché: la siguiente con bloques da «otra», no «ninguno»', () => {
    expect(prefijoBloque('qa507-c', b('x', 'y'))).toBe('inicio');
    prefijoBloqueAjeno('qa507-c');
    expect(prefijoBloque('qa507-c', b('x', 'y'))).toBe('otra');
    expect(prefijoBloque('qa507-c', b('x', 'y'))).toBe('ninguno');
  });

  it('dice el principio de la línea donde se corta dentro del bloque (QA-509)', () => {
    const h = (t: string) => [{ nombre: 'ej', texto: 'fijo' }, { nombre: 'hechos', texto: t }];
    expect(prefijoBloqueYLinea('qa509-a', h('HECHOS:\n- UBICACIÓN: X\n- ESTADO ACTUAL DEL PERSONAJE: herido.\n- y'))).toEqual({ bloque: 'inicio' });
    expect(prefijoBloqueYLinea('qa509-a', h('HECHOS:\n- UBICACIÓN: X\n- ESTADO ACTUAL DEL PERSONAJE: malherido, apenas se tiene en pie y sangra.\n- y'))).toEqual({
      bloque: 'hechos',
      linea: '- ESTADO ACTUAL DEL PERSONAJE: malherido, apenas',
    });
    expect(prefijoBloqueYLinea('qa509-a', [{ nombre: 'otro', texto: 'fijo' }])).toEqual({ bloque: 'otro' });
    expect(JSON.parse(lineaRegistro({ operation: 'text_completion', prefijoBloque: 'hechos', prefijoLinea: '- ESTADO' }, 'deck'))['app.prefijo_linea']).toBe('- ESTADO');
  });

  it('va al registro como app.prefijo_bloque y sin bloques no se escribe', () => {
    expect(JSON.parse(lineaRegistro({ operation: 'text_completion', prefijoBloque: 'hechos' }, 'deck'))['app.prefijo_bloque']).toBe('hechos');
    expect('app.prefijo_bloque' in JSON.parse(lineaRegistro({ operation: 'text_completion' }, 'deck'))).toBe(false);
  });
});
