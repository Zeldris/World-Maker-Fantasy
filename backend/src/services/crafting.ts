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
  /// Slug de ubicación requerido, varios slugs válidos, o null si se puede craftear en cualquier
  /// sitio. Array añadido con el hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06, "recoger
  /// agua" solo en una zona con agua — 3 Locations distintas, no una sola) — el string único
  /// original se queda intacto para las 51 recetas ya existentes.
  location: string | string[] | null;
  ingredients: IngredientRequirement[];
  resultName: string;
  resultDescription: string;
  /// Cuántas unidades del resultado produce ESTE crafteo de una vez (2026-08-30, primer caso real:
  /// "un herrero con fragua puede fundir las Garras de Kirelon directo en 2 Lingotes de Yerreo",
  /// petición explícita: "la idea era que las garras... una receta que te permite convertirlas en
  /// 2 lingotes"). Opcional, default 1 (todas las recetas anteriores dan exactamente 1 unidad) —
  /// mismo formato de sufijo `(N)` que ya usa el resto del inventario apilable
  /// (`baseNameOf`/`quantityOf`, ingredients.ts), nunca N filas separadas.
  resultCantidad?: number;
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
  oficio: 'herrero-orcos-llanuras',
  narrationWant:
    'El personaje quiere reparar su hacha rota, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y tener sal de trueque para pagar al herrero) — narra que lo intenta o lo considera, pero no que la repara de verdad.',
  narrationDo:
    'El personaje repara su hacha rota aquí mismo, en el Campamento del Clan Serhu, a cambio de sal de trueque — narra la escena de la reparación (el herrero, el gesto de volver al campamento del clan) con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

const SMOKE_MEAT_RECIPE: CraftingRecipe = {
  key: 'smokeMeat',
  verbRegex: /ahum|crear|creo/,
  // Sin pisar el Guiso de Múrgol, el Asado de las Llanuras ni la carne de Jusha (QA-16).
  nounRegex: /^(?!.*(guiso|asado|jusha)).*carne/,
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
  // Rebalanceo (decisión de Álvaro, 2026-09-29): mismo bonus que el catálogo (peto-placas-gargantua),
  // PESADO = Fuerza+Constitución, total +7 (antes Con 6 en la receta, desalineado del catálogo).
  statBonuses: { fuerza: 3, constitucion: 4 },
  // Sesión de diseño 2026-07-23: montar armadura pesada de placas óseas exige fuerza — mismo
  // oficio 'herrero' que el hacha (misma fragua del campamento, no hace falta un oficio aparte).
  tier: 3,
  requisitos: { fuerza: 18 },
  oficio: 'herrero-orcos-llanuras',
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
// (2026-08-07): cocinero-orcos-llanuras. Su NPC-profesor (Maestro Cocinero Serhu, ver
// docs/rpgtarkor/lore-mundo/areas.md § Campamento del Clan Serhu) todavía no tiene forma de enseñarlo de
// verdad (mecanismo "aprender oficio de un NPC" sin construir, ver docs/registros/ampliar-lore-checklist.md)
// — igual que 'alquimista-orcos-llanuras', esta receta ya existe aunque el oficio en sí no esté
// en el kit inicial de nadie todavía.
export const BOUNGO_ROAST_RECIPE: CraftingRecipe = {
  key: 'boungoRoast',
  verbRegex: /as|cocin|prepar|tuest/,
  nounRegex: /^(?!.*llanura).*boungo/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'boungo' }, cantidad: 2, label: 'Boungo' }],
  resultName: 'Boungo asado',
  resultCatalogSlug: 'boungo-asado',
  resultDescription: 'Boungo asado sobre brasas — sencillo, pero la primera receta real del oficio de cocinero-orcos-llanuras.',
  tier: 1,
  oficio: 'cocinero-orcos-llanuras',
  narrationWant:
    'El personaje quiere asar Boungo, pero no lleva encima al menos 2 setas Boungo — narra que lo intenta o lo considera, pero no que las asa de verdad.',
  narrationDo: 'El personaje asa sus Boungo sobre brasas — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Auditoría "revisar partida" (2026-08-30, petición explícita: "Agua hervida de liquen debería ser
// un objeto crafteable, no un recurso") — antes vivía como HarvestYield directo (EXTRACCION) con
// una `condicion` de texto libre ("requiere hervirlo sobre fuego ya encendido") que NUNCA se
// verificaba mecánicamente — recolectar en la zona daba el agua YA hervida sin ningún gate real,
// pese a que su propia `description` de catálogo ("hervido sobre fuego") ya admitía que no es un
// recurso crudo. Ahora es una receta real: Liquen húmedo del cauce (sí crudo, sigue siendo
// HarvestYield) + hervirlo, sin ubicación fija (hervir agua no exige una fragua ni un campamento
// concreto). Oficio cocinero añadido (corregido 2026-08-31, "revisar cocina") — el comentario
// original decía "mismo patrón que BOUNGO_ROAST_RECIPE (sin oficio)", pero esa receta SÍ lo lleva;
// mismo criterio real que Boungo/Pan de trigo/Panal/Cuajada: preparación de comida/bebida real del
// clan, no pura supervivencia genérica como ahumar carne cruda sobre cualquier fuego.
export const BOILED_LICHEN_WATER_RECIPE: CraftingRecipe = {
  key: 'boiledLichenWater',
  verbRegex: /herv|hierv|cocin|prepar/,
  nounRegex: /liquen|agua/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'liquen-humedo' }, cantidad: 1, label: 'Liquen húmedo del cauce' }],
  resultName: 'Agua hervida de liquen',
  resultCatalogSlug: 'agua-hervida-liquen',
  resultDescription: 'Liquen húmedo del cauce hervido sobre fuego — más segura de beber que masticarlo en crudo.',
  tier: 1,
  oficio: 'cocinero-orcos-llanuras',
  narrationWant:
    'El personaje quiere hervir agua con liquen, pero no lleva encima al menos 1 Liquen húmedo del cauce (o no tiene fuego encendido cerca) — narra que lo intenta o lo considera, pero no que la hierve de verdad.',
  narrationDo: 'El personaje hierve su Liquen húmedo del cauce sobre el fuego — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const CORACELO_MACE_RECIPE: CraftingRecipe = {
  key: 'coraceloMace',
  verbRegex: /forj|fabric|monta|crear|creo/,
  nounRegex: /maza/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'cola-coracelo' }, cantidad: 1, label: 'cola de Coracelo' }],
  resultName: 'Maza de Coracelo',
  resultCatalogSlug: 'maza-coracelo',
  resultDescription: 'Maza corta rematada con el bulto de escamas de la cola de un Coracelo, remachada a un mango de madera en la fragua del campamento.',
  statBonuses: { fuerza: 2, constitucion: 1 },
  // Sesión de lore 2026-08-22 (La Sabana Alta): la cola del Coracelo es "dura como el hierro" —
  // mismo oficio 'herrero' que el resto de armamento orco tosco (maza-orca, hacha reforjada),
  // requiere fragua real, no crafteo de campo.
  tier: 3,
  requisitos: { fuerza: 9, destreza: 5, constitucion: 5 },
  oficio: 'herrero-orcos-llanuras',
  narrationWant:
    'El personaje quiere forjar una maza con la cola de un Coracelo, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y tener al menos una cola de Coracelo) — narra que lo intenta o lo considera, pero no que la forja de verdad.',
  narrationDo:
    'El personaje forja una Maza de Coracelo aquí mismo, en el Campamento del Clan Serhu, remachando el bulto de escamas de la cola a un mango de madera — narra la escena con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
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
  oficio: 'herrero-orcos-llanuras',
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
  oficio: 'herrero-orcos-llanuras',
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
  oficio: 'herrero-orcos-llanuras',
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

// Odre de agua (hallazgo 13, revisar-partida-hallazgos.md 2026-09-06, "se craftea con peletería
// T1") — mismo oficio/tier/requisito de destreza que SAND_POUCH_RECIPE (misma familia de trabajo
// con cuero), sin gate de ubicación: el odre VACÍO se cose en cualquier sitio, la condición de
// zona con agua solo aplica a llenarlo (RECOGER_AGUA_RECIPE, justo abajo).
export const ODRE_AGUA_RECIPE: CraftingRecipe = {
  key: 'odreAgua',
  verbRegex: /cos[eo]|confeccion|fabric|prepar|crear|creo/,
  nounRegex: /odre/,
  location: null,
  ingredients: [{ match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 1, label: 'piel curtida' }],
  resultName: 'Odre de agua',
  resultCatalogSlug: 'odre-agua',
  resultDescription: 'Odre de cuero curtido cosido a mano, correa larga para llevar al hombro — imprescindible en la estepa, vacío hasta que se llena en una fuente real.',
  tier: 1,
  requisitos: { destreza: 6 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere coser un odre de agua, pero no puede hacerlo ahora mismo (hace falta llevar una piel curtida encima) — narra que lo intenta o lo considera, pero no que lo cose de verdad.',
  narrationDo:
    'El personaje cose el odre de cuero curtido a mano, dejándolo listo pero vacío — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Recoger agua (hallazgo 13) — llena un odre vacío ya craftado, SOLO en una zona con agua real de
// verdad (los 3 puntos de agua permanentes/estacionales del catálogo, worldCatalog.ts: Los
// Manaderos, El Pozo de Cauce Viejo, El Oasis de Chudos Rojos — `Location.kind` incluye 'punto de
// agua' en los 3, pero se lista por slug explícito en vez de leer ese campo en vivo, decisión
// explícita de la usuaria). Sin `oficio`/`tier`/`requisitos`: no es un oficio, es una acción
// simple de recoger algo que ya está ahí — cae al fallback de duración `CRAFT_TIER_DURATION_SECONDS[1]`
// = 5 segundos reales, la espera mínima ya existente del sistema (ver craftDurationSecondsFor más
// abajo), suficiente para sustituir al viejo botón fijo "Beber agua" sin inventar un camino nuevo.
// Puntos de agua real del mundo: donde se llena el odre (RECOGER_AGUA_RECIPE) y donde se puede
// beber directamente sin llevar nada (QA-27 P39, `bebeDeLaFuente`).
export const PUNTOS_DE_AGUA: readonly string[] = ['manaderos', 'pozo-cauce-viejo', 'oasis-de-chudos-rojos'];

// QA-27 P39: beber de la fuente sin odre. Solo cuenta si la acción pide beber agua del sitio (no
// de un recipiente) y el personaje está en un punto de agua real.
export function bebeDeLaFuente(action: string, locationSlug: string | null | undefined): boolean {
  if (!locationSlug || !PUNTOS_DE_AGUA.includes(locationSlug)) return false;
  const t = action.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/\bbeb/.test(t)) return false;
  if (/\b(odre|cantimplora|botella|frasco|vino|cerveza|pocion)/.test(t)) return false;
  return /\b(agua|fuente|manantial|manadero|pozo|oasis|charca|arroyo|cauce)/.test(t);
}

/// La acción es solo beber (una frase sin «y», «luego»…): se narra sin el modelo. Si hace algo
/// más, bebe igual, pero el narrador cuenta el turno entero.
export function soloBebeDeLaFuente(action: string): boolean {
  const t = action.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return !/[,;]|\b(y|e|luego|despues|mientras|tras|antes)\b/.test(t.replace(/[.!]+\s*$/, ''));
}

export const RECOGER_AGUA_RECIPE: CraftingRecipe = {
  key: 'recogerAgua',
  verbRegex: /recoj|recog|llen|lleve/,
  nounRegex: /agua/,
  location: [...PUNTOS_DE_AGUA],
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'odre-agua' }, cantidad: 1, label: 'odre de agua vacío' }],
  resultName: 'Odre de agua lleno',
  resultCatalogSlug: 'odre-agua-lleno',
  resultDescription: 'El mismo odre de cuero curtido, lleno hasta el tapón — listo para beber.',
  narrationWant:
    'El personaje quiere recoger agua, pero no puede hacerlo ahora mismo (hace falta estar en una fuente de agua real y llevar un odre vacío encima) — narra que lo intenta o lo considera, pero no que lo llena de verdad.',
  narrationDo:
    'El personaje se agacha junto al agua y llena el odre hasta el tapón — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
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

// 3 recetas de refinado nuevas (2026-08-24, Grupo 3 § materiales procesados de construcción, ver
// docs/mecanicas/17-reglas-construcciones-reino.md) — mismo patrón que STONE_BLOCK_RECIPE
// arriba (ingrediente por CATEGORÍA, no exacto: cualquier leña/hueso/fibra en bruto sirve),
// consumidas por primera vez por el Ayuntamiento mediano/grande (construction.ts).

export const WOOD_BEAM_RECIPE: CraftingRecipe = {
  key: 'woodBeam',
  verbRegex: /tall|labr|escuadr|desbast|fabric|prepar/,
  nounRegex: /viga.*madera|madera.*viga|viga.*tallad|tallad.*viga/,
  location: null,
  ingredients: [{ match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 4, label: 'leña' }],
  resultName: 'Viga de madera tallada',
  resultCatalogSlug: 'viga-madera-tallada',
  resultDescription: 'Tronco desbastado y escuadrado en una viga recta de sección uniforme — lista para sostener un techo o un muro de verdad.',
  tier: 1,
  requisitos: { destreza: 6 },
  oficio: 'carpintero-orcos-llanuras',
  narrationWant:
    'El personaje quiere tallar leña en una viga de madera, pero no lleva encima suficiente leña en bruto para hacerlo (hacen falta al menos 4) — narra que lo intenta o lo considera, pero no que talla la viga de verdad.',
  narrationDo:
    'El personaje escuadra su leña en una viga recta a golpes de hacha y azuela, desbastando cada cara hasta dejarla plana — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const BONE_COLUMN_RECIPE: CraftingRecipe = {
  key: 'boneColumn',
  verbRegex: /tall|labr|trab|fabric|prepar/,
  nounRegex: /columna.*hueso|hueso.*columna/,
  location: null,
  ingredients: [{ match: { kind: 'category', tipo: 'RECURSO', category: 'hueso' }, cantidad: 3, label: 'hueso' }],
  resultName: 'Columna de hueso',
  resultCatalogSlug: 'columna-hueso',
  resultDescription: 'Varios huesos largos trabados y reforzados en un único puntal rígido — técnica orca de aprovechar lo que caza la propia tierra.',
  tier: 1,
  requisitos: { fuerza: 6 },
  oficio: 'constructor-orcos-llanuras',
  narrationWant:
    'El personaje quiere trabar hueso en una columna, pero no lleva encima suficiente hueso en bruto para hacerlo (hacen falta al menos 3) — narra que lo intenta o lo considera, pero no que la columna queda terminada.',
  narrationDo:
    'El personaje traba varios huesos largos entre sí hasta dejarlos rígidos como un único puntal — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const BRAIDED_CORDAGE_RECIPE: CraftingRecipe = {
  key: 'braidedCordage',
  verbRegex: /trenz|tej|fabric|prepar/,
  nounRegex: /cordaje|cuerda.*trenzad|trenzad.*cuerda/,
  location: null,
  ingredients: [{ match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 4, label: 'fibra' }],
  resultName: 'Cordaje trenzado',
  resultCatalogSlug: 'cordaje-trenzado',
  resultDescription: 'Fibra vegetal trenzada en cabos gruesos y resistentes — ata vigas, tensa pieles de techo, asegura lo que un edificio grande no puede confiar solo al peso.',
  tier: 1,
  requisitos: { destreza: 6 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere trenzar fibra en cordaje, pero no lleva encima suficiente fibra en bruto para hacerlo (hacen falta al menos 4) — narra que lo intenta o lo considera, pero no que el cordaje queda terminado.',
  narrationDo:
    'El personaje trenza su fibra en cabos gruesos y resistentes — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

/// CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — requisito de captura real
/// (companeros.ts § POST /capturar/:npcSlug), sustituye a trampa-de-lazo. `oficio` fija solo la
/// profesión que recibe alivio/XP (petición: "cualquier profesión de construcción") — `canCraft`
/// nunca exige poseer un oficio para craftear (solo ingredientes/atributos), así que un jugador de
/// carpintero también puede hacerlas sin problema, solo sin el alivio de constructor.
export const CUERDAS_RECIPE: CraftingRecipe = {
  key: 'cuerdas',
  verbRegex: /trenz|fabric|prepar|hac(e|ie)r/,
  nounRegex: /\bcuerdas?\b/,
  location: null,
  ingredients: [{ match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 2, label: 'fibra' }],
  resultName: 'Cuerdas',
  resultCatalogSlug: 'cuerdas',
  resultDescription: 'Cuerdas bastas trenzadas de fibra vegetal — bastan para atar a un rival vencido.',
  tier: 1,
  oficio: 'constructor-orcos-llanuras',
  narrationWant:
    'El personaje quiere trenzar cuerdas, pero no lleva encima suficiente fibra en bruto para hacerlo (hacen falta al menos 2) — narra que lo intenta o lo considera, pero no que las cuerdas quedan terminadas.',
  narrationDo:
    'El personaje trenza un par de cuerdas bastas con la fibra que lleva encima — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
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

// 5 recetas nuevas (2026-08-24, Grupo 3 § auditoría de items sin uso): estos 5 objetos existían en
// ItemCatalog desde antes pero sin ninguna vía real de conseguirlos — mismo hueco exacto que ya se
// cerró para faldar-piel-gargantua (ver su comentario arriba, "existía... sin ninguna vía real de
// conseguirlo"), nunca cerrado para estos 5 hasta ahora.

export const CORREDOR_VERTEBRA_RING_RECIPE: CraftingRecipe = {
  key: 'corredorVertebraRing',
  verbRegex: /tall|confeccion|fabric|prepar|crear|creo/,
  nounRegex: /anillo.*v[eé]rtebra|v[eé]rtebra.*anillo/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'piel-corredor' }, cantidad: 1, label: 'piel de Corredor de Cauce' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 1, label: 'cuerda de tendón' },
  ],
  resultName: 'Anillo de vértebra de corredor',
  resultCatalogSlug: 'anillo-vertebra-corredor',
  resultDescription: 'Anillo tallado a mano de una presa propia, pulido hasta sacarle brillo — recuerdo de una cacería real, no un objeto de mercado.',
  tier: 2,
  requisitos: { destreza: 6 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere tallar un anillo de vértebra de corredor, pero no lleva encima piel de Corredor de Cauce y cuerda de tendón a la vez (o no está en el Campamento del Clan Serhu) — narra que lo intenta o lo considera, pero no que lo talla de verdad.',
  narrationDo:
    'El personaje talla y pule el anillo aquí mismo, en el Campamento del Clan Serhu, con la piel y el tendón de su propia presa — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const GARGANTUA_CAPE_RECIPE: CraftingRecipe = {
  key: 'gargantuaCape',
  verbRegex: /confeccion|cos[eo]|curt|prepar|fabric|crear|creo/,
  nounRegex: /capa.*gargant|gargant.*capa/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'piel-gargantua' }, cantidad: 3, label: 'piel de gargantúa' },
    { match: { kind: 'exact', catalogSlug: 'placa-osea-gargantua' }, cantidad: 1, label: 'placa ósea de gargantúa' },
  ],
  resultName: 'Capa de piel de gargantúa',
  resultCatalogSlug: 'capa-piel-gargantua',
  resultDescription: 'Capa gruesa de piel gris ceniza de gargantúa, con pequeñas placas óseas cosidas al cuero — más pesada y protectora que el faldar, hermana mayor del mismo oficio.',
  tier: 3,
  requisitos: { destreza: 10 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere confeccionar una capa de piel de gargantúa, pero no lleva encima suficiente piel de gargantúa y una placa ósea de gargantúa a la vez (o no está en el Campamento del Clan Serhu) — narra que lo intenta o lo considera, pero no que la confecciona de verdad.',
  narrationDo:
    'El personaje curte y cose la capa aquí mismo, en el Campamento del Clan Serhu, dejando las placas óseas cosidas al cuero — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const CORREDOR_HOOD_RECIPE: CraftingRecipe = {
  key: 'corredorHood',
  verbRegex: /confeccion|cos[eo]|curt|prepar|fabric|crear|creo/,
  nounRegex: /capucha/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'piel-corredor' }, cantidad: 2, label: 'piel de Corredor de Cauce' }],
  resultName: 'Capucha de piel de corredor',
  resultCatalogSlug: 'capucha-piel-corredor',
  resultDescription: 'Capucha de piel rojiza ajustada a la cabeza, curtida a mano en el campamento del clan — protege del sol y de la arena magnética.',
  tier: 1,
  requisitos: { destreza: 5 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere confeccionar una capucha de piel de corredor, pero no lleva encima suficiente piel de Corredor de Cauce (hacen falta al menos 2) o no está en el Campamento del Clan Serhu — narra que lo intenta o lo considera, pero no que la confecciona de verdad.',
  narrationDo:
    'El personaje curte y ajusta la capucha aquí mismo, en el Campamento del Clan Serhu — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Mochila Curtida — reemplaza al Pañuelo de luto Serhu (pasada de objetos narrativos sin uso,
// 2026-09-02, decisión explícita de la usuaria: "un cosmético de espalda... que se consigue
// crafteándola con peletería y añade 10 slots a tu inventario de tier 4"). Ingrediente de piel por
// CATEGORÍA (mismo criterio que SAND_POUCH_RECIPE, cantidad más alta por ser tier 4) + un lingote
// de Yerreo para las correas y broches reforzados — coherente con "correas reforzadas" de la
// descripción del objeto.
export const TANNED_BACKPACK_RECIPE: CraftingRecipe = {
  key: 'tannedBackpack',
  verbRegex: /confeccion|cos[eo]|curt|prepar|fabric|crear|creo/,
  nounRegex: /mochila/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 3, label: 'piel curtida' },
    { match: { kind: 'exact', catalogSlug: 'lingote-yerreo' }, cantidad: 1, label: 'lingote de Yerreo' },
  ],
  resultName: 'Mochila Curtida',
  resultCatalogSlug: 'panuelo-luto-serhu',
  resultDescription: 'Mochila de cuero grueso curtido, correas reforzadas y varios compartimentos — carga de verdad, pensada para pasar días fuera del campamento.',
  tier: 4,
  requisitos: { destreza: 10 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere confeccionar una Mochila Curtida, pero no lleva encima suficiente piel curtida (hacen falta al menos 3) y un lingote de Yerreo a la vez (o no está en el Campamento del Clan Serhu) — narra que lo intenta o lo considera, pero no que la confecciona de verdad.',
  narrationDo:
    'El personaje curte y cose la mochila aquí mismo, en el Campamento del Clan Serhu, remachando las correas con el lingote de Yerreo — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Caña de pescar (2026-09-02, profesión pescador — decisión explícita de la usuaria: "la caña se
// crea con carpintería") — mismo patrón que WOOD_BEAM_RECIPE (madera por categoría, sin location
// fija) más un anzuelo de hueso y sedal de cuerda. Sin esta receta, pescador quedaba bloqueado sin
// ninguna forma real de conseguir su herramienta (hallazgo de verificación, ver harvestAbilities.ts
// § comentario de cabecera).
export const CANA_PESCA_RECIPE: CraftingRecipe = {
  key: 'canaPesca',
  verbRegex: /confeccion|tall|fabric|prepar|crear|creo/,
  nounRegex: /ca[ñn]a.*pesc|pesc.*ca[ñn]a/,
  location: null,
  ingredients: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 2, label: 'madera' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'hueso' }, cantidad: 1, label: 'hueso' },
    { match: { kind: 'exact', catalogSlug: 'cuerdas' }, cantidad: 1, label: 'cuerdas' },
  ],
  resultName: 'Caña de pescar',
  resultCatalogSlug: 'cana-pesca',
  resultDescription: 'Vara flexible de madera con sedal de cuerda trenzada y anzuelo de hueso tallado — imprescindible para pescar en la costa.',
  tier: 1,
  requisitos: { destreza: 6 },
  oficio: 'carpintero-orcos-llanuras',
  narrationWant:
    'El personaje quiere fabricar una caña de pescar, pero no lleva encima suficiente madera (hacen falta al menos 2), un hueso y unas cuerdas a la vez — narra que lo intenta o lo considera, pero no que la fabrica de verdad.',
  narrationDo:
    'El personaje talla la vara de madera, ata el sedal de cuerda y monta el anzuelo de hueso en la punta — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Cebo (2026-09-02, profesión pescador — decisión explícita de la usuaria: "el cebo es un objeto
// crafteable de Pesca, como receta de la propia profesión") — receta del propio pescador, no de
// carpintero (a diferencia de la caña): quien ya sabe pescar sabe también preparar su cebo. Sin
// `location` fija, ingrediente por categoría (cualquier marisco/carne de la costa sirve).
export const CEBO_PESCA_RECIPE: CraftingRecipe = {
  key: 'ceboPesca',
  verbRegex: /prepar|confeccion|fabric|crear|creo/,
  nounRegex: /cebo/,
  location: null,
  ingredients: [{ match: { kind: 'category', tipo: 'RECURSO', category: 'alimento' }, cantidad: 1, label: 'marisco o carne de costa' }],
  resultName: 'Cebo',
  resultCatalogSlug: 'cebo-pesca',
  resultCantidad: 10,
  resultDescription: 'Gusanos de arena y trozos de marisco ensartados en el anzuelo — atraen a los peces de la costa.',
  tier: 1,
  requisitos: { voluntad: 4 },
  oficio: 'pescador',
  narrationWant:
    'El personaje quiere preparar cebo, pero no lleva encima marisco o carne de costa con que prepararlo — narra que lo intenta o lo considera, pero no que lo prepara de verdad.',
  narrationDo:
    'El personaje trocea marisco y lo ensarta en el anzuelo, dejando listo un bote de cebo fresco — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const TROPHY_BELT_RECIPE: CraftingRecipe = {
  key: 'trophyBelt',
  verbRegex: /confeccion|cos[eo]|curt|prepar|fabric|crear|creo/,
  nounRegex: /cintur[oó]n.*trofeo|trofeo.*cintur[oó]n/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'piel-corredor' }, cantidad: 1, label: 'piel curtida' },
    { match: { kind: 'exact', catalogSlug: 'colmillo-aullador' }, cantidad: 1, label: 'colmillo de Aullador Rojo' },
    { match: { kind: 'exact', catalogSlug: 'garra-rondador' }, cantidad: 1, label: 'garra de Rondador de Brasas' },
  ],
  resultName: 'Cinturón de trofeos de hueso',
  resultCatalogSlug: 'cinturon-de-trofeos',
  resultDescription: 'Colmillos y garras de presas reales cosidos al cuero — entre orcos, respeto a la vista, nunca comprado.',
  tier: 2,
  requisitos: { destreza: 6 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere confeccionar un cinturón de trofeos, pero no lleva encima piel curtida, un colmillo de Aullador Rojo y una garra de Rondador de Brasas a la vez (o no está en el Campamento del Clan Serhu) — narra que lo intenta o lo considera, pero no que lo confecciona de verdad.',
  narrationDo:
    'El personaje cose colmillo y garra al cuero curtido aquí mismo, en el Campamento del Clan Serhu — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const HAND_AXE_RECIPE: CraftingRecipe = {
  key: 'handAxe',
  verbRegex: /forj|fabric|monta|crear|creo/,
  nounRegex: /hacha.*mano|mano.*hacha/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'lingote-de-hierro' }, cantidad: 1, label: 'lingote de hierro' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 2, label: 'leña' },
  ],
  resultName: 'Hacha de mano orca',
  resultCatalogSlug: 'hacha-de-mano-orca',
  resultDescription: 'Hacha pequeña de cabeza de hierro y mango corto, forjada en la fragua del campamento — versión ligera de una mano, para la mano secundaria.',
  statBonuses: { fuerza: 3 },
  tier: 2,
  requisitos: { fuerza: 8, destreza: 6 },
  oficio: 'herrero-orcos-llanuras',
  narrationWant:
    'El personaje quiere forjar un hacha de mano, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y llevar un lingote de hierro y leña encima) — narra que lo intenta o lo considera, pero no que la forja de verdad.',
  narrationDo:
    'El personaje forja el hacha de mano aquí mismo, en el Campamento del Clan Serhu, remachando la cabeza de hierro a un mango corto — narra la escena con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

// 18 recetas nuevas (2026-08-24, Grupo 3 § 27 recursos/materiales sin receta que los use, ver
// docs/producto/21-roadmap.md) — cierran el destino real de items recolectables desde el 2026-08-23 que
// hasta ahora no servían para nada. Grounding real hecho antes de diseñar: 82 RECURSO/MATERIAL en
// el catálogo, 27 sin ningún consumidor; de esos, `lingote-aleacion-goirntes` se queda fuera a
// propósito (ya tiene uso real como paga/soborno de un NPC goirnte, no hay oficio goirnte en el
// motor) y `hierba-del-hierro` también (su propia `HarvestYield.condicion` dice "fuera del núcleo
// jugable actual" — Meseta del Orden no es jugable hoy, una receta real para algo inalcanzable no
// aporta nada).

export const YERREO_INGOT_RECIPE: CraftingRecipe = {
  key: 'yerreoIngot',
  verbRegex: /fund|forj|refin|derret/,
  nounRegex: /lingote.*yerreo|yerreo.*lingote/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'mena-yerreo' }, cantidad: 4, label: 'mena de Yerreo' }],
  resultName: 'Lingote de Yerreo',
  resultCatalogSlug: 'lingote-yerreo',
  resultDescription: 'Yerreo fundido en la fragua del campamento y colado en un molde sencillo — metal más denso y valioso que el hierro común.',
  tier: 4,
  requisitos: { fuerza: 10 },
  oficio: 'herrero-orcos-llanuras',
  narrationWant:
    'El personaje quiere fundir mena de Yerreo en un lingote, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y llevar al menos 4 mena de Yerreo) — narra que lo intenta o lo considera, pero no que lo funde de verdad.',
  narrationDo:
    'El personaje funde su mena de Yerreo en la fragua del campamento, colándola en un molde sencillo — narra la escena con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

// Auditoría "revisar partida" (2026-08-30) — la propia `condicion` de `garras-kirelon`
// (worldCatalog.ts, HarvestYield de Kirelon Arenoso) ya prometía esta receta ("un herrero con
// fragua a mano puede fundirlas directo en 2 Lingotes de Yerreo"), pero nunca se había
// implementado — confirmado con la usuaria: "la idea era que las garras... una receta que te
// permite convertirlas en 2 lingotes". Mismo oficio/ubicación que YERREO_INGOT_RECIPE (misma
// fragua, mismo lingote resultante), pero atajo directo desde el material de caza en vez de mena.
export const KIRELON_CLAWS_TO_INGOT_RECIPE: CraftingRecipe = {
  key: 'kirelonClawsToIngot',
  verbRegex: /fund|forj|refin|derret/,
  nounRegex: /garra.*kirelon|kirelon.*garra/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'garras-kirelon' }, cantidad: 1, label: 'Garras de Kirelon Arenoso' }],
  resultName: 'Lingote de Yerreo',
  resultCatalogSlug: 'lingote-yerreo',
  resultCantidad: 2,
  resultDescription: 'Yerreo fundido directo de las Garras de Kirelon Arenoso en la fragua del campamento y colado en un molde sencillo — metal más denso y valioso que el hierro común.',
  tier: 4,
  requisitos: { fuerza: 10 },
  oficio: 'herrero-orcos-llanuras',
  narrationWant:
    'El personaje quiere fundir Garras de Kirelon Arenoso en lingotes, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y llevar al menos 1 Garras de Kirelon Arenoso) — narra que lo intenta o lo considera, pero no que las funde de verdad.',
  narrationDo:
    'El personaje funde sus Garras de Kirelon Arenoso directamente en la fragua del campamento, colándolas en un molde sencillo — narra la escena con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

export const HIYERRO_ALLOY_RECIPE: CraftingRecipe = {
  key: 'hiyerroAlloy',
  verbRegex: /fund|forj|refin|derret|aleac/,
  nounRegex: /lingote.*hiyerro|hiyerro.*lingote/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'mena-hierro-llanuras' }, cantidad: 2, label: 'mena de hierro' },
    { match: { kind: 'exact', catalogSlug: 'mena-yerreo' }, cantidad: 2, label: 'mena de Yerreo' },
    { match: { kind: 'exact', catalogSlug: 'punado-arena-iman' }, cantidad: 2, label: 'puñado de arena imán' },
  ],
  resultName: 'Lingote de Hiyerro',
  resultCatalogSlug: 'lingote-hiyerro',
  resultDescription: 'La mejor aleación orca — hierro, Yerreo y arena imán fundidos juntos en la fragua del campamento hasta formar un único lingote.',
  tier: 7,
  requisitos: { fuerza: 14 },
  oficio: 'herrero-orcos-llanuras',
  narrationWant:
    'El personaje quiere fundir hierro, Yerreo y arena imán juntos en un lingote de Hiyerro, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y llevar 2 mena de hierro, 2 mena de Yerreo y 2 puñados de arena imán encima) — narra que lo intenta o lo considera, pero no que lo funde de verdad.',
  narrationDo:
    'El personaje funde hierro, Yerreo y arena imán juntos en la fragua del campamento, colando la mezcla en un único lingote — narra la escena con el peso que merece, es la mejor aleación que conoce su pueblo. El objeto ya se gestiona automáticamente por el backend.',
};

export const QUITINA_PLATES_RECIPE: CraftingRecipe = {
  key: 'quitinaPlates',
  verbRegex: /tall|labr|trab|prepar|fabric/,
  nounRegex: /pieza.*quitina|quitina.*pieza/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'trozo-quitina-roja' }, cantidad: 3, label: 'trozo de quitina roja' }],
  resultName: 'Pieza de quitina roja',
  resultCatalogSlug: 'pieza-quitina-roja',
  resultDescription: 'Varios trozos de quitina roja de Gesgurio trabajados hasta formar una pieza completa, lista para crafteo.',
  tier: 2,
  requisitos: { destreza: 8 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere trabajar quitina roja en una pieza completa, pero no lleva encima suficiente quitina roja en bruto (hacen falta al menos 3 trozos) — narra que lo intenta o lo considera, pero no que la pieza queda terminada.',
  narrationDo:
    'El personaje trabaja varios trozos de quitina roja hasta unirlos en una única pieza completa — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const QUITINA_ARMOR_RECIPE: CraftingRecipe = {
  key: 'quitinaArmor',
  verbRegex: /cos[eo]|confeccion|monta|fabric|prepar/,
  nounRegex: /armadura.*quitina|quitina.*armadura/,
  location: 'campamento-serhu',
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'pieza-quitina-roja' }, cantidad: 2, label: 'pieza de quitina roja' },
    { match: { kind: 'exact', catalogSlug: 'quitina-escorante' }, cantidad: 1, label: 'quitina de Escorante' },
    { match: { kind: 'exact', catalogSlug: 'caparazon-espina' }, cantidad: 1, label: 'caparazón de Espina del Viento' },
  ],
  resultName: 'Armadura de quitina roja',
  resultCatalogSlug: 'armadura-quitina-roja',
  resultDescription: 'Placas de quitina roja cosidas sobre un refuerzo de caparazón de Espina del Viento y quitina de Escorante — ligera, pero resiste bien el corte.',
  // Rebalanceo (decisión de Álvaro, 2026-09-29): MEDIO = Destreza+Voluntad (antes Con 4).
  statBonuses: { voluntad: 4 },
  tier: 3,
  requisitos: { destreza: 10 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere confeccionar una armadura de quitina roja, pero no puede hacerlo ahora mismo (hace falta estar en el Campamento del Clan Serhu y llevar 2 piezas de quitina roja, quitina de Escorante y un caparazón de Espina del Viento encima) — narra que lo intenta o lo considera, pero no que la termina de verdad.',
  narrationDo:
    'El personaje cose las piezas de quitina roja sobre el refuerzo de caparazón y quitina de Escorante hasta formar una armadura ligera — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const JUSHA_SMOKED_MEAT_RECIPE: CraftingRecipe = {
  key: 'jushaSmokedMeat',
  verbRegex: /as|cocin|prepar|tuest|ahum/,
  // QA-16: sin pisar el Guiso de Múrgol ni el Asado de las Llanuras.
  nounRegex: /^(?!.*(guiso|asado|llanura)).*(carne.*jusha|jusha.*carne)/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'carne-jusha' }, cantidad: 2, label: 'carne de Jusha' }],
  resultName: 'Carne de Jusha ahumada',
  resultCatalogSlug: 'carne-jusha-ahumada',
  resultDescription: 'Carne de Jusha Esmeralda ahumada sobre brasas — se conserva mejor que cruda y rinde más energía.',
  // Sin tier/oficio a propósito (corregido 2026-08-31, "revisar cocina" — mismo criterio que
  // smokeMeat, arriba): ahumar carne sobre fuego es habilidad de supervivencia básica, no algo que
  // exija el oficio de cocinero — no había ninguna razón de lore real para tratar esta receta
  // distinto solo por ser de una especie concreta (Jusha) en vez de la carne genérica.
  narrationWant:
    'El personaje quiere ahumar carne de Jusha, pero no lleva encima al menos 2 raciones de carne de Jusha — narra que lo intenta o lo considera, pero no que la ahuma de verdad.',
  narrationDo: 'El personaje ahuma su carne de Jusha sobre brasas — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const SCARLET_WHEAT_BREAD_RECIPE: CraftingRecipe = {
  key: 'scarletWheatBread',
  verbRegex: /horne|cocin|prepar|amas/,
  nounRegex: /^(?!.*(leche|miel)).*(pan.*trigo|trigo.*pan)/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'trigo-escarlata' }, cantidad: 3, label: 'trigo escarlata' }],
  resultName: 'Pan de trigo escarlata',
  resultCatalogSlug: 'pan-trigo-escarlata',
  resultDescription: 'Trigo escarlata molido y horneado sobre piedra caliente — pan denso, poco habitual entre los orcos de las Llanuras.',
  tier: 1,
  oficio: 'cocinero-orcos-llanuras',
  narrationWant:
    'El personaje quiere hornear pan de trigo escarlata, pero no lleva encima suficiente trigo escarlata (hacen falta al menos 3) — narra que lo intenta o lo considera, pero no que el pan queda hecho.',
  narrationDo: 'El personaje muele y hornea su trigo escarlata sobre piedra caliente — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const SWEET_HONEYCOMB_RECIPE: CraftingRecipe = {
  key: 'sweetHoneycomb',
  verbRegex: /prepar|prens|cocin/,
  nounRegex: /panal/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'miel-lebude' }, cantidad: 2, label: 'miel de Lebude' }],
  resultName: 'Panal endulzado',
  resultCatalogSlug: 'panal-endulzado',
  resultDescription: 'Panal de Lebude prensado y endulzado — dulce concentrado, poco cuerpo pero mucha energía rápida.',
  tier: 1,
  oficio: 'cocinero-orcos-llanuras',
  narrationWant:
    'El personaje quiere prensar un panal endulzado, pero no lleva encima suficiente miel de Lebude (hacen falta al menos 2) — narra que lo intenta o lo considera, pero no que el panal queda terminado.',
  narrationDo: 'El personaje prensa su miel de Lebude en un panal denso y dulce — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const MURGOL_CURD_RECIPE: CraftingRecipe = {
  key: 'murgolCurd',
  verbRegex: /cuaj|prens|prepar|cocin/,
  nounRegex: /cuajada/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'leche-murgol' }, cantidad: 2, label: 'leche de múrgol' }],
  resultName: 'Cuajada de múrgol',
  resultCatalogSlug: 'cuajada-murgol',
  resultDescription: 'Leche de los múrgoles domados del campamento, cuajada y prensada — de las pocas cosas que se producen dentro de la propia empalizada.',
  tier: 1,
  oficio: 'cocinero-orcos-llanuras',
  narrationWant:
    'El personaje quiere cuajar leche de múrgol, pero no lleva encima suficiente leche de múrgol (hacen falta al menos 2) — narra que lo intenta o lo considera, pero no que la cuajada queda terminada.',
  narrationDo:
    'El personaje cuaja y prensa su leche de múrgol aquí mismo, en el Campamento del Clan Serhu — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// CR-61 (61d, hito 0.3 — Q4 de la ronda de CR-61 y Q15 de CR-55): platos de Obrador (tier 4-6) y de
// Gran obrador (tier 7-9). Su `curaHambre` es lo crudo que llevan × el multiplicador del escalón
// (×2 Obrador, ×2,5 Gran obrador): rinden más comida para el Reino que sus ingredientes.
export const MURGOL_STEW_RECIPE: CraftingRecipe = {
  key: 'murgolStew',
  verbRegex: /guis|cocin|prepar|herv/,
  nounRegex: /guiso/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'racion-carne' }, cantidad: 2, label: 'ración de carne fresca' },
    { match: { kind: 'exact', catalogSlug: 'leche-murgol' }, cantidad: 1, label: 'leche de múrgol' },
  ],
  resultName: 'Guiso de Múrgol',
  resultCatalogSlug: 'guiso-murgol',
  resultDescription: 'Carne de múrgol guisada a fuego lento en su propia leche — un plato de obrador que da de comer a una casa entera.',
  tier: 4,
  oficio: 'cocinero-orcos-llanuras',
  narrationWant:
    'El personaje quiere guisar múrgol, pero no lleva encima 2 raciones de carne fresca y 1 leche de múrgol — narra que lo intenta o lo considera, pero no que el guiso queda hecho.',
  narrationDo: 'El personaje guisa la carne de múrgol a fuego lento en su leche — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const MILK_HONEY_BREAD_RECIPE: CraftingRecipe = {
  key: 'milkHoneyBread',
  verbRegex: /horne|cocin|prepar|amas/,
  nounRegex: /\bpan\b.*(leche|miel)/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'trigo-escarlata' }, cantidad: 2, label: 'trigo escarlata' },
    { match: { kind: 'exact', catalogSlug: 'leche-murgol' }, cantidad: 1, label: 'leche de múrgol' },
    { match: { kind: 'exact', catalogSlug: 'miel-lebude' }, cantidad: 1, label: 'miel de Lebude' },
  ],
  resultName: 'Pan de leche y miel',
  resultCatalogSlug: 'pan-leche-miel',
  resultDescription: 'Masa de trigo escarlata amasada con leche de múrgol y endulzada con miel de Lebude — pan tierno de obrador.',
  tier: 4,
  oficio: 'cocinero-orcos-llanuras',
  narrationWant:
    'El personaje quiere hornear pan de leche y miel, pero no lleva encima 2 de trigo escarlata, 1 leche de múrgol y 1 miel de Lebude — narra que lo intenta o lo considera, pero no que el pan queda hecho.',
  narrationDo: 'El personaje amasa el trigo con leche y miel y lo hornea — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const AGED_MURGOL_CHEESE_RECIPE: CraftingRecipe = {
  key: 'agedMurgolCheese',
  verbRegex: /cur|cuaj|prens|prepar/,
  nounRegex: /queso/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'leche-murgol' }, cantidad: 4, label: 'leche de múrgol' }],
  resultName: 'Queso curado de Múrgol',
  resultCatalogSlug: 'queso-curado-murgol',
  resultDescription: 'Leche de múrgol cuajada, prensada y curada en la bodega de un gran obrador — aguanta semanas y alimenta mucho.',
  tier: 7,
  oficio: 'cocinero-orcos-llanuras',
  narrationWant:
    'El personaje quiere curar un queso de múrgol, pero no lleva encima 4 de leche de múrgol — narra que lo intenta o lo considera, pero no que el queso queda hecho.',
  narrationDo: 'El personaje cuaja, prensa y deja curar la leche de múrgol — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const PLAINS_ROAST_RECIPE: CraftingRecipe = {
  key: 'plainsRoast',
  verbRegex: /as|cocin|prepar/,
  nounRegex: /asado.*llanura|llanura.*asado/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'racion-carne' }, cantidad: 2, label: 'ración de carne fresca' },
    { match: { kind: 'exact', catalogSlug: 'boungo' }, cantidad: 2, label: 'Boungo' },
    { match: { kind: 'exact', catalogSlug: 'trigo-escarlata' }, cantidad: 1, label: 'trigo escarlata' },
  ],
  resultName: 'Asado de las Llanuras',
  resultCatalogSlug: 'asado-llanuras',
  resultDescription: 'Carne asada a la brasa con Boungo y torta de trigo escarlata — el banquete de un gran obrador de las Llanuras.',
  tier: 7,
  oficio: 'cocinero-orcos-llanuras',
  narrationWant:
    'El personaje quiere preparar un Asado de las Llanuras, pero no lleva encima 2 raciones de carne fresca, 2 Boungo y 1 de trigo escarlata — narra que lo intenta o lo considera, pero no que el asado queda hecho.',
  narrationDo: 'El personaje asa la carne con Boungo y su torta de trigo — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const MOSS_POULTICE_RECIPE: CraftingRecipe = {
  key: 'mossPoultice',
  verbRegex: /prepar|machac|hac|crear|creo/,
  nounRegex: /cataplasma.*musgo|musgo.*cataplasma/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'musgo-rojo' }, cantidad: 3, label: 'musgo rojo' }],
  resultName: 'Cataplasma de musgo',
  resultCatalogSlug: 'cataplasma-musgo',
  resultDescription: 'Musgo rojo machacado en una pasta simple, aplicada directamente sobre la herida — primeros auxilios de campaña, sin más pretensión.',
  tier: 1,
  oficio: 'primeros-auxilios-orcos-llanuras',
  narrationWant:
    'El personaje quiere preparar una cataplasma de musgo, pero no lleva encima suficiente musgo rojo (hacen falta al menos 3) — narra que lo intenta o lo considera, pero no que la prepara de verdad.',
  narrationDo:
    'El personaje machaca su musgo rojo hasta formar una pasta simple — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const SALVATURA_FILTER_RECIPE: CraftingRecipe = {
  key: 'salvaturaFilter',
  verbRegex: /prepar|mezcl|hierv|hac|crear|creo/,
  nounRegex: /filtro.*salvatura|salvatura.*filtro/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'petalos-flor-salvatura' }, cantidad: 2, label: 'pétalos de Flor Salvatura' },
    { match: { kind: 'exact', catalogSlug: 'pasto-de-sangre' }, cantidad: 2, label: 'pasto de sangre' },
    { match: { kind: 'exact', catalogSlug: 'pasto-solar' }, cantidad: 2, label: 'pasto solar' },
  ],
  resultName: 'Filtro de Salvatura',
  resultCatalogSlug: 'filtro-salvatura',
  resultDescription: 'Pétalos de Flor Salvatura hervidos junto a pasto de sangre y pasto solar — primera poción real de la alquimia orca de las Llanuras más allá del contraveneno.',
  tier: 2,
  requisitos: { inteligencia: 8 },
  oficio: 'alquimista-orcos-llanuras',
  narrationWant:
    'El personaje quiere preparar un Filtro de Salvatura, pero no puede hacerlo ahora mismo (hacen falta 2 pétalos de Flor Salvatura, 2 pasto de sangre y 2 pasto solar a la vez) — narra que lo intenta o lo considera, pero no que lo prepara de verdad.',
  narrationDo:
    'El personaje hierve juntos los pétalos de Flor Salvatura, el pasto de sangre y el pasto solar hasta reducirlos a un filtro claro — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Tanda OpenCode 2026-09-27/28 (A-34) — primer crafteo real del veneno de Espina del Viento, que
// hasta ahora solo era loot sin uso: diluido y ligado en resina deja de ser un peligro y se vuelve
// un anestésico de campo. Mismo criterio de tier/oficio que MOSS_POULTICE_RECIPE (curaUnPaso ya
// está en el propio ItemCatalog de 'unguento-espina', no aquí).
export const SPINE_POULTICE_RECIPE: CraftingRecipe = {
  key: 'spinePoultice',
  verbRegex: /prepar|dilu|liga|mezcl|hac|crear|creo/,
  nounRegex: /unguento.*espina|ungüento.*espina/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'veneno-espina' }, cantidad: 1, label: 'aguijón con veneno de Espina del Viento' },
    { match: { kind: 'exact', catalogSlug: 'flor-de-ceniza' }, cantidad: 2, label: 'Flor de Ceniza' },
    { match: { kind: 'exact', catalogSlug: 'resina-telda-gris' }, cantidad: 1, label: 'Resina Telda Gris' },
  ],
  resultName: 'Ungüento de Espina',
  resultCatalogSlug: 'unguento-espina',
  resultCantidad: 2,
  resultDescription: 'El veneno de Espina del Viento, diluido y ligado con Flor de Ceniza y Resina Telda Gris hasta formar una pasta ámbar — deja de ser un peligro y se vuelve un anestésico de campo.',
  tier: 3,
  oficio: 'alquimista-orcos-llanuras',
  narrationWant:
    'El personaje quiere preparar un Ungüento de Espina, pero no puede hacerlo ahora mismo (hacen falta 1 aguijón con veneno de Espina del Viento, 2 Flor de Ceniza y 1 Resina Telda Gris a la vez) — narra que lo intenta o lo considera, pero no que lo prepara de verdad.',
  narrationDo:
    'El personaje diluye el veneno de Espina del Viento con Flor de Ceniza y Resina Telda Gris hasta formar una pasta ámbar — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

// Tanda OpenCode 2026-09-27/28 (A-35) — primera receta real del oficio sastre-orcos-llanuras
// (hasta ahora solo enseñable, la Maestra Sastre Serhu no tenía ningún crafteo propio). Da uso a
// las Plumas de Celubia, que no servían para nada.
export const CORNISA_CLOAK_RECIPE: CraftingRecipe = {
  key: 'cornisaCloak',
  verbRegex: /cos|confeccion|fabric|prepar|hac|crear|creo/,
  nounRegex: /manto.*cornisa|cornisa.*manto/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'plumas-celubia' }, cantidad: 4, label: 'plumas de Celubia' },
    { match: { kind: 'exact', catalogSlug: 'lana-murgol' }, cantidad: 2, label: 'lana de múrgol' },
  ],
  resultName: 'Manto de Cornisa',
  resultCatalogSlug: 'manto-cornisa',
  resultDescription: 'Plumas de Celubia cosidas en hilera sobre un fieltro de lana de múrgol — el manto que se cose quien vuelve de trepar a las cornisas más altas de Los Acantilados Partidos.',
  tier: 2,
  oficio: 'sastre-orcos-llanuras',
  narrationWant:
    'El personaje quiere coser un Manto de Cornisa, pero no puede hacerlo ahora mismo (hacen falta 4 plumas de Celubia y 2 de lana de múrgol a la vez) — narra que lo intenta o lo considera, pero no que lo termina de verdad.',
  narrationDo:
    'El personaje cose las plumas de Celubia en hilera sobre el fieltro de lana de múrgol — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const QUIO_CLARITY_FILTER_RECIPE: CraftingRecipe = {
  key: 'quioClarityFilter',
  verbRegex: /destil|prepar|hac|crear|creo/,
  nounRegex: /filtro.*claridad|claridad.*filtro|filtro.*quio/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'filtro-quio' }, cantidad: 2, label: 'filtro de Quio' }],
  resultName: 'Filtro de claridad de Quio',
  resultCatalogSlug: 'filtro-claridad-quio',
  resultDescription: 'El filtro natural de Quio, destilado en un frasco pequeño — despeja la cabeza tras un golpe fuerte.',
  tier: 1,
  oficio: 'alquimista-orcos-llanuras',
  narrationWant:
    'El personaje quiere destilar un filtro de claridad de Quio, pero no lleva encima suficiente filtro de Quio (hacen falta al menos 2) — narra que lo intenta o lo considera, pero no que lo destila de verdad.',
  narrationDo:
    'El personaje destila su filtro de Quio en un frasco pequeño — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const REED_MAT_RECIPE: CraftingRecipe = {
  key: 'reedMat',
  verbRegex: /trenz|tej|fabric|prepar/,
  nounRegex: /estera/,
  location: null,
  ingredients: [
    // Renombrado 2026-09-04 (vocabulario de mundo) — "Junco" → "Chudo", ver worldCatalog.ts.
    { match: { kind: 'exact', catalogSlug: 'chudos-rojizos' }, cantidad: 2, label: 'chudos rojizos' },
    { match: { kind: 'exact', catalogSlug: 'verdileas-acuaticas' }, cantidad: 2, label: 'verdileas acuáticas' },
    { match: { kind: 'exact', catalogSlug: 'hojas-telda' }, cantidad: 2, label: 'hojas de Telda' },
  ],
  resultName: 'Estera de Chudo Trenzado',
  resultCatalogSlug: 'estera-chudo-trenzado',
  resultDescription: 'Chudos rojizos, verdileas acuáticas y hojas de Telda trenzados en una estera para dormir — un descanso de verdad, no solo suelo desnudo.',
  tier: 1,
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere trenzar una estera de chudo, pero no puede hacerlo ahora mismo (hacen falta 2 chudos rojizos, 2 verdileas acuáticas y 2 hojas de Telda a la vez) — narra que lo intenta o lo considera, pero no que la termina de verdad.',
  narrationDo:
    'El personaje trenza chudos rojizos, verdileas acuáticas y hojas de Telda hasta formar una estera — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const FEATHER_HEADDRESS_RECIPE: CraftingRecipe = {
  key: 'featherHeaddress',
  verbRegex: /trenz|monta|confeccion|fabric|prepar/,
  nounRegex: /tocado/,
  location: null,
  ingredients: [
    { match: { kind: 'exact', catalogSlug: 'plumas-rojizas' }, cantidad: 2, label: 'plumas rojizas' },
    { match: { kind: 'exact', catalogSlug: 'plumas-tura-jusha' }, cantidad: 2, label: 'plumas de Tura Jusha' },
  ],
  resultName: 'Tocado de plumas',
  resultCatalogSlug: 'tocado-plumas',
  resultDescription: 'Plumas rojizas de Corretolvas y plumas de Tura Jusha trenzadas en un tocado ceremonial — más presencia que protección.',
  statBonuses: { carisma: 2 },
  tier: 1,
  requisitos: { destreza: 6 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere trenzar un tocado de plumas, pero no lleva encima suficientes plumas rojizas y de Tura Jusha (hacen falta 2 de cada) — narra que lo intenta o lo considera, pero no que lo termina de verdad.',
  narrationDo:
    'El personaje trenza sus plumas rojizas y de Tura Jusha en un tocado ceremonial — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const TOWRGU_CLAWS_RECIPE: CraftingRecipe = {
  key: 'towrguClaws',
  verbRegex: /monta|confeccion|fabric|prepar/,
  nounRegex: /zarpas|guantelete.*garra/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'garras-towrgu' }, cantidad: 2, label: 'garras de Towrgu' }],
  resultName: 'Zarpas de Towrgu',
  resultCatalogSlug: 'zarpas-towrgu',
  resultDescription: 'Garras de Towrgu montadas sobre un guantelete de cuero — arma de cercanía, tan rápida como brutal.',
  statBonuses: { destreza: 3 },
  tier: 5,
  requisitos: { destreza: 14 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere montar unas zarpas de Towrgu, pero no lleva encima suficientes garras de Towrgu (hacen falta al menos 2) y además hace falta estar en el Campamento del Clan Serhu — narra que lo intenta o lo considera, pero no que las termina de verdad.',
  narrationDo:
    'El personaje monta sus garras de Towrgu sobre un guantelete de cuero grueso — narra la escena con el peso que merece. El objeto ya se gestiona automáticamente por el backend.',
};

export const JUSHA_SCALE_PLATES_RECIPE: CraftingRecipe = {
  key: 'jushaScalePlates',
  verbRegex: /cos[eo]|confeccion|monta|fabric|prepar/,
  nounRegex: /placas.*escama|escama.*placas/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'escama-jusha' }, cantidad: 3, label: 'escama de Jusha' }],
  resultName: 'Placas de escama de Jusha',
  resultCatalogSlug: 'placas-escama-jusha',
  resultDescription: 'Escamas de Jusha Esmeralda cosidas en hilera sobre cuero fino — armadura ligera, se mueve con quien la lleva.',
  statBonuses: { destreza: 2, voluntad: 2 },
  tier: 2,
  requisitos: { destreza: 8 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere coser placas de escama de Jusha, pero no lleva encima suficientes escamas de Jusha (hacen falta al menos 3) y además hace falta estar en el Campamento del Clan Serhu — narra que lo intenta o lo considera, pero no que las termina de verdad.',
  narrationDo:
    'El personaje cose sus escamas de Jusha en hilera sobre cuero fino — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const LEBUDE_CANDLE_RECIPE: CraftingRecipe = {
  key: 'lebudeCandle',
  verbRegex: /mold|prepar|fabric|hac/,
  nounRegex: /vela/,
  location: null,
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'cera-lebude' }, cantidad: 2, label: 'cera de Lebude' }],
  resultName: 'Vela de cera de Lebude',
  resultCatalogSlug: 'vela-cera-lebude',
  resultDescription: 'Cera de la colmena de Lebude moldeada en una vela gruesa — arde más limpio y más tiempo que la resina.',
  tier: 1,
  // Sin `oficio` a propósito: moldear una vela no exige ningún gremio, cualquiera puede hacerlo.
  narrationWant:
    'El personaje quiere moldear una vela de cera de Lebude, pero no lleva encima suficiente cera de Lebude (hacen falta al menos 2) — narra que lo intenta o lo considera, pero no que la termina de verdad.',
  narrationDo: 'El personaje moldea su cera de Lebude en una vela gruesa — narra la escena con naturalidad. El objeto ya se gestiona automáticamente por el backend.',
};

export const FERIKE_CAPE_RECIPE: CraftingRecipe = {
  key: 'ferikeCape',
  verbRegex: /cos[eo]|confeccion|monta|fabric|prepar/,
  nounRegex: /capa.*ferike|ferike.*capa|capa.*melena/,
  location: 'campamento-serhu',
  ingredients: [{ match: { kind: 'exact', catalogSlug: 'melena-cola-ferike' }, cantidad: 1, label: 'melena de la cola del Ferike' }],
  resultName: 'Capa de melena de Ferike',
  resultCatalogSlug: 'capa-melena-ferike',
  resultDescription: 'Capa cosida con la melena de la cola de un Ferike macho — objeto de prestigio real, casi nadie ha visto una de cerca.',
  statBonuses: { carisma: 5 },
  tier: 7,
  requisitos: { destreza: 16 },
  oficio: 'curtidor-orcos-llanuras',
  narrationWant:
    'El personaje quiere coser una capa con la melena de la cola de un Ferike, pero no lleva encima ninguna melena de Ferike y además hace falta estar en el Campamento del Clan Serhu — narra que lo intenta o lo considera, pero no que la termina de verdad.',
  narrationDo:
    'El personaje cose la melena de la cola del Ferike en una capa de prestigio — narra la escena con el peso que merece, es un objeto que casi nadie ha visto de cerca. El objeto ya se gestiona automáticamente por el backend.',
};

// Recetas de extracción de Reino (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md § 3/§ 7,
// 2026-09-28) — `ingredients: []` (convierten solo tiempo de trabajador en materia prima, mismo
// criterio "recolección pura" del tick de Reino, kingdomProduction.ts § 4.4-ter) y
// `requiresUnlock: true` SIN NUNCA añadirlas a `Save.unlockedRecipeKeys` — bloquea a propósito que
// el jugador las crafteé a mano por texto libre (`canCraft`/`detectsCraftIntent` las rechazan
// siempre), solo son asignables desde el panel de Reino como `OrdenProduccion.recipeKey`, que no
// pasa por ese camino (turnResolution.ts llama a `tickOrdenesProduccion` directo contra
// `CRAFTING_RECIPES`, sin comprobar `requiresUnlock`). `verbRegex`/`nounRegex`/`narrationWant`/
// `narrationDo` no se usan nunca en la práctica por lo de arriba, pero son obligatorios de la
// interfaz — se rellenan con el patrón imposible de matchear + texto honesto de "esto no se hace
// a mano" en vez de dejarlos vacíos o copiados sin sentido de otra receta.
const NEVER_MATCH_REGEX = /(?!)/;
export const MENA_HIERRO_EXTRACCION_RECIPE: CraftingRecipe = {
  key: 'extraccionMenaHierroLlanuras',
  verbRegex: NEVER_MATCH_REGEX,
  nounRegex: NEVER_MATCH_REGEX,
  location: null,
  ingredients: [],
  resultName: 'Mena de hierro de las Llanuras',
  resultCatalogSlug: 'mena-hierro-llanuras',
  resultDescription: 'Mena extraída de la boca de mina del reino.',
  tier: 1,
  oficio: 'minero-llanuras',
  requiresUnlock: true,
  narrationWant: 'Esta receta no se crafteé nunca a mano — solo se asigna como orden de producción de una Boca de mina desde el panel de Reino.',
  narrationDo: 'Esta receta no se crafteé nunca a mano — solo se asigna como orden de producción de una Boca de mina desde el panel de Reino.',
};
export const PESCA_EXTRACCION_RECIPE: CraftingRecipe = {
  key: 'extraccionPescaLlanuras',
  verbRegex: NEVER_MATCH_REGEX,
  nounRegex: NEVER_MATCH_REGEX,
  location: null,
  ingredients: [],
  resultName: 'Carne de Jashil',
  resultCatalogSlug: 'carne-jashil',
  resultDescription: 'Pesca fresca del embarcadero del reino.',
  tier: 1,
  oficio: 'pescador',
  requiresUnlock: true,
  narrationWant: 'Esta receta no se crafteé nunca a mano — solo se asigna como orden de producción de un Embarcadero de pesca desde el panel de Reino.',
  narrationDo: 'Esta receta no se crafteé nunca a mano — solo se asigna como orden de producción de un Embarcadero de pesca desde el panel de Reino.',
};
export const HIERBAS_EXTRACCION_RECIPE: CraftingRecipe = {
  key: 'extraccionHierbasLlanuras',
  verbRegex: NEVER_MATCH_REGEX,
  nounRegex: NEVER_MATCH_REGEX,
  location: null,
  ingredients: [],
  resultName: 'Manojo de Salvia del Polvo',
  resultCatalogSlug: 'manojo-salvia-polvo',
  resultDescription: 'Hierbas recogidas y secadas en la herboristería del reino.',
  tier: 1,
  oficio: 'herborista-orcos-llanuras',
  requiresUnlock: true,
  narrationWant: 'Esta receta no se crafteé nunca a mano — solo se asigna como orden de producción de una Herboristería desde el panel de Reino.',
  narrationDo: 'Esta receta no se crafteé nunca a mano — solo se asigna como orden de producción de una Herboristería desde el panel de Reino.',
};
// CR-55 (Q12): la leche de Múrgol ya no es una orden fija de los Corrales: la da cada Múrgol adulto
// con ganadero, en el avance diario del ganado (`cronista/ganadoReino.ts`).

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  MENA_HIERRO_EXTRACCION_RECIPE,
  PESCA_EXTRACCION_RECIPE,
  HIERBAS_EXTRACCION_RECIPE,
  AXE_REPAIR_RECIPE,
  SMOKE_MEAT_RECIPE,
  GARGANTUA_ARMOR_RECIPE,
  ANTIDOTE_RECIPE,
  FIELD_TORCH_RECIPE,
  IRON_INGOT_RECIPE,
  MAGNETIZED_IRON_INGOT_RECIPE,
  COMPASS_NEEDLE_RECIPE,
  SAND_POUCH_RECIPE,
  ODRE_AGUA_RECIPE,
  RECOGER_AGUA_RECIPE,
  STONE_BLOCK_RECIPE,
  WOOD_BEAM_RECIPE,
  BONE_COLUMN_RECIPE,
  BRAIDED_CORDAGE_RECIPE,
  CUERDAS_RECIPE,
  YERREO_INGOT_RECIPE,
  KIRELON_CLAWS_TO_INGOT_RECIPE,
  HIYERRO_ALLOY_RECIPE,
  QUITINA_PLATES_RECIPE,
  QUITINA_ARMOR_RECIPE,
  JUSHA_SMOKED_MEAT_RECIPE,
  SCARLET_WHEAT_BREAD_RECIPE,
  SWEET_HONEYCOMB_RECIPE,
  MURGOL_CURD_RECIPE,
  MURGOL_STEW_RECIPE,
  MILK_HONEY_BREAD_RECIPE,
  AGED_MURGOL_CHEESE_RECIPE,
  PLAINS_ROAST_RECIPE,
  MOSS_POULTICE_RECIPE,
  SALVATURA_FILTER_RECIPE,
  QUIO_CLARITY_FILTER_RECIPE,
  REED_MAT_RECIPE,
  FEATHER_HEADDRESS_RECIPE,
  TOWRGU_CLAWS_RECIPE,
  JUSHA_SCALE_PLATES_RECIPE,
  LEBUDE_CANDLE_RECIPE,
  FERIKE_CAPE_RECIPE,
  FIRST_AID_BANDAGE_RECIPE,
  RED_SPIKE_INFUSION_RECIPE,
  BASIC_POULTICE_RECIPE,
  COMPLETE_POULTICE_RECIPE,
  CLUB_RECIPE,
  GARGANTUA_LEG_ARMOR_RECIPE,
  BOUNGO_ROAST_RECIPE,
  BOILED_LICHEN_WATER_RECIPE,
  CORACELO_MACE_RECIPE,
  CORREDOR_VERTEBRA_RING_RECIPE,
  GARGANTUA_CAPE_RECIPE,
  CORREDOR_HOOD_RECIPE,
  TROPHY_BELT_RECIPE,
  HAND_AXE_RECIPE,
  TANNED_BACKPACK_RECIPE,
  CANA_PESCA_RECIPE,
  CEBO_PESCA_RECIPE,
  SPINE_POULTICE_RECIPE,
  CORNISA_CLOAK_RECIPE,
];

/// P215 (revisión previa al PR, 2026-10-19): slugs que alguna receta pide por su nombre exacto
/// (`racion-carne` para el Ahumadero y la Cocina). Esa comida se queda en el Almacén al depositarla,
/// para las órdenes de producción; la demás pasa a la Comida del Reino (`/almacen/depositar`).
export const SLUGS_INGREDIENTE: ReadonlySet<string> = new Set(
  CRAFTING_RECIPES.flatMap((r) => r.ingredients.flatMap((i) => [i.match, i.orMatch?.match].flatMap((m) => (m?.kind === 'exact' ? [m.catalogSlug] : [])))),
);
export function pasaAComidaDelReino(slug: string | null | undefined, curaHambre: number | null | undefined): boolean {
  return !!slug && !SLUGS_INGREDIENTE.has(slug) && (curaHambre ?? 0) > 0;
}

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
/// bloquean por falta de herramienta EN TODO EL OFICIO; el resto de oficios (herrería, tala,
/// carpintería, construcción, herboristería, minería...) se quedan exactamente como antes, sin
/// gate, hasta que también tengan una herramienta real registrada. Evita que añadir el campo deje
/// sin querer inutilizables oficios que hoy funcionan sin ninguna herramienta física.
///
/// 'minero' NO entra aquí a propósito (2026-08-23, Grupo 3 § HarvestYield.condicion, corregido
/// tras un bug real: bloquear todo el oficio dejaba sin poder minar ni Piedra común, cuando la
/// condición solo pide "pico de minero" para 2 vetas concretas y raras — Mena de Yerreo, Mena de
/// hierro de Los Pilares Rotos). Ese gate es POR YIELD, no por oficio — ver
/// `HarvestYield.requiereHerramienta` y el chequeo de `hasMineroTool` en recolectar.ts.
/// 'pescador-pescar' (2026-09-02, no 'pescador' a secas) — bloquea SOLO Pescar (exige caña de
/// pescar, ver `ItemCatalog.herramientaParaOficio` de la caña), nunca Buscar (marisco, sin
/// herramienta): ambos comparten profesión pero tienen su propia clave de ruta desde
/// `harvestAbilities.ts` § `HarvestAbilityUnlock.subOficio` — usar el prefijo genérico 'pescador'
/// aquí habría bloqueado también Buscar por accidente (`matchesOficioPrefix` machea por prefijo).
export const OFICIOS_CON_HERRAMIENTA_REQUERIDA = ['curtidor', 'desollador', 'pescador-pescar'];

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

/// Puro: ¿la ubicación actual cumple lo que exige `recipe.location`? Soporta tanto el slug único
/// original como el array nuevo (hallazgo 13) sin que el resto de `canCraft` tenga que distinguir
/// los dos casos.
function locationMatches(recipe: CraftingRecipe, currentLocationSlug: string | null): boolean {
  if (!recipe.location) return true;
  if (Array.isArray(recipe.location)) return currentLocationSlug !== null && recipe.location.includes(currentLocationSlug);
  return currentLocationSlug === recipe.location;
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
  if (!locationMatches(recipe, currentLocationSlug)) return false;
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
