import { describe, it, expect } from 'vitest';
import { parsearPasosReino, sexoDelSubdito } from './prepararReinoLib.js';

describe('pasos de prepararReino (3.2)', () => {
  it('interpreta cada paso', () => {
    expect(parsearPasosReino(['subditos:orcos:3:soldado', 'reclutar:tirag-susig', 'guarnicion', 'milicia:2', 'relacion:clan-goshg:EXPANSION_TERRITORIAL_AGRESIVA:2', 'combate:a,b', 'ganado:murgol:2', 'convaleciente:guchapo', 'convaleciente:guchapo:combate', 'lider-muere:goirntes', 'alianza:a:b', 'vasallo-paga:serhu', 'domable:murgol', 'domador:10', 'punto-retirado:kirelon-arenoso', 'punto-retirado:murgol:5', 'sin-aliados', 'reparar', 'danar:cocina', 'subditos:orcos:4:sexo=f', 'subditos:orcos:2:cazador:sexo=m', 'subditos:orcos:2:sexo=pareja:soldado'])).toEqual([
      { tipo: 'subditos', pueblo: 'orcos', n: 3, rol: 'soldado', sexo: 'alterna' },
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
      { tipo: 'sin-aliados' },
      { tipo: 'reparar' },
      { tipo: 'danar', receta: 'cocina' },
      { tipo: 'subditos', pueblo: 'orcos', n: 4, rol: null, sexo: 'f' },
      { tipo: 'subditos', pueblo: 'orcos', n: 2, rol: 'cazador', sexo: 'm' },
      { tipo: 'subditos', pueblo: 'orcos', n: 2, rol: 'soldado', sexo: 'alterna' },
    ]);
  });
  it('rechaza lo que no entiende', () => {
    for (const mal of [['sin-aliados:1'], ['punto-retirado'], ['punto-retirado:murgol:0'], ['punto-retirado:murgol:21'], ['punto-retirado:murgol:2:3'], [], ['subditos:orcos'], ['subditos:orcos:0'], ['relacion:x:NADA:1'], ['guarnicion:2'], ['combate:'], ['ganado:murgol'], ['ganado:murgol:0'], ['convaleciente'], ['convaleciente:a:b'], ['convaleciente:a:combate:b'], ['convaleciente:'], ['convaleciente::combate'], ['lider-muere'], ['lider-muere:a:b'], ['alianza:a'], ['alianza:a:b:c'], ['vasallo-paga'], ['vasallo-paga:a:b'], ['domable'], ['domable:a:b'], ['domador'], ['domador:9'], ['domador:20'], ['domador:diez'], ['domador:10:1'], ['otra'], ['reparar:1'], ['danar'], ['danar:a:b'], ['danar:Cocina'], ['subditos:orcos:2:sexo=x'], ['subditos:orcos:2:sexo=m:sexo=f'], ['subditos:orcos:2:a:b:sexo=m']]) {
      expect(parsearPasosReino(mal)).toHaveProperty('error');
    }
  });
  it('P180, P295, P367, P370: escasez, asalto, mochila-libre y nivel', () => {
    expect(parsearPasosReino(['escasez:clan-serhu', 'escasez:clan-serhu:comida', 'asalto:clan-serhu', 'mochila-libre', 'mochila-libre:25', 'nivel:12'])).toEqual([
      { tipo: 'escasez', facSlug: 'clan-serhu', recurso: null },
      { tipo: 'escasez', facSlug: 'clan-serhu', recurso: 'comida' },
      { tipo: 'asalto', facSlug: 'clan-serhu' },
      { tipo: 'mochila-libre', n: null },
      { tipo: 'mochila-libre', n: 25 },
      { tipo: 'nivel', nivel: 12 },
    ]);
    for (const mal of [['escasez'], ['escasez:a:b:c'], ['asalto'], ['asalto:a:b'], ['mochila-libre:0'], ['mochila-libre:201'], ['mochila-libre:x'], ['nivel'], ['nivel:1'], ['nivel:20'], ['nivel:x']]) {
      expect(parsearPasosReino(mal)).toHaveProperty('error');
    }
  });
  it('P378: el sexo alterna por defecto y se puede fijar', () => {
    expect([0, 1, 2, 3].map((i) => sexoDelSubdito('alterna', i))).toEqual(['M', 'F', 'M', 'F']);
    expect([0, 1, 2].map((i) => sexoDelSubdito('f', i))).toEqual(['F', 'F', 'F']);
    expect([0, 1].map((i) => sexoDelSubdito('m', i))).toEqual(['M', 'M']);
  });
});
