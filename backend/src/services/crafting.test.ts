import { describe, it, expect } from 'vitest';
import { CRAFTING_RECIPES, detectsCraftIntent, canCraft, craftRequisitoShortfalls, planCraftConsumption, craftDurationSecondsFor, type CraftingRecipe } from './crafting.js';
import type { AttributeBlock } from './dice.js';
import { EMPTY_SECONDARY_ATTRIBUTES } from './secondaryAttributes.js';
import type { CatalogLookup, InventoryRowLike } from './ingredients.js';

function recipe(key: string): CraftingRecipe {
  const found = CRAFTING_RECIPES.find((r) => r.key === key);
  if (!found) throw new Error(`receta de prueba no encontrada: ${key}`);
  return found;
}

// Atributos de prueba que SÍ cumplen los requisitos reales de todas las recetas base (fuerza 12
// de axeRepair, fuerza 18 de gargantuaArmor —subido de 10 el 2026-08-15—, inteligencia 8 de
// antidote, fuerza 8 de ironIngot, fuerza 6 de stoneBlock) — para que los tests de materiales/
// ubicación de más abajo prueben SOLO eso, sin toparse con el umbral de atributo.
const attrs: AttributeBlock = { fuerza: 18, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };
const secondary = { ...EMPTY_SECONDARY_ATTRIBUTES, inteligencia: 8 };

const axeRepair = recipe('axeRepair');
const smokeMeat = recipe('smokeMeat');
const gargantuaArmor = recipe('gargantuaArmor');
const antidote = recipe('antidote');
const fieldTorch = recipe('fieldTorch');
const ironIngot = recipe('ironIngot');
const magnetizedIronIngot = recipe('magnetizedIronIngot');
const compassNeedle = recipe('compassNeedle');
const sandPouch = recipe('sandPouch');
const odreAgua = recipe('odreAgua');
const recogerAgua = recipe('recogerAgua');
const stoneBlock = recipe('stoneBlock');
const boiledLichenWater = recipe('boiledLichenWater');
const firstAidBandage = recipe('firstAidBandage');
const redSpikeInfusion = recipe('redSpikeInfusion');
const basicPoultice = recipe('basicPoultice');
const completePoultice = recipe('completePoultice');
const club = recipe('club');
const gargantuaLegArmor = recipe('gargantuaLegArmor');
const corredorVertebraRing = recipe('corredorVertebraRing');
const gargantuaCape = recipe('gargantuaCape');
const corredorHood = recipe('corredorHood');
const trophyBelt = recipe('trophyBelt');
const handAxe = recipe('handAxe');
const woodBeam = recipe('woodBeam');
const boneColumn = recipe('boneColumn');
const braidedCordage = recipe('braidedCordage');
const yerreoIngot = recipe('yerreoIngot');
const hiyerroAlloy = recipe('hiyerroAlloy');
const quitinaPlates = recipe('quitinaPlates');
const quitinaArmor = recipe('quitinaArmor');
const jushaSmokedMeat = recipe('jushaSmokedMeat');
const scarletWheatBread = recipe('scarletWheatBread');
const sweetHoneycomb = recipe('sweetHoneycomb');
const murgolCurd = recipe('murgolCurd');
const mossPoultice = recipe('mossPoultice');
const salvaturaFilter = recipe('salvaturaFilter');
const quioClarityFilter = recipe('quioClarityFilter');
const reedMat = recipe('reedMat');
const featherHeaddress = recipe('featherHeaddress');
const carvedHorn = recipe('carvedHorn');
const towrguClaws = recipe('towrguClaws');
const jushaScalePlates = recipe('jushaScalePlates');
const lebudeCandle = recipe('lebudeCandle');
const ferikeCape = recipe('ferikeCape');

// catalogSlug de cada fila → tipo/categoría real del catálogo (2026-07-29, refactor de
// ingredientes: crafting.ts ya no matchea por prefijo de nombre, matchea por catalogSlug/tipo/
// categoría real). Mismos slugs que crafting.ts usa de verdad, ver worldCatalog.ts.
const catalogBySlug = new Map<string, CatalogLookup>([
  ['hacha-guerra-maktor-rota', { tipo: 'EQUIPABLE', category: 'arma' }],
  ['sal-trueque', { tipo: 'NARRATIVO', category: 'valor' }],
  ['racion-carne', { tipo: 'CONSUMIBLE', category: 'consumible' }],
  ['placa-osea-gargantua', { tipo: 'RECURSO', category: 'hueso' }],
  ['cuerda-tendon', { tipo: 'EQUIPABLE', category: 'herramienta' }],
  ['manojo-salvia-polvo', { tipo: 'CONSUMIBLE', category: 'medicinal' }],
  ['infusion-petalos-flor-ceniza', { tipo: 'CONSUMIBLE', category: 'medicinal' }],
  ['lena-matorral-cuerno', { tipo: 'RECURSO', category: 'madera' }],
  ['resina-trepador-ocaso', { tipo: 'RECURSO', category: 'resina' }],
  ['mena-hierro-llanuras', { tipo: 'RECURSO', category: 'mena' }],
  ['piedra', { tipo: 'RECURSO', category: 'piedra' }],
  // Hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06) — 'odre-agua' pasó de EQUIPABLE/
  // herramienta (decorativo) a CONSUMIBLE/consumible (ingrediente de RECOGER_AGUA_RECIPE).
  ['odre-agua', { tipo: 'CONSUMIBLE', category: 'consumible' }],
  ['grano-espiga-roja', { tipo: 'CONSUMIBLE', category: 'consumible' }],
  ['piel-gargantua', { tipo: 'RECURSO', category: 'piel' }],
  ['punado-arena-iman', { tipo: 'RECURSO', category: 'piedra' }],
  ['saquito-arena-iman', { tipo: 'NARRATIVO', category: 'valor' }],
  ['cardo-brujula', { tipo: 'RECURSO', category: 'hierba' }],
  ['lingote-hierro-imantado', { tipo: 'MATERIAL', category: 'metal' }],
  ['cuchillo-hielo-silice', { tipo: 'EQUIPABLE', category: 'arma', herramientaParaOficio: ['curtidor', 'desollador'] }],
  ['piel-corredor', { tipo: 'RECURSO', category: 'piel' }],
  ['colmillo-aullador', { tipo: 'RECURSO', category: 'hueso' }],
  ['garra-rondador', { tipo: 'NARRATIVO', category: 'valor' }],
  ['lingote-de-hierro', { tipo: 'MATERIAL', category: 'metal' }],
  ['hueso-largo-gargantua', { tipo: 'RECURSO', category: 'hueso' }],
  ['fibra-enredaderas-llanuras', { tipo: 'RECURSO', category: 'fibras' }],
]);

function row(id: string, catalogSlug: string, cantidad?: number): InventoryRowLike {
  return { id, name: cantidad ? `${catalogSlug} (${cantidad})` : catalogSlug, catalogSlug };
}

describe('CRAFTING_RECIPES', () => {
  it('tiene las 52 recetas esperadas, cada una con una clave única', () => {
    expect(CRAFTING_RECIPES.map((r) => r.key)).toEqual([
      'axeRepair',
      'smokeMeat',
      'gargantuaArmor',
      'antidote',
      'fieldTorch',
      'ironIngot',
      'magnetizedIronIngot',
      'compassNeedle',
      'sandPouch',
      // Hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06) — odre de agua (curtidor T1) +
      // recoger agua (llenarlo solo en una zona con agua real).
      'odreAgua',
      'recogerAgua',
      'stoneBlock',
      // 3 nuevas (2026-08-24, Grupo 3 § materiales procesados de construcción) — consumidas por
      // primera vez por el Ayuntamiento mediano/grande (construction.ts).
      'woodBeam',
      'boneColumn',
      'braidedCordage',
      // CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — requisito real de captura.
      'cuerdas',
      // 18 nuevas (2026-08-24, Grupo 3 § 27 recursos/materiales sin receta que los use) — cierran
      // el destino real de items recolectables desde el 2026-08-23 que no servían para nada.
      'yerreoIngot',
      // Auditoría "revisar partida" (2026-08-30) — receta real que la propia condicion de
      // garras-kirelon (worldCatalog.ts) ya prometía, pero nunca se había implementado.
      'kirelonClawsToIngot',
      'hiyerroAlloy',
      'quitinaPlates',
      'quitinaArmor',
      'jushaSmokedMeat',
      'scarletWheatBread',
      'sweetHoneycomb',
      'murgolCurd',
      'mossPoultice',
      'salvaturaFilter',
      'quioClarityFilter',
      'reedMat',
      'featherHeaddress',
      'carvedHorn',
      'towrguClaws',
      'jushaScalePlates',
      'lebudeCandle',
      'ferikeCape',
      'firstAidBandage',
      'redSpikeInfusion',
      'basicPoultice',
      'completePoultice',
      'club',
      'gargantuaLegArmor',
      'boungoRoast',
      // Auditoría "revisar partida" (2026-08-30) — Agua hervida de liquen pasa de HarvestYield
      // directo (sin verificar la condición de "hervido sobre fuego") a receta real.
      'boiledLichenWater',
      'coraceloMace',
      // 5 nuevas (2026-08-24, Grupo 3 § auditoría de items sin uso) — cierran el hueco de
      // hacha-de-mano-orca/anillo-vertebra-corredor/capa-piel-gargantua/capucha-piel-corredor/
      // cinturon-de-trofeos, huérfanos en ItemCatalog desde antes.
      'corredorVertebraRing',
      'gargantuaCape',
      'corredorHood',
      'trophyBelt',
      'handAxe',
      // Mochila Curtida — reemplaza al Pañuelo de luto Serhu (pasada de objetos narrativos sin
      // uso, 2026-09-02): cosmético de espalda crafteable real, statBonuses inventorySlots.
      'tannedBackpack',
      // Caña de pescar (carpintero) y Cebo (pescador) — profesión pescador nueva, cierran el hueco
      // real de "herramienta sin forma de conseguirla" detectado al verificar la implementación.
      'canaPesca',
      'ceboPesca',
    ]);
  });
});

describe('detectsCraftIntent', () => {
  it('detecta intención de reparar el hacha', () => {
    expect(detectsCraftIntent(axeRepair, 'Quiero reparar mi hacha')).toBe(true);
    expect(detectsCraftIntent(axeRepair, 'Voy a reforjar el hacha con el herrero')).toBe(true);
  });
  it('no dispara sin mencionar el hacha', () => {
    expect(detectsCraftIntent(axeRepair, 'Quiero reparar mis botas')).toBe(false);
  });
  it('no dispara sin verbo de reparación', () => {
    expect(detectsCraftIntent(axeRepair, 'Miro mi hacha con cariño')).toBe(false);
  });

  it('detecta intención de ahumar carne, incluido "crear" como verbo', () => {
    expect(detectsCraftIntent(smokeMeat, 'Ahumo mi ración de carne sobre el fuego')).toBe(true);
    expect(detectsCraftIntent(smokeMeat, 'Quiero crear carne ahumada')).toBe(true);
    expect(detectsCraftIntent(smokeMeat, 'Como mi ración de carne')).toBe(false);
  });

  // Auditoría "revisar partida" (2026-08-30) — Agua hervida de liquen deja de recolectarse directa
  // (HarvestYield sin verificación real) y pasa a receta real de crafteo.
  it('detecta intención de hervir agua con liquen', () => {
    expect(detectsCraftIntent(boiledLichenWater, 'Ato un vendaje y hiervo agua con mi liquen húmedo')).toBe(true);
    expect(detectsCraftIntent(boiledLichenWater, 'Hiervo el liquen sobre el fuego')).toBe(true);
    expect(detectsCraftIntent(boiledLichenWater, 'Miro el liquen con curiosidad')).toBe(false);
  });

  it('detecta intención de fabricar el peto, incluido "crear" como verbo', () => {
    expect(detectsCraftIntent(gargantuaArmor, 'Quiero fabricar un peto con las placas')).toBe(true);
    expect(detectsCraftIntent(gargantuaArmor, 'Voy a montar el peto de gargantúa')).toBe(true);
    expect(detectsCraftIntent(gargantuaArmor, 'Quiero fabricar una lanza')).toBe(false);
  });

  it('detecta intención de preparar un antídoto/contraveneno', () => {
    expect(detectsCraftIntent(antidote, 'Preparo un antídoto con lo que tengo')).toBe(true);
    expect(detectsCraftIntent(antidote, 'Mezclo la salvia para hacer un contraveneno')).toBe(true);
    expect(detectsCraftIntent(antidote, 'Preparo la cena')).toBe(false);
    expect(detectsCraftIntent(antidote, 'Miro mi antídoto con curiosidad')).toBe(false);
  });

  it('detecta intención de fabricar una antorcha de campo', () => {
    expect(detectsCraftIntent(fieldTorch, 'Ato una antorcha con lo que tengo')).toBe(true);
    expect(detectsCraftIntent(fieldTorch, 'Voy a fabricar una antorcha de campo')).toBe(true);
    expect(detectsCraftIntent(fieldTorch, 'Ato mis botas')).toBe(false);
  });

  it('detecta intención de fundir un lingote de hierro', () => {
    expect(detectsCraftIntent(ironIngot, 'Fundo mi mena en un lingote de hierro')).toBe(true);
    expect(detectsCraftIntent(ironIngot, 'Quiero forjar el lingote de hierro')).toBe(true);
    expect(detectsCraftIntent(ironIngot, 'Fundo mi peto')).toBe(false);
  });

  it('detecta intención de fundir un lingote de hierro imantado, distinto del normal (2026-08-15)', () => {
    expect(detectsCraftIntent(magnetizedIronIngot, 'Fundo un lingote de hierro imantado')).toBe(true);
    expect(detectsCraftIntent(magnetizedIronIngot, 'Quiero forjar el hierro imantado')).toBe(true);
    expect(detectsCraftIntent(magnetizedIronIngot, 'Fundo mi mena en un lingote de hierro')).toBe(false);
  });

  it('"lingote de hierro imantado" ya NO dispara la receta normal (nounRegex excluye "imantado" a propósito, evita ambigüedad)', () => {
    expect(detectsCraftIntent(ironIngot, 'Fundo un lingote de hierro imantado')).toBe(false);
    expect(detectsCraftIntent(ironIngot, 'Fundo mi mena en un lingote de hierro')).toBe(true);
  });

  it('detecta intención de forjar la Aguja de Cardo Brújula (2026-08-15)', () => {
    expect(detectsCraftIntent(compassNeedle, 'Forjo una aguja de cardo brújula')).toBe(true);
    expect(detectsCraftIntent(compassNeedle, 'Quiero montar la aguja de cardo')).toBe(true);
    expect(detectsCraftIntent(compassNeedle, 'Forjo un hacha')).toBe(false);
  });

  it('detecta intención de coser el Saquito de arena imán (2026-08-15)', () => {
    expect(detectsCraftIntent(sandPouch, 'Coso un saquito de arena imán')).toBe(true);
    expect(detectsCraftIntent(sandPouch, 'Confecciono el saquito imantado')).toBe(true);
    expect(detectsCraftIntent(sandPouch, 'Coso un peto')).toBe(false);
  });

  it('detecta intención de tallar un bloque de piedra', () => {
    expect(detectsCraftIntent(stoneBlock, 'Tallo la piedra en un bloque')).toBe(true);
    expect(detectsCraftIntent(stoneBlock, 'Desbasto piedra tallada')).toBe(true);
    expect(detectsCraftIntent(stoneBlock, 'Tallo un cuchillo')).toBe(false);
  });

  it('detecta intención de atar un vendaje improvisado', () => {
    expect(detectsCraftIntent(firstAidBandage, 'Ato un vendaje improvisado con mi manojo de salvia del polvo')).toBe(true);
    expect(detectsCraftIntent(firstAidBandage, 'Preparo un vendaje con lo que tengo')).toBe(true);
    expect(detectsCraftIntent(firstAidBandage, 'Ato mis botas')).toBe(false);
  });

  it('detecta intención de preparar una infusión de espiga roja', () => {
    expect(detectsCraftIntent(redSpikeInfusion, 'Preparo una infusión de espiga roja')).toBe(true);
    expect(detectsCraftIntent(redSpikeInfusion, 'Hiervo espiga roja en infusión')).toBe(true);
    expect(detectsCraftIntent(redSpikeInfusion, 'Preparo la cena')).toBe(false);
  });

  it('detecta intención de preparar cataplasma básica de salvia, distinta de la completa', () => {
    expect(detectsCraftIntent(basicPoultice, 'Preparo una cataplasma básica de salvia')).toBe(true);
    expect(detectsCraftIntent(basicPoultice, 'Preparo una cataplasma completa de salvia y ceniza')).toBe(false);
  });

  it('detecta intención de preparar cataplasma completa de salvia y ceniza, distinta de la básica', () => {
    expect(detectsCraftIntent(completePoultice, 'Preparo una cataplasma completa de salvia y ceniza')).toBe(true);
    expect(detectsCraftIntent(completePoultice, 'Preparo una cataplasma básica de salvia')).toBe(false);
  });

  it('detecta intención de tallar un garrote (auditoría de catálogo, 2026-08-13)', () => {
    expect(detectsCraftIntent(club, 'Tallo un garrote con la leña que llevo')).toBe(true);
    expect(detectsCraftIntent(club, 'Fabrico un garrote de matorral de cuerno')).toBe(true);
    expect(detectsCraftIntent(club, 'Tallo un cuchillo')).toBe(false);
  });

  it('detecta intención de confeccionar el faldar de piel de gargantúa', () => {
    expect(detectsCraftIntent(gargantuaLegArmor, 'Confecciono un faldar con mi piel de gargantúa')).toBe(true);
    expect(detectsCraftIntent(gargantuaLegArmor, 'Curto un faldar de piel de gargantúa')).toBe(true);
    expect(detectsCraftIntent(gargantuaLegArmor, 'Confecciono un peto')).toBe(false);
  });

  // 5 recetas nuevas (2026-08-24, Grupo 3 § auditoría de items sin uso).
  it('detecta intención de tallar el anillo de vértebra de corredor', () => {
    expect(detectsCraftIntent(corredorVertebraRing, 'Tallo un anillo de vértebra con mi piel de corredor')).toBe(true);
    expect(detectsCraftIntent(corredorVertebraRing, 'Confecciono un anillo de vértebra')).toBe(true);
    expect(detectsCraftIntent(corredorVertebraRing, 'Tallo un anillo cualquiera')).toBe(false);
  });

  it('detecta intención de confeccionar la capa de piel de gargantúa, distinta del faldar/peto', () => {
    expect(detectsCraftIntent(gargantuaCape, 'Confecciono una capa de piel de gargantúa')).toBe(true);
    expect(detectsCraftIntent(gargantuaCape, 'Curto una capa de gargantúa')).toBe(true);
    expect(detectsCraftIntent(gargantuaCape, 'Confecciono un faldar')).toBe(false);
  });

  it('detecta intención de confeccionar la capucha de piel de corredor', () => {
    expect(detectsCraftIntent(corredorHood, 'Confecciono una capucha con mi piel de corredor')).toBe(true);
    expect(detectsCraftIntent(corredorHood, 'Curto una capucha')).toBe(true);
    expect(detectsCraftIntent(corredorHood, 'Confecciono una capa')).toBe(false);
  });

  it('detecta intención de confeccionar el cinturón de trofeos', () => {
    expect(detectsCraftIntent(trophyBelt, 'Confecciono un cinturón de trofeos con mi colmillo y mi garra')).toBe(true);
    expect(detectsCraftIntent(trophyBelt, 'Coso un cinturón de trofeos')).toBe(true);
    expect(detectsCraftIntent(trophyBelt, 'Confecciono un cinturón cualquiera')).toBe(false);
  });

  it('detecta intención de forjar el hacha de mano', () => {
    expect(detectsCraftIntent(handAxe, 'Forjo un hacha de mano con mi lingote')).toBe(true);
    expect(detectsCraftIntent(handAxe, 'Fabrico un hacha de mano')).toBe(true);
    expect(detectsCraftIntent(handAxe, 'Forjo un hacha de guerra')).toBe(false);
  });

  // 3 nuevas (2026-08-24, Grupo 3 § materiales procesados de construcción).
  it('detecta intención de tallar una viga de madera', () => {
    expect(detectsCraftIntent(woodBeam, 'Tallo una viga de madera con mi leña')).toBe(true);
    expect(detectsCraftIntent(woodBeam, 'Escuadro una viga tallada')).toBe(true);
    expect(detectsCraftIntent(woodBeam, 'Tallo un bloque de piedra')).toBe(false);
  });

  it('detecta intención de trabar una columna de hueso', () => {
    expect(detectsCraftIntent(boneColumn, 'Trabo una columna de hueso')).toBe(true);
    expect(detectsCraftIntent(boneColumn, 'Tallo una columna de hueso con mis huesos')).toBe(true);
    expect(detectsCraftIntent(boneColumn, 'Trabo un anillo cualquiera')).toBe(false);
  });

  it('detecta intención de trenzar cordaje', () => {
    expect(detectsCraftIntent(braidedCordage, 'Trenzo cordaje con mi fibra')).toBe(true);
    expect(detectsCraftIntent(braidedCordage, 'Tejo una cuerda trenzada')).toBe(true);
    expect(detectsCraftIntent(braidedCordage, 'Trenzo mi pelo')).toBe(false);
  });

  // 18 nuevas (2026-08-24, Grupo 3 § 27 recursos/materiales sin receta que los use).
  it('detecta intención de fundir Yerreo/Hiyerro', () => {
    expect(detectsCraftIntent(yerreoIngot, 'Fundo mi mena de Yerreo en un lingote')).toBe(true);
    expect(detectsCraftIntent(yerreoIngot, 'Fundo un lingote de hierro')).toBe(false);
    expect(detectsCraftIntent(hiyerroAlloy, 'Forjo un lingote de Hiyerro con mi mena')).toBe(true);
    expect(detectsCraftIntent(hiyerroAlloy, 'Fundo un lingote de Yerreo')).toBe(false);
  });

  it('detecta intención de trabajar/coser quitina roja', () => {
    expect(detectsCraftIntent(quitinaPlates, 'Trabajo mi quitina roja en una pieza')).toBe(true);
    expect(detectsCraftIntent(quitinaArmor, 'Confecciono una armadura de quitina')).toBe(true);
    expect(detectsCraftIntent(quitinaArmor, 'Trabajo una pieza de quitina')).toBe(false);
  });

  it('detecta intención de cocinar carne de Jusha/pan/panal/cuajada', () => {
    expect(detectsCraftIntent(jushaSmokedMeat, 'Ahumo mi carne de Jusha')).toBe(true);
    expect(detectsCraftIntent(scarletWheatBread, 'Horneo pan de trigo escarlata')).toBe(true);
    expect(detectsCraftIntent(sweetHoneycomb, 'Preparo un panal endulzado')).toBe(true);
    expect(detectsCraftIntent(murgolCurd, 'Preparo una cuajada con mi leche de múrgol')).toBe(true);
  });

  it('detecta intención de preparar cataplasma de musgo/filtros', () => {
    expect(detectsCraftIntent(mossPoultice, 'Preparo una cataplasma de musgo')).toBe(true);
    expect(detectsCraftIntent(salvaturaFilter, 'Preparo un filtro de Salvatura')).toBe(true);
    expect(detectsCraftIntent(quioClarityFilter, 'Destilo un filtro de claridad')).toBe(true);
    expect(detectsCraftIntent(quioClarityFilter, 'Preparo un filtro de Salvatura')).toBe(false);
  });

  it('detecta intención de trenzar estera/tocado', () => {
    expect(detectsCraftIntent(reedMat, 'Trenzo una estera de chudo')).toBe(true);
    expect(detectsCraftIntent(featherHeaddress, 'Trenzo un tocado de plumas')).toBe(true);
    expect(detectsCraftIntent(reedMat, 'Trenzo un tocado')).toBe(false);
  });

  it('detecta intención de tallar/montar objetos de caza (cuerno/zarpas/escamas/vela/capa)', () => {
    expect(detectsCraftIntent(carvedHorn, 'Tallo un cuerno de caza con mi cuerno de Cuernahoja')).toBe(true);
    expect(detectsCraftIntent(towrguClaws, 'Fabrico mis zarpas de Towrgu')).toBe(true);
    expect(detectsCraftIntent(jushaScalePlates, 'Coso placas de escama de Jusha')).toBe(true);
    expect(detectsCraftIntent(lebudeCandle, 'Moldeo una vela de cera')).toBe(true);
    expect(detectsCraftIntent(ferikeCape, 'Coso una capa con la melena del Ferike')).toBe(true);
    expect(detectsCraftIntent(ferikeCape, 'Fabrico mis zarpas de Towrgu')).toBe(false);
  });
});

describe('canCraft — ingrediente exacto (catalogSlug concreto)', () => {
  it('exige la ubicación correcta cuando la receta la requiere (hacha rota)', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque', 2)];
    expect(canCraft(axeRepair, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(axeRepair, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('reconoce un lote apilado ("(N)") sumando cantidades', () => {
    expect(canCraft(axeRepair, 'campamento-serhu', [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque', 2)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(smokeMeat, null, [row('1', 'racion-carne', 4)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(
      canCraft(gargantuaArmor, 'campamento-serhu', [row('1', 'placa-osea-gargantua', 2), row('2', 'cuerda-tendon', 2)], catalogBySlug, attrs, secondary),
    ).toBe(true);
  });
  it('no permite craftear si falta cualquiera de los ingredientes', () => {
    expect(canCraft(axeRepair, 'campamento-serhu', [row('1', 'hacha-guerra-maktor-rota')], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(axeRepair, 'campamento-serhu', [row('1', 'sal-trueque', 2)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(gargantuaArmor, 'campamento-serhu', [row('1', 'placa-osea-gargantua', 2)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(antidote, null, [row('1', 'manojo-salvia-polvo')], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(fieldTorch, null, [row('1', 'lena-matorral-cuerno')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('no exige ubicación en recetas sin condición de sitio', () => {
    expect(canCraft(smokeMeat, 'cualquier-sitio', [row('1', 'racion-carne')], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(antidote, null, [row('1', 'manojo-salvia-polvo'), row('2', 'infusion-petalos-flor-ceniza')], catalogBySlug, attrs, secondary)).toBe(true);
    expect(
      canCraft(fieldTorch, null, [row('1', 'lena-matorral-cuerno'), row('2', 'resina-trepador-ocaso')], catalogBySlug, attrs, secondary),
    ).toBe(true);
  });
  it('bloquea el crafteo si no se llega al requisito de atributo de la receta', () => {
    const debil: AttributeBlock = { ...attrs, fuerza: 4 };
    const recipeConRequisito: CraftingRecipe = { ...axeRepair, requisitos: { fuerza: 12 } };
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque', 2)];
    expect(canCraft(recipeConRequisito, 'campamento-serhu', rows, catalogBySlug, debil, secondary)).toBe(false);
    expect(craftRequisitoShortfalls(recipeConRequisito, debil, secondary)).toEqual([{ atributo: 'fuerza', tienes: 4, necesitas: 12 }]);
  });
  it('el alivio de oficio reduce el requisito exigido', () => {
    const debil: AttributeBlock = { ...attrs, fuerza: 8 };
    const recipeConRequisito: CraftingRecipe = { ...axeRepair, requisitos: { fuerza: 12 } };
    expect(craftRequisitoShortfalls(recipeConRequisito, debil, secondary, 4)).toEqual([]);
  });
});

describe('canCraft — recetas de primeros auxilios (2026-08-13)', () => {
  it('vendaje improvisado exige 1 manojo de salvia del polvo, en cualquier sitio', () => {
    expect(canCraft(firstAidBandage, null, [row('1', 'manojo-salvia-polvo')], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(firstAidBandage, null, [], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('infusión de espiga roja exige 2 granos de espiga roja', () => {
    expect(canCraft(redSpikeInfusion, null, [row('1', 'grano-espiga-roja', 2)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(redSpikeInfusion, null, [row('1', 'grano-espiga-roja', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('cataplasma básica exige 1 manojo de salvia + 1 pétalos de Flor de Ceniza', () => {
    expect(
      canCraft(basicPoultice, null, [row('1', 'manojo-salvia-polvo'), row('2', 'infusion-petalos-flor-ceniza')], catalogBySlug, attrs, secondary),
    ).toBe(true);
    expect(canCraft(basicPoultice, null, [row('1', 'manojo-salvia-polvo')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('cataplasma completa exige 2 manojos de salvia + 1 pétalos de Flor de Ceniza — la receta final, más exigente', () => {
    expect(
      canCraft(completePoultice, null, [row('1', 'manojo-salvia-polvo', 2), row('2', 'infusion-petalos-flor-ceniza')], catalogBySlug, attrs, secondary),
    ).toBe(true);
    // Solo 1 manojo (lo que basta para la básica) no llega para la completa.
    expect(
      canCraft(completePoultice, null, [row('1', 'manojo-salvia-polvo', 1), row('2', 'infusion-petalos-flor-ceniza')], catalogBySlug, attrs, secondary),
    ).toBe(false);
  });
});

describe('canCraft — ingrediente fungible por categoría (bloque de piedra)', () => {
  it('cualquier fila tipo=RECURSO/categoría=piedra cuenta, sin importar el catalogSlug exacto', () => {
    expect(canCraft(stoneBlock, null, [row('1', 'piedra', 5)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(stoneBlock, null, [row('1', 'piedra', 4)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('un ingrediente exacto de otra receta (mena de hierro) no cuenta como piedra', () => {
    expect(canCraft(stoneBlock, null, [row('1', 'mena-hierro-llanuras', 5)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

describe('canCraft — ironIngot exige mena de hierro exacta y la fragua del campamento', () => {
  it('funde el lingote con 4 de mena en el campamento', () => {
    expect(canCraft(ironIngot, 'campamento-serhu', [row('1', 'mena-hierro-llanuras', 4)], catalogBySlug, attrs, secondary)).toBe(true);
  });
  it('no funde fuera del campamento ni con menos de 4', () => {
    expect(canCraft(ironIngot, 'hondonada-del-eco', [row('1', 'mena-hierro-llanuras', 4)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(ironIngot, 'campamento-serhu', [row('1', 'mena-hierro-llanuras', 3)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

describe('canCraft — lingote de hierro imantado, aguja de cardo brújula y saquito de arena imán (2026-08-15)', () => {
  it('lingote imantado: 1 mena + 4 puñados de arena imán, en el campamento', () => {
    const rows = [row('1', 'mena-hierro-llanuras'), row('2', 'punado-arena-iman', 4)];
    expect(canCraft(magnetizedIronIngot, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(magnetizedIronIngot, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(magnetizedIronIngot, 'campamento-serhu', [row('1', 'mena-hierro-llanuras'), row('2', 'punado-arena-iman', 3)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('lingote imantado: 1 saquito de arena imán (orMatch) equivale a los 4 puñados', () => {
    const rows = [row('1', 'mena-hierro-llanuras'), row('2', 'saquito-arena-iman')];
    expect(canCraft(magnetizedIronIngot, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
  });
  it('aguja de cardo brújula: 2 Cardo Brújula + 1 lingote imantado, en el campamento', () => {
    const rows = [row('1', 'cardo-brujula', 2), row('2', 'lingote-hierro-imantado')];
    expect(canCraft(compassNeedle, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(compassNeedle, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(compassNeedle, 'campamento-serhu', [row('1', 'cardo-brujula', 1), row('2', 'lingote-hierro-imantado')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  // 5 recetas nuevas (2026-08-24) — las 4 de curtidor necesitan también la herramienta del oficio
  // (cuchillo-hielo-silice), igual que gargantuaLegArmor/sandPouch de arriba; handAxe es herrero,
  // sin ese gate.
  it('anillo de vértebra de corredor: piel + tendón + herramienta de curtidor, en el campamento', () => {
    const rows = [row('1', 'piel-corredor'), row('2', 'cuerda-tendon'), row('3', 'cuchillo-hielo-silice')];
    expect(canCraft(corredorVertebraRing, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(corredorVertebraRing, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('capa de piel de gargantúa: 3 piel + 1 placa ósea + herramienta de curtidor', () => {
    const rows = [row('1', 'piel-gargantua', 3), row('2', 'placa-osea-gargantua'), row('3', 'cuchillo-hielo-silice')];
    expect(canCraft(gargantuaCape, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(gargantuaCape, 'campamento-serhu', [row('1', 'piel-gargantua', 2), row('2', 'placa-osea-gargantua'), row('3', 'cuchillo-hielo-silice')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('capucha de piel de corredor: 2 piel de corredor + herramienta de curtidor', () => {
    const rows = [row('1', 'piel-corredor', 2), row('2', 'cuchillo-hielo-silice')];
    expect(canCraft(corredorHood, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(corredorHood, 'campamento-serhu', [row('1', 'piel-corredor', 1), row('2', 'cuchillo-hielo-silice')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('cinturón de trofeos: piel + colmillo + garra + herramienta de curtidor', () => {
    const rows = [row('1', 'piel-corredor'), row('2', 'colmillo-aullador'), row('3', 'garra-rondador'), row('4', 'cuchillo-hielo-silice')];
    expect(canCraft(trophyBelt, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(trophyBelt, 'campamento-serhu', [row('1', 'piel-corredor'), row('2', 'colmillo-aullador'), row('3', 'cuchillo-hielo-silice')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('hacha de mano: lingote + leña, en el campamento — herrero, sin gate de herramienta', () => {
    const rows = [row('1', 'lingote-de-hierro'), row('2', 'lena-matorral-cuerno', 2)];
    expect(canCraft(handAxe, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(handAxe, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });
  // 3 nuevas (2026-08-24, Grupo 3 § materiales procesados de construcción) — `location: null`
  // igual que stoneBlock, sin gate de ubicación ni de herramienta.
  it('viga de madera tallada: 4 leña (cualquiera, por categoría), en cualquier sitio', () => {
    const rows = [row('1', 'lena-matorral-cuerno', 4)];
    expect(canCraft(woodBeam, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(woodBeam, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(woodBeam, 'campamento-serhu', [row('1', 'lena-matorral-cuerno', 3)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('columna de hueso: 3 hueso (cualquiera, por categoría), en cualquier sitio', () => {
    const rows = [row('1', 'colmillo-aullador'), row('2', 'placa-osea-gargantua'), row('3', 'hueso-largo-gargantua')];
    expect(canCraft(boneColumn, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(boneColumn, 'hondonada-del-eco', [row('1', 'colmillo-aullador'), row('2', 'placa-osea-gargantua')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  // curtidor-orcos-llanuras SÍ está en OFICIOS_CON_HERRAMIENTA_REQUERIDA (a diferencia de
  // constructor/carpintero) — exige también el cuchillo de hielo sílice, igual que sandPouch/las
  // 4 recetas de trofeos de arriba.
  it('cordaje trenzado: 4 fibra (cualquiera, por categoría) + herramienta de curtidor, en cualquier sitio', () => {
    const rows = [row('1', 'fibra-enredaderas-llanuras', 4), row('2', 'cuchillo-hielo-silice')];
    expect(canCraft(braidedCordage, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(braidedCordage, 'campamento-serhu', [row('1', 'fibra-enredaderas-llanuras', 3), row('2', 'cuchillo-hielo-silice')], catalogBySlug, attrs, secondary)).toBe(
      false,
    );
    expect(canCraft(braidedCordage, 'campamento-serhu', [row('1', 'fibra-enredaderas-llanuras', 4)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  // Herramienta requerida (2026-08-17, oficio curtidor) — el cuchillo de hielo sílice de Gorhorn
  // cuenta como herramienta de peletería; sin él en las filas, `canCraft` da false aunque el resto
  // de requisitos se cumplan (ver test dedicado más abajo, describe "herramienta requerida...").
  it('saquito de arena imán: 1 piel (cualquiera, por categoría) + 2 puñados de arena imán, en el campamento', () => {
    const rows = [row('1', 'piel-gargantua'), row('2', 'punado-arena-iman', 2), row('3', 'cuchillo-hielo-silice')];
    expect(canCraft(sandPouch, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(sandPouch, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(sandPouch, 'campamento-serhu', [row('1', 'piel-gargantua'), row('2', 'punado-arena-iman', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

// Hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06) — odre de agua (curtidor T1, sin gate de
// ubicación: se cose en cualquier sitio) y recoger agua (llena un odre vacío, SOLO en una de las
// 3 Locations con agua real — location: string[], el caso nuevo de gate multi-slug).
describe('canCraft — odre de agua y recoger agua (hallazgo 13, 2026-09-06)', () => {
  it('odre de agua: 1 piel (cualquiera, por categoría) + herramienta de curtidor, en CUALQUIER sitio', () => {
    const rows = [row('1', 'piel-gargantua'), row('2', 'cuchillo-hielo-silice')];
    expect(canCraft(odreAgua, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(odreAgua, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(odreAgua, 'campamento-serhu', [row('1', 'cuchillo-hielo-silice')], catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('recoger agua: 1 odre vacío, SOLO en una de las 3 Locations con agua', () => {
    const rows = [row('1', 'odre-agua')];
    expect(canCraft(recogerAgua, 'manaderos', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(recogerAgua, 'pozo-cauce-viejo', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(recogerAgua, 'oasis-de-chudos-rojos', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(recogerAgua, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(recogerAgua, null, rows, catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('recoger agua: sin odre vacío en el inventario, aunque estés en zona con agua', () => {
    expect(canCraft(recogerAgua, 'manaderos', [], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

// 18 recetas nuevas (2026-08-24, Grupo 3 § 27 recursos/materiales sin receta que los use).
describe('canCraft — 18 recetas nuevas (2026-08-24, Grupo 3 § 27 recursos/materiales sin receta)', () => {
  it('lingote de Yerreo: 4 mena de Yerreo, en el campamento', () => {
    const rows = [row('1', 'mena-yerreo', 4)];
    expect(canCraft(yerreoIngot, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(yerreoIngot, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(yerreoIngot, 'campamento-serhu', [row('1', 'mena-yerreo', 3)], catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('lingote de Hiyerro: mena de hierro + mena de Yerreo + arena imán, exige Fuerza 14, en el campamento', () => {
    const rows = [row('1', 'mena-hierro-llanuras', 2), row('2', 'mena-yerreo', 2), row('3', 'punado-arena-iman', 2)];
    expect(canCraft(hiyerroAlloy, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true); // attrs.fuerza = 18
    const debil: AttributeBlock = { ...attrs, fuerza: 10 };
    expect(canCraft(hiyerroAlloy, 'campamento-serhu', rows, catalogBySlug, debil, secondary)).toBe(false);
    expect(canCraft(hiyerroAlloy, 'campamento-serhu', [row('1', 'mena-hierro-llanuras', 1), row('2', 'mena-yerreo', 2), row('3', 'punado-arena-iman', 2)], catalogBySlug, attrs, secondary)).toBe(
      false,
    );
  });

  it('pieza de quitina roja + armadura de quitina roja: encadenadas, ambas exigen herramienta de curtidor y el campamento', () => {
    const rowsPlates = [row('1', 'trozo-quitina-roja', 3), row('2', 'cuchillo-hielo-silice')];
    expect(canCraft(quitinaPlates, 'campamento-serhu', rowsPlates, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(quitinaPlates, 'campamento-serhu', [row('1', 'trozo-quitina-roja', 3)], catalogBySlug, attrs, secondary)).toBe(false);

    const rowsArmor = [row('1', 'pieza-quitina-roja', 2), row('2', 'quitina-escorante'), row('3', 'caparazon-espina'), row('4', 'cuchillo-hielo-silice')];
    expect(canCraft(quitinaArmor, 'campamento-serhu', rowsArmor, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(quitinaArmor, 'hondonada-del-eco', rowsArmor, catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('cocina: carne de Jusha ahumada / pan de trigo escarlata / panal endulzado, en cualquier sitio', () => {
    expect(canCraft(jushaSmokedMeat, 'hondonada-del-eco', [row('1', 'carne-jusha', 2)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(jushaSmokedMeat, 'hondonada-del-eco', [row('1', 'carne-jusha', 1)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(scarletWheatBread, 'hondonada-del-eco', [row('1', 'trigo-escarlata', 3)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(sweetHoneycomb, 'hondonada-del-eco', [row('1', 'miel-lebude', 2)], catalogBySlug, attrs, secondary)).toBe(true);
  });

  it('cuajada de múrgol: 2 leche de múrgol, en el campamento (donde están los múrgoles domados)', () => {
    const rows = [row('1', 'leche-murgol', 2)];
    expect(canCraft(murgolCurd, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(murgolCurd, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('cataplasma de musgo: 3 musgo rojo, en cualquier sitio, sin herramienta (primeros-auxilios)', () => {
    expect(canCraft(mossPoultice, 'hondonada-del-eco', [row('1', 'musgo-rojo', 3)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(mossPoultice, 'hondonada-del-eco', [row('1', 'musgo-rojo', 2)], catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('filtro de Salvatura: 3 hierbas a la vez, exige Inteligencia (alquimista)', () => {
    const rows = [row('1', 'petalos-flor-salvatura', 2), row('2', 'pasto-de-sangre', 2), row('3', 'pasto-solar', 2)];
    expect(canCraft(salvaturaFilter, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(true); // attrs.inteligencia = 10
    const pocoInteligente: AttributeBlock = { ...attrs, inteligencia: 0 };
    expect(canCraft(salvaturaFilter, 'hondonada-del-eco', rows, catalogBySlug, pocoInteligente, secondary)).toBe(false);
  });

  it('filtro de claridad de Quio: 2 filtro de Quio, en cualquier sitio', () => {
    expect(canCraft(quioClarityFilter, 'hondonada-del-eco', [row('1', 'filtro-quio', 2)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(quioClarityFilter, 'hondonada-del-eco', [row('1', 'filtro-quio', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('estera de chudo / tocado de plumas: exigen herramienta de curtidor, en cualquier sitio', () => {
    const rowsMat = [row('1', 'chudos-rojizos', 2), row('2', 'verdileas-acuaticas', 2), row('3', 'hojas-telda', 2), row('4', 'cuchillo-hielo-silice')];
    expect(canCraft(reedMat, 'hondonada-del-eco', rowsMat, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(reedMat, 'hondonada-del-eco', rowsMat.slice(0, 3), catalogBySlug, attrs, secondary)).toBe(false);

    const rowsTocado = [row('1', 'plumas-rojizas', 2), row('2', 'plumas-tura-jusha', 2), row('3', 'cuchillo-hielo-silice')];
    expect(canCraft(featherHeaddress, 'hondonada-del-eco', rowsTocado, catalogBySlug, attrs, secondary)).toBe(true);
  });

  it('cuerno de caza tallado: 1 cuerno de Cuernahoja, en cualquier sitio (carpintero, sin gate de herramienta)', () => {
    expect(canCraft(carvedHorn, 'hondonada-del-eco', [row('1', 'cuerno-cuernahoja')], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(carvedHorn, 'hondonada-del-eco', [], catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('zarpas de Towrgu: exige Destreza 14 y herramienta de curtidor, en el campamento', () => {
    const rows = [row('1', 'garras-towrgu', 2), row('2', 'cuchillo-hielo-silice')];
    const destro: AttributeBlock = { ...attrs, destreza: 14 };
    expect(canCraft(towrguClaws, 'campamento-serhu', rows, catalogBySlug, destro, secondary)).toBe(true);
    expect(canCraft(towrguClaws, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('placas de escama de Jusha: 3 escama de Jusha + herramienta de curtidor, en el campamento', () => {
    const rows = [row('1', 'escama-jusha', 3), row('2', 'cuchillo-hielo-silice')];
    expect(canCraft(jushaScalePlates, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(jushaScalePlates, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('vela de cera de Lebude: 2 cera de Lebude, en cualquier sitio, sin oficio', () => {
    expect(canCraft(lebudeCandle, 'hondonada-del-eco', [row('1', 'cera-lebude', 2)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(lebudeCandle, 'hondonada-del-eco', [row('1', 'cera-lebude', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });

  it('capa de melena de Ferike: exige Destreza 16 y herramienta de curtidor, en el campamento', () => {
    const rows = [row('1', 'melena-cola-ferike'), row('2', 'cuchillo-hielo-silice')];
    const destro: AttributeBlock = { ...attrs, destreza: 16 };
    expect(canCraft(ferikeCape, 'campamento-serhu', rows, catalogBySlug, destro, secondary)).toBe(true);
    expect(canCraft(ferikeCape, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });
});

describe('planCraftConsumption — orMatch del lingote imantado (2026-08-15)', () => {
  it('con un saquito ya completo disponible, lo consume entero en vez de fraccionar puñados sueltos', () => {
    const rows = [row('row-mena', 'mena-hierro-llanuras'), row('row-punado', 'punado-arena-iman', 4), row('row-saquito', 'saquito-arena-iman')];
    const plans = planCraftConsumption(magnetizedIronIngot, rows, catalogBySlug);
    expect(plans).toEqual([
      { deleteIds: ['row-mena'], updateRemainder: null },
      { deleteIds: ['row-saquito'], updateRemainder: null },
    ]);
  });
  it('sin saquito disponible, consume del puñado normal como siempre', () => {
    const rows = [row('row-mena', 'mena-hierro-llanuras'), row('row-punado', 'punado-arena-iman', 4)];
    const plans = planCraftConsumption(magnetizedIronIngot, rows, catalogBySlug);
    expect(plans).toEqual([
      { deleteIds: ['row-mena'], updateRemainder: null },
      { deleteIds: ['row-punado'], updateRemainder: null },
    ]);
  });
});

describe('canCraft — 3 objetos antes inalcanzables (auditoría de catálogo, 2026-08-13)', () => {
  it('garrote: 2 de leña de matorral de cuerno, en cualquier sitio', () => {
    expect(canCraft(club, null, [row('1', 'lena-matorral-cuerno', 2)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(club, null, [row('1', 'lena-matorral-cuerno', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('faldar de piel de gargantúa: 2 pieles, solo en el campamento del clan', () => {
    expect(canCraft(gargantuaLegArmor, 'campamento-serhu', [row('1', 'piel-gargantua', 2), row('2', 'cuchillo-hielo-silice')], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(gargantuaLegArmor, 'hondonada-del-eco', [row('1', 'piel-gargantua', 2)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(gargantuaLegArmor, 'campamento-serhu', [row('1', 'piel-gargantua', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

// Herramienta requerida por oficio (2026-08-17, petición explícita: "cada profesión dependerá de
// tener la herramienta para poder usar esa profesión") — solo bloquea los oficios que de verdad
// tienen alguna herramienta dada de alta en el catálogo (curtidor/desollador hoy); el resto de
// oficios (herrería, minería...) sigue exactamente igual que antes, sin gate.
describe('canCraft — herramienta requerida por oficio (2026-08-17)', () => {
  it('sin ninguna herramienta de curtidor en las filas, una receta con oficio curtidor no se puede craftear aunque sobren ingredientes/atributos', () => {
    const rows = [row('1', 'piel-gargantua', 2)];
    expect(canCraft(gargantuaLegArmor, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('con el cuchillo de hielo sílice en las filas (arma Y herramienta de curtidor a la vez), sí se puede craftear', () => {
    const rows = [row('1', 'piel-gargantua', 2), row('2', 'cuchillo-hielo-silice')];
    expect(canCraft(gargantuaLegArmor, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
  });
  it('un oficio SIN ninguna herramienta registrada en el catálogo (herrero) nunca se bloquea por esto — axeRepair sigue funcionando sin ningún objeto de categoría herramienta', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque')];
    expect(canCraft(axeRepair, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
  });
});

// Recetas desbloqueables por misión (2026-08-17) — receta de prueba a mano, ninguna de las 16
// reales lleva requiresUnlock todavía (no rompe nada de lo que ya existe).
describe('canCraft — requiresUnlock (2026-08-17, recompensa de misión no-objeto)', () => {
  const lockedRecipe: CraftingRecipe = { ...axeRepair, key: 'testLockedRecipe', requiresUnlock: true, location: null, requisitos: undefined, oficio: undefined };
  it('sin la clave en unlockedRecipeKeys, se bloquea aunque sobren ingredientes/atributos', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque')];
    expect(canCraft(lockedRecipe, null, rows, catalogBySlug, attrs, secondary, 0, [])).toBe(false);
    expect(canCraft(lockedRecipe, null, rows, catalogBySlug, attrs, secondary, 0, ['otra-receta'])).toBe(false);
  });
  it('con la clave real en unlockedRecipeKeys, se puede craftear', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque')];
    expect(canCraft(lockedRecipe, null, rows, catalogBySlug, attrs, secondary, 0, ['testLockedRecipe'])).toBe(true);
  });
  it('sin requiresUnlock (todas las recetas reales de hoy), unlockedRecipeKeys nunca importa', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque')];
    expect(canCraft(axeRepair, 'campamento-serhu', rows, catalogBySlug, attrs, secondary, 0, [])).toBe(true);
  });
});

describe('planCraftConsumption', () => {
  it('devuelve un plan de consumo por ingrediente, en el mismo orden que la receta', () => {
    const rows = [row('row-axe', 'hacha-guerra-maktor-rota'), row('row-salt', 'sal-trueque'), row('row-other', 'odre-agua')];
    const plans = planCraftConsumption(axeRepair, rows, catalogBySlug);
    expect(plans).not.toBeNull();
    expect(plans!.map((p) => p.deleteIds)).toEqual([['row-axe'], ['row-salt']]);
  });
  it('deja remanente si una fila apilada trae más unidades de las que la receta consume', () => {
    const rows = [row('row-axe', 'hacha-guerra-maktor-rota'), row('row-salt', 'sal-trueque', 2)];
    const plans = planCraftConsumption(axeRepair, rows, catalogBySlug);
    expect(plans).toEqual([
      { deleteIds: ['row-axe'], updateRemainder: null },
      { deleteIds: [], updateRemainder: { id: 'row-salt', newQuantity: 1 } },
    ]);
  });
  it('devuelve null si falta alguna cantidad de algún ingrediente (protección ante carrera con canCraft)', () => {
    const rows = [row('row-axe', 'hacha-guerra-maktor-rota')];
    expect(planCraftConsumption(axeRepair, rows, catalogBySlug)).toBeNull();
  });
  it('deja remanente reducido cuando se consume solo parte de una fila apilada (bloque de piedra)', () => {
    const rows = [row('row-stone', 'piedra', 10)];
    const plans = planCraftConsumption(stoneBlock, rows, catalogBySlug);
    expect(plans).toEqual([{ deleteIds: [], updateRemainder: { id: 'row-stone', newQuantity: 5 } }]);
  });
});

describe('craftDurationSecondsFor (espera real, 2026-08-20)', () => {
  it('escala con el tier de la receta, de 5 a 60 segundos reales', () => {
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 1 })).toBe(5);
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 2 })).toBe(20);
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 3 })).toBe(35);
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 4 })).toBe(50);
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 5 })).toBe(60);
  });
  it('cae al mínimo (5s) para recetas sin tier — smokeMeat, "habilidad de supervivencia básica"', () => {
    expect(smokeMeat.tier).toBeUndefined();
    expect(craftDurationSecondsFor(smokeMeat)).toBe(5);
  });
  it('coincide con el tier real ya tabulado en las recetas base', () => {
    expect(craftDurationSecondsFor(axeRepair)).toBe(35); // tier 3
    expect(craftDurationSecondsFor(antidote)).toBe(20); // tier 2
  });
});
