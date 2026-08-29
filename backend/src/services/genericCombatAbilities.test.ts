import { describe, expect, it } from 'vitest';
import { GENERIC_COMBAT_ABILITIES } from './genericCombatAbilities.js';

// Ajuste 2026-08-28 (petición explícita, ronda de correcciones): Defenderse baja de recuperar 10
// a recuperar 5; Esquivar invierte el signo — de recuperar 5 pasa a costar 5. Mismos números que
// ya tenía el lado del NPC desde antes (npcCombatAbilities.ts) — quedaron desincronizados desde
// 2026-07-31, este test cierra el hueco de cobertura del lado del jugador.
describe('GENERIC_COMBAT_ABILITIES', () => {
  it('Defenderse: gratis, recupera 5 (bajó de 10)', () => {
    const defenderse = GENERIC_COMBAT_ABILITIES.find((a) => a.name === 'Defenderse');
    expect(defenderse).toMatchObject({ energyCost: 0, energyRegen: 5, preferredAttribute: 'constitucion' });
  });

  it('Esquivar: cuesta 5, no regenera (antes gratis y recuperaba 5)', () => {
    const esquivar = GENERIC_COMBAT_ABILITIES.find((a) => a.name === 'Esquivar');
    expect(esquivar).toMatchObject({ energyCost: 5, energyRegen: 0, preferredAttribute: 'destreza' });
  });
});
