import { describe, it, expect } from 'vitest';
import { disparadoresDeMoral, formaDeRetirada, quienTiraMoral, tieneMoral, tirarEscape, tirarMoral, vaClaramentePerdiendo } from './moralCombate.js';

const ATR = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };
/// `random` que da exactamente ese d20.
const d20 = (...valores: number[]) => {
  let i = 0;
  return () => (valores[i++ % valores.length]! - 1) / 20;
};

describe('moral y retirada (CR-44)', () => {
  it('tienen moral las personas; no la fauna, las invocaciones ni el líder sin sucesor', () => {
    expect(tieneMoral({ raza: 'orcos' })).toBe(true);
    expect(tieneMoral({ raza: null, faunaCategoria: 'GARRAS' })).toBe(false);
    expect(tieneMoral({ raza: 'orcos', esInvocacion: true })).toBe(false);
    expect(tieneMoral({ raza: 'goirntes', sinSucesor: true })).toBe(false);
  });

  it('se dispara la primera vez que cae a GRAVE o que su bando queda a la mitad', () => {
    expect(disparadoresDeMoral({ condicion: 'HERIDO', propiosEnPie: 1, propiosTotal: 1 }, { condicion: 'GRAVE', propiosEnPie: 1 })).toEqual(['GRAVE']);
    expect(disparadoresDeMoral({ condicion: 'GRAVE', propiosEnPie: 1, propiosTotal: 1 }, { condicion: 'GRAVE', propiosEnPie: 1 })).toEqual([]);
    expect(disparadoresDeMoral({ condicion: 'HERIDO', propiosEnPie: 1, propiosTotal: 1 }, { condicion: 'CONVALECIENTE', propiosEnPie: 0 })).toEqual([]);
    expect(disparadoresDeMoral({ condicion: 'ILESO', propiosEnPie: 3, propiosTotal: 4 }, { condicion: 'ILESO', propiosEnPie: 2 })).toEqual(['MITAD_BANDO']);
    expect(disparadoresDeMoral({ condicion: 'ILESO', propiosEnPie: 2, propiosTotal: 4 }, { condicion: 'ILESO', propiosEnPie: 1 })).toEqual([]);
  });

  it('va claramente perdiendo: doble de enemigos en pie, o un grave propio sin graves enfrente', () => {
    expect(vaClaramentePerdiendo(['ILESO'], ['ILESO', 'ILESO'])).toBe(true);
    expect(vaClaramentePerdiendo(['GRAVE'], ['HERIDO'])).toBe(true);
    expect(vaClaramentePerdiendo(['GRAVE'], ['GRAVE'])).toBe(false);
    expect(vaClaramentePerdiendo(['ILESO', 'ILESO'], ['ILESO', 'ILESO', 'ILESO'])).toBe(false);
  });

  it('moral: d20 + Voluntad / 2 contra 10; con desventaja se queda el peor de dos', () => {
    expect(tirarMoral(ATR, false, d20(5))).toMatchObject({ total: 10, aguanta: true, modo: 'normal' });
    expect(tirarMoral(ATR, false, d20(4))).toMatchObject({ total: 9, aguanta: false });
    expect(tirarMoral(ATR, true, d20(18, 3))).toMatchObject({ rolls: [18, 3], usedRoll: 3, aguanta: false, modo: 'desventaja' });
  });

  it('escape: huir de alguien de más nivel cuesta más', () => {
    expect(tirarEscape(ATR, 3, 1, d20(10)).dificultad).toBe(8);
    expect(tirarEscape(ATR, 1, 6, d20(10))).toMatchObject({ dificultad: 18, escapa: false });
  });

  it('forma de la retirada y quién tira por el grupo', () => {
    expect(formaDeRetirada(8)).toBe('DESBANDADA');
    expect(formaDeRetirada(12)).toBe('ORDENADA');
    const grupo = [
      { id: 'a', voluntad: 8, enPie: true },
      { id: 'b', voluntad: 14, enPie: true },
      { id: 'jefe', voluntad: 9, enPie: true },
    ];
    expect(quienTiraMoral(grupo, 'jefe')?.id).toBe('jefe');
    expect(quienTiraMoral(grupo.map((m) => (m.id === 'jefe' ? { ...m, enPie: false } : m)), 'jefe')?.id).toBe('b');
  });
});
