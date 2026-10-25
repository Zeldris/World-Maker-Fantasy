import { describe, it, expect } from 'vitest';
import { cambiosParaSincronizar } from './itemCatalogSync.js';

const petoCat = { statBonuses: { fuerza: 3, constitucion: 4 }, equipSlot: 'ARMADURA_SUPERIOR' as const };
const tocadoCat = { statBonuses: { carisma: 2 }, equipSlot: 'COSMETICO_CABEZA' as const };

describe('cambiosParaSincronizar', () => {
  it('nunca toca filas sin catalogSlug ni slugs que ya no existen', () => {
    expect(cambiosParaSincronizar({ catalogSlug: null, statBonuses: { fuerza: 1 }, slot: 'CASCO' }, petoCat)).toBeNull();
    expect(cambiosParaSincronizar({ catalogSlug: 'borrado', statBonuses: { fuerza: 1 }, slot: 'CASCO' }, undefined)).toBeNull();
  });

  it('resetea al catálogo unos stats viejos', () => {
    const c = cambiosParaSincronizar({ catalogSlug: 'peto', statBonuses: { constitucion: 3, voluntad: 2, carisma: 2 }, slot: null }, petoCat);
    expect(c).toEqual({ statBonuses: { constitucion: 4, fuerza: 3 } });
  });

  it('no cambia nada si ya coincide (orden de claves irrelevante) — idempotente', () => {
    expect(cambiosParaSincronizar({ catalogSlug: 'peto', statBonuses: { constitucion: 4, fuerza: 3 }, slot: 'ARMADURA_SUPERIOR' }, petoCat)).toBeNull();
  });

  it('un objeto sin bonus en el catálogo con bonus viejos queda a null', () => {
    const c = cambiosParaSincronizar({ catalogSlug: 'x', statBonuses: { fuerza: 1 } }, { statBonuses: null, equipSlot: null });
    expect(c).toEqual({ statBonuses: null });
  });

  it('desequipa si la ranura ya no está permitida, y conserva la equipada válida', () => {
    expect(cambiosParaSincronizar({ catalogSlug: 't', statBonuses: { carisma: 2 }, slot: 'CASCO' }, tocadoCat)).toEqual({ desequipar: true });
    expect(cambiosParaSincronizar({ catalogSlug: 't', statBonuses: { carisma: 2 }, slot: 'COSMETICO_CABEZA' }, tocadoCat)).toBeNull();
  });

  it('respeta familias de ranura (anillo en ANILLO_2)', () => {
    expect(cambiosParaSincronizar({ catalogSlug: 'a', statBonuses: null, slot: 'ANILLO_2' }, { statBonuses: null, equipSlot: 'ANILLO_1' })).toBeNull();
  });

  it('un objeto equipado sin equipSlot en el catálogo se desequipa', () => {
    expect(cambiosParaSincronizar({ catalogSlug: 'a', statBonuses: null, slot: 'CASCO' }, { statBonuses: null, equipSlot: null })).toEqual({ desequipar: true });
  });

  it('QA-240: una copia fabricada sin bonus vuelve a los de su ficha (el catálogo manda)', () => {
    const cat = { statBonuses: { carisma: 2 }, equipSlot: 'CINTURON' as const };
    expect(cambiosParaSincronizar({ catalogSlug: 'c', statBonuses: null }, cat)).toEqual({ statBonuses: { carisma: 2 } });
    expect(cambiosParaSincronizar({ catalogSlug: 'c', statBonuses: { fuerza: 9 } }, cat)).toEqual({ statBonuses: { carisma: 2 } });
  });
});
