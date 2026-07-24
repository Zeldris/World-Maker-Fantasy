import { describe, it, expect } from 'vitest';
import { matchHarvestSource, detectsHarvestIntent } from './harvest.js';

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

describe('detectsHarvestIntent', () => {
  it('detecta verbos de despiece/recolección', () => {
    expect(detectsHarvestIntent('Recolecto salvia del polvo')).toBe(true);
    expect(detectsHarvestIntent('Miro el horizonte')).toBe(false);
  });
});
