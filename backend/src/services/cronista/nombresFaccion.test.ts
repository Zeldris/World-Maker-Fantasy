import { describe, it, expect } from 'vitest';
import { nombreDeEscision } from './nombresFaccion.js';
import { regionesVecinas, REGIONES_VECINAS } from './regiones.js';

describe('nombres de escisión (CR-11)', () => {
  it('orcos: el nombre de quien la encabeza sin vocal final, con -ig y si no -g (Helsa → Helsig, Gosha → Goshg)', () => {
    expect(nombreDeEscision('orcos', 'Helsa', new Set())?.nombre).toBe('Clan Helsig');
    expect(nombreDeEscision('orcos', 'Gosha', new Set(['Clan Goshig']))?.nombre).toBe('Clan Goshg');
    expect(nombreDeEscision('orcos', 'Varka la Roja', new Set())).toMatchObject({ nombre: 'Clan Varkig', traduccion: expect.stringContaining('Varka') });
  });

  it('Nabieus y Faerus: la primera palabra libre de su tabla; goirntes no se escinden', () => {
    expect(nombreDeEscision('nabieus', 'x', new Set(['Keseg Tannis']))?.nombre).toBe('Keseg Karo');
    expect(nombreDeEscision('faerus', 'x', new Set())).toEqual({ nombre: 'Feg Sil', traduccion: 'manada del fuego' });
    expect(nombreDeEscision('goirntes', 'x', new Set())).toBeNull();
  });
});

describe('regiones vecinas (CR-11)', () => {
  it('es simétrica y la Meseta solo toca el Margen', () => {
    for (const [region, vecinas] of Object.entries(REGIONES_VECINAS)) {
      for (const v of vecinas) expect(regionesVecinas(v)).toContain(region);
    }
    expect(regionesVecinas('La Meseta del Orden')).toEqual(['El Margen Silencioso']);
  });
});
