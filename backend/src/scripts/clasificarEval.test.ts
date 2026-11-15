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
    const caso = parseCasos('{"id":"a","accion":"Ataco a \'Orco\' con el hacha","npc":{"nombre":"Orco","temperamento":"CAUTELOSO"},"esperado":{"tirada":true,"saludoOPregunta":false,"amenaza":true,"combate":true},"origen":"P1"}')[0];
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

  const caso = (accion: string, temperamento: string, extra = '') =>
    parseCasos(
      JSON.stringify({ id: 'x', accion, npc: { nombre: 'Torgash', temperamento }, esperado: { tirada: false, saludoOPregunta: false, amenaza: false, combate: false, ...JSON.parse(extra || '{}') }, origen: 'T' }),
    )[0];

  it('aceptar ayudar con verbo de ataque no es ataque (como turn.ts): ni tabla, ni combate, ni amenaza', async () => {
    const c = caso('Cuenta conmigo, acabaré con el que te persigue', 'AMIGABLE');
    const o = await decidir(c, modelo(false));
    expect(o.capaTirada).toBe('modelo clasificar');
    expect(o.combate).toBe(false);
    expect(o.amenaza).toBe(false);
  });

  it('un ataque a un NPC CAUTELOSO no citado no abre combate; citado entre comillas, sí (forcedCombatSlugs)', async () => {
    const sinCitar = await decidir(caso('Ataco a Torgash con el hacha', 'CAUTELOSO'), sinModelo);
    expect(sinCitar.combate).toBe(false);
    expect(sinCitar.capaTirada).toBe('regla: tabla de ataque');
    const citado = await decidir(caso("Ataco a 'Torgash' con el hacha", 'CAUTELOSO'), sinModelo);
    expect(citado.combate).toBe(true);
    const noPacifico = await decidir(caso('Ataco a Torgash con el hacha', 'ENEMIGO'), sinModelo);
    expect(noPacifico.combate).toBe(true);
  });

  it('hablar sin más no es amenaza: solo el verbo de ataque o de violencia', async () => {
    const relato = await decidir(caso('Le cuento a Torgash lo que vi en el río', 'CAUTELOSO'), modelo(false));
    expect(relato.amenaza).toBe(false);
    const mentira = await decidir(caso('Le miento a Torgash y le digo que no vi nada', 'CAUTELOSO'), modelo(false));
    expect(mentira.saludoOPregunta).toBe(false);
    expect(mentira.amenaza).toBe(false);
    const violencia = await decidir(caso('Le digo a Torgash que lo voy a matar', 'CAUTELOSO'), modelo(false));
    expect(violencia.amenaza).toBe(true);
  });

  it('el clasificador recibe la línea de calibración del NPC, y sin NPC null', async () => {
    let recibido: string | null | undefined;
    const espia = async (_a: string, cal: string | null) => {
      recibido = cal;
      return modelo(false)();
    };
    await decidir(caso('Observo el campamento', 'CAUTELOSO'), espia);
    expect(recibido).toMatch(/Torgash.*nivel 3/);
    await decidir({ ...caso('Observo el campamento', 'CAUTELOSO'), npc: null }, espia);
    expect(recibido).toBeNull();
  });

  it('parseCasos valida saludoOPregunta, amenaza y el temperamento del NPC con un error claro', () => {
    const base = { id: 'a', accion: 'Hola', origen: 'P', esperado: { tirada: false, saludoOPregunta: true, amenaza: false, combate: false } };
    const linea = (o: object) => JSON.stringify({ ...base, ...o });
    expect(() => parseCasos(linea({ esperado: { ...base.esperado, amenaza: 'no' } }))).toThrow(/línea 1: esperado\.amenaza/);
    expect(() => parseCasos(linea({ esperado: { tirada: false, combate: false } }))).toThrow(/esperado\.saludoOPregunta/);
    expect(() => parseCasos(linea({ npc: { nombre: 'T', temperamento: 'FURIOSO' } }))).toThrow(/temperamento «FURIOSO»/);
    expect(parseCasos(linea({ npc: { nombre: 'T', temperamento: 'ENEMIGO' } }))).toHaveLength(1);
  });
});
