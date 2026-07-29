import { describe, it, expect, vi } from 'vitest';
import { dynamicCombatAbilitiesFor, resolveEquippedWeaponSlots } from './dynamicAbilities.js';
import { ENERGY_COST_BASICA, ENERGY_COST_AVANZADA } from './energy.js';
import { WEAPON_ABILITY_LEVEL_BASICA, WEAPON_ABILITY_LEVEL_AVANZADA } from './weaponAbilities.js';

describe('dynamicCombatAbilitiesFor (sistema de fatiga)', () => {
  it('las raciales cuestan siempre ENERGY_COST_BASICA', () => {
    const abilities = dynamicCombatAbilitiesFor('orcos', WEAPON_ABILITY_LEVEL_BASICA, []);
    expect(abilities).toHaveLength(2);
    expect(abilities.every((a) => a.energyCost === ENERGY_COST_BASICA)).toBe(true);
  });

  it('la de arma básica cuesta ENERGY_COST_BASICA', () => {
    const abilities = dynamicCombatAbilitiesFor(null, WEAPON_ABILITY_LEVEL_BASICA, [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA' }]);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].energyCost).toBe(ENERGY_COST_BASICA);
  });

  it('al cruzar el nivel de arma avanzada, la nueva habilidad cuesta ENERGY_COST_AVANZADA (la básica se queda igual)', () => {
    const abilities = dynamicCombatAbilitiesFor(null, WEAPON_ABILITY_LEVEL_AVANZADA, [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA' }]);
    expect(abilities).toHaveLength(2);
    expect(abilities.find((a) => a.energyCost === ENERGY_COST_BASICA)).toBeTruthy();
    expect(abilities.find((a) => a.energyCost === ENERGY_COST_AVANZADA)).toBeTruthy();
  });

  it('sin raza ni arma equipada, no hay ninguna dinámica', () => {
    expect(dynamicCombatAbilitiesFor(null, 1, [])).toEqual([]);
  });
});

describe('resolveEquippedWeaponSlots (deuda técnica 2026-07-30, extraído de 3 copias casi idénticas en routes/saves.ts)', () => {
  it('ignora los huecos que no son de arma', async () => {
    const tx = { itemCatalog: { findMany: vi.fn().mockResolvedValue([]) } };
    const result = await resolveEquippedWeaponSlots(tx as never, 'world1', [
      { slot: 'CASCO', catalogSlug: 'casco-cuero' },
      { slot: null, catalogSlug: null },
    ]);
    expect(result).toEqual([]);
    expect(tx.itemCatalog.findMany).not.toHaveBeenCalled();
  });

  it('resuelve el tipoArma real de cada arma equipada desde el catálogo', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { slug: 'hacha-guerra-maktor-rota', tipoArma: 'HACHA' },
      { slug: 'cuchillo-hielo-silice', tipoArma: 'CUCHILLO' },
    ]);
    const tx = { itemCatalog: { findMany } };
    const result = await resolveEquippedWeaponSlots(tx as never, 'world1', [
      { slot: 'ARMA_PRINCIPAL', catalogSlug: 'hacha-guerra-maktor-rota' },
      { slot: 'ARMA_SECUNDARIA', catalogSlug: 'cuchillo-hielo-silice' },
    ]);
    expect(result).toEqual([
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'CUCHILLO' },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { worldId: 'world1', slug: { in: ['hacha-guerra-maktor-rota', 'cuchillo-hielo-silice'] } },
      select: { slug: true, tipoArma: true },
    });
  });

  it('un arma equipada sin catalogSlug (objeto narrativo suelto) resuelve a tipoArma null', async () => {
    const tx = { itemCatalog: { findMany: vi.fn().mockResolvedValue([]) } };
    const result = await resolveEquippedWeaponSlots(tx as never, 'world1', [{ slot: 'ARMA_PRINCIPAL', catalogSlug: null }]);
    expect(result).toEqual([{ slot: 'ARMA_PRINCIPAL', tipoArma: null }]);
  });
});
