import { describe, expect, it } from 'vitest';
import { esCompanero, esGuardia, USOS_FAUNA, usosLegibles } from './usosFauna.js';
import { esGanado } from './ganaderia.js';

/// CR-56 (Q1): ficha de usos con las reglas de la Fase D.
// Fuerza + Constitución del catálogo (2026-10-06).
const FC: Record<string, number> = {
  'gargantua-de-ceniza': 42, 'salamandra-de-escoria': 26, 'rondador-de-brasas': 25, cruzavientos: 24, canizor: 17, 'aullador-rojo': 13, 'zense-ceniza': 12,
};

describe('usos de la fauna (CR-56)', () => {
  it('toda especie de guardia llega a Fuerza + Constitución 14; el Aullador Rojo (13) no es guardia', () => {
    for (const [slug, u] of Object.entries(USOS_FAUNA)) if (u.guardia) expect(FC[slug]).toBeGreaterThanOrEqual(14);
    expect(esGuardia('aullador-rojo')).toBe(false);
    expect(esCompanero('aullador-rojo')).toBe(true);
  });

  it('toda especie de guardia se cría en corral (Q2)', () => {
    for (const [slug, u] of Object.entries(USOS_FAUNA)) if (u.guardia) expect(esGanado(slug)).toBe(true);
  });

  it('la ficha se lee en la Enciclopedia', () => {
    expect(usosLegibles('canizor')).toEqual(['guardia del Reino', 'compañero de combate', 'montura (Nabieus y Faerus)']);
    expect(usosLegibles('murgol')[0]).toBe('producción (leche y lana)');
    expect(usosLegibles('sombra-de-kroj')).toEqual([]);
  });
});
