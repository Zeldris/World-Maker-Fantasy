import { describe, it, expect } from 'vitest';
import { matchHarvestSource, matchesVerbForMetodo } from './harvest.js';

describe('matchHarvestSource', () => {
  it('coincide con un alias exacto', () => {
    expect(matchHarvestSource('Despiezo un corredor de cauce')).toBe('corredor-de-cauce');
  });

  it('tolera una errata de una palabra (roadmap 2026-07-20, misma clase de bug que matchNpcAliases)', () => {
    // "corredr" en vez de "corredor" — ningún alias de corredor-de-cauce matchea por substring
    // exacto con esta errata, así que esto solo pasa si funciona la tolerancia por distancia.
    expect(matchHarvestSource('Despiezo un corredr que acabo de cazar')).toBe('corredor-de-cauce');
  });

  it('no matchea nada si no hay ninguna especie mencionada', () => {
    expect(matchHarvestSource('Camino tranquilamente por la llanura')).toBeUndefined();
  });
});

// Verbo por método (2026-07-29, petición explícita: "para conseguir estos recursos debes cazar...
// o talar... o picar") — antes un único regex genérico servía para cualquier fuente.
describe('matchesVerbForMetodo', () => {
  it('CAZA exige desollar/despiezar, no cualquier verbo genérico', () => {
    expect(matchesVerbForMetodo('Despiezo el cadáver del corredor de cauce', 'CAZA')).toBe(true);
    expect(matchesVerbForMetodo('Desuello a la presa ya derrotada', 'CAZA')).toBe(true);
    expect(matchesVerbForMetodo('Recojo lo que encuentro por aquí', 'CAZA')).toBe(false);
  });

  it('TALA exige talar/cortar madera, no un verbo genérico de recolección', () => {
    expect(matchesVerbForMetodo('Talo el matorral de cuerno para sacar leña', 'TALA')).toBe(true);
    expect(matchesVerbForMetodo('Corto madera del matorral', 'TALA')).toBe(true);
    expect(matchesVerbForMetodo('Recojo leña del suelo', 'TALA')).toBe(false);
  });

  it('MINERIA exige picar/minar/extraer roca-piedra-mena, no un verbo genérico', () => {
    expect(matchesVerbForMetodo('Pico la roca de Los Pilares Rotos', 'MINERIA')).toBe(true);
    expect(matchesVerbForMetodo('Extraigo mena de la veta', 'MINERIA')).toBe(true);
    expect(matchesVerbForMetodo('Recojo una piedra suelta', 'MINERIA')).toBe(false);
  });

  it('EXTRACCION acepta el verbo genérico de recolección deliberada', () => {
    expect(matchesVerbForMetodo('Recolecto salvia del polvo con cuidado', 'EXTRACCION')).toBe(true);
    expect(matchesVerbForMetodo('Miro el horizonte', 'EXTRACCION')).toBe(false);
  });

  it('PASIVO nunca matchea ningún verbo (solo sale de discovery.ts, nunca de una fuente nombrada)', () => {
    expect(matchesVerbForMetodo('Recojo, talo, pico y despiezo todo a la vez', 'PASIVO')).toBe(false);
  });
});
