import { describe, expect, it } from 'vitest';
import { avisoDeCarga, repartirPorCapacidad } from './darObjetosLib.js';

const par = (slug: string, cantidad: number) => ({ slug, nombre: slug.toUpperCase(), cantidad });

describe('avisoDeCarga (darObjetos.ts)', () => {
  it('avisa con la carga y la capacidad cuando el inventario ya pasa el tope', () => {
    const aviso = avisoDeCarga(34, 30);
    expect(aviso).toContain('34');
    expect(aviso).toContain('30');
    expect(aviso).toContain('4 de más');
  });

  it('no avisa si la carga cabe, tampoco justo en el tope', () => {
    expect(avisoDeCarga(12, 30)).toBeNull();
    expect(avisoDeCarga(30, 30)).toBeNull();
  });
});

describe('repartirPorCapacidad (P367: dar no pasa el tope)', () => {
  it('da todo si cabe', () => {
    const r = repartirPorCapacidad([par('a', 3), par('b', 2)], 10, 30);
    expect(r.dar).toEqual([par('a', 3), par('b', 2)]);
    expect(r.fuera).toEqual([]);
    expect(r.avisos).toEqual([]);
  });

  it('da lo que cabe, por orden, y avisa de lo recortado', () => {
    const r = repartirPorCapacidad([par('a', 4), par('b', 5), par('c', 1)], 25, 30);
    expect(r.dar).toEqual([par('a', 4), par('b', 1)]);
    expect(r.fuera).toEqual([par('b', 4), par('c', 1)]);
    expect(r.avisos).toHaveLength(2);
    expect(r.avisos[0]).toContain('se dan 1 de 5');
    expect(r.avisos[0]).toContain('25/30');
    expect(r.avisos[1]).toContain('no se da ninguno');
  });

  it('con el inventario lleno o pasado no da nada', () => {
    expect(repartirPorCapacidad([par('a', 2)], 30, 30).dar).toEqual([]);
    const r = repartirPorCapacidad([par('a', 2)], 170, 37);
    expect(r.dar).toEqual([]);
    expect(r.fuera).toEqual([par('a', 2)]);
  });
});
