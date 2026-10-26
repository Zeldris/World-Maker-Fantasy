import { describe, expect, it } from 'vitest';
import { avisoDeCarga } from './darObjetosLib.js';

describe('avisoDeCarga (darObjetos.ts)', () => {
  it('avisa con la carga y la capacidad cuando el inventario pasa el tope', () => {
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
