import { describe, it, expect } from 'vitest';
import {
  effectiveAttributesConDuracion,
  pushActiveEffect,
  decrementActiveEffects,
  parseActiveEffects,
  removeWorstDebilidad,
  worstDebilidadOf,
  bestAumentoOf,
  removeActiveEffect,
  type ActiveEffect,
} from './activeEffects.js';
import type { AttributeBlock } from './dice.js';

const BASE: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

describe('effectiveAttributesConDuracion', () => {
  it('sin efectos activos, devuelve el bloque base tal cual', () => {
    expect(effectiveAttributesConDuracion(BASE, [])).toEqual(BASE);
  });

  it('AUMENTO (magnitud positiva) suma sobre el atributo afectado, el resto no cambia', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 1, sourceAbility: 'Runa de Fuerza' }];
    const result = effectiveAttributesConDuracion(BASE, efectos);
    expect(result.fuerza).toBe(16);
    expect(result.destreza).toBe(10);
  });

  it('DEBILIDAD (magnitud negativa) resta sobre el atributo afectado', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'destreza', magnitude: -4, turnsRemaining: 2, sourceAbility: 'Golpe Envenenado' }];
    expect(effectiveAttributesConDuracion(BASE, efectos).destreza).toBe(6);
  });

  it('varios efectos sobre el MISMO atributo se apilan, no se sustituyen', () => {
    const efectos: ActiveEffect[] = [
      { attribute: 'fuerza', magnitude: 6, turnsRemaining: 1, sourceAbility: 'A' },
      { attribute: 'fuerza', magnitude: 3, turnsRemaining: 2, sourceAbility: 'B' },
    ];
    expect(effectiveAttributesConDuracion(BASE, efectos).fuerza).toBe(19);
  });

  it('no muta el bloque base recibido', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 1, sourceAbility: 'A' }];
    effectiveAttributesConDuracion(BASE, efectos);
    expect(BASE.fuerza).toBe(10);
  });
});

describe('pushActiveEffect', () => {
  it('añade al final sin tocar los que ya había', () => {
    const previo: ActiveEffect[] = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 1, sourceAbility: 'A' }];
    const nuevo: ActiveEffect = { attribute: 'destreza', magnitude: -4, turnsRemaining: 2, sourceAbility: 'B' };
    const result = pushActiveEffect(previo, nuevo);
    expect(result).toEqual([...previo, nuevo]);
    expect(previo).toHaveLength(1); // no muta el array original
  });
});

describe('decrementActiveEffects', () => {
  it('resta 1 turno a cada efecto', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 2, sourceAbility: 'A' }];
    expect(decrementActiveEffects(efectos)).toEqual([{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 1, sourceAbility: 'A' }]);
  });

  it('descarta los efectos que llegan a 0 turnos', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 1, sourceAbility: 'A' }];
    expect(decrementActiveEffects(efectos)).toEqual([]);
  });

  it('array vacío se queda vacío', () => {
    expect(decrementActiveEffects([])).toEqual([]);
  });
});

describe('removeWorstDebilidad', () => {
  it('sin ningún DEBILIDAD activo, devuelve la lista sin cambios', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 2, sourceAbility: 'AUMENTO A' }];
    expect(removeWorstDebilidad(efectos)).toEqual(efectos);
  });

  it('array vacío se queda vacío', () => {
    expect(removeWorstDebilidad([])).toEqual([]);
  });

  it('un solo DEBILIDAD se quita', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'destreza', magnitude: -4, turnsRemaining: 2, sourceAbility: 'Golpe Envenenado' }];
    expect(removeWorstDebilidad(efectos)).toEqual([]);
  });

  it('con varios DEBILIDAD, quita el de magnitud MÁS negativa, conserva el resto', () => {
    const leve: ActiveEffect = { attribute: 'destreza', magnitude: -2, turnsRemaining: 2, sourceAbility: 'Leve' };
    const grave: ActiveEffect = { attribute: 'fuerza', magnitude: -6, turnsRemaining: 3, sourceAbility: 'Grave' };
    const result = removeWorstDebilidad([leve, grave]);
    expect(result).toEqual([leve]);
  });

  it('ignora los AUMENTO (magnitud positiva) al buscar el peor DEBILIDAD', () => {
    const aumento: ActiveEffect = { attribute: 'fuerza', magnitude: 6, turnsRemaining: 2, sourceAbility: 'Buff' };
    const debilidad: ActiveEffect = { attribute: 'destreza', magnitude: -3, turnsRemaining: 2, sourceAbility: 'Malus' };
    const result = removeWorstDebilidad([aumento, debilidad]);
    expect(result).toEqual([aumento]);
  });

  it('no muta el array original', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'destreza', magnitude: -4, turnsRemaining: 2, sourceAbility: 'A' }];
    removeWorstDebilidad(efectos);
    expect(efectos).toHaveLength(1);
  });

  it('en caso de empate exacto, quita el primero encontrado', () => {
    const primero: ActiveEffect = { attribute: 'destreza', magnitude: -4, turnsRemaining: 2, sourceAbility: 'Primero' };
    const segundo: ActiveEffect = { attribute: 'fuerza', magnitude: -4, turnsRemaining: 3, sourceAbility: 'Segundo' };
    const result = removeWorstDebilidad([primero, segundo]);
    expect(result).toEqual([segundo]);
  });
});

describe('worstDebilidadOf', () => {
  it('sin ningún DEBILIDAD activo, devuelve null', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 2, sourceAbility: 'AUMENTO A' }];
    expect(worstDebilidadOf(efectos)).toBeNull();
  });

  it('array vacío devuelve null', () => {
    expect(worstDebilidadOf([])).toBeNull();
  });

  it('con varios DEBILIDAD, devuelve el de magnitud MÁS negativa, sin tocar la lista', () => {
    const leve: ActiveEffect = { attribute: 'destreza', magnitude: -2, turnsRemaining: 2, sourceAbility: 'Leve' };
    const grave: ActiveEffect = { attribute: 'fuerza', magnitude: -6, turnsRemaining: 3, sourceAbility: 'Grave' };
    const efectos = [leve, grave];
    expect(worstDebilidadOf(efectos)).toEqual(grave);
    expect(efectos).toHaveLength(2);
  });
});

describe('bestAumentoOf', () => {
  it('sin ningún AUMENTO activo, devuelve null', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'destreza', magnitude: -4, turnsRemaining: 2, sourceAbility: 'DEBILIDAD A' }];
    expect(bestAumentoOf(efectos)).toBeNull();
  });

  it('array vacío devuelve null', () => {
    expect(bestAumentoOf([])).toBeNull();
  });

  it('con varios AUMENTO, devuelve el de magnitud MÁS positiva, sin tocar la lista', () => {
    const leve: ActiveEffect = { attribute: 'destreza', magnitude: 2, turnsRemaining: 2, sourceAbility: 'Leve' };
    const fuerte: ActiveEffect = { attribute: 'fuerza', magnitude: 6, turnsRemaining: 3, sourceAbility: 'Fuerte' };
    const efectos = [leve, fuerte];
    expect(bestAumentoOf(efectos)).toEqual(fuerte);
    expect(efectos).toHaveLength(2);
  });
});

describe('removeActiveEffect', () => {
  it('quita el efecto exacto pasado por referencia, conserva el resto', () => {
    const a: ActiveEffect = { attribute: 'fuerza', magnitude: 6, turnsRemaining: 2, sourceAbility: 'A' };
    const b: ActiveEffect = { attribute: 'destreza', magnitude: -4, turnsRemaining: 2, sourceAbility: 'B' };
    expect(removeActiveEffect([a, b], a)).toEqual([b]);
  });

  it('null se queda sin cambios', () => {
    const efectos: ActiveEffect[] = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 2, sourceAbility: 'A' }];
    expect(removeActiveEffect(efectos, null)).toEqual(efectos);
  });

  it('un efecto que no está en la lista (por referencia) se queda sin cambios', () => {
    const a: ActiveEffect = { attribute: 'fuerza', magnitude: 6, turnsRemaining: 2, sourceAbility: 'A' };
    const ajeno: ActiveEffect = { attribute: 'fuerza', magnitude: 6, turnsRemaining: 2, sourceAbility: 'A' };
    expect(removeActiveEffect([a], ajeno)).toEqual([a]);
  });
});

describe('parseActiveEffects', () => {
  it('parsea un array JSON válido tal cual', () => {
    const raw = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 1, sourceAbility: 'A' }];
    expect(parseActiveEffects(raw)).toEqual(raw);
  });

  it('null/undefined/no-array devuelve []', () => {
    expect(parseActiveEffects(null)).toEqual([]);
    expect(parseActiveEffects(undefined)).toEqual([]);
    expect(parseActiveEffects('no un array')).toEqual([]);
    expect(parseActiveEffects({})).toEqual([]);
  });

  it('descarta entradas mal formadas dentro del array, conserva las válidas', () => {
    const raw = [{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 1, sourceAbility: 'A' }, { attribute: 'fuerza' }, null, 'basura'];
    expect(parseActiveEffects(raw)).toEqual([{ attribute: 'fuerza', magnitude: 6, turnsRemaining: 1, sourceAbility: 'A' }]);
  });
});
