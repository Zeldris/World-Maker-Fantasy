import { describe, it, expect } from 'vitest';
import {
  harvestAbilityUnlocksFor,
  metodoForOficio,
  attributeForOficio,
  attributeSecundarioForOficio,
  attributeSecundarioForMetodo,
  professionIdForOficio,
} from './harvestAbilities.js';

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

  // Pescador (2026-09-02) — profesión universal (sin sufijo raza/región): aprenderla a nivel 1
  // concede Pescar Y Buscar A LA VEZ, las dos entradas que comparten `oficio: 'pescador'`.
  it('desbloquea Pescar y Buscar juntas a nivel 1 para pescador', () => {
    expect(harvestAbilityUnlocksFor('pescador', 1).map((a) => a.name)).toEqual(['Pescar', 'Buscar']);
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

  // Pescador (2026-09-02) — 'pescador-pescar'/'pescador-buscar' son las claves de ruta reales
  // (subOficio), distinguen método pese a compartir `oficio: 'pescador'` de base.
  it('resuelve PESCA/BUSQUEDA por subOficio, distinguiendo Pescar de Buscar', () => {
    expect(metodoForOficio('pescador-pescar')).toBe('PESCA');
    expect(metodoForOficio('pescador-buscar')).toBe('BUSQUEDA');
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

  it('Pescar tira por Fuerza, Buscar por Voluntad (subOficio, no el prefijo compartido)', () => {
    expect(attributeForOficio('pescador-pescar')).toBe('fuerza');
    expect(attributeForOficio('pescador-buscar')).toBe('voluntad');
  });
});

// Segundo atributo en tier alto (2026-09-02, "doble tirada en tier alto") — valores confirmados
// por la usuaria: minero fuerza→inteligencia, talador fuerza→constitucion, desollador
// destreza→inteligencia, herborista voluntad→inteligencia, Pescar fuerza→inteligencia, Buscar
// voluntad→destreza.
describe('attributeSecundarioForOficio', () => {
  it('resuelve el segundo atributo real de cada oficio recolector', () => {
    expect(attributeSecundarioForOficio('minero-llanuras')).toBe('inteligencia');
    expect(attributeSecundarioForOficio('talador-cristal')).toBe('constitucion');
    expect(attributeSecundarioForOficio('desollador-orcos-llanuras')).toBe('inteligencia');
    expect(attributeSecundarioForOficio('herborista-orcos-llanuras')).toBe('inteligencia');
    expect(attributeSecundarioForOficio('pescador-pescar')).toBe('inteligencia');
    expect(attributeSecundarioForOficio('pescador-buscar')).toBe('destreza');
  });

  it('null para un oficio sin segundo atributo declarado o inexistente', () => {
    expect(attributeSecundarioForOficio('recolector-general')).toBeNull();
    expect(attributeSecundarioForOficio('no-existe')).toBeNull();
  });
});

describe('attributeSecundarioForMetodo', () => {
  it('resuelve segundo atributo + oficio real (para el nivel) a partir del MetodoObtencion de un HarvestYield', () => {
    expect(attributeSecundarioForMetodo('MINERIA')).toEqual({ attribute: 'inteligencia', oficio: 'minero' });
    expect(attributeSecundarioForMetodo('PESCA')).toEqual({ attribute: 'inteligencia', oficio: 'pescador' });
    expect(attributeSecundarioForMetodo('BUSQUEDA')).toEqual({ attribute: 'destreza', oficio: 'pescador' });
  });

  it('null para PASIVO (nunca dispara segunda tirada)', () => {
    expect(attributeSecundarioForMetodo('PASIVO')).toBeNull();
  });
});

// `professionId` real de ProfessionProgress (2026-09-02) — para el resto del catálogo coincide
// con la propia clave de ruta; solo pescador diverge (dos claves de ruta, un único oficio real).
describe('professionIdForOficio', () => {
  it('para el resto del catálogo, la clave de ruta YA es el professionId (sin cambios)', () => {
    expect(professionIdForOficio('minero-llanuras')).toBe('minero-llanuras');
    expect(professionIdForOficio('desollador-orcos-llanuras')).toBe('desollador-orcos-llanuras');
  });

  it('pescador-pescar y pescador-buscar resuelven ambos al mismo professionId real "pescador"', () => {
    expect(professionIdForOficio('pescador-pescar')).toBe('pescador');
    expect(professionIdForOficio('pescador-buscar')).toBe('pescador');
  });
});
