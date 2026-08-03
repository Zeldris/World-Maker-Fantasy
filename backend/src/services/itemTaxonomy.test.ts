import { describe, it, expect } from 'vitest';
import { assertValidCategory, CATEGORY_VOCAB_BY_TIPO } from './itemTaxonomy.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend") — usado en
// seed-catalog.ts para fallar rápido ante un typo de categoría; sin ningún test hasta ahora.

describe('assertValidCategory', () => {
  it('no lanza con una combinación tipo/categoría válida', () => {
    expect(() => assertValidCategory('EQUIPABLE', 'arma', 'hacha de guerra')).not.toThrow();
    expect(() => assertValidCategory('RECURSO', 'piel', 'piel de corredor')).not.toThrow();
  });

  it('lanza con una categoría que no existe para ese tipo (typo o combinación sin sentido)', () => {
    expect(() => assertValidCategory('RECURSO', 'arma', 'algo mal categorizado')).toThrow(/no es válida para tipo "RECURSO"/);
  });

  it('el mensaje de error incluye el contexto y las categorías válidas', () => {
    expect(() => assertValidCategory('CONSUMIBLE', 'valor', 'ración de viaje')).toThrow(/ración de viaje/);
    expect(() => assertValidCategory('CONSUMIBLE', 'valor', 'ración de viaje')).toThrow(/consumible, medicinal/);
  });

  it('cada tipo del catálogo tiene al menos una categoría válida (sanidad del propio vocabulario)', () => {
    for (const categorias of Object.values(CATEGORY_VOCAB_BY_TIPO)) {
      expect(categorias.length).toBeGreaterThan(0);
    }
  });
});
