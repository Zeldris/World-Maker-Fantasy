import { describe, it, expect } from 'vitest';
import { parsearPasosReino } from './prepararReinoLib.js';

describe('pasos de prepararReino (3.2)', () => {
  it('interpreta cada paso', () => {
    expect(parsearPasosReino(['subditos:orcos:3:soldado', 'reclutar:tirag-susig', 'guarnicion', 'milicia:2', 'relacion:clan-goshg:EXPANSION_TERRITORIAL_AGRESIVA:2', 'combate:a,b'])).toEqual([
      { tipo: 'subditos', pueblo: 'orcos', n: 3, rol: 'soldado' },
      { tipo: 'reclutar', npcSlug: 'tirag-susig' },
      { tipo: 'guarnicion' },
      { tipo: 'milicia', n: 2 },
      { tipo: 'relacion', facSlug: 'clan-goshg', evento: 'EXPANSION_TERRITORIAL_AGRESIVA', n: 2 },
      { tipo: 'combate', npcSlugs: ['a', 'b'] },
    ]);
  });
  it('rechaza lo que no entiende', () => {
    for (const mal of [[], ['subditos:orcos'], ['subditos:orcos:0'], ['relacion:x:NADA:1'], ['guarnicion:2'], ['combate:'], ['otra']]) {
      expect(parsearPasosReino(mal)).toHaveProperty('error');
    }
  });
});
