import { describe, it, expect } from 'vitest';
import { checkAprenderOficio, nextGoirnosTrasCobro, REPUTACION_MINIMA_APRENDER_OFICIO, COSTE_GOIRNOS_APRENDER_OFICIO } from './learnProfession.js';

describe('checkAprenderOficio', () => {
  it('permite aprender con reputación suficiente y Goirnos suficientes', () => {
    const factionsStatus = { 'Clan Serhu': REPUTACION_MINIMA_APRENDER_OFICIO };
    expect(checkAprenderOficio(factionsStatus, 'Clan Serhu', false, COSTE_GOIRNOS_APRENDER_OFICIO)).toEqual({ permitido: true });
  });

  it('rechaza si el oficio ya se aprendió, antes de mirar nada más', () => {
    const factionsStatus = { 'Clan Serhu': 0 }; // reputación pésima, no debería importar
    expect(checkAprenderOficio(factionsStatus, 'Clan Serhu', true, 999)).toEqual({ permitido: false, motivo: 'ya_aprendido' });
  });

  it('rechaza con reputación por debajo del umbral, aunque haya de sobra en Goirnos', () => {
    const factionsStatus = { 'Clan Serhu': REPUTACION_MINIMA_APRENDER_OFICIO - 1 };
    expect(checkAprenderOficio(factionsStatus, 'Clan Serhu', false, 9999)).toEqual({ permitido: false, motivo: 'reputacion_insuficiente' });
  });

  it('rechaza con Goirnos insuficientes, aunque la reputación sea perfecta', () => {
    const factionsStatus = { 'Clan Serhu': 5000 };
    expect(checkAprenderOficio(factionsStatus, 'Clan Serhu', false, COSTE_GOIRNOS_APRENDER_OFICIO - 1)).toEqual({
      permitido: false,
      motivo: 'pago_insuficiente',
    });
  });

  it('una facción sin fila en factionsStatus cae al valor neutro por defecto (factionRepFor) — no cuenta como suficiente', () => {
    expect(checkAprenderOficio({}, 'Clan Serhu', false, COSTE_GOIRNOS_APRENDER_OFICIO)).toEqual({
      permitido: false,
      motivo: 'reputacion_insuficiente',
    });
  });
});

describe('nextGoirnosTrasCobro', () => {
  it('resta el coste normalmente', () => {
    expect(nextGoirnosTrasCobro(20, 10)).toBe(10);
  });

  it('nunca baja de 0, incluso con un coste mayor que el saldo (protección, no debería pasar en la práctica)', () => {
    expect(nextGoirnosTrasCobro(5, 10)).toBe(0);
  });

  it('sin tope superior — a diferencia de la reputación, los Goirnos no se acotan por arriba', () => {
    expect(nextGoirnosTrasCobro(999999, 0)).toBe(999999);
  });
});
