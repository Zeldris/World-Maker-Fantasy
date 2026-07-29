import { normalizeText } from './travel.js';
import type { AttributeBlock } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';
import { checkRequisitos, type Requisitos } from './requisitos.js';
import { totalQuantity, type IngredientRequirement, type CatalogLookup, type InventoryRowLike } from './ingredients.js';

export { quantityOf, baseNameOf, planConsumption } from './ingredients.js';

/// Requisitos de construcción con cantidades reales (roadmap 2026-07-20/21, petición explícita de
/// la usuaria: "para construir un campamento necesites x20 leños, 10 piedras y 5 pieles") — mismo
/// principio que crafting.ts pero con CANTIDADES, no solo presencia de un objeto. A diferencia de
/// crafting.ts (intercambio 1:1 de una fila entera), aquí la cantidad puede repartirse entre varias
/// filas de inventario (cada evento de producción/cosecha crea su propia fila, ej. "Leña (15)" +
/// "Leña (8)") — hay que sumar entre filas y, si sobra, dejar el remanente en una fila reducida.
///
/// Refactor de ingredientes (2026-07-29): `ResourceRequirement.namePrefix` (matching por prefijo
/// de nombre) se sustituye por `IngredientRequirement` (ingredients.ts), matcheando contra el
/// tipo/categoría real del catálogo en vez del nombre de la fila.
export type ResourceRequirement = IngredientRequirement;

export interface ConstructionRecipe {
  key: string;
  name: string;
  /// Descripción física real de la construcción terminada — estructura, materiales, forma
  /// (2026-07-23, para poder generarle un prompt de imagen real en la Enciclopedia; antes esta
  /// receta no tenía NINGÚN texto descriptivo más allá del propio `name`, mismo punto ciego que
  /// tuvo fauna/flora hasta que se auditó, ver project_tarkor_sistema_imagenes.md).
  description: string;
  /// Slug de raza (BERIG_RAZAS: 'orcos'/'goirntes'/'nabieus'/'faerus') cuya cultura/material
  /// define esta construcción — undefined = común, disponible para cualquiera sin importar su
  /// raza (petición explícita, 2026-07-23: "tiene que haber construcciones por raza... el
  /// campamento va a ser la construcción básica y común"). Por ahora solo Orcos tiene recetas
  /// propias (choza, atalaya); el resto de razas queda con la división lista pero vacía.
  raza?: string;
  requirements: IngredientRequirement[];
  /// Sustantivo(s) que identifican esta construcción en texto libre normalizado (ver
  /// detectsBuildIntent) — un solo patrón simple por receta, mismo criterio que CAMP_NOUN_REGEX
  /// original: basta con el nombre del edificio, sin intentar cubrir sinónimos exhaustivos.
  nounRegex: RegExp;
  /// Sesión de diseño 2026-07-23: mismo concepto "Craftable" que CraftingRecipe (crafting.ts) —
  /// nivel 1-5, mínimos de atributo del PJ, oficio (id de professions.ts) cuyo nivel alivia el
  /// requisito. Se copia a Building.tier al crearse (ver turnResolution.ts), mejor esfuerzo.
  tier?: number;
  requisitos?: Requisitos;
  oficio?: string;
}

export interface RequirementShortfall {
  label: string;
  tienes: number;
  necesitas: number;
}

export interface RecipeCheck {
  met: boolean;
  missing: RequirementShortfall[];
}

/// Puro: dadas las filas de inventario reales y los atributos del PJ, decide si la receta se
/// puede completar ahora mismo y qué falta si no (materiales Y/O atributos, mismo shape para
/// poder narrar ambos con el mismo texto). `alivio` = nivel de oficio si la receta lo tiene.
export function checkRecipe(
  recipe: ConstructionRecipe,
  rows: InventoryRowLike[],
  catalogBySlug: Map<string, CatalogLookup>,
  attributes: AttributeBlock,
  secondaryAttributes: SecondaryAttributeBlock,
  alivio = 0,
): RecipeCheck {
  const missingMaterials = recipe.requirements
    .map((req) => ({ label: req.label, tienes: totalQuantity(rows, req, catalogBySlug), necesitas: req.cantidad }))
    .filter((r) => r.tienes < r.necesitas);
  const missingRequisitos = checkRequisitos(recipe.requisitos, attributes, secondaryAttributes, alivio).map((s) => ({
    label: s.atributo,
    tienes: s.tienes,
    necesitas: s.necesitas,
  }));
  const missing = [...missingMaterials, ...missingRequisitos];
  return { met: missing.length === 0, missing };
}

const BUILD_VERB_REGEX = /constru|levant|mont[ao]|erig/;

/// Detección genérica: verbo de construcción + el sustantivo propio de ESTA receta (reemplaza al
/// antiguo detectsCampBuildIntent, hoy uno de tres — ver CONSTRUCTION_RECIPES).
export function detectsBuildIntent(recipe: ConstructionRecipe, action: string): boolean {
  const n = normalizeText(action);
  return BUILD_VERB_REGEX.test(n) && recipe.nounRegex.test(n);
}

// Primera receta real (petición explícita de la usuaria, cifras suyas literales) — grounded en
// materiales que ya existen en el catálogo: leña (worldCatalog.ts, fórmula ya existente en
// timedActions.ts), piedra (nueva, Los Pilares Rotos — ver worldCatalog.ts), piel (varias especies
// ya cosechables, "Piel de" las cubre todas).
export const CAMPAMENTO_RECIPE: ConstructionRecipe = {
  key: 'campamento',
  name: 'un campamento base',
  description:
    'Un cerco improvisado y rápido de levantar: un anillo de piedras apiladas para contener el fuego, un poste central de leña clavada en la tierra, y pieles tensadas a modo de toldo bajo contra el viento. Protege lo justo para pasar la noche — no aguanta una tormenta fuerte ni un asedio.',
  nounRegex: /campamento/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 20, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 10, label: 'piedra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 5, label: 'piel' },
  ],
  // Sin tier/requisitos/oficio a propósito (2026-07-23): un campamento base es lo mínimo que
  // cualquiera puede levantar solo, sin necesitar ningún oficio.
};

// Segunda receta (checklist 2026-07-21/22, punto 5/6 — "una casa, o lo que sea"): refugio más
// permanente que el campamento, grounded en areas.md § "Armamento y loot" (lanzas/armadura de
// hueso de gargantúa ya establecidas como material de construcción pesado) — pieles para el
// cerramiento, huesos largos como postes/armazón, tendón para atar en vez de clavos.
export const CHOZA_RECIPE: ConstructionRecipe = {
  key: 'choza',
  name: 'una choza de piel y hueso',
  // Caracterizada como construcción ORCA (2026-07-23, petición explícita: "por ahora clasifica
  // esta como construcciones orcas y caracterízalas como tal") — mismo respeto por el hueso de
  // gargantúa ya establecido en el Osario de la Manada (worldCatalog.ts): no se profana, se
  // trabaja con respeto.
  description:
    'Construcción típica de los clanes orcos de las Llanuras: un armazón de huesos largos de gargantúa clavados en tierra y atados entre sí con cuerda de tendón, formando una estructura curva más alta que un orco de pie — el mismo respeto por el hueso de gargantúa que rige en el Osario de la Manada, aquí puesto a trabajar. Sobre ese esqueleto se tensan pieles cosidas a modo de paredes y techo, dejando solo una abertura baja como entrada, a veces con la marca del clan grabada en el poste de entrada. Más permanente y resistente al viento que un simple campamento, aunque sigue siendo una sola estancia.',
  raza: 'orcos',
  // normalizeText() quita diacríticos (NFD + strip \p{Diacritic}) antes de comparar — "cabaña"
  // llega aquí ya como "cabana", igual que "vigía" como "vigia" en ATALAYA_RECIPE.
  nounRegex: /choza|cabana/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 10, label: 'piel' },
    // Exacto, no por categoría (2026-07-29): "hueso ligero" (corredor-de-cauce) es también
    // category='hueso' pero NO sirve de armazón estructural — el prefijo original ("Hueso largo")
    // ya excluía deliberadamente huesos más pequeños, se preserva esa distinción.
    { match: { kind: 'exact', catalogSlug: 'hueso-largo-gargantua' }, cantidad: 6, label: 'hueso largo de gargantúa' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 4, label: 'cuerda de tendón' },
  ],
  // Sesión de diseño 2026-07-23: montar un armazón de huesos con pieles tensadas exige fuerza
  // real — oficio 'carpintero' (armazón y estructura, no forja ni curtido de la piel en sí).
  tier: 2,
  requisitos: { fuerza: 10 },
  oficio: 'carpintero',
};

// Tercera receta: atalaya de vigía — utilidad real distinta al refugio (vigilar el terreno abierto
// de la llanura), misma piedra de Los Pilares Rotos que el campamento, leña para el armazón.
export const ATALAYA_RECIPE: ConstructionRecipe = {
  key: 'atalaya',
  name: 'una atalaya de vigía',
  // Caracterizada como construcción ORCA (2026-07-23, ver comentario de CHOZA_RECIPE arriba).
  description:
    'Construcción típica de los clanes orcos de las Llanuras, para vigilar territorio abierto sin depender de patrullas propias: una plataforma elevada sobre un armazón de leña trabada, con un pretil bajo de piedra apilada alrededor del borde para cubrirse mientras se vigila. Lo bastante alta para avistar tanto manadas como patrullas de la Concordia de Hierro antes de que se acerquen, sin más techo que el cielo.',
  raza: 'orcos',
  nounRegex: /atalaya|torre de vigia|puesto de vigia/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 15, label: 'piedra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 10, label: 'leña' },
  ],
  // Sesión de diseño 2026-07-23: requisito de Voluntad (aguantar turnos de guardia sin ceder,
  // no fuerza bruta) — oficio 'rastreador', ya lee el cielo/terreno para anticipar tormentas.
  tier: 2,
  requisitos: { voluntad: 10 },
  oficio: 'rastreador',
};

export const CONSTRUCTION_RECIPES: ConstructionRecipe[] = [CAMPAMENTO_RECIPE, CHOZA_RECIPE, ATALAYA_RECIPE];
