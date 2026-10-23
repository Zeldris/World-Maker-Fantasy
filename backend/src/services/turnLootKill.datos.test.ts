import { describe, it, expect, vi } from 'vitest';
import { datosNpcStateDeIntercambio, dejarNpcConvaleciente } from './turnLootKill.js';
import { MINUTOS_AUSENCIA_TRAS_DERROTA } from './zonaPosicion.js';

const base = {
  npcNuevaEnergia: null,
  npcAttackHits: true,
  npcTargetNewCondicion: 'CONVALECIENTE' as const,
  analizarRivalExito: false,
  abilityNamesToIncrement: [],
  npcActiveEffectsNext: [],
  saveId: 's1',
  scope: 'loc-1',
  currentLocationId: 'loc-1',
  nuevoFictionalMinutes: 1000,
};

describe('datosNpcStateDeIntercambio (QA-220)', () => {
  it('un golpe de muerte solitario deja CONVALECIENTE y ausente de la zona 6 h', () => {
    const { create, update, esGolpeDeMuerte } = datosNpcStateDeIntercambio({ ...base, npcAttackTarget: { id: 'n1', groupSize: null, groupDefeated: 0, abilityUsesThisEncounter: {} } });
    expect(esGolpeDeMuerte).toBe(true);
    for (const d of [create, update]) {
      expect(d).toMatchObject({ condicionFisica: 'CONVALECIENTE', condicionFisicaSinceMinutes: 1000, zonaAusenteHastaMinutes: 1000 + MINUTOS_AUSENCIA_TRAS_DERROTA, zonaLocationId: 'loc-1' });
    }
    expect(MINUTOS_AUSENCIA_TRAS_DERROTA).toBe(360);
  });
  it('en un grupo con más miembros, el actual vuelve a ILESO, sin ausencia, y sube groupDefeated', () => {
    const { create, update } = datosNpcStateDeIntercambio({ ...base, npcAttackTarget: { id: 'n1', groupSize: 3, groupDefeated: 0, abilityUsesThisEncounter: {} } });
    expect(create).toMatchObject({ condicionFisica: 'ILESO', groupDefeated: 1, corpsesLooted: 0 });
    expect(update).toMatchObject({ condicionFisica: 'ILESO', groupDefeated: { increment: 1 }, targetedForKill: false });
    expect(create).not.toHaveProperty('zonaAusenteHastaMinutes');
  });
  it('el último del grupo queda CONVALECIENTE, ausente, con groupDefeated', () => {
    const { create, update } = datosNpcStateDeIntercambio({ ...base, npcAttackTarget: { id: 'n1', groupSize: 3, groupDefeated: 2, abilityUsesThisEncounter: {} } });
    expect(create).toMatchObject({ condicionFisica: 'CONVALECIENTE', groupDefeated: 1, corpsesLooted: 0, zonaAusenteHastaMinutes: 1360 });
    expect(update).toMatchObject({ condicionFisica: 'CONVALECIENTE', groupDefeated: { increment: 1 }, zonaAusenteHastaMinutes: 1360 });
  });
});

describe('dejarNpcConvaleciente (QA-220)', () => {
  it('escribe lo mismo que la derrota real, con el scope de scopeFor', async () => {
    const upsert = vi.fn();
    const tx = { npcState: { findUnique: vi.fn().mockResolvedValue(null), upsert } } as never;
    const { scope } = await dejarNpcConvaleciente(tx, { saveId: 's1', npc: { id: 'n1', kind: 'PRINCIPAL' as const }, currentLocationId: 'loc-1', ahora: 1000 });
    const arg = upsert.mock.calls[0][0];
    expect(arg.where.saveId_npcId_scope).toEqual({ saveId: 's1', npcId: 'n1', scope });
    expect(arg.create).toMatchObject({ condicionFisica: 'CONVALECIENTE', zonaAusenteHastaMinutes: 1360, zonaLocationId: 'loc-1' });
    expect(arg.update).toMatchObject({ condicionFisica: 'CONVALECIENTE', zonaAusenteHastaMinutes: 1360, zonaLocationId: 'loc-1' });
  });
});
