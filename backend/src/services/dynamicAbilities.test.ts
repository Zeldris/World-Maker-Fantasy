import { describe, it, expect, vi } from 'vitest';
import { dynamicCombatAbilitiesFor, resolveEquippedWeaponSlots } from './dynamicAbilities.js';
import { ENERGY_COST_BASICA, ENERGY_COST_AVANZADA, ENERGY_COST_ATAQUE_BASICO } from './energy.js';
import { WEAPON_ABILITY_LEVEL_BASICA, WEAPON_ABILITY_LEVEL_AVANZADA } from './weaponAbilities.js';

describe('dynamicCombatAbilitiesFor (sistema de fatiga)', () => {
  it('las raciales cuestan siempre ENERGY_COST_BASICA, el ataque básico (con o sin arma) cuesta ENERGY_COST_ATAQUE_BASICO (rediseño 2026-07-31)', () => {
    const abilities = dynamicCombatAbilitiesFor('orcos', WEAPON_ABILITY_LEVEL_BASICA, []);
    expect(abilities).toHaveLength(3); // ataque racial + defensa racial + Ataque Básico (sin arma, desarmado)
    const raciales = abilities.filter((a) => a.name !== 'Ataque Básico');
    expect(raciales).toHaveLength(2);
    expect(raciales.every((a) => a.energyCost === ENERGY_COST_BASICA)).toBe(true);
    const ataqueBasico = abilities.find((a) => a.name === 'Ataque Básico')!;
    expect(ataqueBasico).toMatchObject({ energyCost: ENERGY_COST_ATAQUE_BASICO, energyRegen: 0, isGeneric: true });
  });

  it('la de arma básica ("Ataque Básico") cuesta ENERGY_COST_ATAQUE_BASICO, no ENERGY_COST_BASICA — la real ("Tajo Horizontal") cuesta ENERGY_COST_BASICA como una habilidad de clase', () => {
    const abilities = dynamicCombatAbilitiesFor(null, WEAPON_ABILITY_LEVEL_BASICA, [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA' }]);
    expect(abilities).toHaveLength(2); // Ataque Básico (genérico) + "Tajo Horizontal" (real, 2026-07-31)
    expect(abilities.find((a) => a.isGeneric)).toMatchObject({ name: 'Ataque Básico', energyCost: ENERGY_COST_ATAQUE_BASICO });
    expect(abilities.find((a) => !a.isGeneric)).toMatchObject({ name: 'Tajo Horizontal', energyCost: ENERGY_COST_BASICA, dualWield: false });
  });

  it('al cruzar el nivel de arma avanzada, la nueva habilidad cuesta ENERGY_COST_AVANZADA (la básica y la real se quedan igual)', () => {
    const abilities = dynamicCombatAbilitiesFor(null, WEAPON_ABILITY_LEVEL_AVANZADA, [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA' }]);
    expect(abilities).toHaveLength(3); // Ataque Básico + "Tajo Horizontal" (real) + "Golpe Sísmico" (avanzada)
    expect(abilities.find((a) => a.energyCost === ENERGY_COST_ATAQUE_BASICO)).toMatchObject({ name: 'Ataque Básico', isGeneric: true });
    expect(abilities.find((a) => a.name === 'Tajo Horizontal')).toMatchObject({ energyCost: ENERGY_COST_BASICA, isGeneric: false });
    expect(abilities.find((a) => a.energyCost === ENERGY_COST_AVANZADA)).toMatchObject({ name: 'Golpe Sísmico', isGeneric: false });
  });

  it('sin raza ni arma equipada, cae al ataque desarmado como única dinámica (2026-07-30: nunca sin ninguna habilidad de ataque real) — ahora se llama "Ataque Básico" (rediseño 2026-07-31)', () => {
    const abilities = dynamicCombatAbilitiesFor(null, 1, []);
    expect(abilities).toHaveLength(1);
    expect(abilities[0]).toMatchObject({ name: 'Ataque Básico', preferredAttribute: 'fuerza', effect: 'ATAQUE', isGeneric: true });
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
