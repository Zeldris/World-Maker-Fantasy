import { describe, it, expect, afterEach } from 'vitest';
import { claimTurnInFlight, releaseTurnInFlight } from './turnLock.js';

/// Cobertura nueva (refactor de deuda técnica 2026-08-12: `turnLock.ts` pasó a apoyarse en
/// `createInFlightClaimSet` compartido con `chapterSummary.ts`) — comprueba el contrato que el
/// resto del backend da por hecho: un segundo reclamo sobre la misma partida falla mientras el
/// primero sigue en curso, y tras liberar vuelve a estar disponible.
describe('claimTurnInFlight / releaseTurnInFlight', () => {
  afterEach(() => {
    releaseTurnInFlight('save-lock-test');
    releaseTurnInFlight('save-lock-test-b');
  });

  it('un segundo reclamo sobre la misma partida falla mientras el primero no se ha liberado', () => {
    expect(claimTurnInFlight('save-lock-test')).toBe(true);
    expect(claimTurnInFlight('save-lock-test')).toBe(false);
  });

  it('tras liberar, un nuevo reclamo sobre la misma partida vuelve a tener éxito', () => {
    expect(claimTurnInFlight('save-lock-test')).toBe(true);
    releaseTurnInFlight('save-lock-test');
    expect(claimTurnInFlight('save-lock-test')).toBe(true);
  });

  it('partidas distintas no se bloquean entre sí', () => {
    expect(claimTurnInFlight('save-lock-test')).toBe(true);
    expect(claimTurnInFlight('save-lock-test-b')).toBe(true);
  });
});
