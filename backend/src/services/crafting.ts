import { normalizeText } from './travel.js';
import type { Attribute, AttributeBlock } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';
import { checkRequisitos, type Requisitos, type RequisitoShortfall } from './requisitos.js';
import { totalQuantity, planConsumption, type IngredientRequirement, type CatalogLookup, type InventoryRowLike } from './ingredients.js';

/// Crafteo v1 (roadmap 2026-07-20, propuesta de Fable): determinista, sin sistema nuevo — un
/// intercambio 1:1 de filas de inventario, con o sin condición de ubicación. El crafteo ES la
/// escena, no solo un intercambio de números (narrationWant/narrationDo son la mitad real de cada
/// receta, no solo boilerplate).
///
/// Tabulado (auditoría 2026-07-22, mismo criterio que ConstructionRecipe en construction.ts): las
/// 5 recetas originales (hacha, carne ahumada, peto, antídoto, antorcha) eran 5 copias casi
/// idénticas de detección + comprobación + narración + transacción, repetidas tanto aquí como en
/// turnResolution.ts — ahora es una sola tabla de datos y un solo camino de código para las 5.
///
/// Refactor de ingredientes (2026-07-29, petición explícita: categorización mecánica de objetos):
/// `ingredients` sustituye al antiguo `ingredientNamePrefixes: string[]` (matching por prefijo de
/// nombre) — ahora matchea contra el tipo/categoría REAL del catálogo (ver ingredients.ts), y
/// soporta cantidades reales (antes siempre se consumía la fila entera, sin contar unidades).
export interface CraftingRecipe {
  key: string;
  verbRegex: RegExp;
  nounRegex: RegExp;
  /// Slug de ubicación requerido, o null si se puede craftear en cualquier sitio.
  location: string | null;
  ingredients: IngredientRequirement[];
  resultName: string;
  resultDescription: string;
  /// Slug de ItemCatalog (sesión de diseño 2026-07-23) — se copia al InventoryItem.catalogSlug
  /// del resultado para poder mirar sus requisitos de equipar (ver requisitos.ts). Opcional: no
  /// todas las recetas tienen fila propia en el catálogo del mundo.
  resultCatalogSlug?: string;
  /// 'defensa' incluido a propósito (mismo criterio que ItemCatalog/InventoryItem, ver saves.ts):
  /// el peto de gargantúa es armadura, no un arma con uno de los 6 atributos jugables.
  statBonusAttribute?: Attribute | 'defensa';
  statBonusAmount?: number;
  /// Sesión de diseño 2026-07-23: nivel de rareza/dificultad del objeto (1-5), mínimos de
  /// atributo del PJ para poder craftearlo, y a qué oficio pertenece (id de professions.ts) — el
  /// nivel de ESE oficio alivia el requisito (ver professionProgress.ts), nunca la tirada general.
  tier?: number;
  requisitos?: Requisitos;
  oficio?: string;
  /// Pista de narración cuando el jugador lo quiere pero no se puede materializar todavía.
  narrationWant: string;
  /// Pista de narración cuando sí se materializa este turno.
  narrationDo: string;
}

const AXE_REPAIR_RECIPE: CraftingRecipe = {
  key: 'axeRepair',
  verbRegex: /repar|reforj|restaur/,
  nounRegex: /hacha/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'hacha-guerra-maktor-rota' }, cantidad: 1, label: 'hacha de guerra rota' },
    { match: { kind: 'exact', catalogSlug: 'sal-trueque' }, cantidad: 1, label: 'sal de trueque' },
  ],
  resultName: 'Hacha de guerra Maktor restaurada',
  resultCatalogSlug: 'hacha-guerra-maktor-restaurada',
  resultDescription:
    'El hacha rota del clan, reforjada — la cabeza reasentada y el filo devuelto. Lo único del Clan Maktor que ha vuelto a estar entero.',
  statBonusAttribute: 'fuerza',
  statBonusAmount: 3,
  // Sesión de diseño 2026-07-23: reforjar el hacha del clan a un arma de tier 3 exige fuerza real
  // (blandirla y guiar al herrero) — oficio 'herrero' porque ocurre en la fragua del campamento.
  tier: 3,
  requisitos: { fuerza: 12 },
  oficio: 'herrero',
  narrationWant:
    'El personaje quiere reparar su hacha rota, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y tener sal de trueque para pagar al herrero) — narra que lo intenta o lo considera, pero no que la repara de verdad.',
  narrationDo:
    'El personaje repara su hacha rota aquí mismo, en el Campamento del Clan Serhu, a cambio de sal de trueque — narra la escena de la reparación (el herrero, el gesto de volver al campamento del clan) con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

const SMOKE_MEAT_RECIPE: CraftingRecipe = {
  key: 'smokeMeat',
  verbRegex: /ahum|crear|creo/,
  nounRegex: /carne/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'racion-carne' }, cantidad: 1, label: 'ración de carne fresca' }],
  resultName: 'Ración de carne ahumada',
  resultCatalogSlug: 'racion-carne-ahumada',
  resultDescription: 'Ahumada sobre fuego — aguanta mucho más antes de estropearse que la carne fresca.',
  // Sin tier/requisitos/oficio a propósito (2026-07-23): ahumar carne sobre el fuego es una
  // habilidad de supervivencia básica, al alcance de cualquiera sin necesitar oficio.
  narrationWant:
    'El personaje quiere ahumar carne para conservarla, pero no lleva ninguna ración de carne fresca encima ahora mismo — narra que lo intenta o lo considera, pero no que la ahuma de verdad.',
  narrationDo: 'El personaje ahuma su ración de carne fresca sobre el fuego — narra la escena (el humo, la espera, el olor) con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

const GARGANTUA_ARMOR_RECIPE: CraftingRecipe = {
  key: 'gargantuaArmor',
  verbRegex: /fabric|monta|confeccion|cos[eo]|prepar|crear|creo/,
  nounRegex: /peto/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'placa-osea-gargantua' }, cantidad: 1, label: 'placa ósea de gargantúa' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 1, label: 'cuerda de tendón' },
  ],
  resultName: 'Peto de placas óseas de gargantúa',
  resultCatalogSlug: 'peto-placas-gargantua',
  resultDescription: 'Armadura pesada montada a mano en el campamento del clan, con placas óseas y tendón de gargantúa.',
  statBonusAttribute: 'defensa',
  statBonusAmount: 2,
  // Sesión de diseño 2026-07-23: montar armadura pesada de placas óseas exige fuerza — mismo
  // oficio 'herrero' que el hacha (misma fragua del campamento, no hace falta un oficio aparte).
  tier: 3,
  requisitos: { fuerza: 10 },
  oficio: 'herrero',
  narrationWant:
    'El personaje quiere fabricar un peto de placas óseas de gargantúa, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y tener placas óseas de gargantúa y cuerda de tendón) — narra que lo intenta o lo considera, pero no que lo fabrica de verdad.',
  narrationDo:
    'El personaje fabrica un peto de placas óseas de gargantúa aquí mismo, en el Campamento del Clan Serhu, con placas óseas y cuerda de tendón que lleva encima — narra la escena del montaje con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

const ANTIDOTE_RECIPE: CraftingRecipe = {
  key: 'antidote',
  verbRegex: /prepar|mezcl|hac|crear|creo/,
  nounRegex: /ant[ií]doto|contraveneno/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 1, label: 'manojo de salvia del polvo' },
    { match: { kind: 'exact', catalogSlug: 'petalos-flor-ceniza' }, cantidad: 1, label: 'pétalos de Flor de Ceniza' },
  ],
  resultName: 'Contraveneno de salvia y ceniza',
  resultCatalogSlug: 'contraveneno-salvia-ceniza',
  resultDescription: 'Mezcla preparada de salvia del polvo y pétalos de Flor de Ceniza — neutraliza el veneno de Espina del Viento.',
  // Sesión de diseño 2026-07-23: mezclar un contraveneno de verdad exige entender qué se está
  // mezclando — requisito de Inteligencia (atributo secundario, ver secondaryAttributes.ts), no
  // de fuerza física. Oficio 'sanador': encaja con quien ya conoce estas hierbas de antes.
  tier: 2,
  requisitos: { inteligencia: 8 },
  oficio: 'sanador',
  narrationWant:
    'El personaje quiere preparar un antídoto, pero no lleva encima salvia del polvo y pétalos de Flor de Ceniza a la vez — narra que lo intenta o lo considera, pero no que lo prepara de verdad.',
  narrationDo: 'El personaje prepara un contraveneno mezclando su salvia del polvo con pétalos de Flor de Ceniza — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

const FIELD_TORCH_RECIPE: CraftingRecipe = {
  key: 'fieldTorch',
  verbRegex: /fabric|monta|prepar|\bata|\bato|crear|creo/,
  nounRegex: /antorcha/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'lena-matorral-cuerno' }, cantidad: 1, label: 'leña de matorral de cuerno' },
    { match: { kind: 'exact', catalogSlug: 'resina-trepador-ocaso' }, cantidad: 1, label: 'bloque de resina de Trepador Ocaso' },
  ],
  resultName: 'Antorcha de resina de ciénaga',
  resultCatalogSlug: 'antorcha-de-resina',
  resultDescription: 'Antorcha de madera envuelta en resina oscura de ciénaga, atada en el momento — arde incluso con lluvia.',
  // Sin tier/requisitos/oficio a propósito (2026-07-23): atar una antorcha de campo es utilidad
  // básica, al alcance de cualquiera sin necesitar oficio.
  narrationWant:
    'El personaje quiere atar una antorcha, pero no lleva encima leña de matorral de cuerno y resina de Trepador Ocaso a la vez — narra que lo intenta o lo considera, pero no que la fabrica de verdad.',
  narrationDo: 'El personaje ata una antorcha de campo con su leña de matorral de cuerno y su resina de Trepador Ocaso — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Receta de refinado nueva (2026-07-29, petición explícita, ejemplo dado por la usuaria: "convertir
// una mena de mineral en un lingote") — mismo oficio/ubicación que las dos recetas de arriba que ya
// usan la fragua del campamento (hacha, peto): fundir mena es el paso previo natural a forjar.
const IRON_INGOT_RECIPE: CraftingRecipe = {
  key: 'ironIngot',
  verbRegex: /fund|forj|refin|derret/,
  nounRegex: /lingote.*hierro|hierro.*lingote/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'mena-de-hierro' }, cantidad: 4, label: 'mena de hierro' }],
  resultName: 'Lingote de hierro',
  resultCatalogSlug: 'lingote-de-hierro',
  resultDescription: 'Metal fundido en la fragua del campamento y colado en un molde sencillo — listo para forjar.',
  tier: 2,
  requisitos: { fuerza: 8 },
  oficio: 'herrero',
  narrationWant:
    'El personaje quiere fundir mena de hierro en un lingote, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y llevar al menos 4 fragmentos de mena de hierro) — narra que lo intenta o lo considera, pero no que lo funde de verdad.',
  narrationDo:
    'El personaje funde su mena de hierro en la fragua del campamento, colándola en un molde sencillo hasta que enfría en un lingote — narra la escena (el calor, el fuelle, el metal al rojo) con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

// Receta de refinado nueva (2026-07-29, petición explícita, ejemplo dado por la usuaria:
// "transformar piedra en bloques de construcción") — oficio 'carpintero' (mismo oficio que
// CHOZA_RECIPE, "construye con lo que hay a mano"; ninguna de las 8 profesiones es literalmente
// "cantero", carpintero es la que mejor encaja narrativamente). Ingrediente por CATEGORÍA (no
// exacto): cualquier piedra en bruto sirve, a diferencia del lingote de hierro (mena específica).
const STONE_BLOCK_RECIPE: CraftingRecipe = {
  key: 'stoneBlock',
  verbRegex: /tall|labr|desbast|fabric|prepar/,
  nounRegex: /bloque.*piedra|piedra.*bloque|piedra.*tallad|tallad.*piedra/,
  location: null,
  ingredients: [{ match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 5, label: 'piedra' }],
  resultName: 'Bloque de piedra tallada',
  resultCatalogSlug: 'bloque-piedra-tallada',
  resultDescription: 'Bloque de piedra desbastado a golpes de maza y cincel hasta dejarlo plano por al menos dos caras — ya no es solo cascote, sirve para levantar un muro de verdad.',
  tier: 1,
  requisitos: { fuerza: 6 },
  oficio: 'carpintero',
  narrationWant:
    'El personaje quiere tallar piedra en bloques, pero no lleva encima suficiente piedra en bruto para hacerlo (hacen falta al menos 5 piedras) — narra que lo intenta o lo considera, pero no que talla los bloques de verdad.',
  narrationDo:
    'El personaje talla su piedra en bloques a golpes de maza y cincel, desbastando cada cara hasta dejarla plana — narra la escena (el polvo, el ritmo del golpe, las esquirlas saltando) con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  AXE_REPAIR_RECIPE,
  SMOKE_MEAT_RECIPE,
  GARGANTUA_ARMOR_RECIPE,
  ANTIDOTE_RECIPE,
  FIELD_TORCH_RECIPE,
  IRON_INGOT_RECIPE,
  STONE_BLOCK_RECIPE,
];

export function detectsCraftIntent(recipe: CraftingRecipe, action: string): boolean {
  const normalized = normalizeText(action);
  return recipe.verbRegex.test(normalized) && recipe.nounRegex.test(normalized);
}

/// Puro: dado el slug de la ubicación actual, las filas de inventario disponibles y los
/// atributos del PJ, decide si la receta puede materializarse ahora mismo. `alivio` (nivel de
/// oficio si la receta lo tiene, ver professionProgress.ts) resta a los requisitos exigidos.
export function canCraft(
  recipe: CraftingRecipe,
  currentLocationSlug: string | null,
  rows: InventoryRowLike[],
  catalogBySlug: Map<string, CatalogLookup>,
  attributes: AttributeBlock,
  secondaryAttributes: SecondaryAttributeBlock,
  alivio = 0,
): boolean {
  if (recipe.location && currentLocationSlug !== recipe.location) return false;
  const hasIngredients = recipe.ingredients.every((ing) => totalQuantity(rows, ing, catalogBySlug) >= ing.cantidad);
  if (!hasIngredients) return false;
  return craftRequisitoShortfalls(recipe, attributes, secondaryAttributes, alivio).length === 0;
}

/// Puro: qué atributos no llegan al mínimo de esta receta — vacío si no tiene requisitos o si
/// todos se cumplen. Separado de `canCraft` para poder narrar EXACTAMENTE qué falta.
export function craftRequisitoShortfalls(
  recipe: CraftingRecipe,
  attributes: AttributeBlock,
  secondaryAttributes: SecondaryAttributeBlock,
  alivio = 0,
): RequisitoShortfall[] {
  return checkRequisitos(recipe.requisitos, attributes, secondaryAttributes, alivio);
}

/// Puro: localiza las filas reales a borrar/reducir para cada ingrediente — null si alguno ya no
/// alcanza (no debería pasar justo después de que `canCraft` diera true, pero protege de una
/// carrera entre el chequeo y la resolución sin tocar la base de datos).
export function planCraftConsumption(
  recipe: CraftingRecipe,
  rows: InventoryRowLike[],
  catalogBySlug: Map<string, CatalogLookup>,
): { deleteIds: string[]; updateRemainder: { id: string; newQuantity: number } | null }[] | null {
  const plans: { deleteIds: string[]; updateRemainder: { id: string; newQuantity: number } | null }[] = [];
  for (const ingredient of recipe.ingredients) {
    if (totalQuantity(rows, ingredient, catalogBySlug) < ingredient.cantidad) return null;
    plans.push(planConsumption(rows, ingredient, catalogBySlug));
  }
  return plans;
}
