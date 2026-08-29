import { describe, it, expect } from 'vitest';
import { professionAbilityUnlocksFor, allProfessionAbilityUnlocks } from './professionAbilities.js';
import { CRAFTING_RECIPES, detectsCraftIntent } from './crafting.js';
import { CONSTRUCTION_RECIPES, detectsBuildIntent } from './construction.js';

describe('professionAbilityUnlocksFor', () => {
  // Ids escalados por raza+región (2026-08-09, professions.ts) — el emparejamiento sigue siendo
  // por igualdad EXACTA contra `recipe.oficio` (crafting.ts), a diferencia de harvestAbilities.ts
  // (recolectoras, por prefijo): una receta de creación pertenece a UNA variante concreta, nunca a
  // "cualquier herrero", así que no hace falta tolerancia de prefijo aquí.
  it('carpintero-orcos-llanuras nivel 1 NO desbloquea nada (STONE_BLOCK_RECIPE es de constructor, no de carpintero)', () => {
    const result = professionAbilityUnlocksFor('carpintero-orcos-llanuras', 1);
    expect(result).toHaveLength(0);
  });

  it('constructor-orcos-llanuras nivel 1 desbloquea "Tallar bloque de piedra" y "Trenzar cuerdas"', () => {
    // Bug real (pendiente 2026-08-27, investigado 2026-08-28): CUERDAS_RECIPE ya funcionaba por
    // texto libre desde el commit que la creó, pero nunca se dio de alta aquí — sin botón de un
    // clic en Habilidades → Profesiones, quien no supiera la frase exacta la veía como "no craftea".
    const result = professionAbilityUnlocksFor('constructor-orcos-llanuras', 1);
    expect(result.map((a) => a.name).sort()).toEqual(['Tallar bloque de piedra', 'Trenzar cuerdas'].sort());
    expect(result.every((a) => a.category === 'profesion')).toBe(true);
  });

  it('herrero-orco-llanuras nivel 2 desbloquea solo el lingote de hierro (tier 2), no las de tier 3 todavía', () => {
    const result = professionAbilityUnlocksFor('herrero-orco-llanuras', 2);
    expect(result.map((a) => a.name)).toEqual(['Fundir lingote de hierro']);
  });

  it('herrero-orco-llanuras nivel 3 desbloquea las dos recetas de tier 3 (hacha y peto)', () => {
    const result = professionAbilityUnlocksFor('herrero-orco-llanuras', 3);
    expect(result.map((a) => a.name).sort()).toEqual(['Fabricar peto de gargantúa', 'Reparar hacha de guerra'].sort());
  });

  it('alquimista-orcos-llanuras nivel 2 desbloquea el antídoto (oficio remapeado de "sanador", ya retirado)', () => {
    const result = professionAbilityUnlocksFor('alquimista-orcos-llanuras', 2);
    expect(result.map((a) => a.name)).toEqual(['Preparar antídoto']);
  });

  it('un oficio/nivel sin ninguna receta gateada no desbloquea nada', () => {
    expect(professionAbilityUnlocksFor('herrero-orco-llanuras', 1)).toEqual([]);
    expect(professionAbilityUnlocksFor('cazador', 1)).toEqual([]);
  });

  it('las de crafteo son "profesion" y las de construcción son "reino" (nunca combate)', () => {
    expect(allProfessionAbilityUnlocks().every((u) => u.ability.category === (u.recipeCategory === 'construccion' ? 'reino' : 'profesion'))).toBe(true);
  });

  // Edificios de construction.ts con oficio propio (2026-08-13, petición explícita: "hay que
  // añadir también los edificios como habilidades de construcción, al igual que el resto de
  // elementos de profesiones") — la Choza sí tiene oficio+tier (a diferencia de Campamento/
  // Ayuntamiento, que van como habilidad GENERAL en startingAbilities.ts por no tener oficio).
  it('carpintero-orcos-llanuras nivel 2 desbloquea "Construir choza de piel y hueso"', () => {
    const result = professionAbilityUnlocksFor('carpintero-orcos-llanuras', 2);
    expect(result.map((a) => a.name)).toEqual(['Construir choza de piel y hueso']);
  });
});

describe('promptText de cada habilidad de oficio dispara de verdad su propia receta', () => {
  // Red de seguridad contra el error real que sería más fácil de cometer aquí: escribir un
  // promptText que "suena bien" pero no case con el verbRegex/nounRegex (crafteo) o BUILD_VERB_
  // REGEX/nounRegex (construcción) de la receta, dejando el botón sin efecto real al pulsarlo.
  it.each(allProfessionAbilityUnlocks())('$ability.name', ({ ability, recipeCategory }) => {
    if (recipeCategory === 'construccion') {
      // Emparejado por description (única por receta, y es justo lo que buildAbilityFor copia tal
      // cual) en vez de por oficio+tier: no hay ambigüedad hoy, pero mismo criterio que abajo.
      const recipe = CONSTRUCTION_RECIPES.find((r) => r.description === ability.description);
      expect(recipe).toBeDefined();
      expect(detectsBuildIntent(recipe!, ability.promptText)).toBe(true);
      return;
    }
    // Emparejado por resultDescription (única por receta, y es justo lo que abilityFor copia tal
    // cual) en vez de por oficio+tier: herrero tier 3 tiene DOS recetas, así que emparejar solo
    // por esos dos campos sería ambiguo.
    const recipe = CRAFTING_RECIPES.find((r) => r.resultDescription === ability.description);
    expect(recipe).toBeDefined();
    expect(detectsCraftIntent(recipe!, ability.promptText)).toBe(true);
  });
});
