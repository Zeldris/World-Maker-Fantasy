import { describe, it, expect } from 'vitest';
import { weaponAbilitiesFor, weaponRoleFor, WEAPON_CATEGORY_ATTRIBUTE, type EquippedWeaponSlot } from './weaponAbilities.js';

describe('weaponRoleFor', () => {
  it('solo ESCUDO es defensivo, el resto siempre ataque', () => {
    expect(weaponRoleFor('ESCUDO')).toBe('defensa');
    for (const categoria of Object.keys(WEAPON_CATEGORY_ATTRIBUTE) as (keyof typeof WEAPON_CATEGORY_ATTRIBUTE)[]) {
      if (categoria === 'ESCUDO') continue;
      expect(weaponRoleFor(categoria)).toBe('ataque');
    }
  });
});

describe('weaponAbilitiesFor', () => {
  it('arma+arma de categorías distintas da 2 ataques con atributos distintos', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'DAGA' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'HACHA' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.rol === 'ataque')).toBe(true);
    expect(new Set(result.map((a) => a.attribute))).toEqual(new Set(['destreza', 'fuerza']));
  });

  it('arma+escudo da 1 ataque + 1 defensa', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'ESPADA' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'ESCUDO' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.rol === 'ataque')?.attribute).toBe('destreza');
    expect(result.find((a) => a.rol === 'defensa')?.attribute).toBe('constitucion');
  });

  it('dos armas de la MISMA categoría no duplican la tarjeta — cuenta una vez', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'DAGA' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'CUCHILLO' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    expect(result).toHaveLength(1);
    expect(result[0].attribute).toBe('destreza');
  });

  it('sin arma equipada en ningún hueco, no hay habilidades de arma', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: null },
      { slot: 'CASCO', tipoArma: null },
    ];
    expect(weaponAbilitiesFor(equipped, 20)).toHaveLength(0);
  });

  it('por debajo del nivel básico (imposible en la práctica, nivel mínimo es 1) no da habilidades', () => {
    const equipped: EquippedWeaponSlot[] = [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA' }];
    expect(weaponAbilitiesFor(equipped, 0)).toHaveLength(0);
  });

  it('a nivel máximo se suma la avanzada SIN perder la básica (4 huecos, no un reemplazo)', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'ESPADA' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'ESCUDO' },
    ];
    const result = weaponAbilitiesFor(equipped, 20);
    expect(result).toHaveLength(4);
    expect(result.filter((a) => a.tier === 'basica')).toHaveLength(2);
    expect(result.filter((a) => a.tier === 'avanzada')).toHaveLength(2);
  });

  it('ignora huecos de equipo que no son de arma (CASCO, etc.)', () => {
    const equipped: EquippedWeaponSlot[] = [{ slot: 'CASCO', tipoArma: null }];
    expect(weaponAbilitiesFor(equipped, 20)).toHaveLength(0);
  });
});
