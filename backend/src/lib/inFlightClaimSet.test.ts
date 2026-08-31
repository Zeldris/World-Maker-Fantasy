import { describe, it, expect, vi, afterEach } from 'vitest';
import { createInFlightClaimSet } from './inFlightClaimSet.js';

describe('createInFlightClaimSet', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('un segundo claim sobre la misma clave falla mientras la primera no se libera', () => {
    const set = createInFlightClaimSet<string>();
    expect(set.claim('a')).toBe(true);
    expect(set.claim('a')).toBe(false);
  });

  it('tras release, un nuevo claim sobre la misma clave vuelve a tener éxito', () => {
    const set = createInFlightClaimSet<string>();
    expect(set.claim('a')).toBe(true);
    set.release('a');
    expect(set.claim('a')).toBe(true);
  });

  it('claves distintas no se bloquean entre sí', () => {
    const set = createInFlightClaimSet<string>();
    expect(set.claim('a')).toBe(true);
    expect(set.claim('b')).toBe(true);
  });

  it('CADUCIDAD: un claim más viejo que staleAfterMs se trata como abandonado, sin necesitar release', () => {
    vi.useFakeTimers();
    const set = createInFlightClaimSet<string>(1000);

    expect(set.claim('save-1')).toBe(true);
    // Simula la promesa zombie real (narrateAndPersistTurn colgada sin timeout que la corte) —
    // nunca llama a release(), exactamente el escenario que causaba el bloqueo permanente.
    expect(set.claim('save-1')).toBe(false);

    vi.advanceTimersByTime(1500); // supera staleAfterMs

    expect(set.claim('save-1')).toBe(true);
  });

  it('un claim reciente (dentro de staleAfterMs) sigue bloqueando con normalidad', () => {
    vi.useFakeTimers();
    const set = createInFlightClaimSet<string>(1000);

    expect(set.claim('save-1')).toBe(true);
    vi.advanceTimersByTime(500); // NO supera staleAfterMs

    expect(set.claim('save-1')).toBe(false);
  });

  it('usa 5 minutos (300000ms) como margen por defecto si no se especifica', () => {
    vi.useFakeTimers();
    const set = createInFlightClaimSet<string>();

    expect(set.claim('save-1')).toBe(true);
    vi.advanceTimersByTime(299_000);
    expect(set.claim('save-1')).toBe(false);

    vi.advanceTimersByTime(2_000); // total 301s, supera los 300s por defecto
    expect(set.claim('save-1')).toBe(true);
  });
});
