import { describe, it, expect } from 'vitest';
import {
  weaponAbilitiesFor,
  weaponRoleFor,
  WEAPON_CATEGORY_ATTRIBUTE,
  DUAL_WIELD_DIFFICULTY_BONUS,
  dualWieldAdjustedDifficulty,
  weaponPoolFor,
  type EquippedWeaponSlot,
} from './weaponAbilities.js';

// Rediseño 2026-07-31 (petición explícita: "renombrar siempre a 'Ataque Básico'") — la tier
// básica de ataque ya no se llama "Golpe de Arma Pesada"/"Estocada Rápida"/"Golpe Desarmado" según
// el arma; es SIEMPRE "Ataque Básico", armado o no, y lleva `isGeneric: true` (se agrupa aparte de
// las habilidades reales en la UI). El atributo real sigue dependiendo del arma — eso no cambia.

describe('weaponRoleFor', () => {
  it('solo ESCUDO es defensivo, el resto siempre ataque', () => {
    expect(weaponRoleFor('ESCUDO')).toBe('defensa');
    for (const categoria of Object.keys(WEAPON_CATEGORY_ATTRIBUTE) as (keyof typeof WEAPON_CATEGORY_ATTRIBUTE)[]) {
      if (categoria === 'ESCUDO') continue;
      expect(weaponRoleFor(categoria)).toBe('ataque');
    }
  });
});

// Rediseño 2026-07-30 (petición explícita, probado en vivo: "ataque normal... se rige por el
// tipo de arma de la MANO PRINCIPAL — la secundaria deja de generar su propia habilidad de
// ataque aparte, como mucho aporta algo distinto si es un escudo"). "Ataque normal" es ahora UNA
// SOLA tarjeta que mira únicamente ARMA_PRINCIPAL; la defensa de escudo se mantiene en cualquier
// mano.
describe('weaponAbilitiesFor', () => {
  it('Ataque Básico (genérico) SIEMPRE sale de la mano PRINCIPAL, aunque la secundaria lleve otra categoría distinta', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'DAGA' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    const generico = result.find((a) => a.isGeneric)!;
    expect(generico.attribute).toBe('fuerza'); // HACHA (principal), nunca DAGA (secundaria)
    expect(generico).toMatchObject({ name: 'Ataque Básico', isGeneric: true, energyRegen: 0 });
  });

  it('arma en principal + escudo en secundaria: 1 ataque genérico + 1 real de la principal + 1 defensa', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'ESPADA_1_MANO' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'ESCUDO' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    expect(result).toHaveLength(3); // Ataque Básico + "Tajo Preciso" (real de ESPADA) + Cobertura de Escudo
    const ataques = result.filter((a) => a.rol === 'ataque');
    expect(ataques).toHaveLength(2);
    expect(ataques.every((a) => a.attribute === 'destreza')).toBe(true);
    expect(result.find((a) => a.rol === 'defensa')?.attribute).toBe('constitucion');
    // El genérico es Ataque Básico; la real ("Tajo Preciso") y la defensa de escudo son habilidades reales.
    expect(ataques.find((a) => a.isGeneric)?.name).toBe('Ataque Básico');
    expect(ataques.find((a) => !a.isGeneric)).toMatchObject({ name: 'Tajo Preciso', tier: 'real', dualWield: false });
    expect(result.find((a) => a.rol === 'defensa')?.isGeneric).toBe(false);
  });

  it('mano principal vacía pero secundaria con arma real: el GENÉRICO cae a desarmado (nunca usa la secundaria), pero la REAL de la secundaria sí aparece', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: null },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'CUCHILLO' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    const ataques = result.filter((a) => a.rol === 'ataque');
    expect(ataques).toHaveLength(2);
    expect(ataques.find((a) => a.isGeneric)).toMatchObject({ name: 'Ataque Básico', attribute: 'fuerza', isGeneric: true });
    expect(ataques.find((a) => !a.isGeneric)).toMatchObject({ name: 'Estocada Veloz', attribute: 'destreza', tier: 'real', dualWield: false });
  });

  it('escudo en la mano PRINCIPAL: el ataque cae a desarmado, pero la defensa de escudo sigue contando', () => {
    const equipped: EquippedWeaponSlot[] = [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'ESCUDO' }];
    const result = weaponAbilitiesFor(equipped, 1);
    expect(result.find((a) => a.rol === 'ataque')).toMatchObject({ name: 'Ataque Básico' });
    expect(result.find((a) => a.rol === 'defensa')).toMatchObject({ name: 'Cobertura de Escudo' });
  });

  it('sin arma equipada en ningún hueco, cae al ataque desarmado (fuerza) — nunca se queda sin ninguna', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: null },
      { slot: 'CASCO', tipoArma: null },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'Ataque Básico', attribute: 'fuerza', rol: 'ataque', tier: 'basica', isGeneric: true });
  });

  it('desarmado a nivel máximo suma también el desarmado avanzado', () => {
    const result = weaponAbilitiesFor([], 20);
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.tier === 'avanzada')).toMatchObject({ name: 'Puño Demoledor', attribute: 'fuerza', rol: 'ataque' });
  });

  it('con un arma real en la principal, NO añade el fallback desarmado de propina (ni su avanzada, "Puño Demoledor")', () => {
    const equipped: EquippedWeaponSlot[] = [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' }];
    const result = weaponAbilitiesFor(equipped, 20);
    const ataques = result.filter((a) => a.rol === 'ataque');
    expect(ataques).toHaveLength(3); // genérica + real ("Tajo Horizontal") + avanzada, ninguna desarmada
    expect(ataques.some((a) => a.name === 'Puño Demoledor')).toBe(false);
    expect(ataques.find((a) => a.tier === 'real')?.name).toBe('Tajo Horizontal'); // real de HACHA
    expect(ataques.find((a) => a.tier === 'avanzada')?.name).toBe('Golpe Sísmico'); // avanzada de HACHA (fuerza), no la desarmada
  });

  it('dos escudos a la vez (principal y secundaria) no duplican la tarjeta de defensa', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'ESCUDO' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'ESCUDO' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    expect(result.filter((a) => a.rol === 'defensa')).toHaveLength(1);
  });

  it('por debajo del nivel básico (imposible en la práctica, nivel mínimo es 1) no da habilidades', () => {
    const equipped: EquippedWeaponSlot[] = [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' }];
    expect(weaponAbilitiesFor(equipped, 0)).toHaveLength(0);
  });

  it('a nivel máximo se suma la avanzada SIN perder la básica ni la real (5 huecos, no un reemplazo)', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'ESPADA_1_MANO' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'ESCUDO' },
    ];
    const result = weaponAbilitiesFor(equipped, 20);
    expect(result).toHaveLength(5); // Ataque Básico + "Tajo Preciso" (real) + "Ráfaga de Cortes" (avanzada) + Cobertura de Escudo + Muro Inquebrantable
    expect(result.filter((a) => a.tier === 'basica')).toHaveLength(2); // Ataque Básico + Cobertura de Escudo
    expect(result.filter((a) => a.tier === 'real')).toHaveLength(1); // "Tajo Preciso"
    expect(result.filter((a) => a.tier === 'avanzada')).toHaveLength(2); // "Ráfaga de Cortes" + Muro Inquebrantable
  });

  it('ignora huecos de equipo que no son de arma (CASCO, etc.) — cuenta como desarmado', () => {
    const equipped: EquippedWeaponSlot[] = [{ slot: 'CASCO', tipoArma: null }];
    const result = weaponAbilitiesFor(equipped, 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'Ataque Básico', attribute: 'fuerza', isGeneric: true });
  });

  it('bug real de partida (2026-07-31, "cuando no llevas nada equipado... el ataque pasa a ser con tus puños desnudos, garras o lo que sea"): el nombre es siempre "Ataque Básico", pero desarmado el texto SÍ menciona puños/garras (nunca lo deja a la libre interpretación del modelo)', () => {
    const desarmado = weaponAbilitiesFor([{ slot: 'ARMA_PRINCIPAL', tipoArma: null }], 1)[0];
    expect(desarmado.name).toBe('Ataque Básico');
    expect(desarmado.attribute).toBe('fuerza');
    expect(desarmado.description).toMatch(/puños|garras/);
    expect(desarmado.promptText).toMatch(/puños|garras/);

    const armado = weaponAbilitiesFor([{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' }], 1)[0];
    expect(armado.name).toBe('Ataque Básico');
    expect(armado.description).not.toMatch(/puños|garras/);
  });
});

// Rediseño 2026-07-31 (petición explícita: "cada arma que tengas equipada te dará una habilidad
// de su tipo... si llevas 2 armas del mismo tipo tendrás solo 1 habilidad de arma con doble
// efecto"). Habilidad REAL por categoría exacta — a diferencia de Ataque Básico (genérico, solo
// mano principal), esta mira las DOS manos.
describe('weaponAbilitiesFor — habilidad real por categoría exacta de arma', () => {
  it('2 armas de la MISMA categoría (2 hachas) colapsan en 1 sola habilidad real, marcada dualWield', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'HACHA_1_MANO' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    const reales = result.filter((a) => a.tier === 'real');
    expect(reales).toHaveLength(1);
    expect(reales[0]).toMatchObject({ name: 'Tajo Horizontal', attribute: 'fuerza', dualWield: true, isGeneric: false });
  });

  it('2 armas de categorías DISTINTAS (hacha + cuchillo) dan las 2 habilidades reales por separado, ninguna dualWield', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'CUCHILLO' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    const reales = result.filter((a) => a.tier === 'real');
    expect(reales).toHaveLength(2);
    expect(reales.find((a) => a.attribute === 'fuerza')).toMatchObject({ name: 'Tajo Horizontal', dualWield: false });
    expect(reales.find((a) => a.attribute === 'destreza')).toMatchObject({ name: 'Estocada Veloz', dualWield: false });
  });

  it('1 sola arma equipada: 1 habilidad real, nunca dualWield', () => {
    const result = weaponAbilitiesFor([{ slot: 'ARMA_PRINCIPAL', tipoArma: 'MAZA_1_MANO' }], 1);
    const reales = result.filter((a) => a.tier === 'real');
    expect(reales).toHaveLength(1);
    expect(reales[0]).toMatchObject({ name: 'Golpe Devastador', attribute: 'fuerza', dualWield: false });
  });

  it('sin ningún arma de rol ataque equipada (desarmado, o solo escudo), no hay ninguna real de ataque', () => {
    expect(weaponAbilitiesFor([], 1).some((a) => a.tier === 'real')).toBe(false);
    expect(weaponAbilitiesFor([{ slot: 'ARMA_PRINCIPAL', tipoArma: 'ESCUDO' }], 1).some((a) => a.tier === 'real')).toBe(false);
  });

  it('escudo en una mano no cuenta como "categoría de ataque" para el colapso — 1 arma real + 1 defensa, no dualWield', () => {
    const equipped: EquippedWeaponSlot[] = [
      { slot: 'ARMA_PRINCIPAL', tipoArma: 'LANZA' },
      { slot: 'ARMA_SECUNDARIA', tipoArma: 'ESCUDO' },
    ];
    const result = weaponAbilitiesFor(equipped, 1);
    expect(result.filter((a) => a.tier === 'real')).toEqual([
      expect.objectContaining({ name: 'Punzada Penetrante', attribute: 'fuerza', dualWield: false }),
    ]);
  });

  it('DUAL_WIELD_DIFFICULTY_BONUS es un número positivo (se resta de la dificultad del atacante)', () => {
    expect(DUAL_WIELD_DIFFICULTY_BONUS).toBeGreaterThan(0);
  });
});

describe('dualWieldAdjustedDifficulty', () => {
  it('sin dualWield, la dificultad no cambia', () => {
    expect(dualWieldAdjustedDifficulty(15, false)).toBe(15);
  });

  it('con dualWield, resta DUAL_WIELD_DIFFICULTY_BONUS', () => {
    expect(dualWieldAdjustedDifficulty(15, true)).toBe(15 - DUAL_WIELD_DIFFICULTY_BONUS);
  });

  it('con dualWield, nunca baja de 8 (mismo suelo que contraataqueDifficultyFor)', () => {
    expect(dualWieldAdjustedDifficulty(8, true)).toBe(8);
    expect(dualWieldAdjustedDifficulty(9, true)).toBe(8);
  });
});

// Bonus de atributo al ejecutar (petición explícita, 2026-08-26: "que las habilidades de arma su
// efecto en todas sea ATAQUE que cuando se ejecuta da +2 del attr en el que está basada"). Decisión
// cerrada tras revisarlo con la usuaria: "Ataque Básico" se queda con el stat base tal cual, sin
// bonus — el +2 es solo para las reales/avanzadas (`tier !== 'basica'`).
describe('weaponAbilitiesFor — attributeBonus', () => {
  it('"Ataque Básico" (tier basica), armado o desarmado, nunca lleva bonus', () => {
    const armado = weaponAbilitiesFor([{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' }], 1)[0];
    expect(armado).toMatchObject({ name: 'Ataque Básico', attributeBonus: 0 });
    const desarmado = weaponAbilitiesFor([{ slot: 'ARMA_PRINCIPAL', tipoArma: null }], 1)[0];
    expect(desarmado).toMatchObject({ name: 'Ataque Básico', attributeBonus: 0 });
  });

  it('la habilidad REAL por categoría de arma lleva +2', () => {
    const result = weaponAbilitiesFor([{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' }], 1);
    expect(result.find((a) => a.tier === 'real')).toMatchObject({ name: 'Tajo Horizontal', attributeBonus: 2 });
  });

  it('la avanzada de ataque (fuerza/destreza y desarmada) lleva +2', () => {
    const armado = weaponAbilitiesFor([{ slot: 'ARMA_PRINCIPAL', tipoArma: 'HACHA_1_MANO' }], 20);
    expect(armado.find((a) => a.tier === 'avanzada')).toMatchObject({ name: 'Golpe Sísmico', attributeBonus: 2 });
    const desarmado = weaponAbilitiesFor([], 20);
    expect(desarmado.find((a) => a.tier === 'avanzada')).toMatchObject({ name: 'Puño Demoledor', attributeBonus: 2 });
  });

  it('defensa de escudo: la básica ("Cobertura de Escudo") sin bonus, la avanzada ("Muro Inquebrantable") con +2', () => {
    const equipped: EquippedWeaponSlot[] = [{ slot: 'ARMA_PRINCIPAL', tipoArma: 'ESCUDO' }];
    const result = weaponAbilitiesFor(equipped, 20);
    expect(result.find((a) => a.name === 'Cobertura de Escudo')).toMatchObject({ attributeBonus: 0 });
    expect(result.find((a) => a.name === 'Muro Inquebrantable')).toMatchObject({ attributeBonus: 2 });
  });
});

// Restricción de armas por clase (2026-08-24, Grupo 3 § Sistema de clases, clases.md §
// "Restricción de armas por clase") — solo Guerrero/Cazador/Chamán tienen pool construido.
describe('weaponPoolFor', () => {
  it('Guerrero: mismo pool cuerpo a cuerpo puro para las 4 especializaciones, nada de distancia ni magia', () => {
    const pool = weaponPoolFor('GUERRERO', 'BERSERKER');
    expect(pool).toContain('HACHA_1_MANO');
    expect(pool).toContain('ESCUDO');
    expect(pool).not.toContain('ARCO_CORTO');
    expect(pool).not.toContain('GRIMORIO');
    // Sin especialización elegida, el pool es el mismo (no depende de la rama).
    expect(weaponPoolFor('GUERRERO', null)).toEqual(pool);
  });

  it('Chamán: hacha/maza a una mano + focos mágicos, mismo pool para las 4 especializaciones', () => {
    const pool = weaponPoolFor('CHAMAN', 'OPRESOR');
    expect(pool).toContain('BACULO');
    expect(pool).toContain('GRIMORIO');
    expect(pool).not.toContain('HACHA_2_MANO'); // solo la variante a una mano, deja la otra libre para el foco
  });

  it('Cazador Tirador: solo arcos, sin honda ni ballesta (reservadas a la futura clase Arquero)', () => {
    const pool = weaponPoolFor('CAZADOR', 'TIRADOR');
    expect(pool).toEqual(['ARCO_CORTO', 'ARCO_LARGO']);
  });

  it('Cazador Domador/Supervivencia: mismo pool para las dos, incluye la VARA nueva', () => {
    expect(weaponPoolFor('CAZADOR', 'DOMADOR')).toEqual(weaponPoolFor('CAZADOR', 'SUPERVIVENCIA'));
    expect(weaponPoolFor('CAZADOR', 'DOMADOR')).toContain('VARA');
  });

  it('Cazador Instintivo: cuerpo a cuerpo, solo variantes de una mano', () => {
    const pool = weaponPoolFor('CAZADOR', 'INSTINTIVO')!;
    expect(pool).toContain('ESPADA_1_MANO');
    expect(pool).not.toContain('ESPADA_2_MANO');
  });

  it('Cazador sin especialización elegida: sin restricción todavía (null)', () => {
    expect(weaponPoolFor('CAZADOR', null)).toBeNull();
  });

  it('una clase fuera de las 3 construidas: sin restricción (null)', () => {
    expect(weaponPoolFor('ASESINO', 'MAESTRO_ASESINO')).toBeNull();
    expect(weaponPoolFor(null, null)).toBeNull();
  });
});
