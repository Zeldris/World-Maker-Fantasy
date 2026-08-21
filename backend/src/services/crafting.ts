import { prisma } from '../lib/prisma.js';
import { normalizeText } from './travel.js';
import type { Attribute, AttributeBlock } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';
import { checkRequisitos, type Requisitos, type RequisitoShortfall } from './requisitos.js';
import { totalQuantity, planConsumption, type IngredientRequirement, type CatalogLookup, type InventoryRowLike } from './ingredients.js';
import { alivioForLevel } from './professionProgress.js';
import { matchesOficioPrefix } from './harvestAbilities.js';

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
  /// 'defensa' incluido a propósito (mismo criterio que ItemCatalog/InventoryItem, ver
  /// equipment.ts § effectiveDefense): el peto de gargantúa es armadura, no un arma con uno de
  /// los 6 atributos jugables. Mapa de varios bonus a la vez (2026-08-03, sustituye al par
  /// statBonusAttribute/statBonusAmount) — mismo patrón que `Requisitos`.
  statBonuses?: Partial<Record<Attribute | 'defensa', number>>;
  /// Sesión de diseño 2026-07-23: nivel de rareza/dificultad del objeto (1-5), mínimos de
  /// atributo del PJ para poder craftearlo, y a qué oficio pertenece (id de professions.ts) — el
  /// nivel de ESE oficio alivia el requisito (ver professionProgress.ts), nunca la tirada general.
  tier?: number;
  requisitos?: Requisitos;
  oficio?: string;
  /// Receta bloqueada hasta desbloquearla (2026-08-17, recompensa de misión no-objeto — ver
  /// Quest.rewardRecipeKeys/Save.unlockedRecipeKeys en schema.prisma) — omitido/false = disponible
  /// para cualquiera que cumpla el resto de requisitos, exactamente como todas las recetas de hoy
  /// (ninguna de las 16 existentes lleva `true`, esto no cambia nada de lo que ya funciona). true =
  /// además hace falta `recipe.key` en `Save.unlockedRecipeKeys`.
  requiresUnlock?: boolean;
  /// Pista de narración cuando el jugador lo quiere pero no se puede materializar todavía.
  narrationWant: string;
  /// Pista de narración cuando sí se materializa este turno.
  narrationDo: string;
}

export const AXE_REPAIR_RECIPE: CraftingRecipe = {
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
  statBonuses: { fuerza: 3 },
  // Sesión de diseño 2026-07-23: reforjar el hacha del clan a un arma de tier 3 exige fuerza real
  // (blandirla y guiar al herrero) — oficio 'herrero' porque ocurre en la fragua del campamento.
  tier: 3,
  requisitos: { fuerza: 12 },
  oficio: 'herrero-orco-llanuras',
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

export const GARGANTUA_ARMOR_RECIPE: CraftingRecipe = {
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
  statBonuses: { constitucion: 6 },
  // Sesión de diseño 2026-07-23: montar armadura pesada de placas óseas exige fuerza — mismo
  // oficio 'herrero' que el hacha (misma fragua del campamento, no hace falta un oficio aparte).
  tier: 3,
  requisitos: { fuerza: 18 },
  oficio: 'herrero-orco-llanuras',
  narrationWant:
    'El personaje quiere fabricar un peto de placas óseas de gargantúa, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y tener placas óseas de gargantúa y cuerda de tendón) — narra que lo intenta o lo considera, pero no que lo fabrica de verdad.',
  narrationDo:
    'El personaje fabrica un peto de placas óseas de gargantúa aquí mismo, en el Campamento del Clan Serhu, con placas óseas y cuerda de tendón que lleva encima — narra la escena del montaje con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

export const ANTIDOTE_RECIPE: CraftingRecipe = {
  key: 'antidote',
  verbRegex: /prepar|mezcl|hac|crear|creo/,
  nounRegex: /ant[ií]doto|contraveneno/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 1, label: 'manojo de salvia del polvo' },
    { match: { kind: 'exact', catalogSlug: 'infusion-petalos-flor-ceniza' }, cantidad: 1, label: 'pétalos de Flor de Ceniza' },
  ],
  resultName: 'Contraveneno de salvia y ceniza',
  resultCatalogSlug: 'contraveneno-salvia-ceniza',
  resultDescription: 'Mezcla preparada de salvia del polvo y pétalos de Flor de Ceniza — neutraliza el veneno de Espina del Viento.',
  // Sesión de diseño 2026-07-23: mezclar un contraveneno de verdad exige entender qué se está
  // mezclando — requisito de Inteligencia, no de fuerza física. Oficio 'sanador': encaja con
  // quien ya conoce estas hierbas de antes. (Nota 2026-08-03: Inteligencia es atributo JUGABLE
  // desde el rediseño a 7, no secundario — este comentario decía lo contrario por error histórico,
  // ya corregido; el requisito en sí nunca cambió de comportamiento.)
  // Oficio remapeado (2026-08-09): 'sanador' ya no existe en professions.ts (rediseño por
  // raza+región). Su hueco temático es ahora 'alquimista' (creadora — transforma en pociones/
  // ungüentos lo que 'herborista', la recolectora, recoge; equivalente real de "sanador"), no
  // 'herborista' — se añadió la variante 'alquimista-orcos-llanuras' en professions.ts porque no
  // existía ninguna para orcos de las Llanuras (mismo criterio que herrero/constructor de esta
  // misma receta, pensadas para el Campamento del Clan Serhu).
  tier: 2,
  requisitos: { inteligencia: 8 },
  oficio: 'alquimista-orcos-llanuras',
  narrationWant:
    'El personaje quiere preparar un antídoto, pero no lleva encima salvia del polvo y pétalos de Flor de Ceniza a la vez — narra que lo intenta o lo considera, pero no que lo prepara de verdad.',
  narrationDo: 'El personaje prepara un contraveneno mezclando su salvia del polvo con pétalos de Flor de Ceniza — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Ampliación de lore 2026-08-21 — primer oficio nuevo desde el rediseño de profesiones
// (2026-08-07): cocinero-orco-llanuras. Su NPC-profesor (Maestro Cocinero Serhu, ver
// docs/rpgtarkor/areas.md § Campamento del Clan Serhu) todavía no tiene forma de enseñarlo de
// verdad (mecanismo "aprender oficio de un NPC" sin construir, ver docs/ampliar-lore-checklist.md)
// — igual que 'alquimista-orcos-llanuras', esta receta ya existe aunque el oficio en sí no esté
// en el kit inicial de nadie todavía.
export const BOUNGO_ROAST_RECIPE: CraftingRecipe = {
  key: 'boungoRoast',
  verbRegex: /as|cocin|prepar|tuest/,
  nounRegex: /boungo/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'boungo' }, cantidad: 2, label: 'Boungo' }],
  resultName: 'Boungo asado',
  resultCatalogSlug: 'boungo-asado',
  resultDescription: 'Boungo asado sobre brasas — sencillo, pero la primera receta real del oficio de cocinero-orco-llanuras.',
  tier: 1,
  oficio: 'cocinero-orco-llanuras',
  narrationWant:
    'El personaje quiere asar Boungo, pero no lleva encima al menos 2 setas Boungo — narra que lo intenta o lo considera, pero no que las asa de verdad.',
  narrationDo: 'El personaje asa sus Boungo sobre brasas — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
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
export const IRON_INGOT_RECIPE: CraftingRecipe = {
  key: 'ironIngot',
  verbRegex: /fund|forj|refin|derret/,
  // Excluye "imantado" (2026-08-15, evita ambigüedad con MAGNETIZED_IRON_INGOT_RECIPE de abajo —
  // sin esto, "quiero forjar el lingote de hierro imantado" disparaba las dos recetas a la vez,
  // cada una comprobando sus propios ingredientes por separado).
  nounRegex: /^(?!.*imantad).*(?:lingote.*hierro|hierro.*lingote)/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'mena-hierro-llanuras' }, cantidad: 4, label: 'mena de hierro' }],
  resultName: 'Lingote de hierro',
  resultCatalogSlug: 'lingote-de-hierro',
  resultDescription: 'Metal fundido en la fragua del campamento y colado en un molde sencillo — listo para forjar.',
  tier: 2,
  requisitos: { fuerza: 8 },
  oficio: 'herrero-orco-llanuras',
  narrationWant:
    'El personaje quiere fundir mena de hierro en un lingote, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y llevar al menos 4 fragmentos de mena de hierro) — narra que lo intenta o lo considera, pero no que lo funde de verdad.',
  narrationDo:
    'El personaje funde su mena de hierro en la fragua del campamento, colándola en un molde sencillo hasta que enfría en un lingote — narra la escena (el calor, el fuelle, el metal al rojo) con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

// Tres recetas nuevas (2026-08-15, petición explícita: "estos 3 no deberían ser extraibles sino
// crafteables" — la Aguja de Cardo Brújula y el Saquito de arena imán, que antes salían directos
// de extraer Cardo Brújula/Arena Imán, ver docs de HarvestYield en worldCatalog.ts). La Esquirla
// celeste caída se queda como extracción rara tal cual estaba, no forma parte de este cambio.

// Lingote de hierro imantado — paso intermedio para la Aguja, misma fragua/oficio que el lingote de
// hierro normal (IRON_INGOT_RECIPE), solo que fundido junto a arena imán. `orMatch` (2026-08-15,
// petición explícita: "el saquito... sirve como si fueran 4 montones de imán pero ocupando solo 1
// slot") — 4 Puñado de arena imán o, más cómodo, 1 Saquito de arena imán ya crafteado.
export const MAGNETIZED_IRON_INGOT_RECIPE: CraftingRecipe = {
  key: 'magnetizedIronIngot',
  verbRegex: /fund|forj|refin|derret/,
  nounRegex: /lingote.*imantad|imantad.*lingote|hierro imantado/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'mena-hierro-llanuras' }, cantidad: 1, label: 'mena de hierro' },
    {
      match: { kind: 'exact', catalogSlug: 'punado-arena-iman' },
      cantidad: 4,
      label: 'puñado de arena imán',
      orMatch: { match: { kind: 'exact', catalogSlug: 'saquito-arena-iman' }, unitsPerMatch: 4 },
    },
  ],
  resultName: 'Lingote de hierro imantado',
  resultCatalogSlug: 'lingote-hierro-imantado',
  resultDescription: 'Mena de hierro fundida junto a arena imán en la fragua del campamento — conserva un tirón magnético débil pero constante.',
  tier: 2,
  requisitos: { fuerza: 8 },
  oficio: 'herrero-orco-llanuras',
  narrationWant:
    'El personaje quiere fundir un lingote de hierro imantado, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu, llevar mena de hierro y 4 puñados de arena imán —o un saquito ya hecho— encima) — narra que lo intenta o lo considera, pero no que lo funde de verdad.',
  narrationDo:
    'El personaje funde su mena de hierro junto a la arena imán en la fragua del campamento, colándola en un molde sencillo — narra la escena (el calor, el tirón magnético al enfriar) con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

// Aguja de Cardo Brújula — 2 Cardo Brújula + 1 Lingote de hierro imantado, misma fragua/oficio que
// el lingote (petición explícita confirmada, 2026-08-15: trabajo de precisión sobre metal, no
// alquimia). Antes salía directa de extraer Cardo Brújula; ahora la extracción solo da la planta en
// bruto (ver HarvestYield 'cardo-brujula' en worldCatalog.ts).
export const COMPASS_NEEDLE_RECIPE: CraftingRecipe = {
  key: 'compassNeedle',
  verbRegex: /forj|fabric|monta|tall|crear|creo/,
  nounRegex: /aguja.*cardo|cardo.*aguja|aguja.*brujula|brujula.*aguja/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'cardo-brujula' }, cantidad: 2, label: 'Cardo Brújula' },
    { match: { kind: 'exact', catalogSlug: 'lingote-hierro-imantado' }, cantidad: 1, label: 'lingote de hierro imantado' },
  ],
  resultName: 'Aguja de Cardo Brújula',
  resultCatalogSlug: 'aguja-cardo-brujula',
  resultDescription: 'Aguja imantada natural montada a mano en la fragua del campamento: colgada de un hilo señala siempre el mismo rumbo, incluso en plena tormenta.',
  tier: 2,
  requisitos: { destreza: 8 },
  oficio: 'herrero-orco-llanuras',
  narrationWant:
    'El personaje quiere forjar una Aguja de Cardo Brújula, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y llevar 2 Cardo Brújula y un lingote de hierro imantado encima) — narra que lo intenta o lo considera, pero no que la forja de verdad.',
  narrationDo:
    'El personaje monta la Aguja de Cardo Brújula en la fragua del campamento, tallando el cardo alrededor del lingote imantado hasta dejarla colgada de un hilo — narra la escena con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

// Saquito de arena imán — oficio de peletería (petición explícita, 2026-08-15: "el saquito se hace
// con peletería de los orcos de las llanuras" → curtidor-orcos-llanuras, el oficio real de
// peletería). Ingrediente de cuero por CATEGORÍA (no exacto): no existe un "Cuero" genérico en el
// catálogo, cualquier piel en bruto sirve (mismo criterio que STONE_BLOCK_RECIPE con "piedra").
export const SAND_POUCH_RECIPE: CraftingRecipe = {
  key: 'sandPouch',
  verbRegex: /cos[eo]|confeccion|fabric|prepar|crear|creo/,
  nounRegex: /saquito.*aren|aren.*saquito|saquito imant/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 1, label: 'piel curtida' },
    { match: { kind: 'exact', catalogSlug: 'punado-arena-iman' }, cantidad: 2, label: 'puñado de arena imán' },
  ],
  resultName: 'Saquito de arena imán',
  resultCatalogSlug: 'saquito-arena-iman',
  resultDescription: 'Saquito de cuero curtido cosido a mano y relleno de arena imán — los herreros goirntes pagan bien por uno.',
  tier: 1,
  requisitos: { destreza: 6 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere coser un saquito de arena imán, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y llevar una piel curtida y 2 puñados de arena imán encima) — narra que lo intenta o lo considera, pero no que lo cose de verdad.',
  narrationDo:
    'El personaje cose el saquito de cuero curtido y lo rellena con su arena imán aquí mismo, en el Campamento del Clan Serhu — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Receta de refinado nueva (2026-07-29, petición explícita, ejemplo dado por la usuaria:
// "transformar piedra en bloques de construcción") — oficio 'carpintero' (mismo oficio que
// CHOZA_RECIPE, "construye con lo que hay a mano"; ninguna de las 8 profesiones es literalmente
// "cantero", carpintero es la que mejor encaja narrativamente). Ingrediente por CATEGORÍA (no
// exacto): cualquier piedra en bruto sirve, a diferencia del lingote de hierro (mena específica).
export const STONE_BLOCK_RECIPE: CraftingRecipe = {
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
  oficio: 'constructor-orcos-llanuras',
  narrationWant:
    'El personaje quiere tallar piedra en bloques, pero no lleva encima suficiente piedra en bruto para hacerlo (hacen falta al menos 5 piedras) — narra que lo intenta o lo considera, pero no que talla los bloques de verdad.',
  narrationDo:
    'El personaje talla su piedra en bloques a golpes de maza y cincel, desbastando cada cara hasta dejarla plana — narra la escena (el polvo, el ritmo del golpe, las esquirlas saltando) con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Primeros auxilios (2026-08-13, petición explícita: "una profesión que sea primeros-auxilios que
// tenga pocas recetas de objetos básicos... si es convaleciente solo hay un item que te lleva a
// grave... luego otro que mejora al siguiente, de grave a herido y de herido a ileso") — oficio
// nuevo 'primeros-auxilios-orcos-llanuras' (distinto de 'alquimista', reservado para objetos
// mejores más adelante). Los 3 objetos de condición usan `curaUnPaso: true` (ver ItemCatalog/
// healCeilingFor) — cada uno solo sube UN escalón desde donde esté el jugador, nunca de golpe
// hasta su curaHasta. Deliberadamente MÁS débiles que la materia prima sin craftear (manojo-
// salvia-polvo/petalos-flor-ceniza YA curan HERIDO/GRAVE de golpe en crudo) — esta profesión
// existe por el escalón final (HERIDO→ILESO, tier 3, el único punto que la materia prima sola
// nunca alcanza), no para competir con ella en los tramos bajos.
export const FIRST_AID_BANDAGE_RECIPE: CraftingRecipe = {
  key: 'firstAidBandage',
  verbRegex: /prepar|at[ao]|venda|hac|crear|creo/,
  nounRegex: /vendaje/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 1, label: 'manojo de salvia del polvo' }],
  resultName: 'Vendaje improvisado',
  resultCatalogSlug: 'vendaje-improvisado-orcos-llanuras',
  resultDescription: 'Tiras de tela atadas sobre un manojo machacado de salvia del polvo — primeros auxilios de campaña, lo justo para dejar de desangrarse.',
  tier: 1,
  oficio: 'primeros-auxilios-orcos-llanuras',
  narrationWant:
    'El personaje quiere atar un vendaje improvisado, pero no lleva encima ningún manojo de salvia del polvo — narra que lo intenta o lo considera, pero no que lo prepara de verdad.',
  narrationDo:
    'El personaje machaca su manojo de salvia del polvo y lo ata sobre la herida con tiras de tela — narra la escena con naturalidad, sin prometer más curación de la justa. El objeto ya se gestiona automáticamente por el backend.',
};

export const RED_SPIKE_INFUSION_RECIPE: CraftingRecipe = {
  key: 'redSpikeInfusion',
  verbRegex: /prepar|hierv|infusion|hac|crear|creo/,
  nounRegex: /infusi[oó]n.*espiga|espiga.*infusi[oó]n/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'grano-espiga-roja' }, cantidad: 2, label: 'grano de espiga roja' }],
  resultName: 'Infusión de espiga roja',
  resultCatalogSlug: 'infusion-espiga-roja',
  resultDescription: 'Grano de espiga roja tostado e infusionado en agua hirviendo — más nutritiva que el grano crudo, prepara para seguir adelante.',
  tier: 1,
  oficio: 'primeros-auxilios-orcos-llanuras',
  narrationWant:
    'El personaje quiere preparar una infusión de espiga roja, pero no lleva encima suficiente grano de espiga roja (hacen falta al menos 2) — narra que lo intenta o lo considera, pero no que la prepara de verdad.',
  narrationDo:
    'El personaje tuesta e infusiona su grano de espiga roja en agua hirviendo — narra la escena (el olor tostado, el vapor) con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const BASIC_POULTICE_RECIPE: CraftingRecipe = {
  key: 'basicPoultice',
  verbRegex: /prepar|machac|hac|crear|creo/,
  nounRegex: /cataplasma b[aá]sica/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 1, label: 'manojo de salvia del polvo' },
    { match: { kind: 'exact', catalogSlug: 'infusion-petalos-flor-ceniza' }, cantidad: 1, label: 'pétalos de Flor de Ceniza' },
  ],
  resultName: 'Cataplasma básica de salvia',
  resultCatalogSlug: 'cataplasma-basica-salvia',
  resultDescription: 'Salvia del polvo y pétalos de Flor de Ceniza machacados juntos en una pasta simple — cura mejor que el vendaje improvisado, pero sigue siendo primeros auxilios de campaña.',
  tier: 2,
  oficio: 'primeros-auxilios-orcos-llanuras',
  narrationWant:
    'El personaje quiere preparar una cataplasma básica de salvia, pero no lleva encima manojo de salvia del polvo y pétalos de Flor de Ceniza a la vez — narra que lo intenta o lo considera, pero no que la prepara de verdad.',
  narrationDo:
    'El personaje machaca juntos su manojo de salvia del polvo y sus pétalos de Flor de Ceniza hasta formar una pasta — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const COMPLETE_POULTICE_RECIPE: CraftingRecipe = {
  key: 'completePoultice',
  verbRegex: /prepar|machac|hac|crear|creo/,
  nounRegex: /cataplasma completa/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 2, label: 'manojo de salvia del polvo' },
    { match: { kind: 'exact', catalogSlug: 'infusion-petalos-flor-ceniza' }, cantidad: 1, label: 'pétalos de Flor de Ceniza' },
  ],
  resultName: 'Cataplasma completa de salvia y ceniza',
  resultCatalogSlug: 'cataplasma-completa-salvia-ceniza',
  resultDescription: 'La preparación más cuidada de primeros auxilios que se puede hacer en campaña — doble ración de salvia del polvo y pétalos de Flor de Ceniza, machacados y aplicados con calma. Cierra hasta la última herida.',
  // La receta final de la profesión (2026-08-13, petición explícita: "la última receta que se
  // aprende es la que cura de herido a ileso") — tier 3, el más alto de las 4 recetas nuevas, así
  // que hace falta subir la profesión practicando las otras 3 antes de poder craftearla.
  tier: 3,
  oficio: 'primeros-auxilios-orcos-llanuras',
  narrationWant:
    'El personaje quiere preparar una cataplasma completa de salvia y ceniza, pero no lleva encima suficiente manojo de salvia del polvo (hacen falta 2) y pétalos de Flor de Ceniza a la vez — narra que lo intenta o lo considera, pero no que la prepara de verdad.',
  narrationDo:
    'El personaje machaca con calma su doble ración de salvia del polvo junto a sus pétalos de Flor de Ceniza, aplicando la cataplasma con el cuidado que merece una cura completa — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Garrote de matorral de cuerno (auditoría de catálogo, 2026-08-13: el objeto existía en
// ItemCatalog, tier 1, "la primera arma para quien no tiene ninguna" — pero nunca tenía ninguna
// vía real para llegar a manos del jugador). Oficio 'carpintero' (mismo oficio que la choza/bloque
// de piedra tallada — trabajar madera con las manos), sin requisitos ni tier de crafteo: es
// deliberadamente la opción más básica, coherente con ser "la primera arma".
export const CLUB_RECIPE: CraftingRecipe = {
  key: 'club',
  verbRegex: /tall|fabric|prepar|hac|crear|creo/,
  nounRegex: /garrote/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'lena-matorral-cuerno' }, cantidad: 2, label: 'leña de matorral de cuerno' }],
  resultName: 'Garrote de matorral de cuerno',
  resultCatalogSlug: 'garrote-matorral-cuerno',
  resultDescription: 'Madera densa y retorcida, tallada a mano — la primera arma para quien no tiene ninguna.',
  oficio: 'carpintero-orcos-llanuras',
  narrationWant:
    'El personaje quiere tallar un garrote de matorral de cuerno, pero no lleva encima suficiente leña de matorral de cuerno (hacen falta al menos 2) — narra que lo intenta o lo considera, pero no que lo talla de verdad.',
  narrationDo:
    'El personaje talla a mano un garrote con su leña de matorral de cuerno, retorcida y densa — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Faldar de piel de gargantúa (auditoría de catálogo, 2026-08-13: mismo hueco que el garrote —
// existía en ItemCatalog, hermano de `capa-piel-gargantua`/`peto-placas-gargantua`, sin ninguna
// vía real de conseguirlo). Mismo oficio/ubicación que el peto de placas óseas (curtir piel de
// gargantúa en el campamento del clan) — a diferencia del peto (herrero, huesos+tendón), aquí es
// trabajo de curtidor sobre la propia piel.
export const GARGANTUA_LEG_ARMOR_RECIPE: CraftingRecipe = {
  key: 'gargantuaLegArmor',
  verbRegex: /confeccion|cos[eo]|curt|prepar|fabric|crear|creo/,
  nounRegex: /faldar/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'piel-gargantua' }, cantidad: 2, label: 'piel de gargantúa' }],
  resultName: 'Faldar de piel de gargantúa',
  resultCatalogSlug: 'faldar-piel-gargantua',
  resultDescription: 'Faldar de piel gris ceniza de gargantúa, con pequeñas placas óseas todavía cosidas al cuero — abrigo, no defensa.',
  tier: 2,
  requisitos: { destreza: 8 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere confeccionar un faldar de piel de gargantúa, pero no lleva encima suficiente piel de gargantúa (hacen falta al menos 2) y además hace falta estar en el Campamento del Clan Serhu — narra que lo intenta o lo considera, pero no que lo confecciona de verdad.',
  narrationDo:
    'El personaje curte y cose su piel de gargantúa aquí mismo, en el Campamento del Clan Serhu, dejando las placas óseas pequeñas cosidas al cuero — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  AXE_REPAIR_RECIPE,
  SMOKE_MEAT_RECIPE,
  GARGANTUA_ARMOR_RECIPE,
  ANTIDOTE_RECIPE,
  FIELD_TORCH_RECIPE,
  IRON_INGOT_RECIPE,
  MAGNETIZED_IRON_INGOT_RECIPE,
  COMPASS_NEEDLE_RECIPE,
  SAND_POUCH_RECIPE,
  STONE_BLOCK_RECIPE,
  FIRST_AID_BANDAGE_RECIPE,
  RED_SPIKE_INFUSION_RECIPE,
  BASIC_POULTICE_RECIPE,
  COMPLETE_POULTICE_RECIPE,
  CLUB_RECIPE,
  GARGANTUA_LEG_ARMOR_RECIPE,
  BOUNGO_ROAST_RECIPE,
];

export function detectsCraftIntent(recipe: CraftingRecipe, action: string): boolean {
  const normalized = normalizeText(action);
  return recipe.verbRegex.test(normalized) && recipe.nounRegex.test(normalized);
}

/// Espera REAL (no de ficción) de craftear, según `tier` (petición explícita, 2026-08-20: "que
/// lleve un tiempo real... dependiendo de la dificultad del crafteo le asignamos un valor entre 5
/// segs y 60 segs") — `tier` (1-5, "nivel de rareza/dificultad") es el único campo de dificultad
/// ya tabulado; recetas sin `tier` (ej. SMOKE_MEAT_RECIPE, "habilidad de supervivencia básica")
/// caen al mínimo.
const CRAFT_TIER_DURATION_SECONDS: Record<number, number> = { 1: 5, 2: 20, 3: 35, 4: 50, 5: 60 };
export function craftDurationSecondsFor(recipe: CraftingRecipe): number {
  return CRAFT_TIER_DURATION_SECONDS[recipe.tier ?? 1] ?? 5;
}

/// Precheck barato, de solo lectura, callable ANTES de montar todo lo que `narrateAndPersistTurn`
/// necesita para un turno completo (petición explícita, 2026-08-20: espera real con barra de
/// "estás crafteando" + cancelar, igual que los viajes) — `turn.ts` lo usa para decidir, en el
/// mismo sitio donde ya decide si un viaje necesita convertirse en `CharacterTransit`, si esta
/// acción es un crafteo determinista de verdad y cuánto debería tardar. Monta `catalogBySlug`/
/// `alivioFor` con el MISMO criterio exacto que `narrateAndPersistTurn` (turnResolution.ts) ya usa
/// para lo mismo — reimplementado aquí en vez de exportado de allí porque ese archivo monta mucho
/// más contexto (misiones, compañeros, NPCs en escena...) que este precheck no necesita.
export async function detectDeterministicCraft(params: {
  action: string;
  worldId: string;
  saveId: string;
  currentLocationSlug: string | null;
  inventoryRows: InventoryRowLike[];
  attributes: AttributeBlock;
  secondaryAttributes: SecondaryAttributeBlock;
  unlockedRecipeKeys: string[];
}): Promise<{ recipeKeys: string[]; resultNames: string[]; durationSeconds: number } | null> {
  const { action, worldId, saveId, currentLocationSlug, inventoryRows, attributes, secondaryAttributes, unlockedRecipeKeys } = params;
  const catalogSlugs = [...new Set(inventoryRows.map((i) => i.catalogSlug).filter((s): s is string => Boolean(s)))];
  const [catalogRows, professionProgressRows] = await Promise.all([
    catalogSlugs.length
      ? prisma.itemCatalog.findMany({
          where: { worldId, slug: { in: catalogSlugs } },
          select: {
            slug: true,
            tipo: true,
            category: true,
            curaHasta: true,
            curaUnPaso: true,
            tipoArma: true,
            curaEnergia: true,
            equipSlot: true,
            effectKey: true,
            aliases: true,
            herramientaParaOficio: true,
          },
        })
      : Promise.resolve([]),
    prisma.professionProgress.findMany({ where: { saveId } }),
  ]);
  const catalogBySlug: Map<string, CatalogLookup> = new Map(
    catalogRows.map((c) => [
      c.slug,
      {
        tipo: c.tipo,
        category: c.category,
        curaHasta: c.curaHasta,
        curaUnPaso: c.curaUnPaso,
        tipoArma: c.tipoArma,
        curaEnergia: c.curaEnergia,
        equipSlot: c.equipSlot,
        effectKey: c.effectKey,
        aliases: c.aliases,
        herramientaParaOficio: c.herramientaParaOficio,
      },
    ]),
  );
  const oficioNivelById = new Map(professionProgressRows.map((p) => [p.professionId, p.nivel]));
  const alivioFor = (oficio: string | undefined) => (oficio ? alivioForLevel(oficioNivelById.get(oficio) ?? 1) : 0);

  const fired = CRAFTING_RECIPES.filter(
    (recipe) =>
      detectsCraftIntent(recipe, action) &&
      canCraft(recipe, currentLocationSlug, inventoryRows, catalogBySlug, attributes, secondaryAttributes, alivioFor(recipe.oficio), unlockedRecipeKeys),
  );
  if (fired.length === 0) return null;
  return {
    recipeKeys: fired.map((r) => r.key),
    resultNames: fired.map((r) => r.resultName),
    durationSeconds: Math.max(...fired.map(craftDurationSecondsFor)),
  };
}

/// Oficios (prefijo sin raza/región) que de verdad tienen alguna herramienta dada de alta en el
/// catálogo (2026-08-17, ver ItemCatalog.herramientaParaOficio en schema.prisma) — solo estos
/// bloquean por falta de herramienta; el resto de oficios (herrería, minería, tala, carpintería,
/// construcción, herboristería...) se quedan exactamente como antes, sin gate, hasta que también
/// tengan una herramienta real registrada. Evita que añadir el campo deje sin querer inutilizables
/// oficios que hoy funcionan sin ninguna herramienta física.
export const OFICIOS_CON_HERRAMIENTA_REQUERIDA = ['curtidor', 'desollador'];

/// Puro: ¿tiene el personaje, en las filas de inventario dadas, algún objeto marcado como
/// herramienta para este oficio? Solo relevante si `oficio` está en
/// `OFICIOS_CON_HERRAMIENTA_REQUERIDA` — para el resto, se considera siempre cumplido (llamarlo de
/// todos modos no hace daño, pero el caller ya filtra por esa lista antes).
export function hasToolForOficio(oficio: string, rows: InventoryRowLike[], catalogBySlug: Map<string, CatalogLookup>): boolean {
  return rows.some((row) => {
    const info = row.catalogSlug ? catalogBySlug.get(row.catalogSlug) : undefined;
    return !!info?.herramientaParaOficio?.some((prefix) => matchesOficioPrefix(oficio, prefix));
  });
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
  // Recetas desbloqueables por misión (2026-08-17) — trailing y con default `[]` a propósito: no
  // rompe ningún caller existente, y ninguna receta de hoy lleva `requiresUnlock`, así que ni
  // siquiera hace falta pasarlo salvo que de verdad se use.
  unlockedRecipeKeys: string[] = [],
): boolean {
  if (recipe.location && currentLocationSlug !== recipe.location) return false;
  if (recipe.requiresUnlock && !unlockedRecipeKeys.includes(recipe.key)) return false;
  const hasIngredients = recipe.ingredients.every((ing) => totalQuantity(rows, ing, catalogBySlug) >= ing.cantidad);
  if (!hasIngredients) return false;
  if (recipe.oficio && OFICIOS_CON_HERRAMIENTA_REQUERIDA.some((p) => matchesOficioPrefix(recipe.oficio!, p)) && !hasToolForOficio(recipe.oficio, rows, catalogBySlug)) {
    return false;
  }
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
