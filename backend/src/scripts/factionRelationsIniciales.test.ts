import { describe, it, expect } from 'vitest';
import { factions, factionRelationsIniciales } from './worldCatalog.js';
import { typeForPresion } from '../services/factionRelations.js';

/// H-7 — relaciones iniciales entre facciones (decisión de Álvaro, 2026-09-29).
describe('factionRelationsIniciales', () => {
  const nombres = new Set(factions.map((f) => f.name));

  it('solo usa facciones del catálogo, presión en 0-100 y nunca una facción consigo misma', () => {
    for (const r of factionRelationsIniciales) {
      expect(nombres.has(r.source), r.source).toBe(true);
      expect(nombres.has(r.target), r.target).toBe(true);
      expect(r.source).not.toBe(r.target);
      expect(r.presion).toBeGreaterThanOrEqual(0);
      expect(r.presion).toBeLessThanOrEqual(100);
    }
  });

  it('una sola fila por pareja, en cualquier dirección', () => {
    const parejas = factionRelationsIniciales.map((r) => [r.source, r.target].sort().join('|'));
    expect(new Set(parejas).size).toBe(parejas.length);
  });

  it('las posturas clave del lore caen en su banda', () => {
    const tipo = (a: string, b: string) => {
      const r = factionRelationsIniciales.find((x) => (x.source === a && x.target === b) || (x.source === b && x.target === a));
      return r ? typeForPresion(r.presion) : 'NEUTRAL';
    };
    expect(tipo('Concordia de Hierro', 'Los del Obelisco')).toBe('TENSION');
    expect(tipo('Concordia de Hierro', 'Feg Tusha')).toBe('GUERRA');
    expect(tipo('Clan Serhu', 'Feg Tusha')).toBe('GUERRA');
    expect(tipo('Clan Serhu', 'Feg Ger')).toBe('TRATADO_COMERCIAL');
    expect(tipo('Clan Helsig', 'Clan Goshg')).toBe('NEUTRAL');
  });
});
