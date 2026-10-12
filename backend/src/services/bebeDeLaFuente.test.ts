import { describe, expect, it } from 'vitest';
import { bebeDeLaFuente, soloBebeDeLaFuente, RECOGER_AGUA_RECIPE, PUNTOS_DE_AGUA } from './crafting.js';

describe('bebeDeLaFuente (QA-27 P39)', () => {
  it('bebe del agua del sitio en un punto de agua real', () => {
    expect(bebeDeLaFuente('Bebo agua del manantial', 'manaderos')).toBe(true);
    expect(bebeDeLaFuente('me agacho y bebo del pozo', 'pozo-cauce-viejo')).toBe(true);
    expect(bebeDeLaFuente('Bebo en el oasis', 'oasis-de-chudos-rojos')).toBe(true);
  });

  it('fuera de un punto de agua no cuenta', () => {
    expect(bebeDeLaFuente('Bebo agua', 'llanuras-de-holdo')).toBe(false);
    expect(bebeDeLaFuente('Bebo agua', null)).toBe(false);
  });

  it('beber de un recipiente o sin agua de por medio no cuenta', () => {
    expect(bebeDeLaFuente('Bebo del odre', 'manaderos')).toBe(false);
    expect(bebeDeLaFuente('Bebo agua del odre', 'manaderos')).toBe(false);
    expect(bebeDeLaFuente('Bebo vino', 'manaderos')).toBe(false);
    expect(bebeDeLaFuente('Lleno el odre de agua', 'manaderos')).toBe(false);
  });

  it('los puntos de agua son los mismos donde se llena el odre', () => {
    expect(RECOGER_AGUA_RECIPE.location).toEqual([...PUNTOS_DE_AGUA]);
  });

  it('solo beber se narra sin el modelo; si hace algo más, no', () => {
    expect(soloBebeDeLaFuente('Bebo agua de la fuente hasta saciarme.')).toBe(true);
    expect(soloBebeDeLaFuente('Bebo agua del manantial.')).toBe(true);
    expect(soloBebeDeLaFuente('Bebo agua del pozo y hablo con el pastor')).toBe(false);
    expect(soloBebeDeLaFuente('Bebo agua, luego sigo')).toBe(false);
  });
});
