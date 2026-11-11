import { describe, it, expect } from 'vitest';
import { parseCasos, decidir, diferencias } from './clasificarEval.js';

const sinModelo = async () => {
  throw new Error('no debería llamar al modelo');
};
const modelo = (requiereTirada: boolean) => async () =>
  ({ requiereTirada, atributo: 'fuerza', dificultad: 22, razon: '', banda: 'instantanea', duracionEstimadaMinutos: 0 }) as never;

describe('clasificar-eval (QA-309)', () => {
  it('lee casos JSONL y rechaza una línea rota o incompleta', () => {
    const ok = '{"id":"a","accion":"Hola","esperado":{"tirada":false,"saludoOPregunta":true,"amenaza":false,"combate":false},"origen":"P1"}\n\n';
    expect(parseCasos(ok)).toHaveLength(1);
    expect(() => parseCasos('{no')).toThrow(/línea 1 no es JSON/);
    expect(() => parseCasos('{"id":"a"}')).toThrow(/faltan/);
  });

  it('un ataque con NPC lo decide la tabla, sin modelo', async () => {
    const caso = parseCasos('{"id":"a","accion":"Ataco al orco con el hacha","npc":{"nombre":"Orco","temperamento":"CAUTELOSO"},"esperado":{"tirada":true,"saludoOPregunta":false,"amenaza":true,"combate":true},"origen":"P1"}')[0];
    const o = await decidir(caso, sinModelo);
    expect(o.capaTirada).toBe('regla: tabla de ataque');
    expect(diferencias(caso, o)).toEqual([]);
  });

  it('un saludo apaga la tirada que pide el modelo, y se informa de la diferencia si no coincide', async () => {
    const caso = parseCasos('{"id":"a","accion":"Saludo a Torgash y le pregunto por la caza","npc":{"nombre":"T","temperamento":"CAUTELOSO"},"esperado":{"tirada":true,"saludoOPregunta":true,"amenaza":false,"combate":false},"origen":"P1"}')[0];
    const o = await decidir(caso, modelo(true));
    expect(o.capaTirada).toBe('regla: saludo apaga la tirada');
    expect(diferencias(caso, o)[0]).toMatch(/^tirada \(esperado true, obtenido false/);
  });
});
