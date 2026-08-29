import { describe, it, expect } from 'vitest';
import { decideOfertaModoDinamico } from './dynamicMode.js';

describe('decideOfertaModoDinamico', () => {
  it('sin candidatos (NPC/FAUNA con cantidad > 0), nunca ofrece nada', () => {
    expect(decideOfertaModoDinamico([], () => 0)).toBeNull();
    expect(decideOfertaModoDinamico([{ tipo: 'RECURSO', targetSlug: 'x', cantidad: 5 }], () => 0)).toBeNull();
    expect(decideOfertaModoDinamico([{ tipo: 'EDIFICIO', targetSlug: 'x', cantidad: 1 }], () => 0)).toBeNull();
  });

  it('un candidato FAUNA con cantidad 0 (inactivo) no cuenta', () => {
    expect(decideOfertaModoDinamico([{ tipo: 'FAUNA', targetSlug: 'murgol', cantidad: 0 }], () => 0)).toBeNull();
  });

  it('random por encima del umbral de probabilidad, no ofrece aunque haya candidatos', () => {
    const zonePoints = [{ tipo: 'NPC' as const, targetSlug: 'gistera-koh', cantidad: 1 }];
    // decideOfertaModoDinamico consume random() una vez para el umbral — devolver 0.99 (>= 0.35) lo rechaza.
    expect(decideOfertaModoDinamico(zonePoints, () => 0.99)).toBeNull();
  });

  it('random por debajo del umbral, con un único candidato, lo elige', () => {
    const zonePoints = [{ tipo: 'NPC' as const, targetSlug: 'gistera-koh', cantidad: 1 }];
    expect(decideOfertaModoDinamico(zonePoints, () => 0)).toEqual({ tipo: 'NPC', targetSlug: 'gistera-koh' });
  });

  it('con varios candidatos, elige uno de ellos determinista según random', () => {
    const zonePoints = [
      { tipo: 'NPC' as const, targetSlug: 'gistera-koh', cantidad: 1 },
      { tipo: 'FAUNA' as const, targetSlug: 'murgol', cantidad: 3 },
    ];
    // Primera llamada a random() decide el umbral (0 pasa), segunda decide el índice.
    let call = 0;
    const secuencia = [0, 0.99];
    const random = () => secuencia[call++];
    expect(decideOfertaModoDinamico(zonePoints, random)).toEqual({ tipo: 'FAUNA', targetSlug: 'murgol' });
  });
});
