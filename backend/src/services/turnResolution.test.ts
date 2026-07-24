import { describe, it, expect } from 'vitest';
import { detectsLootIntent } from './turnResolution.js';

describe('detectsLootIntent', () => {
  it('detecta coincidencia exacta de un stem', () => {
    expect(detectsLootIntent('Registro el cuerpo del enemigo caído.')).toBe(true);
  });

  it('tolera una errata de distancia 2 en un stem literal (auditoría 2026-07-20, P0.4)', () => {
    expect(detectsLootIntent('Le saqeo el cadáver antes de seguir.')).toBe(true);
  });

  it('no dispara con una acción sin ninguna intención de saqueo', () => {
    expect(detectsLootIntent('Miro con cuidado el horizonte.')).toBe(false);
  });
});
