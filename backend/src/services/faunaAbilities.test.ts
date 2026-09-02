import { describe, it, expect } from 'vitest';
import { faunaCategoriaAbilityUnlocksFor, faunaCategoriaAbilitiesForLevel } from './faunaAbilities.js';

/// Cobertura nueva (2026-09-02, sistema de categorías de raza de fauna) — mismo criterio de tests
/// que classAbilities.test.ts: verificar el filtro por nivel y que cada categoría reparte sus 7
/// habilidades con la regla dura "a nivel 1 ya hay 1 ataque + 1 defensa + 1 utilidad".
///
/// Retoque PROVOCACION (2026-09-02, decisión explícita de la usuaria: "en las que sean robustos y
/// tengan mucha constitución... al menos una hab de provocación") — 5 categorías (fauna robusta/de
/// manada que se planta a proteger al resto: GUELISES/BESTIONES/QUITINOS/MUDOS_SALVAJE/
/// ROKRATS_ESTALLIDO) tienen una 8ª habilidad extra de nivel 36 con PROVOCACION, en vez de
/// sustituir ninguna de las 7 originales. El resto se queda en 7.

describe('faunaCategoriaAbilityUnlocksFor', () => {
  it('categorías sin PROVOCACION (sigilo/velocidad/huida) tienen exactamente 7 habilidades en total', () => {
    const categoriasSinProvocacion = [
      'ACECHANTES', 'CORVENES', 'ZANCUDOS', 'RONDINES', 'ESCAMADOS', 'NADANTES', 'ORDENADOS', 'UMBRIAS',
    ] as const;
    for (const categoria of categoriasSinProvocacion) {
      expect(faunaCategoriaAbilityUnlocksFor(categoria).length).toBe(7);
    }
  });

  it('categorías robustas/de manada (con PROVOCACION añadida) tienen exactamente 8 habilidades en total', () => {
    const categoriasConProvocacion = ['GUELISES', 'BESTIONES', 'QUITINOS', 'MUDOS_SALVAJE', 'ROKRATS_ESTALLIDO'] as const;
    for (const categoria of categoriasConProvocacion) {
      const unlocks = faunaCategoriaAbilityUnlocksFor(categoria);
      expect(unlocks.length).toBe(8);
      const provocacion = unlocks.find((u) => u.ability.effects?.includes('PROVOCACION'));
      expect(provocacion).toBeDefined();
      expect(provocacion!.level).toBe(36);
      // Nunca combinada con MULTIPLE (gateado únicamente a ATAQUE+MULTIPLE en el motor real,
      // ver comentario de cabecera de faunaAbilities.ts) ni con ningún otro efecto.
      expect(provocacion!.ability.effects).toEqual(['PROVOCACION']);
    }
  });

  it('GUELISES: a nivel 1 ya hay exactamente 3 habilidades, una de cada rol (ataque/defensa/utilidad)', () => {
    const nivel1 = faunaCategoriaAbilityUnlocksFor('GUELISES').filter((u) => u.level === 1);
    expect(nivel1.length).toBe(3);
    expect(nivel1.map((u) => u.ability.rol).sort()).toEqual(['ataque', 'defensa', 'utilidad']);
  });

  it('QUITINOS: a nivel 1 ya hay exactamente 3 habilidades, una de cada rol', () => {
    const nivel1 = faunaCategoriaAbilityUnlocksFor('QUITINOS').filter((u) => u.level === 1);
    expect(nivel1.length).toBe(3);
    expect(nivel1.map((u) => u.ability.rol).sort()).toEqual(['ataque', 'defensa', 'utilidad']);
  });

  it('NADANTES: a nivel 1 ya hay exactamente 3 habilidades, una de cada rol', () => {
    const nivel1 = faunaCategoriaAbilityUnlocksFor('NADANTES').filter((u) => u.level === 1);
    expect(nivel1.length).toBe(3);
    expect(nivel1.map((u) => u.ability.rol).sort()).toEqual(['ataque', 'defensa', 'utilidad']);
  });

  it('los 4 huecos base restantes de cada categoría caen en 8/16/24/32 (patrón documentado) en una categoría sin PROVOCACION', () => {
    const niveles = faunaCategoriaAbilityUnlocksFor('CORVENES').map((u) => u.level).sort((a, b) => a - b);
    expect(niveles).toEqual([1, 1, 1, 8, 16, 24, 32]);
  });

  it('GUELISES (con PROVOCACION): los 5 huecos base + extra caen en 8/16/24/32/36', () => {
    const niveles = faunaCategoriaAbilityUnlocksFor('GUELISES').map((u) => u.level).sort((a, b) => a - b);
    expect(niveles).toEqual([1, 1, 1, 8, 16, 24, 32, 36]);
  });

  it('solo usa AbilityEffect con motor real, salvo PROVOCACION (decisión explícita de la usuaria, sin motor real todavía) — nunca AUMENTO/DEBILIDAD/INVOCACION/LETAL/DESVIAR/OCULTACION/etc.', () => {
    const pendientes = new Set([
      'INVOCACION', 'DEBILIDAD', 'AUMENTO', 'RETIRAR', 'CANALIZAR', 'CURAZION', 'REFLEJAR',
      'EXPULSAR', 'LETAL', 'DESVIAR', 'OCULTACION', 'PURIFICAR',
    ]);
    const categorias = [
      'GUELISES', 'ACECHANTES', 'CORVENES', 'ZANCUDOS', 'BESTIONES', 'RONDINES',
      'QUITINOS', 'ESCAMADOS', 'NADANTES', 'ORDENADOS', 'UMBRIAS', 'MUDOS_SALVAJE', 'ROKRATS_ESTALLIDO',
    ] as const;
    for (const categoria of categorias) {
      for (const unlock of faunaCategoriaAbilityUnlocksFor(categoria)) {
        for (const effect of unlock.ability.effects ?? []) {
          expect(pendientes.has(effect)).toBe(false);
        }
      }
    }
  });

  it('MULTIPLE nunca se usa en fauna (gateado solo a ATAQUE+MULTIPLE en el motor real, ninguna habilidad de fauna lo necesita) — y nunca combinado con PROVOCACION', () => {
    const categorias = [
      'GUELISES', 'ACECHANTES', 'CORVENES', 'ZANCUDOS', 'BESTIONES', 'RONDINES',
      'QUITINOS', 'ESCAMADOS', 'NADANTES', 'ORDENADOS', 'UMBRIAS', 'MUDOS_SALVAJE', 'ROKRATS_ESTALLIDO',
    ] as const;
    for (const categoria of categorias) {
      for (const unlock of faunaCategoriaAbilityUnlocksFor(categoria)) {
        expect(unlock.ability.effects ?? []).not.toContain('MULTIPLE');
      }
    }
  });
});

describe('faunaCategoriaAbilitiesForLevel', () => {
  it('a nivel 1, GUELISES solo tiene las 3 primeras (nunca las de nivel 8+)', () => {
    const habilidades = faunaCategoriaAbilitiesForLevel('GUELISES', 1);
    expect(habilidades.length).toBe(3);
    expect(habilidades.some((a) => a.name === 'Aturdir por el flanco')).toBe(false); // nivel 8
  });

  it('a nivel 8, GUELISES ya tiene 4 (las 3 de nivel 1 + la de nivel 8)', () => {
    const habilidades = faunaCategoriaAbilitiesForLevel('GUELISES', 8);
    expect(habilidades.length).toBe(4);
    expect(habilidades.some((a) => a.name === 'Aturdir por el flanco')).toBe(true);
    expect(habilidades.some((a) => a.name === 'Contragolpe de colmillos')).toBe(false); // nivel 16
  });

  it('a nivel 32, GUELISES tiene las 7 base (la 8ª de PROVOCACION es nivel 36, todavía no)', () => {
    const habilidades = faunaCategoriaAbilitiesForLevel('GUELISES', 32);
    expect(habilidades.length).toBe(7);
    expect(habilidades.some((a) => a.name === 'Desafío del alfa')).toBe(false);
  });

  it('a nivel 36, GUELISES ya tiene las 8 completas, incluida la de PROVOCACION', () => {
    const habilidades = faunaCategoriaAbilitiesForLevel('GUELISES', 36);
    expect(habilidades.length).toBe(8);
    const desafio = habilidades.find((a) => a.name === 'Desafío del alfa');
    expect(desafio).toBeDefined();
    expect(desafio!.effects).toEqual(['PROVOCACION']);
  });

  it('a nivel 40 (techo de personaje), sigue teniendo solo las 8 (sin desbloqueo nuevo entre 36 y 40)', () => {
    expect(faunaCategoriaAbilitiesForLevel('GUELISES', 40).length).toBe(8);
  });

  it('ORDENADOS/UMBRIAS (sin fauna real asignada, sin PROVOCACION por no encajar en su tema) tienen sus 7 habilidades ya definidas, listas para uso futuro', () => {
    expect(faunaCategoriaAbilitiesForLevel('ORDENADOS', 32).length).toBe(7);
    expect(faunaCategoriaAbilitiesForLevel('UMBRIAS', 32).length).toBe(7);
  });

  it('ROKRATS_ESTALLIDO (sin fauna real asignada, con PROVOCACION igualmente) tiene sus 8 habilidades ya definidas, listas para uso futuro', () => {
    expect(faunaCategoriaAbilitiesForLevel('ROKRATS_ESTALLIDO', 40).length).toBe(8);
  });

  it('QUITINOS a nivel 1 da mínimo un ataque y una defensa utilizables en combate (regla dura)', () => {
    const habilidades = faunaCategoriaAbilitiesForLevel('QUITINOS', 1);
    expect(habilidades.some((a) => a.rol === 'ataque')).toBe(true);
    expect(habilidades.some((a) => a.rol === 'defensa')).toBe(true);
  });
});
