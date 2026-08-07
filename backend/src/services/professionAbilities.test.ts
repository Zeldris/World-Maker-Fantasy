import { describe, it, expect } from 'vitest';
import { professionAbilityUnlocksFor, allProfessionAbilityUnlocks } from './professionAbilities.js';
import { CRAFTING_RECIPES, detectsCraftIntent } from './crafting.js';

describe('professionAbilityUnlocksFor', () => {
  it('carpintero nivel 1 desbloquea "Tallar bloque de piedra"', () => {
    const result = professionAbilityUnlocksFor('carpintero', 1);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tallar bloque de piedra');
    expect(result[0].category).toBe('profesion');
  });

  it('herrero nivel 2 desbloquea solo el lingote de hierro (tier 2), no las de tier 3 todavía', () => {
    const result = professionAbilityUnlocksFor('herrero', 2);
    expect(result.map((a) => a.name)).toEqual(['Fundir lingote de hierro']);
  });

  it('herrero nivel 3 desbloquea las dos recetas de tier 3 (hacha y peto)', () => {
    const result = professionAbilityUnlocksFor('herrero', 3);
    expect(result.map((a) => a.name).sort()).toEqual(['Fabricar peto de gargantúa', 'Reparar hacha de guerra'].sort());
  });

  it('sanador nivel 2 desbloquea el antídoto', () => {
    const result = professionAbilityUnlocksFor('sanador', 2);
    expect(result.map((a) => a.name)).toEqual(['Preparar antídoto']);
  });

  it('un oficio/nivel sin ninguna receta gateada no desbloquea nada', () => {
    expect(professionAbilityUnlocksFor('herrero', 1)).toEqual([]);
    expect(professionAbilityUnlocksFor('cazador', 1)).toEqual([]);
  });

  it('todas las habilidades de oficio son de categoría "profesion" (su propia pestaña, nunca combate)', () => {
    expect(allProfessionAbilityUnlocks().every((u) => u.ability.category === 'profesion')).toBe(true);
  });
});

describe('promptText de cada habilidad de oficio dispara de verdad su propia receta', () => {
  // Red de seguridad contra el error real que sería más fácil de cometer aquí: escribir un
  // promptText que "suena bien" pero no case con el verbRegex/nounRegex de la receta, dejando el
  // botón sin efecto real al pulsarlo.
  it.each(allProfessionAbilityUnlocks())('$ability.name', ({ ability }) => {
    // Emparejado por resultDescription (única por receta, y es justo lo que abilityFor copia tal
    // cual) en vez de por oficio+tier: herrero tier 3 tiene DOS recetas, así que emparejar solo
    // por esos dos campos sería ambiguo.
    const recipe = CRAFTING_RECIPES.find((r) => r.resultDescription === ability.description);
    expect(recipe).toBeDefined();
    expect(detectsCraftIntent(recipe!, ability.promptText)).toBe(true);
  });
});
