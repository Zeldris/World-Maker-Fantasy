import { normalizeText } from './travel.js';
import type { Attribute, AttributeBlock } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';
import { checkRequisitos, type Requisitos, type RequisitoShortfall } from './requisitos.js';

/// Crafteo v1 (roadmap 2026-07-20, propuesta de Fable): determinista, sin sistema nuevo — un
/// intercambio 1:1 de filas de inventario, con o sin condición de ubicación. El crafteo ES la
/// escena, no solo un intercambio de números (narrationWant/narrationDo son la mitad real de cada
/// receta, no solo boilerplate).
///
/// Tabulado (auditoría 2026-07-22, mismo criterio que ConstructionRecipe en construction.ts): las
/// 5 recetas originales (hacha, carne ahumada, peto, antídoto, antorcha) eran 5 copias casi
/// idénticas de detección + comprobación + narración + transacción, repetidas tanto aquí como en
/// turnResolution.ts — ahora es una sola tabla de datos y un solo camino de código para las 5.
export interface CraftingRecipe {
  key: string;
  verbRegex: RegExp;
  nounRegex: RegExp;
  /// Slug de ubicación requerido, o null si se puede craftear en cualquier sitio.
  location: string | null;
  /// Prefijos de nombre (startsWith) de las filas de inventario que se consumen enteras — el
  /// botín/despiece a veces materializa lotes ("Sal de trueque ×2") en una sola fila, así que
  /// nunca se rastrea cantidad exacta, se consume la fila completa que matchea el prefijo.
  ingredientNamePrefixes: string[];
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
  ingredientNamePrefixes: ['Hacha de guerra rota', 'Sal de trueque'],
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
  ingredientNamePrefixes: ['Ración de carne fresca'],
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
  ingredientNamePrefixes: ['Placa ósea de gargantúa', 'Cuerda de tendón'],
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
  ingredientNamePrefixes: ['Manojo de salvia del polvo', 'Pétalos de Flor de Ceniza'],
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
  ingredientNamePrefixes: ['Leña de matorral de cuerno', 'Bloque de resina de Trepador Ocaso'],
  resultName: 'Antorcha de resina de ciénaga',
  resultCatalogSlug: 'antorcha-de-resina',
  resultDescription: 'Antorcha de madera envuelta en resina oscura de ciénaga, atada en el momento — arde incluso con lluvia.',
  // Sin tier/requisitos/oficio a propósito (2026-07-23): atar una antorcha de campo es utilidad
  // básica, al alcance de cualquiera sin necesitar oficio.
  narrationWant:
    'El personaje quiere atar una antorcha, pero no lleva encima leña de matorral de cuerno y resina de Trepador Ocaso a la vez — narra que lo intenta o lo considera, pero no que la fabrica de verdad.',
  narrationDo: 'El personaje ata una antorcha de campo con su leña de matorral de cuerno y su resina de Trepador Ocaso — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  AXE_REPAIR_RECIPE,
  SMOKE_MEAT_RECIPE,
  GARGANTUA_ARMOR_RECIPE,
  ANTIDOTE_RECIPE,
  FIELD_TORCH_RECIPE,
];

export function detectsCraftIntent(recipe: CraftingRecipe, action: string): boolean {
  const normalized = normalizeText(action);
  return recipe.verbRegex.test(normalized) && recipe.nounRegex.test(normalized);
}

/// Puro: dado el slug de la ubicación actual, los nombres de inventario disponibles y los
/// atributos del PJ, decide si la receta puede materializarse ahora mismo. `alivio` (nivel de
/// oficio si la receta lo tiene, ver professionProgress.ts) resta a los requisitos exigidos.
export function canCraft(
  recipe: CraftingRecipe,
  currentLocationSlug: string | null,
  inventoryNames: string[],
  attributes: AttributeBlock,
  secondaryAttributes: SecondaryAttributeBlock,
  alivio = 0,
): boolean {
  if (recipe.location && currentLocationSlug !== recipe.location) return false;
  const hasIngredients = recipe.ingredientNamePrefixes.every((prefix) => inventoryNames.some((n) => n.startsWith(prefix)));
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

export interface InventoryRowLike {
  id: string;
  name: string;
}

/// Puro: localiza la fila real de cada ingrediente para poder borrarla en la transacción — null
/// si alguno ya no está (no debería pasar justo después de que `canCraft` diera true, pero
/// protege de una carrera entre el chequeo y la resolución sin tocar la base de datos).
export function planCraftConsumption(recipe: CraftingRecipe, rows: InventoryRowLike[]): string[] | null {
  const rowIds: string[] = [];
  for (const prefix of recipe.ingredientNamePrefixes) {
    const row = rows.find((r) => r.name.startsWith(prefix));
    if (!row) return null;
    rowIds.push(row.id);
  }
  return rowIds;
}
