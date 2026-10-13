import { describe, it, expect } from 'vitest';
import { esAtacanteDeMasPermitido, topeDeRondaJugadora } from './combateMultipleOrquestacion.js';

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
