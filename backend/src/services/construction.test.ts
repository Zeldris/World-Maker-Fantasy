import { describe, it, expect } from 'vitest';
import {
  CAMPAMENTO_RECIPE,
  CHOZA_RECIPE,
  MAKTOR_CLAN_TOTEM_RECIPE,
  AYUNTAMIENTO_PEQUENO_RECIPE,
  AYUNTAMIENTO_MEDIANO_RECIPE,
  AYUNTAMIENTO_GRANDE_RECIPE,
  CONSTRUCTION_RECIPES,
  checkRecipe,
  detectsBuildIntent,
  planConsumption,
  quantityOf,
  nivelEdificioRequeridoParaTier,
  plazasTrabajadorParaTier,
  type ConstructionRecipe,
} from './construction.js';
import type { AttributeBlock } from './dice.js';
import { EMPTY_SECONDARY_ATTRIBUTES } from './secondaryAttributes.js';
import type { CatalogLookup, InventoryRowLike } from './ingredients.js';

// Ninguna de las 3 recetas base tiene `requisitos` todavía, así que estos valores no afectan a
// checkRecipe(); existen para no repetir el bloque en cada llamada.
const attrs: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };
const secondary = EMPTY_SECONDARY_ATTRIBUTES;

// catalogSlug de cada fila → tipo/categoría real (2026-07-29, refactor de ingredientes: ya no se
// matchea por prefijo de nombre). Mismos slugs que construction.ts usa de verdad.
const catalogBySlug = new Map<string, CatalogLookup>([
  ['lena-matorral-cuerno', { tipo: 'RECURSO', category: 'madera' }],
  ['piedra', { tipo: 'RECURSO', category: 'piedra' }],
  ['piel-gargantua', { tipo: 'RECURSO', category: 'piel' }],
  ['piel-corredor', { tipo: 'RECURSO', category: 'piel' }],
  ['hueso-largo-gargantua', { tipo: 'RECURSO', category: 'hueso' }],
  ['cuerda-tendon', { tipo: 'EQUIPABLE', category: 'herramienta' }],
  ['mena-de-hierro', { tipo: 'RECURSO', category: 'mena' }],
  ['resina-trepador-ocaso', { tipo: 'RECURSO', category: 'resina' }],
  ['fibra-enredaderas-llanuras', { tipo: 'RECURSO', category: 'fibras' }],
  ['totem-clan-roto', { tipo: 'NARRATIVO', category: 'cosmetico' }],
  ['totem-maktor', { tipo: 'EQUIPABLE', category: 'ropa' }],
]);

function row(id: string, catalogSlug: string, cantidad?: number): InventoryRowLike {
  return { id, name: cantidad ? `${catalogSlug} (${cantidad})` : catalogSlug, catalogSlug };
}

describe('quantityOf', () => {
  it('lee la cantidad del sufijo "(N)"', () => {
    expect(quantityOf('Leña (60)')).toBe(60);
    expect(quantityOf('Piedra (3)')).toBe(3);
  });

  it('sin sufijo, cuenta como 1 unidad suelta', () => {
    expect(quantityOf('Piel de Corredor de Cauce')).toBe(1);
  });
});

describe('checkRecipe', () => {
  it('detecta receta cumplida, sumando entre varias filas fungibles de la misma categoría', () => {
    const rows = [row('1', 'lena-matorral-cuerno', 20), row('2', 'piedra', 10), row('3', 'piel-gargantua', 5)];
    expect(checkRecipe(CAMPAMENTO_RECIPE, rows, catalogBySlug, attrs, secondary)).toEqual({ met: true, missing: [] });
  });

  it('reporta exactamente qué falta y cuánto', () => {
    const rows = [row('1', 'lena-matorral-cuerno', 2)];
    const result = checkRecipe(CAMPAMENTO_RECIPE, rows, catalogBySlug, attrs, secondary);
    expect(result.met).toBe(false);
    expect(result.missing).toEqual([
      { label: 'leña', tienes: 2, necesitas: 6 },
      { label: 'piedra', tienes: 0, necesitas: 8 },
      { label: 'piel', tienes: 0, necesitas: 2 },
    ]);
  });

  it('bloquea la construcción si no se llega al requisito de atributo de la receta', () => {
    const rows = [row('1', 'lena-matorral-cuerno', 20), row('2', 'piedra', 10), row('3', 'piel-gargantua', 5)];
    const recipeConRequisito: ConstructionRecipe = { ...CAMPAMENTO_RECIPE, requisitos: { fuerza: 12 } };
    const debil: AttributeBlock = { ...attrs, fuerza: 6 };
    const result = checkRecipe(recipeConRequisito, rows, catalogBySlug, debil, secondary);
    expect(result.met).toBe(false);
    expect(result.missing).toEqual([{ label: 'fuerza', tienes: 6, necesitas: 12 }]);
  });

  it('el alivio de oficio reduce el requisito exigido de una construcción', () => {
    const rows = [row('1', 'lena-matorral-cuerno', 20), row('2', 'piedra', 10), row('3', 'piel-gargantua', 5)];
    const recipeConRequisito: ConstructionRecipe = { ...CAMPAMENTO_RECIPE, requisitos: { fuerza: 12 } };
    const debil: AttributeBlock = { ...attrs, fuerza: 8 };
    expect(checkRecipe(recipeConRequisito, rows, catalogBySlug, debil, secondary, 4)).toEqual({ met: true, missing: [] });
  });

  it('cualquier piel de distinta especie cuenta igual (ingrediente fungible por categoría)', () => {
    const rows = [row('1', 'lena-matorral-cuerno', 20), row('2', 'piedra', 10), row('3', 'piel-corredor', 3), row('4', 'piel-gargantua', 2)];
    expect(checkRecipe(CAMPAMENTO_RECIPE, rows, catalogBySlug, attrs, secondary)).toEqual({ met: true, missing: [] });
  });
});

describe('planConsumption', () => {
  // Ingrediente propio en vez de leer CAMPAMENTO_RECIPE.requirements (rebalanceo 2026-08-24,
  // Grupo 3 § Campamento/Ayuntamiento) — planConsumption es lógica pura de consumo, no debería
  // depender de qué cantidad exacta pida el Campamento hoy, que ya cambió una vez y puede volver
  // a cambiar.
  const ingredient = { ...CAMPAMENTO_RECIPE.requirements.find((r) => r.label === 'leña')!, cantidad: 20 };

  it('borra filas completas hasta cubrir la cantidad exacta, sin remanente', () => {
    const rows = [row('1', 'lena-matorral-cuerno', 12), row('2', 'lena-matorral-cuerno', 8)];
    const plan = planConsumption(rows, ingredient, catalogBySlug);
    expect(plan.deleteIds.sort()).toEqual(['1', '2']);
    expect(plan.updateRemainder).toBeNull();
  });

  it('deja un remanente reducido en la última fila parcialmente consumida', () => {
    const rows = [row('1', 'lena-matorral-cuerno', 25)];
    const plan = planConsumption(rows, ingredient, catalogBySlug);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.updateRemainder).toEqual({ id: '1', newQuantity: 5 });
  });

  it('combina filas completas + una parcial', () => {
    const rows = [row('1', 'lena-matorral-cuerno', 10), row('2', 'lena-matorral-cuerno', 15)];
    const plan = planConsumption(rows, ingredient, catalogBySlug);
    expect(plan.deleteIds).toEqual(['1']);
    expect(plan.updateRemainder).toEqual({ id: '2', newQuantity: 5 });
  });
});

describe('detectsBuildIntent', () => {
  it('detecta construir/levantar/montar un campamento', () => {
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Me quedo aquí varios días construyendo un campamento base permanente')).toBe(true);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Levanto un campamento para pasar la noche')).toBe(true);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Monto el campamento junto al río')).toBe(true);
  });

  it('no dispara para descansar en un campamento ya existente', () => {
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Vuelvo al campamento a descansar')).toBe(false);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Construyo una antorcha')).toBe(false);
  });

  it('detecta construir una choza/cabaña, distinto del campamento', () => {
    expect(detectsBuildIntent(CHOZA_RECIPE, 'Levanto una choza de piel y hueso junto al pozo')).toBe(true);
    expect(detectsBuildIntent(CHOZA_RECIPE, 'Construyo una cabaña para pasar el invierno')).toBe(true);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Levanto una choza de piel y hueso junto al pozo')).toBe(false);
  });

  it('detecta reconstruir el Tótem del Clan Maktor, sin confundirse con una mención cualquiera de "tótem"', () => {
    expect(detectsBuildIntent(MAKTOR_CLAN_TOTEM_RECIPE, 'Reconstruyo el tótem del clan')).toBe(true);
    expect(detectsBuildIntent(MAKTOR_CLAN_TOTEM_RECIPE, 'Construyo el tótem de Maktor sobre el mío')).toBe(true);
    // Verbo de construcción sin mencionar "clan"/"maktor" junto a "tótem": no dispara.
    expect(detectsBuildIntent(MAKTOR_CLAN_TOTEM_RECIPE, 'Monto mi tótem en la mochila')).toBe(false);
    // Mención de "tótem" sin verbo de construcción: no dispara (mismo criterio que el resto).
    expect(detectsBuildIntent(MAKTOR_CLAN_TOTEM_RECIPE, 'Miro el tótem del clan con cariño')).toBe(false);
  });

  it('detecta construir un ayuntamiento (pequeño), distinto de las otras dos', () => {
    expect(detectsBuildIntent(AYUNTAMIENTO_PEQUENO_RECIPE, 'Levanto un ayuntamiento en el cruce')).toBe(true);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Levanto un ayuntamiento en el cruce')).toBe(false);
    expect(detectsBuildIntent(CHOZA_RECIPE, 'Levanto un ayuntamiento en el cruce')).toBe(false);
  });

  // 2026-08-04: "mejorar" también cuenta como verbo de construcción (BUILD_VERB_REGEX incluye
  // mejor/ampl) — necesario para que las mejoras de Ayuntamiento se detecten sin decir "construyo".
  it('detecta mejorar el ayuntamiento a mediano/grande, sin confundirse entre niveles', () => {
    expect(detectsBuildIntent(AYUNTAMIENTO_MEDIANO_RECIPE, 'Mejoro mi ayuntamiento a mediano')).toBe(true);
    expect(detectsBuildIntent(AYUNTAMIENTO_GRANDE_RECIPE, 'Mejoro mi ayuntamiento a mediano')).toBe(false);
    // El nounRegex del pequeño (/ayuntamiento/, sin exigir "mediano") SÍ matchea este texto en
    // aislado — la desambiguación real solo pasa vía el ORDEN de CONSTRUCTION_RECIPES.find() (ver
    // el test de abajo), no llamando detectsBuildIntent() directo sobre el pequeño.

    expect(detectsBuildIntent(AYUNTAMIENTO_GRANDE_RECIPE, 'Amplío el ayuntamiento hasta hacerlo grande')).toBe(true);
    expect(detectsBuildIntent(AYUNTAMIENTO_MEDIANO_RECIPE, 'Amplío el ayuntamiento hasta hacerlo grande')).toBe(false);
  });

  // Orden real de CONSTRUCTION_RECIPES.find() (2026-08-04): "ayuntamiento mediano"/"ayuntamiento
  // grande" también matchearían el patrón simple del pequeño si ese se comprobara antes — el
  // orden del array es lo que evita que .find() se quede con la receta equivocada.
  it('CONSTRUCTION_RECIPES.find() elige la receta de Ayuntamiento correcta según el nivel mencionado', () => {
    const buscaMediano = CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, 'Mejoro mi ayuntamiento a mediano'));
    expect(buscaMediano?.key).toBe('ayuntamiento-mediano');
    const buscaGrande = CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, 'Amplío el ayuntamiento hasta hacerlo grande'));
    expect(buscaGrande?.key).toBe('ayuntamiento-grande');
    const buscaPequeno = CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, 'Construyo un ayuntamiento'));
    expect(buscaPequeno?.key).toBe('ayuntamiento');
  });
});

describe('checkRecipe — recetas nuevas', () => {
  it('choza: cumplida con piel/hueso largo/cuerda de tendón suficientes', () => {
    const rows = [row('1', 'piel-gargantua', 10), row('2', 'hueso-largo-gargantua', 6), row('3', 'cuerda-tendon', 4)];
    expect(checkRecipe(CHOZA_RECIPE, rows, catalogBySlug, attrs, secondary)).toEqual({ met: true, missing: [] });
  });

  it('tótem del Clan Maktor: cumplido con el tótem roto + el tótem personal de Gorhorn', () => {
    const rows = [row('1', 'totem-clan-roto'), row('2', 'totem-maktor')];
    expect(checkRecipe(MAKTOR_CLAN_TOTEM_RECIPE, rows, catalogBySlug, attrs, secondary)).toEqual({ met: true, missing: [] });
  });

  it('tótem del Clan Maktor: falta si solo tienes uno de los dos materiales', () => {
    expect(checkRecipe(MAKTOR_CLAN_TOTEM_RECIPE, [row('1', 'totem-clan-roto')], catalogBySlug, attrs, secondary).met).toBe(false);
    expect(checkRecipe(MAKTOR_CLAN_TOTEM_RECIPE, [row('1', 'totem-maktor')], catalogBySlug, attrs, secondary).met).toBe(false);
  });

  it('ayuntamiento pequeño: cumplido con las 6 categorías suficientes (rebalanceo 2026-08-24)', () => {
    const rows = [
      row('1', 'piedra', 14),
      row('2', 'lena-matorral-cuerno', 6),
      row('3', 'hueso-largo-gargantua', 6),
      row('4', 'resina-trepador-ocaso', 8),
      row('5', 'mena-de-hierro', 2),
      row('6', 'fibra-enredaderas-llanuras', 8),
    ];
    expect(checkRecipe(AYUNTAMIENTO_PEQUENO_RECIPE, rows, catalogBySlug, attrs, secondary)).toEqual({ met: true, missing: [] });
  });

  // Materiales procesados (2026-08-24, Grupo 3 § materiales procesados de construcción) — mediano
  // ~75% procesado/25% crudo, grande 100% procesado (salvo resina, siempre cruda). `tieneOficio`
  // por defecto `true` (checkRecipe) — estos tests solo prueban materiales, no el gate de oficio
  // (ver describe aparte más abajo).
  it('ayuntamiento mediano: cumplido con la mezcla de materiales procesados + crudo, carisma alto', () => {
    const rows = [
      row('1', 'bloque-piedra-tallada', 3),
      row('2', 'piedra', 5),
      row('3', 'lingote-de-hierro', 1),
      row('4', 'mena-de-hierro', 1),
      row('5', 'viga-madera-tallada', 2),
      row('6', 'lena-matorral-cuerno', 3),
      row('7', 'columna-hueso', 2),
      row('8', 'hueso-largo-gargantua', 2),
      row('9', 'cordaje-trenzado', 2),
      row('10', 'fibra-enredaderas-llanuras', 3),
      row('11', 'resina-trepador-ocaso', 12),
    ];
    const carismatico: AttributeBlock = { ...attrs, carisma: 18 };
    expect(checkRecipe(AYUNTAMIENTO_MEDIANO_RECIPE, rows, catalogBySlug, carismatico, secondary)).toEqual({ met: true, missing: [] });
  });

  it('ayuntamiento grande: cumplido 100% procesado (salvo resina, siempre cruda) y carisma alto', () => {
    const rows = [
      row('1', 'bloque-piedra-tallada', 8),
      row('2', 'lingote-de-hierro', 4),
      row('3', 'viga-madera-tallada', 5),
      row('4', 'columna-hueso', 5),
      row('5', 'cordaje-trenzado', 5),
      row('6', 'resina-trepador-ocaso', 20),
    ];
    const carismatico: AttributeBlock = { ...attrs, carisma: 22 };
    expect(checkRecipe(AYUNTAMIENTO_GRANDE_RECIPE, rows, catalogBySlug, carismatico, secondary)).toEqual({ met: true, missing: [] });
  });
});

describe('checkRecipe — bloqueo real de oficio de construcción (2026-08-24)', () => {
  const rowsGrande = [
    row('1', 'bloque-piedra-tallada', 8),
    row('2', 'lingote-de-hierro', 4),
    row('3', 'viga-madera-tallada', 5),
    row('4', 'columna-hueso', 5),
    row('5', 'cordaje-trenzado', 5),
    row('6', 'resina-trepador-ocaso', 20),
  ];
  const carismatico: AttributeBlock = { ...attrs, carisma: 22 };

  it('sin tieneOficio (mediano/grande), aunque sobren materiales y carisma, no está cumplida', () => {
    const result = checkRecipe(AYUNTAMIENTO_GRANDE_RECIPE, rowsGrande, catalogBySlug, carismatico, secondary, 0, false);
    expect(result.met).toBe(false);
    expect(result.missing).toEqual([{ label: 'el oficio de constructor-orcos-llanuras', tienes: 0, necesitas: 1 }]);
  });

  it('con tieneOficio true, la misma combinación sí está cumplida', () => {
    expect(checkRecipe(AYUNTAMIENTO_GRANDE_RECIPE, rowsGrande, catalogBySlug, carismatico, secondary, 0, true)).toEqual({ met: true, missing: [] });
  });

  it('el pequeño no exige el oficio (nivel de entrada) — tieneOficio false no lo bloquea', () => {
    const rows = [
      row('1', 'piedra', 14),
      row('2', 'lena-matorral-cuerno', 6),
      row('3', 'hueso-largo-gargantua', 6),
      row('4', 'resina-trepador-ocaso', 8),
      row('5', 'mena-de-hierro', 2),
      row('6', 'fibra-enredaderas-llanuras', 8),
    ];
    expect(checkRecipe(AYUNTAMIENTO_PEQUENO_RECIPE, rows, catalogBySlug, attrs, secondary, 0, false)).toEqual({ met: true, missing: [] });
  });
});

describe('Campos de reglas de reino en las recetas (2026-08-04)', () => {
  it('campamento: 1 slot de compañero, tope de 1 por región', () => {
    expect(CAMPAMENTO_RECIPE.companionSlots).toBe(1);
    expect(CAMPAMENTO_RECIPE.maxPerRegion).toBe(1);
  });

  it('choza: 2 slots de compañero, exige Ayuntamiento', () => {
    expect(CHOZA_RECIPE.companionSlots).toBe(2);
    expect(CHOZA_RECIPE.requiresAyuntamiento).toBe(true);
  });

  // 2026-08-15: corrección tras un primer intento de atarlo a una Location fija (Los Restos de
  // Maktor) — la usuaria pidió en su lugar el mismo mecanismo que la choza, ligado a dónde esté
  // el Ayuntamiento de la facción que funde Gorhorn, no a un sitio concreto del mapa.
  it('tótem del Clan Maktor: sin slots de compañero (monumento, no infraestructura habitable), exige Ayuntamiento', () => {
    expect(MAKTOR_CLAN_TOTEM_RECIPE.companionSlots).toBeUndefined();
    expect(MAKTOR_CLAN_TOTEM_RECIPE.requiresAyuntamiento).toBe(true);
  });

  it('las 3 recetas de Ayuntamiento comparten key y suben de nivel/capacidad', () => {
    expect(AYUNTAMIENTO_PEQUENO_RECIPE.key).toBe('ayuntamiento');
    expect(AYUNTAMIENTO_PEQUENO_RECIPE.ayuntamientoNivel).toBe(1);
    expect(AYUNTAMIENTO_PEQUENO_RECIPE.reinoBuildingCapacity).toBe(10);
    expect(AYUNTAMIENTO_MEDIANO_RECIPE.upgradesRecipeKey).toBe('ayuntamiento');
    expect(AYUNTAMIENTO_MEDIANO_RECIPE.ayuntamientoNivel).toBe(2);
    expect(AYUNTAMIENTO_MEDIANO_RECIPE.reinoBuildingCapacity).toBe(25);
    expect(AYUNTAMIENTO_GRANDE_RECIPE.upgradesRecipeKey).toBe('ayuntamiento');
    expect(AYUNTAMIENTO_GRANDE_RECIPE.ayuntamientoNivel).toBe(3);
    expect(AYUNTAMIENTO_GRANDE_RECIPE.reinoBuildingCapacity).toBe(60);
  });
});

describe('Edificios de oficio (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md, 2026-09-28)', () => {
  it('nivelEdificioRequeridoParaTier: Taller admite 1-3, Obrador 4-6, Gran obrador 7-9', () => {
    expect(nivelEdificioRequeridoParaTier(1)).toBe(1);
    expect(nivelEdificioRequeridoParaTier(3)).toBe(1);
    expect(nivelEdificioRequeridoParaTier(4)).toBe(2);
    expect(nivelEdificioRequeridoParaTier(6)).toBe(2);
    expect(nivelEdificioRequeridoParaTier(7)).toBe(3);
    expect(nivelEdificioRequeridoParaTier(9)).toBe(3);
  });

  it('plazasTrabajadorParaTier: 1/2/4 por nivel, null sin nivel de edificio', () => {
    expect(plazasTrabajadorParaTier(null)).toBeNull();
    expect(plazasTrabajadorParaTier(1)).toBe(1);
    expect(plazasTrabajadorParaTier(2)).toBe(2);
    expect(plazasTrabajadorParaTier(3)).toBe(4);
  });

  it('las 14 recetas base llevan oficioProducido, edificioOficioNivel 1 y requiresAyuntamiento', () => {
    const baseKeys = [
      'herreria', 'curtiduria', 'peleteria', 'desolladero', 'corrales', 'carpinteria', 'sastreria',
      'herboristeria', 'casa-de-curas', 'taller-alquimia', 'cocina', 'embarcadero-pesca', 'obrador-piedra', 'boca-mina',
    ];
    for (const key of baseKeys) {
      const recipe = CONSTRUCTION_RECIPES.find((r) => r.key === key);
      expect(recipe, `receta base '${key}' no encontrada`).toBeDefined();
      expect(recipe!.oficioProducido, `'${key}'.oficioProducido`).toBeTruthy();
      expect(recipe!.edificioOficioNivel, `'${key}'.edificioOficioNivel`).toBe(1);
      expect(recipe!.requiresAyuntamiento, `'${key}'.requiresAyuntamiento`).toBe(true);
    }
  });

  it('Embarcadero de pesca y Boca de mina llevan condicionRegion en sus 3 niveles', () => {
    for (const key of ['embarcadero-pesca', 'embarcadero-pesca-obrador', 'embarcadero-pesca-gran-obrador']) {
      expect(CONSTRUCTION_RECIPES.find((r) => r.key === key)!.condicionRegion).toBe('costa');
    }
    for (const key of ['boca-mina', 'boca-mina-obrador', 'boca-mina-gran-obrador']) {
      expect(CONSTRUCTION_RECIPES.find((r) => r.key === key)!.condicionRegion).toBe('veta');
    }
  });

  it('las mejoras de nivel 2/3 llevan ayuntamientoNivelMinimo y edificioOficioNivel crecientes', () => {
    const obrador = CONSTRUCTION_RECIPES.find((r) => r.key === 'herreria-obrador')!;
    const granObrador = CONSTRUCTION_RECIPES.find((r) => r.key === 'herreria-gran-obrador')!;
    expect(obrador.edificioOficioNivel).toBe(2);
    expect(obrador.ayuntamientoNivelMinimo).toBe(2);
    expect(obrador.upgradesRecipeKey).toBe('herreria');
    expect(granObrador.edificioOficioNivel).toBe(3);
    expect(granObrador.ayuntamientoNivelMinimo).toBe(3);
    expect(granObrador.upgradesRecipeKey).toBe('herreria-obrador');
  });

  it('el orden en CONSTRUCTION_RECIPES pone "gran obrador" antes que "obrador" a secas, por familia', () => {
    const keys = CONSTRUCTION_RECIPES.map((r) => r.key);
    expect(keys.indexOf('herreria-gran-obrador')).toBeLessThan(keys.indexOf('herreria-obrador'));
    expect(keys.indexOf('herreria-obrador')).toBeLessThan(keys.indexOf('herreria'));
  });

  it('detectsBuildIntent distingue Taller/Obrador/Gran obrador de herrería por texto', () => {
    const herreria = CONSTRUCTION_RECIPES.find((r) => r.key === 'herreria')!;
    const obrador = CONSTRUCTION_RECIPES.find((r) => r.key === 'herreria-obrador')!;
    const granObrador = CONSTRUCTION_RECIPES.find((r) => r.key === 'herreria-gran-obrador')!;
    expect(detectsBuildIntent(herreria, 'Construyo una herrería')).toBe(true);
    expect(detectsBuildIntent(obrador, 'Mejoro a un obrador de herrería')).toBe(true);
    expect(detectsBuildIntent(granObrador, 'Mejoro a un gran obrador de herrería')).toBe(true);
    // El nounRegex del Taller no excluye "gran obrador de herrería" a propósito (el orden del
    // array es lo que decide, ver test de arriba) — pero si se comprueba el Taller AISLADO,
    // el texto de la mejora también matchea su patrón más simple.
    expect(detectsBuildIntent(herreria, 'Mejoro a un gran obrador de herrería')).toBe(true);
  });
});
