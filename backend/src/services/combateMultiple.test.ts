import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  rollInitiativeMultiple,
  elegirObjetivo,
  objetivosValidos,
  retargetBando,
  particionarEnSubCombates,
  subCombateJugable,
  resolverIntercambioCompleto,
  INTELIGENCIA_TACTICA_UMBRAL,
  MAX_COMBATIENTES_POR_BANDO,
  type CombatienteIniciativa,
  type ObjetivoCandidato,
  type CombatienteParticion,
  type CombatienteParaIntercambio,
  type HabilidadParaIntercambio,
} from './combateMultiple.js';

function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('rollInitiativeMultiple', () => {
  it('ordena N combatientes por resultado descendente, no solo 2 lados', () => {
    const combatientes: CombatienteIniciativa[] = [
      { participantId: 'jugador', bando: 'JUGADOR', destreza: 10 },
      { participantId: 'companero', bando: 'JUGADOR', destreza: 14 },
      { participantId: 'enemigo1', bando: 'ENEMIGO', destreza: 8 },
      { participantId: 'enemigo2', bando: 'ENEMIGO', destreza: 20 },
    ];
    // rolls en el mismo orden que combatientes: 0.5→11, 0.5→11, 0.5→11, 0.9→19
    const orden = rollInitiativeMultiple(combatientes, sequence([0.5, 0.5, 0.5, 0.9]));
    expect(orden.map((e) => e.participantId)).toEqual(['enemigo2', 'companero', 'jugador', 'enemigo1']);
  });

  it('empate en resultado (floor(destreza/2) igual) lo gana mayor Destreza cruda', () => {
    const combatientes: CombatienteIniciativa[] = [
      { participantId: 'destreza8', bando: 'JUGADOR', destreza: 8 },
      { participantId: 'destreza9', bando: 'ENEMIGO', destreza: 9 },
    ];
    const orden = rollInitiativeMultiple(combatientes, sequence([0.5, 0.5]));
    expect(orden[0].participantId).toBe('destreza9');
  });
});

describe('objetivosValidos / elegirObjetivo', () => {
  const candidatos: ObjetivoCandidato[] = [
    { participantId: 'a', condicionFisica: 'ILESO' },
    { participantId: 'b', condicionFisica: 'GRAVE' },
    { participantId: 'c', condicionFisica: 'CONVALECIENTE' },
    { participantId: 'd', condicionFisica: 'MUERTO' },
  ];

  it('CONVALECIENTE y MUERTO nunca son objetivo válido', () => {
    expect(objetivosValidos(candidatos).map((c) => c.participantId)).toEqual(['a', 'b']);
  });

  it('Inteligencia alta remata al más herido de los vivos', () => {
    const objetivo = elegirObjetivo(INTELIGENCIA_TACTICA_UMBRAL, candidatos, () => 0);
    expect(objetivo).toBe('b'); // GRAVE está más cerca de caer que ILESO
  });

  it('Inteligencia baja elige aleatorio entre los vivos', () => {
    const objetivo = elegirObjetivo(INTELIGENCIA_TACTICA_UMBRAL - 1, candidatos, () => 0);
    expect(objetivo).toBe('a'); // random()=0 -> primer vivo de la lista
  });

  it('null si no queda nadie vivo en el bando contrario', () => {
    const soloMuertos: ObjetivoCandidato[] = [{ participantId: 'x', condicionFisica: 'MUERTO' }];
    expect(elegirObjetivo(20, soloMuertos)).toBeNull();
  });
});

describe('retargetBando', () => {
  it('redecide el objetivo de cada atacante vivo de una vez', () => {
    const atacantes = [
      { participantId: 'atacante-listo', inteligencia: 20 },
      { participantId: 'atacante-torpe', inteligencia: 4 },
    ];
    const defensores: ObjetivoCandidato[] = [
      { participantId: 'debil', condicionFisica: 'GRAVE' },
      { participantId: 'fuerte', condicionFisica: 'ILESO' },
    ];
    const resultado = retargetBando(atacantes, defensores, () => 0.9);
    expect(resultado['atacante-listo']).toBe('debil'); // remata al más herido, sin importar el dado
    expect(resultado['atacante-torpe']).toBe('fuerte'); // random 0.9 * 2 candidatos -> índice 1
  });
});

describe('particionarEnSubCombates', () => {
  it('un bando pequeño (≤4) contra uno grande: cada fragmento grande enfrenta al bando pequeño entero', () => {
    const jugador: CombatienteParticion[] = [{ participantId: 'yo', bando: 'JUGADOR', esJugador: true }];
    const enemigos: CombatienteParticion[] = Array.from({ length: 9 }, (_, i) => ({ participantId: `e${i}`, bando: 'ENEMIGO' as const }));
    const subCombates = particionarEnSubCombates([...jugador, ...enemigos]);
    // 9 enemigos / 4 = 3 fragmentos (4/4/1) -> 3 sub-combates, cada uno con la jugadora
    expect(subCombates).toHaveLength(3);
    for (const sc of subCombates) {
      expect(sc.filter((c) => c.bando === 'JUGADOR')).toHaveLength(1);
      expect(sc.filter((c) => c.bando === 'ENEMIGO').length).toBeLessThanOrEqual(MAX_COMBATIENTES_POR_BANDO);
    }
    expect(subCombateJugable(subCombates)).toBe(0);
  });

  it('ambos bandos ≤4: un único sub-combate', () => {
    const jugador: CombatienteParticion[] = [
      { participantId: 'yo', bando: 'JUGADOR', esJugador: true },
      { participantId: 'companero', bando: 'JUGADOR' },
    ];
    const enemigos: CombatienteParticion[] = [{ participantId: 'e1', bando: 'ENEMIGO' }];
    const subCombates = particionarEnSubCombates([...jugador, ...enemigos]);
    expect(subCombates).toHaveLength(1);
    expect(subCombates[0]).toHaveLength(3);
  });

  it('sin jugadora presente (combate autónomo de Reino), ningún sub-combate es jugable', () => {
    const defensores: CombatienteParticion[] = [{ participantId: 'guardia', bando: 'JUGADOR' }];
    const atacantes: CombatienteParticion[] = [{ participantId: 'invasor', bando: 'ENEMIGO' }];
    const subCombates = particionarEnSubCombates([...defensores, ...atacantes]);
    expect(subCombateJugable(subCombates)).toBeNull();
  });

  it('un bando vacío no produce ningún sub-combate', () => {
    expect(particionarEnSubCombates([{ participantId: 'yo', bando: 'JUGADOR', esJugador: true }])).toEqual([]);
  });
});

// § 4 — resolverIntercambioCompleto (2026-08-25, paridad completa con resolveCombatExchangePhase)
describe('resolverIntercambioCompleto', () => {
  const rFor = (roll: number) => (roll - 1) / 20 + 0.001;

  function mockRolls(atacanteR: number, defensorR: number) {
    vi.spyOn(Math, 'random').mockReturnValueOnce(atacanteR).mockReturnValueOnce(defensorR);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const combatiente = (overrides: Partial<CombatienteParaIntercambio> = {}): CombatienteParaIntercambio => ({
    nombre: 'Combatiente',
    attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
    condicionFisica: 'ILESO',
    ...overrides,
  });

  const habilidad = (overrides: Partial<HabilidadParaIntercambio> = {}): HabilidadParaIntercambio => ({
    name: 'Habilidad',
    description: '',
    attribute: 'fuerza',
    effects: [],
    rol: 'ataque',
    energyCost: 0,
    energyRegen: 0,
    ...overrides,
  });

  it('golpe normal básico: margen decisivo empeora la condición del defensor un escalón', () => {
    mockRolls(rFor(15), rFor(1)); // atacante 20 vs defensor 6, margen 14 -> golpe_pleno
    const resultado = resolverIntercambioCompleto(
      combatiente({ nombre: 'Gorhorn' }),
      habilidad({ rol: 'ataque' }),
      'ataque',
      13,
      combatiente({ nombre: 'Lobo' }),
      habilidad({ rol: 'defensa' }),
      13,
    );
    expect(resultado.defensorRecibeGolpe).toBe(true);
    expect(resultado.nuevaCondicionDefensor).toBe('HERIDO');
    expect(resultado.atacanteRecibeGolpe).toBe(false);
    expect(resultado.combatRealHitLanded).toBe(true);
  });

  it('LETAL mata de un golpe sin importar la condición previa del defensor', () => {
    mockRolls(rFor(15), rFor(1));
    const resultado = resolverIntercambioCompleto(
      combatiente({ nombre: 'Gorhorn' }),
      habilidad({ rol: 'ataque', effects: ['LETAL'] }),
      'ataque',
      13,
      combatiente({ nombre: 'Lobo', condicionFisica: 'ILESO' }),
      habilidad({ rol: 'defensa' }),
      13,
    );
    expect(resultado.nuevaCondicionDefensor).toBe('MUERTO');
    expect(resultado.exchangeBlock).toContain('golpe letal');
  });

  it('doble arma reduce la dificultad del atacante — decide un intercambio independiente al límite', () => {
    // roll=7, fuerza 10 sin bonus -> result 12. Dificultad base 13 (falla) vs con doble arma 10 (éxito).
    mockRolls(rFor(7), rFor(10));
    const sinDobleArma = resolverIntercambioCompleto(
      combatiente({ nombre: 'Gorhorn' }),
      habilidad({ rol: 'utilidad', effects: ['ANALISIS'] }),
      'utilidad',
      13,
      combatiente({ nombre: 'Lobo' }),
      habilidad({ rol: 'defensa' }),
      13,
      false,
    );
    expect(sinDobleArma.analizarRivalExito).toBe(false);

    mockRolls(rFor(7), rFor(10));
    const conDobleArma = resolverIntercambioCompleto(
      combatiente({ nombre: 'Gorhorn' }),
      habilidad({ rol: 'utilidad', effects: ['ANALISIS'] }),
      'utilidad',
      13,
      combatiente({ nombre: 'Lobo' }),
      habilidad({ rol: 'defensa' }),
      13,
      true,
    );
    expect(conDobleArma.analizarRivalExito).toBe(true);
  });

  it('contraataque del defensor (utilidad + efecto ATAQUE) golpea de vuelta al atacante', () => {
    // atacante falla su ataque (roll 1, dificultad 15) — aísla el contragolpe del golpe base.
    // defensor acierta su propia tirada de utilidad (roll 15, dificultad 10) -> se dispara.
    mockRolls(rFor(1), rFor(15));
    const resultado = resolverIntercambioCompleto(
      combatiente({ nombre: 'Gorhorn' }),
      habilidad({ rol: 'ataque' }),
      'ataque',
      15,
      combatiente({ nombre: 'Lobo' }),
      habilidad({ rol: 'utilidad', effects: ['ATAQUE'] }),
      10,
    );
    expect(resultado.defensorRecibeGolpe).toBe(false);
    expect(resultado.atacanteRecibeGolpe).toBe(true);
    expect(resultado.nuevaCondicionAtacante).toBe('HERIDO');
  });

  it('Grito de Guerra del defensor (utilidad + INTIMIDACION) cancela el golpe entrante del todo', () => {
    // atacante acierta de sobra (roll 15, dificultad 10) — sin el grito, golpearía.
    // defensor también acierta su propia tirada (roll 15, dificultad 10) -> el grito se dispara.
    mockRolls(rFor(15), rFor(15));
    const resultado = resolverIntercambioCompleto(
      combatiente({ nombre: 'Gorhorn' }),
      habilidad({ rol: 'ataque' }),
      'ataque',
      10,
      combatiente({ nombre: 'Lobo' }),
      habilidad({ rol: 'utilidad', effects: ['INTIMIDACION'] }),
      10,
    );
    expect(resultado.defensorRecibeGolpe).toBe(false);
    expect(resultado.nuevaCondicionDefensor).toBe('ILESO');
  });
});
