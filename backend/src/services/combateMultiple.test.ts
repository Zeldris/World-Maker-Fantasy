import { describe, it, expect } from 'vitest';
import {
  rollInitiativeMultiple,
  elegirObjetivo,
  objetivosValidos,
  retargetBando,
  particionarEnSubCombates,
  subCombateJugable,
  INTELIGENCIA_TACTICA_UMBRAL,
  MAX_COMBATIENTES_POR_BANDO,
  type CombatienteIniciativa,
  type ObjetivoCandidato,
  type CombatienteParticion,
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
