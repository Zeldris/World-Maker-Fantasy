import { describe, it, expect } from 'vitest';
import { razaFor } from './berigLore.js';

// Cobertura nueva (auditoría de deuda técnica 2026-08-21) — `razaFor` es la única lógica real de
// este archivo (el resto es dato puro, BERIG_RAZAS/BERIG_PERSONAJES); hasta ahora solo se
// ejercitaba indirectamente vía routes/saves/creation.ts.
describe('razaFor', () => {
  it('Gorhorn es de raza orcos', () => {
    expect(razaFor('Gorhorn')).toBe('orcos');
  });

  it('cualquier otro personaje jugable (sin flujo de creación libre todavía) devuelve null', () => {
    expect(razaFor('Dessa Kaltrenn')).toBeNull();
    expect(razaFor('Otro')).toBeNull();
  });
});
