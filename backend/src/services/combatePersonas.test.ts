import { describe, it, expect } from 'vitest';
import { aliadosQueSeUnen } from './combatePersonas.js';

/// CR-49: quién se une al combate al atacar a una persona (como en BG3).
describe('aliadosQueSeUnen', () => {
  const c = (slug: string, x: number, y: number) => ({ slug, punto: { x, y } });

  it('los de su facción a 3 casillas o menos, los más cercanos primero, como mucho 3', () => {
    const r = aliadosQueSeUnen({ x: 400, y: 220 }, [c('lejos', 400, 600), c('a3', 400, 380), c('a1', 450, 220), c('a2', 500, 260), c('a2b', 300, 260)], false);
    expect(r.map((x) => x.slug)).toEqual(['a1', 'a2', 'a2b']);
  });

  it('en un interior se une la guardia aunque esté lejos; el bando no pasa de 4', () => {
    const r = aliadosQueSeUnen({ x: 400, y: 220 }, [c('guardiana-helsig', 50, 550), c('a1', 450, 220), c('a2', 500, 260), c('a3', 300, 260)], true);
    expect(r.map((x) => x.slug)).toEqual(['guardiana-helsig', 'a1', 'a2']);
    expect(aliadosQueSeUnen({ x: 400, y: 220 }, [c('guardiana-helsig', 50, 550)], false)).toEqual([]);
  });

  it('sin punto propio en el mapa solo se une la guardia', () => {
    expect(aliadosQueSeUnen(null, [c('a1', 450, 220), c('guardia-x', 0, 0)], true).map((x) => x.slug)).toEqual(['guardia-x']);
  });
});
