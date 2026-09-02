import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveExchange,
  resolveIndependentExchange,
  rollInitiative,
  exchangeContextBlock,
  effectiveExchangeOutcome,
  hitSeverityHint,
  type ExchangeParticipant,
} from './combatExchange.js';
import type { AttributeBlock } from './dice.js';

const BASE_ATTRIBUTES: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

// d20 = floor(r*20)+1 — valores de Math.random() que producen cada roll usado en los tests.
const R_FOR_ROLL_5 = 0.2; // floor(0.2*20)+1 = 5
const R_FOR_ROLL_10 = 0.45; // floor(0.45*20)+1 = 10
const R_FOR_ROLL_20 = 0.95; // floor(0.95*20)+1 = 20
// Cualquier roll exacto 1-20, para los tests de margen (rediseño a check opuesto, 2026-08-21) —
// más directo que ir buscando constantes nombradas para cada valor límite que hace falta probar.
const rFor = (roll: number) => (roll - 1) / 20 + 0.001;

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

  // Rediseño a check opuesto de D&D (2026-08-21, petición explícita de la usuaria: "en D&D que tu
  // saques un 22 y el enemigo un 24, no quiere decir que el 24 sea el que gana?" — antes cada lado
  // tiraba contra su PROPIA dificultad y se cruzaban los dos grados en una tabla de 9
  // combinaciones; ahora se comparan los dos totales DIRECTAMENTE). `margen = atacante.result -
  // defensor.result` decide el desenlace por magnitud, `DECISIVE_MARGIN = 10` es el umbral entre
  // "golpe/parada normal" y "golpe pleno/contragolpe" — primer valor, recalibrable jugando.
  it('margen muy negativo (≤-10) → el defensor contragolpea', () => {
    mockRolls(R_FOR_ROLL_5, R_FOR_ROLL_20); // 10 vs 25, margen -15
    const result = resolveExchange(atacanteBase, defensorBase);
    expect(result.margen).toBe(-15);
    expect(result.resultado).toBe('defensor_contragolpea');
    expect(result.atacante.success).toBe(false);
    expect(result.defensor.success).toBe(true);
  });

  it('margen exactamente -10 (el umbral) → todavía cuenta como contragolpe, no como parada normal', () => {
    mockRolls(rFor(10), R_FOR_ROLL_20); // 15 vs 25, margen -10
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('defensor_contragolpea');
  });

  it('margen -9 (justo por debajo del umbral) → parada en seco, no contragolpe', () => {
    mockRolls(rFor(11), R_FOR_ROLL_20); // 16 vs 25, margen -9
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('parada_en_seco');
  });

  it('empate exacto → gana el defensor, el golpe no conecta (petición explícita)', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10); // 15 vs 15, margen 0
    const result = resolveExchange(atacanteBase, defensorBase);
    expect(result.margen).toBe(0);
    expect(result.resultado).toBe('ataque_falla');
    expect(result.atacante.success).toBe(false);
    expect(result.defensor.success).toBe(true); // el empate cuenta como éxito del defensor
  });

  it('margen 1 (el atacante gana por el mínimo) → golpe normal', () => {
    mockRolls(rFor(11), R_FOR_ROLL_10); // 16 vs 15, margen 1
    const result = resolveExchange(atacanteBase, defensorBase);
    expect(result.resultado).toBe('golpe_normal');
    expect(result.atacante.success).toBe(true);
  });

  it('margen 9 (justo por debajo del umbral) → golpe normal, no pleno', () => {
    mockRolls(R_FOR_ROLL_20, rFor(11)); // 25 vs 16, margen 9
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('golpe_normal');
  });

  it('margen exactamente 10 (el umbral) → golpe pleno', () => {
    mockRolls(R_FOR_ROLL_20, R_FOR_ROLL_10); // 25 vs 15, margen 10
    expect(resolveExchange(atacanteBase, defensorBase).resultado).toBe('golpe_pleno');
  });

  it('margen muy positivo → golpe pleno, el peor caso', () => {
    mockRolls(R_FOR_ROLL_20, R_FOR_ROLL_5); // 25 vs 10, margen 15
    const result = resolveExchange(atacanteBase, defensorBase);
    expect(result.resultado).toBe('golpe_pleno');
    expect(result.atacante.success).toBe(true);
    expect(result.defensor.success).toBe(false);
  });

  // Bug real jugando en vivo (2026-08-13, petición explícita: "solo si la habilidad especifica
  // que hace daño en defensa debe hacerlo... solo las de ataque hacen daño") — una habilidad de
  // defensa sin `effect: 'ATAQUE'` (todas hoy: Esquivar/Bloquear/etc., AGUANTE o sin efecto) NUNCA
  // debería narrar un golpe de vuelta que conecta de verdad, aunque la tirada saque
  // `defensor_contragolpea`. El caller (turnResolution.ts) decide el gate mirando la habilidad
  // real; `exchangeContextBlock` solo narra lo que el caller le diga que aplica.
  it('exchangeContextBlock narra defensor_contragolpea como un simple fallo si la defensa no puede contragolpear (sin effect ATAQUE)', () => {
    mockRolls(R_FOR_ROLL_5, R_FOR_ROLL_20);
    const exchange = resolveExchange(atacanteBase, defensorBase);
    const conBonus = exchangeContextBlock(exchange, 'Orco', 'Gorhorn', true);
    const sinBonus = exchangeContextBlock(exchange, 'Orco', 'Gorhorn', false);
    expect(conBonus).toContain('de propina consigue tocar');
    expect(sinBonus).not.toContain('de propina consigue tocar');
    expect(sinBonus).toContain('no llega a alcanzar');
  });

  it('exchangeContextBlock sigue narrando el contragolpe cuando SÍ aplica (parámetro por defecto true)', () => {
    mockRolls(R_FOR_ROLL_5, R_FOR_ROLL_20);
    const exchange = resolveExchange(atacanteBase, defensorBase);
    expect(exchangeContextBlock(exchange, 'Orco', 'Gorhorn')).toContain('de propina consigue tocar');
  });

  it('exchangeContextBlock incluye el margen real en el texto para el Narrador', () => {
    mockRolls(R_FOR_ROLL_20, R_FOR_ROLL_5); // 25 vs 10, margen 15
    const exchange = resolveExchange(atacanteBase, defensorBase);
    const texto = exchangeContextBlock(exchange, 'Orco', 'Gorhorn');
    expect(texto).toContain('Orco tira 25');
    expect(texto).toContain('Gorhorn tira 10');
    expect(texto).toContain('Orco supera a Gorhorn por 15');
  });

  describe('effectiveExchangeOutcome', () => {
    it('degrada defensor_contragolpea a ataque_falla si el defensor no puede contragolpear', () => {
      expect(effectiveExchangeOutcome('defensor_contragolpea', false)).toBe('ataque_falla');
    });
    it('deja el resto de desenlaces intactos aunque el defensor no pueda contragolpear', () => {
      expect(effectiveExchangeOutcome('golpe_normal', false)).toBe('golpe_normal');
      expect(effectiveExchangeOutcome('golpe_pleno', false)).toBe('golpe_pleno');
      expect(effectiveExchangeOutcome('ataque_falla', false)).toBe('ataque_falla');
      expect(effectiveExchangeOutcome('parada_en_seco', false)).toBe('parada_en_seco');
    });
    it('nunca degrada nada si el defensor SÍ puede contragolpear', () => {
      expect(effectiveExchangeOutcome('defensor_contragolpea', true)).toBe('defensor_contragolpea');
    });
  });

  // Petición explícita (2026-08-21, tras confirmar quitar la protección por nivel del defensor):
  // "súmalo a la tirada de defensa" — el bono de equipo de defensa se suma directo al resultado
  // del defensor, como cualquier modificador normal de D&D, en vez de reducir su dificultad propia
  // (que ya no decide nada).
  it('bonoTirada del defensor se suma a su resultado y puede cambiar quién gana el contraste', () => {
    mockRolls(rFor(11), rFor(11)); // 16 vs 16 sin bono — empate, ganaría el defensor de todos modos
    const defensorConBono: ExchangeParticipant = { ...defensorBase, bonoTirada: 5 };
    const result = resolveExchange(atacanteBase, defensorConBono);
    expect(result.defensor.result).toBe(21); // 16 + 5
    expect(result.margen).toBe(-5);
    expect(result.resultado).toBe('parada_en_seco');
  });

  it('aplica el multiplicador de la rueda de debilidades al valor efectivo de cada lado', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10);
    const atacante: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'destreza', difficulty: 15, condicionFisica: 'ILESO', rol: 'ataque' };
    const defensor: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'defensa' };
    const result = resolveExchange(atacante, defensor);
    // Destreza contra Fuerza: el atacante tiene ventaja de tipo (×1.5) — solo premia, nunca
    // penaliza (rediseño 2026-08-15): el defensor en desventaja se queda en su valor crudo, sin
    // dividir.
    expect(result.atacante.valorEfectivo).toBeGreaterThan(result.atacante.value);
    expect(result.defensor.valorEfectivo).toBe(result.defensor.value);
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

  // Malus expuesto aparte del valorEfectivo ya rebajado (petición explícita, 2026-08-15: "hay que
  // indicar también la resta que tiene por el estado... en el resultado") — antes solo se veía el
  // efecto (un valorEfectivo más bajo), nunca el número real de la resta en sí.
  it('expone el malus real por condición física, 0 en ILESO', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10);
    const ileso: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'defensa' };
    const herido: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'HERIDO', rol: 'ataque' };
    const grave: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'GRAVE', rol: 'ataque' };
    expect(resolveExchange(herido, ileso).atacante.malus).toBe(2);
    expect(resolveExchange(grave, ileso).atacante.malus).toBe(5);
    expect(resolveExchange(ileso, ileso).atacante.malus).toBe(0);
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

  it('sigue aplicando el multiplicador de la rueda de debilidades al valorEfectivo de cada lado (solo premia, nunca penaliza)', () => {
    mockRolls(R_FOR_ROLL_10, R_FOR_ROLL_10);
    const atacanteDestreza: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'destreza', difficulty: 15, condicionFisica: 'ILESO', rol: 'ataque' };
    const defensorFuerza: ExchangeParticipant = { attributes: BASE_ATTRIBUTES, attribute: 'fuerza', difficulty: 15, condicionFisica: 'ILESO', rol: 'utilidad' };
    const result = resolveIndependentExchange(atacanteDestreza, defensorFuerza);
    expect(result.atacante.valorEfectivo).toBeGreaterThan(result.atacante.value);
    expect(result.defensor.valorEfectivo).toBe(result.defensor.value);
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

describe('hitSeverityHint', () => {
  it('bug real jugando en vivo (2026-08-15): un golpe que solo baja a GRAVE no debe narrarse como si dejara al objetivo inerte/muerto', () => {
    const hint = hitSeverityHint('Zense Ceniza', 'GRAVE');
    expect(hint).toContain('sigue consciente, en pie y capaz de seguir luchando');
    expect(hint).toContain('NUNCA lo narres cayendo inerte, desmayado o muerto');
  });

  it('no añade nada si el golpe deja al objetivo CONVALECIENTE — eso ya lo cubre npcFallsUnconsciousThisTurn', () => {
    expect(hitSeverityHint('Zense Ceniza', 'CONVALECIENTE')).toBe('');
  });

  it('no añade nada si el golpe deja al objetivo MUERTO — mismo motivo', () => {
    expect(hitSeverityHint('Zense Ceniza', 'MUERTO')).toBe('');
  });

  it('deja claro que no hubo ningún daño real si el golpe no conectó (nuevaCondicion null)', () => {
    expect(hitSeverityHint('Zense Ceniza', null)).toBe('El golpe no conecta — no hay ningún daño real que narrar en Zense Ceniza.');
  });
});
