import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  rollInitiativeMultiple,
  elegirObjetivo,
  objetivosValidos,
  retargetBando,
  resolverEnganchesRonda,
  esDueloMutuo,
  golpeaPrimeroEnDuelo,
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

// Objetivo individual real (2026-08-26, diseño cerrado con la usuaria jugando en vivo contra 2
// cuervos). Cada caso usa un `elegirObjetivoPara` fijo (mock, no IA real) para poder controlar
// exactamente quién elige a quién en cada test — la IA real (`elegirObjetivo`) ya tiene su propia
// cobertura arriba, aquí solo importa el ALGORITMO de enganche/duelo/golpe gratis en sí.
describe('resolverEnganchesRonda', () => {
  it('caso real que originó el diseño: 2 cuervos vs 1 jugadora — solo uno entra en duelo real, el otro pega gratis', () => {
    // Orden de iniciativa: cuervoA primero, luego jugadora, luego cuervoB (el que se queda sin
    // duelo real, exactamente como en la partida real de la usuaria).
    const orden = ['cuervoA', 'jugadora', 'cuervoB'];
    const combatientes = [
      { participantId: 'cuervoA', bando: 'ENEMIGO' as const },
      { participantId: 'jugadora', bando: 'JUGADOR' as const },
      { participantId: 'cuervoB', bando: 'ENEMIGO' as const },
    ];
    // Ambos cuervos y la jugadora solo tienen un candidato posible cada uno (bando contrario de 1).
    const elegir = (id: string) => (id === 'jugadora' ? 'cuervoA' : 'jugadora');
    const resultado = resolverEnganchesRonda(orden, combatientes, elegir);

    expect(resultado.get('cuervoA')).toBe('jugadora'); // primer reclamo sobre la jugadora, gana
    expect(resultado.get('jugadora')).toBe('cuervoA'); // ya reclamada por cuervoA — defiende/duela contra él, no elige
  });

  it('caso real, versión completa con esDueloMutuo/golpeaPrimeroEnDuelo: cuervoA duela de verdad, cuervoB pega gratis', () => {
    const orden = ['cuervoA', 'jugadora', 'cuervoB'];
    const combatientes = [
      { participantId: 'cuervoA', bando: 'ENEMIGO' as const },
      { participantId: 'jugadora', bando: 'JUGADOR' as const },
      { participantId: 'cuervoB', bando: 'ENEMIGO' as const },
    ];
    const elegir = (id: string) => (id === 'jugadora' ? 'cuervoA' : 'jugadora');
    const resultado = resolverEnganchesRonda(orden, combatientes, elegir);

    expect(esDueloMutuo(resultado, 'cuervoA', 'jugadora')).toBe(true);
    expect(golpeaPrimeroEnDuelo(orden, 'cuervoA', 'jugadora')).toBe('cuervoA'); // más iniciativa

    // cuervoB SÍ tiene objetivo (la jugadora), pero la jugadora no le devuelve la mirada — golpe gratis.
    expect(resultado.get('cuervoB')).toBe('jugadora');
    expect(esDueloMutuo(resultado, 'cuervoB', 'jugadora')).toBe(false);
  });

  it('petición explícita de la usuaria: "X eligió atacar a Y, luego es atacado por Z — pasa a ser X vs Z, el ataque de X ya no puede ir contra Y"', () => {
    // X primero (más iniciativa), luego Y, luego Z (menos iniciativa, pero SÍ puede enganchar a X
    // aunque X ya haya actuado antes — "un enemigo con menos iniciativa puede enganchar a alguien
    // con más, que aun así golpea primero dentro de ese duelo").
    const orden = ['x', 'y', 'z'];
    const combatientes = [
      { participantId: 'x', bando: 'JUGADOR' as const },
      { participantId: 'y', bando: 'ENEMIGO' as const },
      { participantId: 'z', bando: 'ENEMIGO' as const },
    ];
    const elegir = (id: string) => (id === 'x' ? 'y' : 'x'); // x elige y; z (el único que llega a elegir) elige x
    const resultado = resolverEnganchesRonda(orden, combatientes, elegir);

    expect(resultado.get('x')).toBe('z'); // cancelado su ataque a y, ahora duela con z
    expect(resultado.get('z')).toBe('x');
    expect(esDueloMutuo(resultado, 'x', 'z')).toBe(true);
    expect(golpeaPrimeroEnDuelo(orden, 'x', 'z')).toBe('x'); // x tiene más iniciativa que z

    // y se queda sin nadie atacándole esta ronda — ya había perdido su propio turno de elegir
    // (estaba reclamado por x en ese momento) y no recupera una segunda oportunidad.
    expect(resultado.get('y')).toBeNull();
  });

  it('sin candidatos válidos en el bando contrario: sin objetivo, no revienta', () => {
    const orden = ['solo'];
    const combatientes = [{ participantId: 'solo', bando: 'JUGADOR' as const }];
    const resultado = resolverEnganchesRonda(orden, combatientes, () => null);
    expect(resultado.get('solo')).toBeNull();
  });

  it('1 contra 1 normal: siempre acaba en duelo mutuo, quien tenga más iniciativa golpea primero', () => {
    const orden = ['rapido', 'lento'];
    const combatientes = [
      { participantId: 'rapido', bando: 'JUGADOR' as const },
      { participantId: 'lento', bando: 'ENEMIGO' as const },
    ];
    const elegir = (id: string) => (id === 'rapido' ? 'lento' : 'rapido');
    const resultado = resolverEnganchesRonda(orden, combatientes, elegir);
    expect(esDueloMutuo(resultado, 'rapido', 'lento')).toBe(true);
    expect(golpeaPrimeroEnDuelo(orden, 'rapido', 'lento')).toBe('rapido');
  });

  it('grupo impar (3 enemigos vs 1 jugadora, ella con menos iniciativa que todos): solo el primero en reclamarla entra en duelo real, los otros 2 pegan gratis', () => {
    // Jugadora AL FINAL de la cola a propósito — así nunca llega a elegir ella misma (los 3
    // enemigos ya la reclaman antes de que le toque actuar), aislando el caso "varios pretenden
    // el mismo objetivo" del caso de cancelación por elección propia (ya cubierto en el test de
    // X/Y/Z de arriba).
    const orden = ['e1', 'e2', 'e3', 'jugadora'];
    const combatientes = [
      { participantId: 'e1', bando: 'ENEMIGO' as const },
      { participantId: 'e2', bando: 'ENEMIGO' as const },
      { participantId: 'e3', bando: 'ENEMIGO' as const },
      { participantId: 'jugadora', bando: 'JUGADOR' as const },
    ];
    const elegir = () => 'jugadora'; // los 3 enemigos solo tienen un candidato posible: la jugadora
    const resultado = resolverEnganchesRonda(orden, combatientes, elegir);

    expect(esDueloMutuo(resultado, 'jugadora', 'e1')).toBe(true); // e1 llegó primero, se queda el duelo
    expect(golpeaPrimeroEnDuelo(orden, 'jugadora', 'e1')).toBe('e1'); // más iniciativa que la jugadora

    expect(resultado.get('e2')).toBe('jugadora');
    expect(esDueloMutuo(resultado, 'jugadora', 'e2')).toBe(false); // golpe gratis
    expect(resultado.get('e3')).toBe('jugadora');
    expect(esDueloMutuo(resultado, 'jugadora', 'e3')).toBe(false); // golpe gratis

    // La jugadora, ya reclamada por e1 cuando le toca actuar, no elige por su cuenta.
    expect(resultado.get('jugadora')).toBe('e1');
  });

  it('cadena de cancelaciones (2026-08-26, cazado depurando la integración real): A reclama a B, C reclama a A (cancela A→B), D reclama a C (cancela C→A) — A y B se quedan sin nadie, solo C↔D llega a duelo real', () => {
    const orden = ['a', 'b', 'c', 'd'];
    const combatientes = [
      { participantId: 'a', bando: 'JUGADOR' as const },
      { participantId: 'b', bando: 'ENEMIGO' as const },
      { participantId: 'c', bando: 'ENEMIGO' as const },
      { participantId: 'd', bando: 'JUGADOR' as const },
    ];
    const elegir = (id: string) => ({ a: 'b', c: 'a', d: 'c' })[id] ?? null; // b nunca llega a elegir (reclamada por a antes de su turno)
    const resultado = resolverEnganchesRonda(orden, combatientes, elegir);

    expect(resultado.get('a')).toBeNull(); // reclamada por c, pero c a su vez cancelado por d
    expect(resultado.get('b')).toBeNull(); // la elección de a (su único pretendiente) se canceló
    expect(esDueloMutuo(resultado, 'c', 'd')).toBe(true); // el único duelo real que sobrevive
    expect(golpeaPrimeroEnDuelo(orden, 'c', 'd')).toBe('c'); // c tiene más iniciativa que d
  });

  it('un participante fuera de la lista de combatientes (no debería pasar) se ignora sin reventar', () => {
    const orden = ['fantasma', 'jugadora', 'enemigo'];
    const combatientes = [
      { participantId: 'jugadora', bando: 'JUGADOR' as const },
      { participantId: 'enemigo', bando: 'ENEMIGO' as const },
    ];
    const elegir = (id: string) => (id === 'jugadora' ? 'enemigo' : 'jugadora');
    const resultado = resolverEnganchesRonda(orden, combatientes, elegir);
    expect(resultado.has('fantasma')).toBe(false); // ignorado del todo, ni siquiera null
    expect(esDueloMutuo(resultado, 'jugadora', 'enemigo')).toBe(true);
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
