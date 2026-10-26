import { describe, it, expect } from 'vitest';
import { parsearPasosReino } from './prepararReinoLib.js';

describe('pasos de prepararReino (3.2)', () => {
  it('interpreta cada paso', () => {
    expect(parsearPasosReino(['subditos:orcos:3:soldado', 'reclutar:tirag-susig', 'guarnicion', 'milicia:2', 'relacion:clan-goshg:EXPANSION_TERRITORIAL_AGRESIVA:2', 'combate:a,b', 'ganado:murgol:2', 'convaleciente:guchapo', 'convaleciente:guchapo:combate', 'lider-muere:goirntes', 'alianza:a:b', 'vasallo-paga:serhu', 'domable:murgol', 'domador:10', 'punto-retirado:kirelon-arenoso', 'punto-retirado:murgol:5'])).toEqual([
      { tipo: 'subditos', pueblo: 'orcos', n: 3, rol: 'soldado' },
      { tipo: 'reclutar', npcSlug: 'tirag-susig' },
      { tipo: 'guarnicion' },
      { tipo: 'milicia', n: 2 },
      { tipo: 'relacion', facSlug: 'clan-goshg', evento: 'EXPANSION_TERRITORIAL_AGRESIVA', n: 2 },
      { tipo: 'combate', npcSlugs: ['a', 'b'] },
      { tipo: 'ganado', especie: 'murgol', n: 2 },
      { tipo: 'convaleciente', npcSlug: 'guchapo', enCombate: false },
      { tipo: 'convaleciente', npcSlug: 'guchapo', enCombate: true },
      { tipo: 'lider-muere', facSlug: 'goirntes' },
      { tipo: 'alianza', facA: 'a', facB: 'b' },
      { tipo: 'vasallo-paga', vasalloSlug: 'serhu' },
      { tipo: 'domable', especie: 'murgol' },
      { tipo: 'domador', nivel: 10 },
      { tipo: 'punto-retirado', especie: 'kirelon-arenoso', n: null },
      { tipo: 'punto-retirado', especie: 'murgol', n: 5 },
    ]);
  });
  it('rechaza lo que no entiende', () => {
    for (const mal of [['punto-retirado'], ['punto-retirado:murgol:0'], ['punto-retirado:murgol:21'], ['punto-retirado:murgol:2:3'], [], ['subditos:orcos'], ['subditos:orcos:0'], ['relacion:x:NADA:1'], ['guarnicion:2'], ['combate:'], ['ganado:murgol'], ['ganado:murgol:0'], ['convaleciente'], ['convaleciente:a:b'], ['convaleciente:a:combate:b'], ['convaleciente:'], ['convaleciente::combate'], ['lider-muere'], ['lider-muere:a:b'], ['alianza:a'], ['alianza:a:b:c'], ['vasallo-paga'], ['vasallo-paga:a:b'], ['domable'], ['domable:a:b'], ['domador'], ['domador:9'], ['domador:20'], ['domador:diez'], ['domador:10:1'], ['otra']]) {
      expect(parsearPasosReino(mal)).toHaveProperty('error');
    }
  });
});
