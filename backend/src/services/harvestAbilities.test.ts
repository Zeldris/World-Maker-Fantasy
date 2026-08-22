import { describe, it, expect } from 'vitest';
import { harvestAbilityUnlocksFor, metodoForOficio, attributeForOficio } from './harvestAbilities.js';

describe('harvestAbilityUnlocksFor', () => {
  it('desbloquea Minar/Talar/Desollar a nivel 1 por prefijo de oficio, con o sin variante raza+región', () => {
    expect(harvestAbilityUnlocksFor('minero-llanuras', 1).map((a) => a.name)).toEqual(['Minar']);
    expect(harvestAbilityUnlocksFor('talador-cristal', 1).map((a) => a.name)).toEqual(['Talar']);
    expect(harvestAbilityUnlocksFor('desollador-orcos-llanuras', 1).map((a) => a.name)).toEqual(['Desollar']);
  });

  // Bug real jugando en vivo (2026-08-13, "no veo la habilidad de recolección para herborista"):
  // la profesión y el catálogo ya existían, pero herborista nunca estuvo en HARVEST_ABILITIES —
  // mismo hueco que ya se cerró antes para desollador.
  it('desbloquea Recolectar hierbas a nivel 1 para herborista', () => {
    expect(harvestAbilityUnlocksFor('herborista-orcos-llanuras', 1).map((a) => a.name)).toEqual(['Recolectar hierbas']);
  });

  it('nunca desbloquea nada fuera del nivel 1 (no hay tiers superiores en recolectoras)', () => {
    expect(harvestAbilityUnlocksFor('minero-llanuras', 2)).toEqual([]);
  });

  it('un oficio creador (no recolector) no desbloquea nada aquí', () => {
    expect(harvestAbilityUnlocksFor('herrero-orco-llanuras', 1)).toEqual([]);
  });
});

describe('metodoForOficio', () => {
  it('resuelve el método real de cada oficio recolector, incluido herborista', () => {
    expect(metodoForOficio('minero-llanuras')).toBe('MINERIA');
    expect(metodoForOficio('talador-cristal')).toBe('TALA');
    expect(metodoForOficio('desollador-orcos-llanuras')).toBe('CAZA');
    expect(metodoForOficio('herborista-orcos-llanuras')).toBe('EXTRACCION');
  });

  it('null para un oficio creador o inexistente', () => {
    expect(metodoForOficio('herrero-orco-llanuras')).toBeNull();
    expect(metodoForOficio('no-existe')).toBeNull();
  });
});

// Atributo que mueve rollGathering (rediseño de recolección, 2026-08-22): minero/talador →
// esfuerzo físico (Fuerza), herborista → percepción/paciencia (Voluntad), desollador → precisión
// al despiezar (Destreza). Nunca Sigilo ni un atributo secundario — ver comentario en
// harvestAbilities.ts § HarvestAbilityUnlock.attribute.
describe('attributeForOficio', () => {
  it('resuelve el atributo primario real de cada oficio recolector, incluido herborista', () => {
    expect(attributeForOficio('minero-llanuras')).toBe('fuerza');
    expect(attributeForOficio('talador-cristal')).toBe('fuerza');
    expect(attributeForOficio('desollador-orcos-llanuras')).toBe('destreza');
    expect(attributeForOficio('herborista-orcos-llanuras')).toBe('voluntad');
  });

  it('null para un oficio creador o inexistente', () => {
    expect(attributeForOficio('herrero-orco-llanuras')).toBeNull();
    expect(attributeForOficio('no-existe')).toBeNull();
  });
});
