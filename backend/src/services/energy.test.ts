import { describe, it, expect } from 'vitest';
import { energiaMaxFor, nextEnergia, ENERGY_COST_BASICA, ENERGY_COST_AVANZADA, type EnergyTurnInput } from './energy.js';

const BASE: EnergyTurnInput = {
  current: 50,
  max: 100,
  abilityEnergyCost: 0,
  exchangeHappened: false,
  wasDefending: false,
  restSucceeds: false,
  itemRestoreAmount: null,
};

describe('energiaMaxFor', () => {
  it('escala con constitución (50 + constitucion*3)', () => {
    expect(energiaMaxFor(0)).toBe(50);
    expect(energiaMaxFor(10)).toBe(80);
  });
});

describe('nextEnergia', () => {
  it('sin intercambio de combate, la energía no cambia', () => {
    expect(nextEnergia(BASE)).toBe(50);
  });

  it('usar una habilidad con coste la descuenta y no regenera nada ese turno', () => {
    expect(nextEnergia({ ...BASE, abilityEnergyCost: ENERGY_COST_BASICA, exchangeHappened: true })).toBe(35);
    expect(nextEnergia({ ...BASE, abilityEnergyCost: ENERGY_COST_AVANZADA, exchangeHappened: true })).toBe(25);
  });

  it('atacar normal (coste 0, atacando) regenera un poco', () => {
    expect(nextEnergia({ ...BASE, exchangeHappened: true, wasDefending: false })).toBe(60);
  });

  it('defenderse (coste 0, defendiendo) regenera más que atacar normal', () => {
    expect(nextEnergia({ ...BASE, exchangeHappened: true, wasDefending: true })).toBe(65);
  });

  it('nunca pasa del máximo al regenerar', () => {
    expect(nextEnergia({ ...BASE, current: 95, exchangeHappened: true, wasDefending: true })).toBe(100);
  });

  it('nunca baja de 0 al gastar más de lo que queda', () => {
    expect(nextEnergia({ ...BASE, current: 5, abilityEnergyCost: ENERGY_COST_AVANZADA, exchangeHappened: true })).toBe(0);
  });

  it('un descanso válido restaura al tope entero, por encima de cualquier regen de combate', () => {
    expect(nextEnergia({ ...BASE, current: 10, restSucceeds: true })).toBe(100);
  });

  it('un objeto consumido suma su restauración, topado al máximo', () => {
    expect(nextEnergia({ ...BASE, current: 90, itemRestoreAmount: 30 })).toBe(100);
    expect(nextEnergia({ ...BASE, current: 10, itemRestoreAmount: 30 })).toBe(40);
  });
});
