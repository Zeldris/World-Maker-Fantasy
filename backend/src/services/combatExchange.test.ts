import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveExchange, resolveIndependentExchange, rollInitiative, type ExchangeParticipant } from './combatExchange.js';
import type { AttributeBlock } from './dice.js';

const BASE_ATTRIBUTES: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };

// d20 = floor(r*20)+1 — valores de Math.random() que producen cada roll usado en los tests.
const R_FOR_ROLL_5 = 0.2; // floor(0.2*20)+1 = 5
const R_FOR_ROLL_10 = 0.45; // floor(0.45*20)+1 = 10
const R_FOR_ROLL_20 = 0.95; // floor(0.95*20)+1 = 20

function mockRolls(atacanteR: number, defensorR: number) {
  vi.spyOn(Math, 'random').mockReturnValueOnce(atacanteR).mockReturnValueOnce(defensorR);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveExchange', () => {
  // Mismo atributo en los dos lados (multiplicador de tipo = 1, sin ventaja) para aislar la
  // tabla de resultados cruzados del efecto de la rueda de debilidades — esa se cubre aparte
  // en attributeWheel.test.ts, ya integrada aquí en el último bloque de tests.
  const atacanteBase: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'ataque' };
  const defensorBase: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'defensa' };

  it('atacante falla + defensor claro → el defensor contragolpea', () => {
    mockRolls(R_FOR_ROLL_5, R_FOR_ROLL_20);
    const result = resolveExchange(atacanteBase, defensorBase);
    expect(result.atacante.gradoExito).toBe('fallo');
    expect(result.defensor.gradoExito).toBe('claro');
    expect(result.resultado).toBe('defensor_contragolpea');
  });

  it('atacante falla + defensor con_coste → el ataque simplemente falla', () => {
    mockRolls(R_FOR_ROLL_5, R_FOR_ROLL_10);
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('ataque_falla');
  });

  it('atacante falla + defensor falla → el ataque simplemente falla (nunca llega, gane o no la defensa)', () => {
    mockRolls(R_FOR_ROLL_5, R_FOR_ROLL_5);
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('ataque_falla');
  });

  it('atacante con_coste + defensor claro → parada en seco', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_20);
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('parada_en_seco');
  });

  it('atacante con_coste + defensor con_coste → golpes mutuos', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10);
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('golpes_mutuos');
  });

  it('atacante con_coste + defensor falla → golpe normal', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_5);
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('golpe_normal');
  });

  it('atacante claro + defensor claro → golpes mutuos (un choque duro)', () => {
    mockRolls(R_FOR_ROLL_20, R_FOR_ROLL_20);
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('golpes_mutuos');
  });

  it('atacante claro + defensor con_coste → golpe normal', () => {
    mockRolls(R_FOR_ROLL_20, R_FOR_ROLL_10);
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('golpe_normal');
  });

  it('atacante claro + defensor falla → golpe pleno, el peor caso', () => {
    mockRolls(R_FOR_ROLL_20, R_FOR_ROLL_5);
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('golpe_pleno');
  });

  it('aplica el multiplicador de la rueda de debilidades al valor efectivo de cada lado', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10);
    const atacante: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'destreza', difficulty: 15, condicionFisica: 'ILESO', rol: 'ataque' };
    const defensor: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'defensa' };
    const result = resolveExchange(atacante, defensor);
    // Destreza contra Fuerza: el atacante tiene ventaja de tipo (×1.5), el defensor la desventaja.
    expect(result.atacante.valorEfectivo).toBeGreaterThan(result.atacante.value);
    expect(result.defensor.valorEfectivo).toBeLessThan(result.defensor.value);
  });

  it('un participante HERIDO/GRAVE tira con un valor efectivo menor que uno ILESO (malus por condición)', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10);
    const ileso: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'defensa' };
    const herido: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'HERIDO', rol: 'ataque' };
    const grave: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'GRAVE', rol: 'ataque' };
    const resultHerido = resolveExchange(herido, ileso);
    const resultGrave = resolveExchange(grave, ileso);
    expect(resultHerido.atacante.valorEfectivo).toBeLessThan(BASE_ATTRIBUTES.fuerza);
    expect(resultGrave.atacante.valorEfectivo).toBeLessThan(resultHerido.atacante.valorEfectivo);
  });
});

describe('resolveIndependentExchange', () => {
  // Rediseño de combate (2026-08-09) — nunca cruza OUTCOME_TABLE: el éxito de cada lado se juzga
  // por su cuenta, `efectoAplica` es simplemente `gradoExito !== 'fallo'` de ESE lado.
  const atacante: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'ataque' };
  const defensor: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'utilidad' };

  it('los dos fallan → efectoAplica false en los dos, cada uno con su propio grado', () => {
    mockRolls(R_FOR_ROLL_5, R_FOR_ROLL_5);
    const result = resolveIndependentExchange(atacante, defensor);
    expect(result.atacante.gradoExito).toBe('fallo');
    expect(result.atacante.efectoAplica).toBe(false);
    expect(result.defensor.gradoExito).toBe('fallo');
    expect(result.defensor.efectoAplica).toBe(false);
  });

  it('el atacante tiene éxito y el defensor falla → solo el del atacante aplica (nunca depende del otro)', () => {
    mockRolls(R_FOR_ROLL_20, R_FOR_ROLL_5);
    const result = resolveIndependentExchange(atacante, defensor);
    expect(result.atacante.efectoAplica).toBe(true);
    expect(result.defensor.efectoAplica).toBe(false);
  });

  it('los dos tienen éxito a la vez → los dos efectoAplica true (no es "el mejor gana")', () => {
    mockRolls(R_FOR_ROLL_20, R_FOR_ROLL_20);
    const result = resolveIndependentExchange(atacante, defensor);
    expect(result.atacante.efectoAplica).toBe(true);
    expect(result.defensor.efectoAplica).toBe(true);
  });

  it('éxito con coste también cuenta como efectoAplica (solo el fallo lo bloquea)', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10);
    const result = resolveIndependentExchange(atacante, defensor);
    expect(result.atacante.gradoExito).toBe('con_coste');
    expect(result.atacante.efectoAplica).toBe(true);
  });

  it('sigue aplicando el multiplicador de la rueda de debilidades al valorEfectivo de cada lado', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10);
    const atacanteDestreza: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'destreza', difficulty: 15, condicionFisica: 'ILESO', rol: 'ataque' };
    const defensorFuerza: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'utilidad' };
    const result = resolveIndependentExchange(atacanteDestreza, defensorFuerza);
    expect(result.atacante.valorEfectivo).toBeGreaterThan(result.atacante.value);
    expect(result.defensor.valorEfectivo).toBeLessThan(result.defensor.value);
  });
});

describe('rollInitiative', () => {
  it('gana quien saque el resultado más alto en la tirada de destreza', () => {
    mockRolls(R_FOR_ROLL_20, R_FOR_ROLL_5);
    expect(rollInitiative(BASE_ATTRIBUTES, BASE_ATTRIBUTES)).toEqual({ ganador: 'jugador', jugadorTirada: 25, npcTirada: 10 });
  });

  it('el NPC puede ganar la iniciativa', () => {
    mockRolls(R_FOR_ROLL_5, R_FOR_ROLL_20);
    expect(rollInitiative(BASE_ATTRIBUTES, BASE_ATTRIBUTES)).toEqual({ ganador: 'npc', jugadorTirada: 10, npcTirada: 25 });
  });

  it('un empate favorece al jugador (nunca deja la iniciativa sin decidir)', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10);
    expect(rollInitiative(BASE_ATTRIBUTES, BASE_ATTRIBUTES)).toEqual({ ganador: 'jugador', jugadorTirada: 15, npcTirada: 15 });
  });
});
