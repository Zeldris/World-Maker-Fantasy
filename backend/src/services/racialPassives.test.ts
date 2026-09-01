import { describe, it, expect } from 'vitest';
import { ownRacialAdvantageFor, rivalRacialDisadvantageAgainst } from './racialPassives.js';

/// Pasivas raciales (2026-08-28, pendiente 2026-08-27 punto 4, "de 2 raciales activas a 1
/// pasiva") — diseño cerrado con la usuaria: Goirntes (ventaja al defenderse contra ataques
/// físicos, nunca mágicos — "todos los attr son fisicos menos la Magia"), Orcos (desventaja al
/// rival que intenta CONTROL sobre ellos), Nabieus (desventaja al rival que intenta INTIMIDACION),
/// Faerus (ventaja en el primer intercambio de cada combate).

describe('ownRacialAdvantageFor', () => {
  it('Goirntes defendiéndose contra un ataque físico (no de magia): ventaja', () => {
    const result = ownRacialAdvantageFor('goirntes', 'defensa', 'fuerza', false);
    expect(result.rollMode).toBe('ventaja');
    expect(result.racialAdvantageReason).toMatch(/Piel Quitinosa/);
  });

  it('Goirntes defendiéndose contra un ataque de MAGIA: sin ventaja — "todos los attr son fisicos menos la Magia"', () => {
    const result = ownRacialAdvantageFor('goirntes', 'defensa', 'magia', false);
    expect(result.rollMode).toBe('normal');
    expect(result.racialAdvantageReason).toBeUndefined();
  });

  it('Goirntes ATACANDO (no defendiendo): sin ventaja — la pasiva es solo al defenderse', () => {
    const result = ownRacialAdvantageFor('goirntes', 'ataque', 'fuerza', false);
    expect(result.rollMode).toBe('normal');
  });

  it('Faerus en el primer intercambio de un combate nuevo: ventaja, sin importar el rol', () => {
    expect(ownRacialAdvantageFor('faerus', 'ataque', 'fuerza', true).rollMode).toBe('ventaja');
    expect(ownRacialAdvantageFor('faerus', 'defensa', 'fuerza', true).rollMode).toBe('ventaja');
  });

  it('Faerus en un intercambio NO inicial (combate ya en marcha): sin ventaja', () => {
    const result = ownRacialAdvantageFor('faerus', 'ataque', 'fuerza', false);
    expect(result.rollMode).toBe('normal');
  });

  it('Orcos y Nabieus no tienen pasiva PROPIA (la suya es una penalización al rival, ver el otro describe)', () => {
    expect(ownRacialAdvantageFor('orcos', 'defensa', 'fuerza', true).rollMode).toBe('normal');
    expect(ownRacialAdvantageFor('nabieus', 'defensa', 'fuerza', true).rollMode).toBe('normal');
  });

  it('raza null (partida sin raza asignada) nunca da ventaja', () => {
    expect(ownRacialAdvantageFor(null, 'defensa', 'fuerza', true).rollMode).toBe('normal');
  });
});

describe('rivalRacialDisadvantageAgainst', () => {
  it('CONTROL contra un Orco: desventaja para quien lo intenta', () => {
    const result = rivalRacialDisadvantageAgainst('orcos', ['CONTROL']);
    expect(result.rollMode).toBe('desventaja');
    expect(result.racialAdvantageReason).toMatch(/Orco/);
  });

  it('INTIMIDACION contra un Nabieu: desventaja para quien lo intenta', () => {
    const result = rivalRacialDisadvantageAgainst('nabieus', ['INTIMIDACION']);
    expect(result.rollMode).toBe('desventaja');
    expect(result.racialAdvantageReason).toMatch(/Nabieu/);
  });

  it('CONTROL contra un Nabieu (efecto equivocado para esa raza): sin desventaja', () => {
    expect(rivalRacialDisadvantageAgainst('nabieus', ['CONTROL']).rollMode).toBe('normal');
  });

  it('INTIMIDACION contra un Orco (efecto equivocado para esa raza): sin desventaja', () => {
    expect(rivalRacialDisadvantageAgainst('orcos', ['INTIMIDACION']).rollMode).toBe('normal');
  });

  it('CONTROL/INTIMIDACION contra Goirntes/Faerus: sin desventaja (no son su pasiva)', () => {
    expect(rivalRacialDisadvantageAgainst('goirntes', ['CONTROL']).rollMode).toBe('normal');
    expect(rivalRacialDisadvantageAgainst('faerus', ['INTIMIDACION']).rollMode).toBe('normal');
  });

  it('sin ningún effect relevante: sin desventaja aunque el objetivo sea Orco/Nabieu', () => {
    expect(rivalRacialDisadvantageAgainst('orcos', ['ATAQUE']).rollMode).toBe('normal');
  });
});
