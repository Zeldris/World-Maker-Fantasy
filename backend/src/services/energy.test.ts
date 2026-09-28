import { describe, it, expect } from 'vitest';
import {
  energiaMaxFor,
  nextEnergia,
  restCooldownActivo,
  ENERGY_COST_BASICA,
  ENERGY_COST_AVANZADA,
  ENERGY_COST_ATAQUE_BASICO,
  ENERGY_REST_RESTORE,
  REST_COOLDOWN_MINUTES,
  type EnergyTurnInput,
} from './energy.js';
import { energiaPasivaEntre } from './energy.js';

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
    expect(nextEnergia({ ...BASE, abilityEnergyCost: ENERGY_COST_BASICA, exchangeHappened: true })).toBe(40);
    expect(nextEnergia({ ...BASE, abilityEnergyCost: ENERGY_COST_AVANZADA, exchangeHappened: true })).toBe(20);
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

  it('un objeto consumido suma su restauración, topado al máximo', () => {
    expect(nextEnergia({ ...BASE, current: 90, itemRestoreAmount: 30 })).toBe(100);
    expect(nextEnergia({ ...BASE, current: 10, itemRestoreAmount: 30 })).toBe(40);
  });

  // Rediseño 2026-09-06 (hallazgo 11 de la sesión de pruebas, decisión explícita de la usuaria):
  // Descansar repone un tramo FIJO (`ENERGY_REST_RESTORE` = 30), igual en cualquier sitio válido
  // (ya no distingue refugio de vivac para energía — solo seguía distinguiendo antes para curar
  // condicionFisica, curación eliminada por completo, ver death.ts § healCeilingFor). El cooldown
  // de 3h de ficción (`restCooldownActivo`) lo aplica el CALLER (turnResolution.ts) forzando
  // `restAttempted`/`restSucceeds` a `false` — esta función no sabe de cooldowns.
  describe('restAttempted/restSucceeds (reposo fijo de Descansar)', () => {
    it('restAttempted suma el tramo fijo, topado al máximo', () => {
      expect(nextEnergia({ ...BASE, current: 10, restAttempted: true })).toBe(10 + ENERGY_REST_RESTORE);
      expect(nextEnergia({ ...BASE, current: 80, restAttempted: true })).toBe(100); // topado a max
    });

    it('restSucceeds suma el mismo tramo fijo que restAttempted — ya no hay distinción para energía', () => {
      expect(nextEnergia({ ...BASE, current: 10, restSucceeds: true })).toBe(10 + ENERGY_REST_RESTORE);
    });

    it('restAttempted y restSucceeds a la vez no suman el doble', () => {
      expect(nextEnergia({ ...BASE, current: 10, restAttempted: true, restSucceeds: true })).toBe(10 + ENERGY_REST_RESTORE);
    });
  });
});

describe('restCooldownActivo', () => {
  it('nunca descansó todavía (null) — sin cooldown que aplicar', () => {
    expect(restCooldownActivo(null, 1000)).toBe(false);
  });

  it('dentro de las 3h de ficción desde el último descanso — cooldown activo', () => {
    expect(restCooldownActivo(1000, 1000 + REST_COOLDOWN_MINUTES - 1)).toBe(true);
  });

  it('justo en el límite de 3h — ya no está activo (comparación estricta)', () => {
    expect(restCooldownActivo(1000, 1000 + REST_COOLDOWN_MINUTES)).toBe(false);
  });

  it('pasadas las 3h de ficción — cooldown ya no activo', () => {
    expect(restCooldownActivo(1000, 1000 + REST_COOLDOWN_MINUTES + 60)).toBe(false);
  });
});

describe('energiaPasivaEntre (B11)', () => {
  it('1 punto por cada múltiplo de 10 minutos cruzado, sin arrastrar restos', () => {
    expect(energiaPasivaEntre(480, 490)).toBe(1);
    expect(energiaPasivaEntre(485, 495)).toBe(1);
    expect(energiaPasivaEntre(481, 489)).toBe(0);
    expect(energiaPasivaEntre(480, 540)).toBe(6);
  });
  it('sin tiempo transcurrido no regenera', () => {
    expect(energiaPasivaEntre(500, 500)).toBe(0);
    expect(energiaPasivaEntre(500, 400)).toBe(0);
  });
});
