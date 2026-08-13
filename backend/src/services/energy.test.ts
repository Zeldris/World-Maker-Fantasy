import { describe, it, expect } from 'vitest';
import { energiaMaxFor, nextEnergia, ENERGY_COST_BASICA, ENERGY_COST_AVANZADA, ENERGY_COST_ATAQUE_BASICO, type EnergyTurnInput } from './energy.js';

const BASE: EnergyTurnInput = {
  current: 50,
  max: 100,
  abilityEnergyCost: 0,
  exchangeHappened: false,
  abilityEnergyRegen: 0,
  restSucceeds: false,
  restAttempted: false,
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

  it('usar una habilidad con coste la descuenta y no regenera nada ese turno (regen 0)', () => {
    expect(nextEnergia({ ...BASE, abilityEnergyCost: ENERGY_COST_BASICA, exchangeHappened: true })).toBe(35);
    expect(nextEnergia({ ...BASE, abilityEnergyCost: ENERGY_COST_AVANZADA, exchangeHappened: true })).toBe(25);
  });

  it('rediseño 2026-07-31: Ataque Básico cuesta 5 y no regenera nada', () => {
    expect(nextEnergia({ ...BASE, abilityEnergyCost: ENERGY_COST_ATAQUE_BASICO, exchangeHappened: true })).toBe(45);
  });

  it('rediseño 2026-07-31: Defenderse no cuesta nada y recupera 10 (ya no depende del "rol", sino de la habilidad usada)', () => {
    expect(nextEnergia({ ...BASE, abilityEnergyCost: 0, abilityEnergyRegen: 10, exchangeHappened: true })).toBe(60);
  });

  it('rediseño 2026-07-31: Esquivar no cuesta nada y recupera 5', () => {
    expect(nextEnergia({ ...BASE, abilityEnergyCost: 0, abilityEnergyRegen: 5, exchangeHappened: true })).toBe(55);
  });

  it('el regen solo se aplica si hubo intercambio de combate real este turno', () => {
    expect(nextEnergia({ ...BASE, abilityEnergyRegen: 10, exchangeHappened: false })).toBe(50);
  });

  it('nunca pasa del máximo al regenerar', () => {
    expect(nextEnergia({ ...BASE, current: 95, exchangeHappened: true, abilityEnergyRegen: 10 })).toBe(100);
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

  // Bug real jugando en vivo (2026-08-13, "he descansado [fuera de refugio/asentamiento] y la
  // energía no se recuperó") — mismo criterio ya fijado para condicionFisica el 2026-08-11
  // (healCeilingFor): un vivac en cualquier sitio SÍ debe restaurar algo, solo un refugio/
  // asentamiento real llega al tope entero (restSucceeds).
  describe('restAttempted (vivac en cualquier sitio, mitad del tope)', () => {
    it('sube hasta la mitad del tope si estaba por debajo', () => {
      expect(nextEnergia({ ...BASE, current: 10, restAttempted: true })).toBe(50);
    });

    it('no baja la energía si ya estaba por encima de la mitad del tope', () => {
      expect(nextEnergia({ ...BASE, current: 80, restAttempted: true })).toBe(80);
    });

    it('restSucceeds (refugio/asentamiento real) manda por encima de restAttempted — sigue llegando al tope entero', () => {
      expect(nextEnergia({ ...BASE, current: 10, restAttempted: true, restSucceeds: true })).toBe(100);
    });
  });
});
