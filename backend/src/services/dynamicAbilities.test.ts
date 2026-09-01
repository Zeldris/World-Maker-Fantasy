import { describe, it, expect, vi } from 'vitest';
import { dynamicCombatAbilitiesFor, resolveEquippedWeaponSlots } from './dynamicAbilities.js';
import { ENERGY_COST_BASICA, ENERGY_COST_AVANZADA, ENERGY_COST_ATAQUE_BASICO } from './energy.js';
import { WEAPON_ABILITY_LEVEL_BASICA, WEAPON_ABILITY_LEVEL_AVANZADA } from './weaponAbilities.js';

describe('dynamicCombatAbilitiesFor (sistema de fatiga)', () => {
  // Bug real (2026-09-01, petición explícita): esta función ya NO empuja ninguna habilidad
  // racial activa — el rediseño de pasivas raciales (racialPassives.ts, 2026-08-28) las
  // sustituyó por una única pasiva automática por raza, y las 2 activas viejas ("Sangre del
  // Estallido"/"Piel de Guerra" para orcos, y equivalentes de otras razas) quedaron redundantes
  // y confusas. `raza` sigue en la firma por compatibilidad con los 4 callers reales, pero ya no
  // se usa dentro de esta función.
  it('la raza no aporta ninguna habilidad dinámica — solo cuenta el Ataque Básico desarmado', () => {
    const abilities = dynamicCombatAbilitiesFor('orcos', WEAPON_ABILITY_LEVEL_BASICA, []);
    expect(abilities).toHaveLength(1);
    expect(abilities[0]).toMatchObject({ name: 'Ataque Básico', energyCost: ENERGY_COST_ATAQUE_BASICO, energyRegen: 0, isGeneric: true });
  });

  it('la de arma básica ("Ataque Básico") cuesta ENERGY_COST_ATAQUE_BASICO, no ENERGY_COST_BASICA — la real ("Tajo Horizontal") cuesta ENERGY_COST_BASICA como una habilidad de clase', () => {
    const abilities = dynamicCombatAbilitiesFor(null, WEAPON_ABILITY_LEVEL_BASICA, [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' }]);
    expect(abilities).toHaveLength(2); // Ataque Básico (genérico) + "Tajo Horizontal" (real, 2026-07-31)
    expect(abilities.find((a) => a.isGeneric)).toMatchObject({ name: 'Ataque Básico', energyCost: ENERGY_COST_ATAQUE_BASICO });
    expect(abilities.find((a) => !a.isGeneric)).toMatchObject({ name: 'Tajo Horizontal', energyCost: ENERGY_COST_BASICA, dualWield: false });
  });

  it('al cruzar el nivel de arma avanzada, la nueva habilidad cuesta ENERGY_COST_AVANZADA (la básica y la real se quedan igual)', () => {
    const abilities = dynamicCombatAbilitiesFor(null, WEAPON_ABILITY_LEVEL_AVANZADA, [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' }]);
    expect(abilities).toHaveLength(3); // Ataque Básico + "Tajo Horizontal" (real) + "Golpe Sísmico" (avanzada)
    expect(abilities.find((a) => a.energyCost === ENERGY_COST_ATAQUE_BASICO)).toMatchObject({ name: 'Ataque Básico', isGeneric: true });
    expect(abilities.find((a) => a.name === 'Tajo Horizontal')).toMatchObject({ energyCost: ENERGY_COST_BASICA, isGeneric: false });
    expect(abilities.find((a) => a.energyCost === ENERGY_COST_AVANZADA)).toMatchObject({ name: 'Golpe Sísmico', isGeneric: false });
  });

  it('sin raza ni arma equipada, cae al ataque desarmado como única dinámica (2026-07-30: nunca sin ninguna habilidad de ataque real) — ahora se llama "Ataque Básico" (rediseño 2026-07-31)', () => {
    const abilities = dynamicCombatAbilitiesFor(null, 1, []);
    expect(abilities).toHaveLength(1);
    expect(abilities[0]).toMatchObject({ name: 'Ataque Básico', preferredAttribute: 'fuerza', effects: ['ATAQUE'], isGeneric: true });
  });

  // Rediseño de combate (2026-08-09) — WeaponAbility.rol ya existía (weaponAbilities.ts), pero se
  // descartaba al pasar por aquí.
  it('propaga rol: de arma toma WeaponAbility.rol (nunca se descarta)', () => {
    const abilities = dynamicCombatAbilitiesFor('orcos', WEAPON_ABILITY_LEVEL_BASICA, [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'ESCUDO' }]);
    expect(abilities.find((a) => a.name === 'Ataque Básico')?.rol).toBe('ataque');
    expect(abilities.find((a) => a.name === 'Cobertura de Escudo')?.rol).toBe('defensa');
  });

  // Bonus de atributo (2026-08-26, ver weaponAbilities.test.ts § attributeBonus) — propaga
  // WeaponAbility.attributeBonus tal cual.
  it('propaga attributeBonus: Ataque Básico 0, la real de arma +2', () => {
    const abilities = dynamicCombatAbilitiesFor('orcos', WEAPON_ABILITY_LEVEL_BASICA, [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' }]);
    expect(abilities.find((a) => a.name === 'Ataque Básico')?.attributeBonus).toBe(0);
    expect(abilities.find((a) => a.name === 'Tajo Horizontal')?.attributeBonus).toBe(2);
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
      { slug: 'hacha-guerra-maktor-rota', tipoArma: 'HACHA_1_MANO' },
      { slug: 'cuchillo-hielo-silice', tipoArma: 'CUCHILLO' },
    ]);
    const tx = { itemCatalog: { findMany } };
    const result = await resolveEquippedWeaponSlots(tx as never, 'world1', [
      { slot: 'ARMA_PRINCIPAL', catalogSlug: 'hacha-guerra-maktor-rota' },
      { slot: 'ARMA_SECUNDARIA', catalogSlug: 'cuchillo-hielo-silice' },
    ]);
    expect(result).toEqual([
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' },
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
