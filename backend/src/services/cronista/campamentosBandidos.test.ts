import { describe, it, expect } from 'vitest';
import { elegirOcupante, genteInicial, OCUPANTES_CAMPAMENTO, refuerzos, regionesConCampamentos, tocaCampamento, topeTrasExito } from './campamentosBandidos.js';

/// CR-50 (50a): semillas y reglas puras de los campamentos de bandidos.
describe('campamentos de bandidos (CR-50)', () => {
  it('las semillas provisionales: renegados de cada pueblo, con su NPC plantilla', () => {
    expect(OCUPANTES_CAMPAMENTO.map((o) => o.npcSlug)).toEqual(['goirnte-renegado', 'faerus-erratico', 'nabieus-enloquecido']);
    expect(regionesConCampamentos()).toEqual(['El Margen Silencioso', 'La Meseta del Orden', 'Las Llanuras del Viento Rojo']);
  });

  it('el primero el día 10; uno destruido se rehace a los 20', () => {
    expect(tocaCampamento(9, null)).toBe(false);
    expect(tocaCampamento(10, null)).toBe(true);
    expect(tocaCampamento(29, 10)).toBe(false);
    expect(tocaCampamento(30, 10)).toBe(true);
  });

  it('sorteo por región: fuera de sus regiones, nadie', () => {
    expect(elegirOcupante('El Margen Silencioso', () => 0.9)?.slug).toBe('nabieus-enloquecidos');
    expect(elegirOcupante('Las Llanuras del Viento Rojo', () => 0)?.slug).toBe('renegados-goirntes');
    expect(elegirOcupante('Cristal Helado', () => 0.5)).toBeNull();
    expect([0, 0.999].map((r) => genteInicial(() => r))).toEqual([6, 9]);
  });

  it('un refuerzo cada 3 días hasta el tope; el tope crece hasta 12', () => {
    expect(refuerzos({ gente: 4, tope: 8, ultimoRefuerzoDia: 10 }, 12)).toEqual({ gente: 4, ultimoRefuerzoDia: 10 });
    expect(refuerzos({ gente: 4, tope: 8, ultimoRefuerzoDia: 10 }, 17)).toEqual({ gente: 6, ultimoRefuerzoDia: 16 });
    expect(refuerzos({ gente: 7, tope: 8, ultimoRefuerzoDia: 10 }, 40)).toEqual({ gente: 8, ultimoRefuerzoDia: 40 });
    expect(topeTrasExito(11)).toBe(12);
    expect(topeTrasExito(12)).toBe(12);
  });
});
