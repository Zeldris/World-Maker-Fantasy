import { describe, it, expect } from 'vitest';
import { resumenDeCaza } from './partidasCaza.js';

/// P439: el aviso de una caza sin piezas concuerda con el número de heridos.
describe('resumenDeCaza (P439)', () => {
  const base = { quien: 'La partida de caza', nombre: 'Múrgol', lugar: 'Karot Veku', encuentros: 1, piezas: 0, capturados: 0, caidos: 0, muertos: 0, desarmados: 0 };

  it('1 herido: «1 de los suyos sale herido», en singular', () => {
    expect(resumenDeCaza({ ...base, heridos: 1 })).toBe('La partida de caza planta cara a Múrgol en Karot Veku y no abate ninguno: 1 de los suyos sale herido y la partida se retira.');
    expect(resumenDeCaza({ ...base, heridos: 1, caidos: 1 })).toContain('1 de los suyos sale herido (fuera de combate) y la partida se retira.');
  });

  it('varios heridos o ninguno: el texto de siempre', () => {
    expect(resumenDeCaza({ ...base, heridos: 3, caidos: 2 })).toContain('no abate ninguno: 3 de los suyos salen heridos (2 fuera de combate) y se retiran.');
    expect(resumenDeCaza({ ...base, heridos: 0 })).toContain('no abate ninguno: los suyos se retiran.');
  });
});
