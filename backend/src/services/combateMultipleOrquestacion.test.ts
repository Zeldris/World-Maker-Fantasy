import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { condicionTrasGolpe, esAtacanteDeMasPermitido, topeDeRondaJugadora } from './combateMultipleOrquestacion.js';

/// P129 (QA-27): reglas de los ataques de más contra la jugadora en un combate de grupo.
describe('P129 — ataques de más contra la jugadora', () => {
  const jugadora = { id: 'J', objetivoActualId: 'A' };
  const participantes = ['A', 'B', 'C', 'D'].map((id) => ({ id, objetivoActualId: 'J' }));
  const orden = ['B', 'J', 'A', 'C', 'D'];

  it('solo los 2 primeros por iniciativa, sin contar su duelo, la atacan de más', () => {
    expect(esAtacanteDeMasPermitido(orden, participantes, 'B', jugadora)).toBe(true);
    expect(esAtacanteDeMasPermitido(orden, participantes, 'C', jugadora)).toBe(true);
    expect(esAtacanteDeMasPermitido(orden, participantes, 'D', jugadora)).toBe(false);
  });

  it('en una ronda que empezó Ilesa, un golpe mortal la deja Convaleciente', () => {
    expect(topeDeRondaJugadora('ILESO', 'MUERTO')).toBe('CONVALECIENTE');
    expect(topeDeRondaJugadora('HERIDO', 'MUERTO')).toBe('MUERTO');
    expect(topeDeRondaJugadora(null, 'MUERTO')).toBe('MUERTO');
    expect(topeDeRondaJugadora('ILESO', 'GRAVE')).toBe('GRAVE');
  });
});

/// `/code-review` del PR #53: el tope de ronda vale para todo golpe sin tirada propia (objetivo extra de
/// MULTIPLE/AREA, DESVIAR, tótem), no solo para el intercambio principal.
describe('P129 — tope de ronda en los golpes sin tirada propia', () => {
  it('a la jugadora que empezó Ilesa, un golpe LETAL la deja Convaleciente; a un NPC, no', () => {
    expect(condicionTrasGolpe({ tipo: 'JUGADOR', condicionInicioRonda: 'ILESO' }, ['LETAL'], 'ILESO')).toBe('CONVALECIENTE');
    expect(condicionTrasGolpe({ tipo: 'NPC', condicionInicioRonda: null }, ['LETAL'], 'ILESO')).toBe('MUERTO');
  });

  it('todo golpe de la orquestación calcula su condición con condicionTrasGolpe', () => {
    const codigo = readFileSync(new URL('./combateMultipleOrquestacion.ts', import.meta.url), 'utf-8');
    expect(codigo.match(/nextCondicionForAttack\(/g)).toHaveLength(1);
  });
});
