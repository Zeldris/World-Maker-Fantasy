import { describe, it, expect } from 'vitest';
import { estadisticas, medirStreamNarracion, parsearOpciones } from './benchmarkTurnoLib.js';

/// Fase F del hito 0.1 — benchmark de latencia de turno.
describe('benchmarkTurnoLib', () => {
  it('opciones por defecto y desde la línea de órdenes', () => {
    expect(parsearOpciones([], {})).toEqual({ url: 'http://localhost:3001', turnos: 5, saveId: null, conservar: false, salida: null });
    expect(parsearOpciones(['--turnos', '10', '--url', 'http://deck:3001/', '--conservar', '--save', 's1', '--salida', 'x.json'], {})).toEqual({
      url: 'http://deck:3001', turnos: 10, saveId: 's1', conservar: true, salida: 'x.json',
    });
    expect(parsearOpciones([], { API_URL: 'http://otra:3001' }).url).toBe('http://otra:3001');
    expect(() => parsearOpciones(['--turnos', '0'], {})).toThrow();
    expect(() => parsearOpciones(['--rapido'], {})).toThrow('Opción desconocida');
  });

  it('mediana, p90 y máximo', () => {
    expect(estadisticas([])).toBeNull();
    expect(estadisticas([1000, 3000, 2000, 10000, 4000, 5000, 6000, 7000, 8000, 9000])).toEqual({ n: 10, mediana: 5000, p90: 9000, max: 10000 });
    expect(estadisticas([1500])).toEqual({ n: 1, mediana: 1500, p90: 1500, max: 1500 });
  });

  it('mide la primera línea y la de done de un stream NDJSON partido en trozos', async () => {
    const trozos = ['{"type":"exc', 'hange"}\n{"type":"chunk","text":"a"}\n', '{"type":"done"}\n'];
    const cuerpo = new ReadableStream<Uint8Array>({
      start(c) {
        for (const t of trozos) c.enqueue(new TextEncoder().encode(t));
        c.close();
      },
    });
    let reloj = 0;
    const r = await medirStreamNarracion(cuerpo, () => ++reloj);
    expect(r).toEqual({ primeraLinea: 1, fin: 2, error: null });
  });

  it('recoge el error del stream', async () => {
    const cuerpo = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"type":"error","message":"Error narrando el turno"}\n'));
        c.close();
      },
    });
    const r = await medirStreamNarracion(cuerpo, () => 5);
    expect(r.error).toBe('Error narrando el turno');
    expect(r.fin).toBeNull();
  });
});
