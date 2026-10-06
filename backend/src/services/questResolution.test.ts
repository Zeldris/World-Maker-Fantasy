import { describe, it, expect, vi } from 'vitest';
import { grantQuestRewardRecipesAndCompanion, parseRewardCompanion } from './questResolution.js';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-18: "el único test que toca
/// grantQuestRewardRecipesAndCompanion le pasa [] / null — ningún camino donde de verdad concede
/// algo está probado"). `tx` mockeado a mano (mismo criterio que recolectar.test.ts) en vez de una
/// base de datos real: esta función es pura orquestación de 2 escrituras condicionales, no necesita
/// una transacción de Postgres real para probar su lógica de negocio.
function mockTx(overrides: {
  unlockedRecipeKeys?: string[];
  companionCount?: number;
  companionBuildingRecipeKeys?: string[];
} = {}) {
  const saveUpdate = vi.fn().mockResolvedValue(undefined);
  const companionCreate = vi.fn().mockResolvedValue(undefined);
  return {
    tx: {
      save: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ unlockedRecipeKeys: overrides.unlockedRecipeKeys ?? [] }),
        update: saveUpdate,
      },
      companion: {
        count: vi.fn().mockResolvedValue(overrides.companionCount ?? 0),
        create: companionCreate,
      },
      // REI-118: los súbditos activos comparten las camas (aquí, ninguno).
      subject: { count: vi.fn().mockResolvedValue(0) },
      building: {
        findMany: vi.fn().mockResolvedValue((overrides.companionBuildingRecipeKeys ?? ['campamento']).map((recipeKey) => ({ recipeKey }))),
      },
    } as any,
    saveUpdate,
    companionCreate,
  };
}

describe('grantQuestRewardRecipesAndCompanion', () => {
  it('una receta ya desbloqueada no se vuelve a conceder (dedup)', async () => {
    const { tx, saveUpdate } = mockTx({ unlockedRecipeKeys: ['vendaje-improvisado'] });
    const result = await grantQuestRewardRecipesAndCompanion(tx, 'save1', ['vendaje-improvisado'], null);
    expect(result.grantedRecipeKeys).toEqual([]);
    expect(saveUpdate).not.toHaveBeenCalled();
  });

  it('una receta nueva sí se concede y se añade a unlockedRecipeKeys', async () => {
    const { tx, saveUpdate } = mockTx({ unlockedRecipeKeys: ['vendaje-improvisado'] });
    const result = await grantQuestRewardRecipesAndCompanion(tx, 'save1', ['reparar-hacha'], null);
    expect(result.grantedRecipeKeys).toEqual(['reparar-hacha']);
    expect(saveUpdate).toHaveBeenCalledWith({
      where: { id: 'save1' },
      data: { unlockedRecipeKeys: ['vendaje-improvisado', 'reparar-hacha'] },
    });
  });

  it('tope de compañeros alcanzado: no se crea, el resto de la recompensa se concede igual', async () => {
    // 1 campamento = 1 slot de compañero (construction.ts), ya ocupado.
    const { tx, companionCreate } = mockTx({ companionCount: 1, companionBuildingRecipeKeys: ['campamento'] });
    const result = await grantQuestRewardRecipesAndCompanion(tx, 'save1', ['reparar-hacha'], {
      name: 'Kessa',
      role: 'Rastreadora',
      notes: 'Se une tras la misión.',
    });
    expect(result.grantedCompanionName).toBeNull();
    expect(companionCreate).not.toHaveBeenCalled();
    expect(result.grantedRecipeKeys).toEqual(['reparar-hacha']);
  });

  it('con hueco libre, el compañero se crea y se concede junto a la receta en la misma llamada', async () => {
    const { tx, companionCreate } = mockTx({ companionCount: 0, companionBuildingRecipeKeys: ['campamento'] });
    const result = await grantQuestRewardRecipesAndCompanion(tx, 'save1', ['reparar-hacha'], {
      name: 'Kessa',
      role: 'Rastreadora',
      notes: 'Se une tras la misión.',
    });
    expect(result.grantedCompanionName).toBe('Kessa');
    expect(companionCreate).toHaveBeenCalledWith({
      data: { saveId: 'save1', name: 'Kessa', role: 'Rastreadora', notes: 'Se une tras la misión.' },
    });
    expect(result.grantedRecipeKeys).toEqual(['reparar-hacha']);
  });

  it('sin rewardRecipeKeys ni rewardCompanion, no toca la base de datos', async () => {
    const { tx, saveUpdate, companionCreate } = mockTx();
    const result = await grantQuestRewardRecipesAndCompanion(tx, 'save1', [], null);
    expect(result).toEqual({ grantedRecipeKeys: [], grantedCompanionName: null });
    expect(saveUpdate).not.toHaveBeenCalled();
    expect(companionCreate).not.toHaveBeenCalled();
    expect(tx.save.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('parseRewardCompanion', () => {
  it('null/undefined → null', () => {
    expect(parseRewardCompanion(null)).toBeNull();
    expect(parseRewardCompanion(undefined)).toBeNull();
  });

  it('JSON con la forma correcta se acepta tal cual', () => {
    const value = { name: 'Kessa', role: 'Rastreadora', notes: 'x' };
    expect(parseRewardCompanion(value)).toEqual(value);
  });

  it('JSON con campos que faltan o de tipo equivocado → null en vez de reventar', () => {
    expect(parseRewardCompanion({ name: 'Kessa' })).toBeNull();
    expect(parseRewardCompanion({ name: 1, role: 'x', notes: 'x' })).toBeNull();
    expect(parseRewardCompanion(['no', 'es', 'un', 'objeto'])).toBeNull();
    expect(parseRewardCompanion('texto suelto')).toBeNull();
  });
});
