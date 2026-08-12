import { describe, it, expect } from 'vitest';
import { startingAbilitiesFor } from './startingAbilities.js';
import { CONSTRUCTION_RECIPES, detectsBuildIntent } from './construction.js';

describe('startingAbilitiesFor', () => {
  it('Gorhorn tiene sus habilidades "de serie"; otros personajes, ninguna', () => {
    expect(startingAbilitiesFor('Gorhorn').length).toBeGreaterThan(0);
    expect(startingAbilitiesFor('Otro')).toEqual([]);
  });
});

// Edificios sin oficio (Campamento, Ayuntamiento x3 — 2026-08-13, petición explícita: "hay que
// añadir también los edificios como habilidades de construcción, al igual que el resto de
// elementos de profesiones"): mismo criterio "red de seguridad" que professionAbilities.test.ts
// — un promptText que "suena bien" pero no case con detectsBuildIntent dejaría el botón sin
// efecto real al pulsarlo.
describe('promptText de las habilidades de construcción sin oficio dispara de verdad su propia receta', () => {
  const buildingAbilities = startingAbilitiesFor('Gorhorn').filter((a) =>
    ['Construir campamento', 'Fundar ayuntamiento', 'Ampliar ayuntamiento a mediano', 'Ampliar ayuntamiento a grande'].includes(a.name),
  );

  it('las 4 habilidades existen', () => {
    expect(buildingAbilities).toHaveLength(4);
  });

  it.each(buildingAbilities)('$name', (ability) => {
    const recipe = CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, ability.promptText));
    expect(recipe).toBeDefined();
    expect(detectsBuildIntent(recipe!, ability.promptText)).toBe(true);
  });

  it('cada promptText resuelve a la receta correcta, sin colisión entre niveles de Ayuntamiento', () => {
    const keyFor = (name: string) => CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, buildingAbilities.find((a) => a.name === name)!.promptText))?.key;
    expect(keyFor('Construir campamento')).toBe('campamento');
    expect(keyFor('Fundar ayuntamiento')).toBe('ayuntamiento');
    expect(keyFor('Ampliar ayuntamiento a mediano')).toBe('ayuntamiento-mediano');
    expect(keyFor('Ampliar ayuntamiento a grande')).toBe('ayuntamiento-grande');
  });
});
