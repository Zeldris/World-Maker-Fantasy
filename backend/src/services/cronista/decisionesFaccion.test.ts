import { describe, it, expect } from 'vitest';
import { aceptaPropuesta, elegirDecision, opcionesDiplomaticas, type VistaFaccion, type VistaRelacion } from './decisionesFaccion.js';

const rel = (otroId: string, tipo: VistaRelacion['tipo'], soldadosOtro = 100, enemigoComun = false): VistaRelacion => ({ otroId, tipo, soldadosOtro, enemigoComun });
const vista = (v: Partial<VistaFaccion>): VistaFaccion => ({ id: 'yo', disposicion: 'NEUTRAL', tramo: 'SENSATO', soldados: 100, carencias: [], relaciones: [], ...v });
const acciones = (v: VistaFaccion) => opcionesDiplomaticas(v).map((o) => `${o.accion}:${o.objetivoId}`);

describe('decisiones de facción (CR-34 34c)', () => {
  it('sin líder no decide nada grande (Q8)', () => {
    expect(opcionesDiplomaticas(vista({ tramo: null, relaciones: [rel('a', 'NEUTRAL'), rel('b', 'TENSION', 10)] }))).toEqual([]);
  });

  it('cada banda abre lo suyo: tratado desde neutral, alianza solo desde tratado, guerra desde tensión, paz en guerra', () => {
    const v = vista({
      tramo: 'ESTRATEGA', soldados: 500,
      carencias: [{ tipo: 'SOLDADOS', gravedad: 'LEVE', enemigoId: 'g' }],
      relaciones: [rel('n', 'NEUTRAL'), rel('t', 'TRATADO_COMERCIAL', 100, true), rel('x', 'TENSION', 100), rel('g', 'GUERRA', 1000), rel('al', 'ALIANZA')],
    });
    expect(acciones(v).sort()).toEqual(['PEDIR_PAZ:g', 'PROPONER_ALIANZA:t', 'PROPONER_TRATADO:n']);
    // Sin guerra abierta, el estratega sí declara contra el más débil.
    expect(acciones({ ...v, carencias: [], relaciones: [rel('x', 'TENSION', 100)] })).toEqual(['DECLARAR_GUERRA:x']);
  });

  it('el estratega no abre una guerra que no puede ganar; el impulsivo sí', () => {
    const debil = { soldados: 50, relaciones: [rel('x', 'TENSION', 500)] };
    expect(acciones(vista({ ...debil, tramo: 'ESTRATEGA' }))).toEqual([]);
    expect(acciones(vista({ ...debil, tramo: 'IMPULSIVO', disposicion: 'BELICOSA' }))).toEqual(['DECLARAR_GUERRA:x']);
  });

  it('la disposición inclina: la mercantil busca tratados, la recelosa no, la belicosa presiona', () => {
    expect(opcionesDiplomaticas(vista({ disposicion: 'MERCANTIL', relaciones: [rel('n', 'NEUTRAL')] }))[0]!.puntuacion).toBeGreaterThan(2);
    expect(acciones(vista({ disposicion: 'RECELOSA', relaciones: [rel('n', 'NEUTRAL')] }))).toEqual([]);
    expect(acciones(vista({ disposicion: 'BELICOSA', relaciones: [rel('n', 'NEUTRAL')] }))).toContain('PRESIONAR:n');
  });

  it('elección por tramo: el estratega toma la mejor; el impulsivo a veces nada', () => {
    const opciones = [{ accion: 'PROPONER_TRATADO' as const, objetivoId: 'a', puntuacion: 1 }, { accion: 'DECLARAR_GUERRA' as const, objetivoId: 'b', puntuacion: 3 }];
    expect(elegirDecision(opciones, 'ESTRATEGA', () => 0.5)?.objetivoId).toBe('b');
    expect(elegirDecision(opciones, 'IMPULSIVO', () => 0.1)).toBeNull();
    expect(elegirDecision(opciones, 'IMPULSIVO', () => 0.9)?.objetivoId).toBe('b');
    expect(elegirDecision(opciones, null, () => 0.5)).toBeNull();
    expect(elegirDecision([], 'SENSATO', () => 0.5)).toBeNull();
  });

  it('la otra facción responde con su IA: tratado si le conviene, nunca en guerra; paz solo si también sufre', () => {
    const proponente = { id: 'p', soldados: 100 };
    expect(aceptaPropuesta('PROPONER_TRATADO', vista({ tramo: 'ESTRATEGA', relaciones: [rel('p', 'NEUTRAL')] }), proponente, () => 0.5)).toBe(true);
    expect(aceptaPropuesta('PROPONER_TRATADO', vista({ tramo: 'ESTRATEGA', disposicion: 'RECELOSA', relaciones: [rel('p', 'NEUTRAL')] }), proponente, () => 0.5)).toBe(false);
    expect(aceptaPropuesta('PROPONER_TRATADO', vista({ tramo: 'ESTRATEGA', relaciones: [rel('p', 'GUERRA')] }), proponente, () => 0.5)).toBe(false);
    expect(aceptaPropuesta('PEDIR_PAZ', vista({ tramo: 'ESTRATEGA', soldados: 500 }), { id: 'p', soldados: 60 }, () => 0.5)).toBe(false);
    expect(aceptaPropuesta('PEDIR_PAZ', vista({ tramo: 'ESTRATEGA', soldados: 500, carencias: [{ tipo: 'COMIDA', gravedad: 'LEVE' }] }), { id: 'p', soldados: 60 }, () => 0.5)).toBe(true);
    // La belicosa solo con una carencia grave.
    expect(aceptaPropuesta('PEDIR_PAZ', vista({ tramo: 'ESTRATEGA', disposicion: 'BELICOSA', soldados: 500, carencias: [{ tipo: 'COMIDA', gravedad: 'LEVE' }] }), { id: 'p', soldados: 60 }, () => 0.5)).toBe(false);
  });
});

describe('el Reino de la jugadora como destinatario (CR-34 34e, Q7)', () => {
  it('se le proponen pactos o se le presiona, nunca una guerra ni una paz', () => {
    const reino = (tipo: VistaRelacion['tipo']) => ({ ...rel('reino', tipo, 10), esReino: true });
    expect(acciones(vista({ relaciones: [reino('NEUTRAL')] }))).toEqual(['PROPONER_TRATADO:reino']);
    expect(acciones(vista({ tramo: 'ESTRATEGA', soldados: 1000, disposicion: 'BELICOSA', relaciones: [reino('TENSION')] }))).toEqual([]);
    expect(acciones(vista({ carencias: [{ tipo: 'SOLDADOS', gravedad: 'GRAVE', enemigoId: 'reino' }], relaciones: [reino('GUERRA')] }))).toEqual([]);
    expect(acciones(vista({ disposicion: 'BELICOSA', relaciones: [reino('NEUTRAL')] }))).toContain('PRESIONAR:reino');
  });
});

describe('pedir la paz se mide contra el enemigo de esa guerra (regresión, 2026-10-05)', () => {
  it('perder claramente una guerra pesa aunque la carencia de soldados apunte a otro enemigo más fuerte', () => {
    // Helsig (60) en guerra con Serhu (500) y en tensión con la Concordia (900): su carencia de soldados
    // señala a la Concordia, pero la paz con Serhu tiene que ganar a cualquier tratado.
    const v = vista({
      soldados: 60,
      carencias: [{ tipo: 'SOLDADOS', gravedad: 'GRAVE', enemigoId: 'concordia' }],
      relaciones: [rel('serhu', 'GUERRA', 500), rel('concordia', 'TENSION', 900), rel('obelisco', 'NEUTRAL'), rel('prisilke', 'NEUTRAL')],
    });
    const opciones = opcionesDiplomaticas(v);
    const paz = opciones.find((o) => o.accion === 'PEDIR_PAZ')!;
    expect(paz.objetivoId).toBe('serhu');
    expect(paz.puntuacion).toBeGreaterThan(Math.max(...opciones.filter((o) => o.accion !== 'PEDIR_PAZ').map((o) => o.puntuacion)));
  });
});
