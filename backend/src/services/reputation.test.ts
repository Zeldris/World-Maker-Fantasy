import { describe, it, expect } from 'vitest';
import { FACTION_REP_MAX, FACTION_REP_MIN, applyFactionRepDelta, effectiveTemperamento, factionRepFor } from './reputation.js';

describe('factionRepFor', () => {
  it('devuelve el default neutro (2500) si la facción no tiene fila todavía', () => {
    expect(factionRepFor({}, 'Clan Serhu')).toBe(2500);
  });

  it('devuelve el valor guardado si ya existe', () => {
    expect(factionRepFor({ 'Clan Serhu': 4000 }, 'Clan Serhu')).toBe(4000);
  });
});

describe('applyFactionRepDelta', () => {
  it('acota por arriba en 5000', () => {
    const result = applyFactionRepDelta({ 'Clan Serhu': 4990 }, 'Clan Serhu', 30);
    expect(result['Clan Serhu']).toBe(FACTION_REP_MAX);
  });

  it('acota por abajo en 0', () => {
    const result = applyFactionRepDelta({ 'Clan Serhu': 100 }, 'Clan Serhu', -150);
    expect(result['Clan Serhu']).toBe(FACTION_REP_MIN);
  });

  it('parte del default neutro si la facción no tiene fila todavía', () => {
    const result = applyFactionRepDelta({}, 'Concordia de Hierro', -150);
    expect(result['Concordia de Hierro']).toBe(2350);
  });

  it('no muta el objeto original', () => {
    const original = { 'Clan Serhu': 2500 };
    applyFactionRepDelta(original, 'Clan Serhu', -150);
    expect(original['Clan Serhu']).toBe(2500);
  });
});

describe('effectiveTemperamento', () => {
  it('sin facción (fauna/independientes), devuelve el de catálogo sin tocar', () => {
    expect(effectiveTemperamento('CAUTELOSO', null, { 'Clan Serhu': 0 })).toBe('CAUTELOSO');
  });

  it('reputación neutra (2500, sin fila) no desplaza nada', () => {
    expect(effectiveTemperamento('INOFENSIVO', 'Clan Serhu', {})).toBe('INOFENSIVO');
  });

  it('reputación pésima (banda 0) empuja +2 escalones hacia ENEMIGO', () => {
    expect(effectiveTemperamento('INOFENSIVO', 'Clan Serhu', { 'Clan Serhu': 0 })).toBe('AGRESIVO');
    expect(effectiveTemperamento('CAUTELOSO', 'Clan Serhu', { 'Clan Serhu': 999 })).toBe('ENEMIGO');
  });

  it('reputación excelente (banda 4) empuja -2 escalones hacia AMIGABLE', () => {
    expect(effectiveTemperamento('AGRESIVO', 'Clan Serhu', { 'Clan Serhu': 5000 })).toBe('INOFENSIVO');
    expect(effectiveTemperamento('CAUTELOSO', 'Clan Serhu', { 'Clan Serhu': 4000 })).toBe('AMIGABLE');
  });

  it('nunca se sale de los extremos AMIGABLE/ENEMIGO por mucho que empuje la reputación', () => {
    expect(effectiveTemperamento('AMIGABLE', 'Clan Serhu', { 'Clan Serhu': 0 })).toBe('CAUTELOSO');
    expect(effectiveTemperamento('ENEMIGO', 'Clan Serhu', { 'Clan Serhu': 5000 })).toBe('CAUTELOSO');
  });
});
