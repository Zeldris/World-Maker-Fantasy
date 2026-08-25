import { normalizeText, buildAdjacency, shortestPath } from './travel.js';
import type { AttributeBlock } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';
import { checkRequisitos, type Requisitos } from './requisitos.js';
import { totalQuantity, planConsumption, type IngredientRequirement, type CatalogLookup, type InventoryRowLike } from './ingredients.js';
import { prisma } from '../lib/prisma.js';
import { alivioForLevel } from './professionProgress.js';
import { matchesOficioPrefix } from './harvestAbilities.js';
import type { Prisma } from '@prisma/client';

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
  /// Slug alternativo SOLO para buscar/generar la imagen de la Enciclopedia (petición explícita,
  /// 2026-08-15: "ajustar los nombres de las construcciones... con los nombres que tengo ahí en
  /// las imágenes") — undefined = usa `key` tal cual (comportamiento de siempre). Separado de
  /// `key` a propósito: `key` es el identificador estable que ya vive en `Building.recipeKey` de
  /// partidas reales (cambiarlo huérfana cualquier edificio ya construido); el nombre/slug visible
  /// puede afinarse sin ese riesgo.
  imageSlug?: string;
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
  /// requisito. NO tiene nada que ver con `Building.tier`/`ayuntamientoNivel` de abajo — ese es
  /// el nivel del Ayuntamiento (pequeño/mediano/grande), este es solo dificultad de receta.
  tier?: number;
  requisitos?: Requisitos;
  oficio?: string;
  /// Reglas de construcciones/reino (2026-08-04, docs/17-reglas-construcciones-reino.md) — cuántos
  /// slots de compañero desbloquea esta construcción una vez `ACTIVO`. undefined = 0.
  companionSlots?: number;
  /// Máximo de construcciones ACTIVAS/EN_CONSTRUCCION de esta receta por región (`Location.region`
  /// de su `locationId`) — el Campamento es 1; el resto no tiene tope propio (puede que sí tengan
  /// `reinoBuildingCapacity`, ver abajo, que es un tope distinto y compartido entre recetas).
  maxPerRegion?: number;
  /// true = necesita un Ayuntamiento (cualquier nivel) ya construido en la partida antes de poder
  /// levantarse — y además debe caer en su misma región y dentro de la distancia máxima permitida
  /// (ver MAX_MINUTOS_DESDE_AYUNTAMIENTO más abajo).
  requiresAyuntamiento?: boolean;
  /// Si esta receta MEJORA un Ayuntamiento ya existente en vez de construir uno nuevo, la `key` de
  /// la receta que mejora (siempre `'ayuntamiento'`) — turnResolution.ts hace `UPDATE` del mismo
  /// `Building.id` en vez de `CREATE` cuando esto está presente.
  upgradesRecipeKey?: string;
  /// Nivel de Ayuntamiento que esta receta deja tras completarse (1/2/3 = pequeño/mediano/grande)
  /// — se copia a `Building.tier`. Solo lo llevan las 3 recetas de Ayuntamiento.
  ayuntamientoNivel?: number;
  /// Cuántos edificios de tipo reino (los que llevan `requiresAyuntamiento: true`) puedes tener
  /// ACTIVOS a la vez con este nivel de Ayuntamiento — solo lo llevan las 3 recetas de Ayuntamiento.
  reinoBuildingCapacity?: number;
}

/// Distancia máxima (minutos de viaje reales, mismo grafo que `shortestPath`/`buildAdjacency` de
/// travel.ts) entre un edificio de tipo reino y el Ayuntamiento del que depende — bastante para
/// cubrir el núcleo medido de una región (docs/13-escala-del-mundo.md § 1.1: la mayoría de tramos
/// entre nodos del núcleo de Llanuras rondan 60-150 min) sin llegar a otra región.
const MAX_MINUTOS_DESDE_AYUNTAMIENTO = 600;

export interface RequirementShortfall {
  label: string;
  tienes: number;
  necesitas: number;
}

export interface RecipeCheck {
  met: boolean;
  missing: RequirementShortfall[];
}

/// Oficios de construcción (prefijo sin raza/región) que de verdad BLOQUEAN si no se han
/// aprendido — mismo patrón que `OFICIOS_CON_HERRAMIENTA_REQUERIDA` (crafting.ts): una lista
/// explícita, en vez de cambiar el comportamiento por defecto de golpe para todas las recetas
/// existentes. Gap real cerrado (2026-08-24, Grupo 3 § materiales procesados, ver
/// docs/rpgtarkor/materiales-procesados-construccion.md): antes `ConstructionRecipe.oficio` solo
/// daba un alivio de requisito (`alivioForLevel`), nunca bloqueaba — hoy nada impedía construir un
/// Ayuntamiento orco sin haber aprendido `constructor-orcos-llanuras` en absoluto. El Ayuntamiento
/// pequeño y el Campamento se quedan fuera a propósito (nivel de entrada, sin oficio exigido);
/// mediano/grande sí lo declaran.
export const OFICIOS_CONSTRUCCION_REQUERIDOS = ['constructor'];

/// Puro: dadas las filas de inventario reales y los atributos del PJ, decide si la receta se
/// puede completar ahora mismo y qué falta si no (materiales Y/O atributos Y/O oficio, mismo shape
/// para poder narrar los tres con el mismo texto). `alivio` = nivel de oficio si la receta lo
/// tiene. `tieneOficio` = si el personaje ha aprendido AL MENOS UN NIVEL de `recipe.oficio` (solo
/// importa si ese oficio está en `OFICIOS_CONSTRUCCION_REQUERIDOS`) — default `true` para no
/// romper ningún caller/test existente que no pase este dato.
export function checkRecipe(
  recipe: ConstructionRecipe,
  rows: InventoryRowLike[],
  catalogBySlug: Map<string, CatalogLookup>,
  attributes: AttributeBlock,
  secondaryAttributes: SecondaryAttributeBlock,
  alivio = 0,
  tieneOficio = true,
): RecipeCheck {
  const missingMaterials = recipe.requirements
    .map((req) => ({ label: req.label, tienes: totalQuantity(rows, req, catalogBySlug), necesitas: req.cantidad }))
    .filter((r) => r.tienes < r.necesitas);
  const missingRequisitos = checkRequisitos(recipe.requisitos, attributes, secondaryAttributes, alivio).map((s) => ({
    label: s.atributo,
    tienes: s.tienes,
    necesitas: s.necesitas,
  }));
  const missingOficio: RequirementShortfall[] =
    recipe.oficio && !tieneOficio && OFICIOS_CONSTRUCCION_REQUERIDOS.some((p) => matchesOficioPrefix(recipe.oficio!, p))
      ? [{ label: `el oficio de ${recipe.oficio}`, tienes: 0, necesitas: 1 }]
      : [];
  const missing = [...missingMaterials, ...missingRequisitos, ...missingOficio];
  return { met: missing.length === 0, missing };
}

/// Puro: localiza las filas reales a consumir para TODOS los requisitos de materiales de la
/// receta — null si alguno ya no alcanza contra ESTAS filas (protege de la misma carrera que
/// `planCraftConsumption` en crafting.ts: `checkRecipe` de más arriba puede haberse evaluado
/// contra una foto de inventario ya obsoleta, leída antes de la transacción real).
export function planRecipeConsumption(
  recipe: ConstructionRecipe,
  rows: InventoryRowLike[],
  catalogBySlug: Map<string, CatalogLookup>,
): { deleteIds: string[]; updateRemainder: { id: string; newQuantity: number } | null }[] | null {
  const plans: { deleteIds: string[]; updateRemainder: { id: string; newQuantity: number } | null }[] = [];
  for (const req of recipe.requirements) {
    if (totalQuantity(rows, req, catalogBySlug) < req.cantidad) return null;
    plans.push(planConsumption(rows, req, catalogBySlug));
  }
  return plans;
}

// "mejor"/"ampl" (2026-08-04): mejorar un Ayuntamiento existente no es "construir" en sentido
// estricto ("Mejoro mi ayuntamiento a mediano", "Amplío el ayuntamiento") — mismo verbo genérico
// para las 3 recetas, la receta correcta la decide el `nounRegex` de cada una.
const BUILD_VERB_REGEX = /constru|levant|mont[ao]|erig|mejor|ampl/;

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
  // Nombre ajustado (petición explícita, 2026-08-15, referencia: imagen ya subida
  // "campamento-base-orco-llanuras-banner.png") — `imageSlug` apunta a ese mismo slug para que la
  // imagen ya generada se enganche sin renombrar el archivo.
  name: 'Campamento Base Orco de las Llanuras',
  imageSlug: 'campamento-base-orco-llanuras',
  description:
    'Un cerco improvisado y rápido de levantar: un anillo de piedras apiladas para contener el fuego, un poste central de leña clavada en la tierra, y pieles tensadas a modo de toldo bajo contra el viento. Protege lo justo para pasar la noche — no aguanta una tormenta fuerte ni un asedio.',
  nounRegex: /campamento/,
  // Rebalanceo (2026-08-24, Grupo 3 § Campamento/Ayuntamiento, petición explícita): antes 20
  // leña + 10 piedra + 5 piel (35 unidades) — la usuaria lo consideraba demasiado caro para lo
  // rápido/improvisado que es narrativamente. Cifras exactas dadas por ella, no "mitad" literal.
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 6, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 8, label: 'piedra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 2, label: 'piel' },
  ],
  // Sin tier/requisitos/oficio a propósito (2026-07-23): un campamento base es lo mínimo que
  // cualquiera puede levantar solo, sin necesitar ningún oficio.
  // Reglas de reino (2026-08-04): 1 slot de compañero, máximo 1 activo por región — es tu
  // refugio/punto de guardado PERSONAL, no infraestructura de reino (por eso no lleva
  // `requiresAyuntamiento`, a diferencia de la choza).
  companionSlots: 1,
  maxPerRegion: 1,
};

// Segunda receta (checklist 2026-07-21/22, punto 5/6 — "una casa, o lo que sea"): refugio más
// permanente que el campamento, grounded en areas.md § "Armamento y loot" (lanzas/armadura de
// hueso de gargantúa ya establecidas como material de construcción pesado) — pieles para el
// cerramiento, huesos largos como postes/armazón, tendón para atar en vez de clavos.
export const CHOZA_RECIPE: ConstructionRecipe = {
  key: 'choza',
  // Nombre ajustado (petición explícita, 2026-08-15, referencia: imagen ya subida
  // "choza-basica-orco-llanuras-banner.png") — `imageSlug` apunta a ese mismo slug para que la
  // imagen ya generada se enganche sin renombrar el archivo.
  name: 'Choza Básica Orco de las Llanuras',
  imageSlug: 'choza-basica-orco-llanuras',
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
  // Id actualizado (2026-08-09): professions.ts ahora escala 'carpintero' por raza+región — esta
  // choza es construcción orca de las Llanuras (ver su descripción), variante 'carpintero-orcos-
  // llanuras'.
  tier: 2,
  requisitos: { fuerza: 10 },
  oficio: 'carpintero-orcos-llanuras',
  // Reglas de reino (2026-08-04): 2 slots de compañero, pero es infraestructura de reino de
  // verdad — no se puede levantar sin Ayuntamiento, ni fuera de su región/distancia (comprobado
  // en turnResolution.ts, no aquí: hace falta consultar la DB).
  companionSlots: 2,
  requiresAyuntamiento: true,
};

// Tótem del Clan Maktor (2026-08-15, petición explícita: "eso no es un objeto, es una
// construcción... que requiere materiales, entre ellos el tótem que lleva Gorhorn, que es el
// componente principal de la receta") — movido desde crafting.ts (antes CraftingRecipe
// 'maktorClanTotem', producía el objeto NARRATIVO `totem-del-clan-maktor`, ya retirado del
// catálogo). Restaura `totem-clan-roto` (fragmento encontrado en Los Restos de Maktor) usando el
// propio tótem personal de Gorhorn (equipo inicial, `totem-maktor`, "único, el de Gorhorn") como
// material principal — a diferencia del diseño anterior (que los mantenía deliberadamente
// separados), aquí Gorhorn renuncia a su tótem personal para reconstruir el del clan entero.
// `requiresAyuntamiento` (petición explícita, 2026-08-15, corrigiendo un intento anterior de
// atarlo a Los Restos de Maktor a secas): se levanta donde esté el Ayuntamiento de la facción que
// funde Gorhorn, no en una Location fija — mismo mecanismo que la choza de arriba.
export const MAKTOR_CLAN_TOTEM_RECIPE: ConstructionRecipe = {
  key: 'totem-clan-maktor',
  name: 'Tótem del Clan Maktor',
  description:
    'El fragmento roto del tótem del clan, restaurado sobre el propio tótem personal de Gorhorn — un monumento íntegro con la marca del Clan Maktor, símbolo de que quien lo llevaba no fue el único superviviente. Ya no es una posesión personal: es del clan entero.',
  raza: 'orcos',
  // Requiere "clan" o "maktor" junto a "tótem" (no basta "tótem" a secas, para no confundirse con
  // una mención cualquiera del tótem personal de Gorhorn que no sea intención de construir esto).
  nounRegex: /t[oó]tem.*(clan|maktor)|(clan|maktor).*t[oó]tem/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'totem-clan-roto' }, cantidad: 1, label: 'tótem de clan roto' },
    { match: { kind: 'exact', catalogSlug: 'totem-maktor' }, cantidad: 1, label: 'tótem personal de Gorhorn' },
  ],
  // Mismo criterio que antes en crafting.ts: acto de memoria, no de destreza — solo Carisma, sin
  // oficio.
  tier: 2,
  requisitos: { carisma: 8 },
  requiresAyuntamiento: true,
};

// Ayuntamiento (2026-08-04, renombrado desde "Atalaya de vigía" — docs/17-reglas-construcciones-
// reino.md): funda el reino y desbloquea construir edificios de tipo reino (choza, futuro "puesto
// avanzado") a su alrededor. 3 niveles NO acumulables — mejorar es actualizar el mismo `Building`,
// nunca construir uno aparte (`upgradesRecipeKey`/`ayuntamientoNivel` lo gestionan en
// turnResolution.ts). Las 3 comparten `key: 'ayuntamiento'` a propósito.

export const AYUNTAMIENTO_PEQUENO_RECIPE: ConstructionRecipe = {
  key: 'ayuntamiento',
  name: 'un pequeño ayuntamiento',
  // Caracterizada como construcción ORCA (2026-07-23, ver comentario de CHOZA_RECIPE arriba).
  description:
    'El primer asiento de mando de un reino naciente: una sala de consejo modesta, de piedra apilada y vigas de leña trabada, con un único fuego central alrededor del que se reúnen quienes juran lealtad. Nada imponente todavía, pero suficiente para que un liderazgo real empiece a echar raíces en la región.',
  raza: 'orcos',
  nounRegex: /ayuntamiento/,
  // Rebalanceo (2026-08-24, Grupo 3 § Campamento/Ayuntamiento — ver
  // docs/rpgtarkor/materiales-procesados-construccion.md): antes solo 15 piedra + 10 leña (2
  // categorías). El pequeño se queda 100% crudo a propósito (mediano/grande pasan a materiales
  // procesados por oficio regional, sin implementar todavía) — cifras dadas por la usuaria.
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 14, label: 'piedra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 6, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'hueso' }, cantidad: 6, label: 'hueso' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'resina' }, cantidad: 8, label: 'resina' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'mena' }, cantidad: 2, label: 'mena' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 8, label: 'fibra' },
  ],
  // Carisma, no fuerza ni voluntad (2026-08-04): fundar un liderazgo real es una cuestión de
  // autoridad, no de músculo ni de aguante — sin oficio a propósito, cualquiera con suficiente
  // presencia puede intentarlo, no hace falta un gremio.
  requisitos: { carisma: 10 },
  companionSlots: 0,
  ayuntamientoNivel: 1,
  reinoBuildingCapacity: 10,
};

export const AYUNTAMIENTO_MEDIANO_RECIPE: ConstructionRecipe = {
  key: 'ayuntamiento-mediano',
  name: 'un ayuntamiento mediano',
  description:
    'El asiento de mando crece: muros de piedra más gruesos, una techumbre real de leña y piel curtida, y una sala aparte para recibir a quienes vienen a jurar lealtad o a negociar. Ya no es un fuego de campamento con pretensiones — es el corazón administrativo de un territorio que empieza a sostenerse solo.',
  raza: 'orcos',
  // Lookahead — necesita las dos palabras presentes, en cualquier orden, para no confundirse con
  // el pequeño (`AYUNTAMIENTO_PEQUENO_RECIPE.nounRegex` matchea "ayuntamiento" solo) ni con el
  // grande. El orden en CONSTRUCTION_RECIPES (más abajo) ya pone este antes que el pequeño.
  nounRegex: /(?=.*ayuntamiento)(?=.*median)/,
  // Materiales procesados (2026-08-24, Grupo 3 § materiales procesados — ver
  // docs/rpgtarkor/materiales-procesados-construccion.md): antes solo 30 piedra + 25 leña crudas.
  // Regla cerrada con la usuaria: ~75% procesado / 25% crudo por categoría procesable — la resina
  // nunca tiene versión procesada, se queda 100% crudo en cualquier nivel.
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 3, label: 'bloque de piedra tallada' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 5, label: 'piedra' },
    { match: { kind: 'exact', catalogSlug: 'lingote-de-hierro' }, cantidad: 1, label: 'lingote de hierro' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'mena' }, cantidad: 1, label: 'mena' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 2, label: 'viga de madera tallada' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 3, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'columna-hueso' }, cantidad: 2, label: 'columna de hueso' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'hueso' }, cantidad: 2, label: 'hueso' },
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 2, label: 'cordaje trenzado' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 3, label: 'fibra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'resina' }, cantidad: 12, label: 'resina' },
  ],
  requisitos: { carisma: 18 },
  // Bloqueo real (2026-08-24, ver `OFICIOS_CONSTRUCCION_REQUERIDOS` arriba) — a diferencia del
  // pequeño, mediano en adelante SÍ exige haber aprendido constructor-orcos-llanuras de verdad.
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'ayuntamiento',
  ayuntamientoNivel: 2,
  reinoBuildingCapacity: 25,
};

export const AYUNTAMIENTO_GRANDE_RECIPE: ConstructionRecipe = {
  key: 'ayuntamiento-grande',
  name: 'un gran ayuntamiento',
  description:
    'La capital de verdad: piedra maciza, un salón de consejo lo bastante grande para reunir a súbditos y visitantes de varios asentamientos a la vez, y refuerzos de mena de hierro en los puntos de carga. Un reino que ha llegado hasta aquí ya no depende de la voluntad de una sola persona para sostenerse.',
  raza: 'orcos',
  nounRegex: /(?=.*ayuntamiento)(?=.*grande)/,
  // Materiales procesados (2026-08-24) — 100% procesado en todo lo procesable, "así es difícil de
  // ampliar" a propósito: exige tener constructor/herrero/carpintero/curtidor a buen nivel A LA
  // VEZ, no solo más cantidad de lo mismo. La resina se queda cruda (nunca tiene procesado).
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 8, label: 'bloque de piedra tallada' },
    { match: { kind: 'exact', catalogSlug: 'lingote-de-hierro' }, cantidad: 4, label: 'lingote de hierro' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 5, label: 'viga de madera tallada' },
    { match: { kind: 'exact', catalogSlug: 'columna-hueso' }, cantidad: 5, label: 'columna de hueso' },
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 5, label: 'cordaje trenzado' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'resina' }, cantidad: 20, label: 'resina' },
  ],
  requisitos: { carisma: 22 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'ayuntamiento',
  ayuntamientoNivel: 3,
  reinoBuildingCapacity: 60,
};

// Jaula (Grupo 3 § Compañeros y supervivencia, 2026-08-25, ver
// docs/rpgtarkor/companeros-y-supervivencia.md § 2) — "el sitio físico donde se cuida al animal
// DURANTE el proceso de tameo, no el slot final de compañero" — `companionSlots: 0` a propósito,
// no compite con Campamento/Choza. Sin `requiresAyuntamiento`: capturar/tamear no depende de tener
// Reino fundado, mismo criterio que el propio doc ("Reino NO es requisito"). Capacidad = 1 animal
// por Jaula construida (cifra de partida, ajustable) — se comprueba contando
// `NpcState.capturaJaulaBuildingId` apuntando a esa Jaula, no un campo nuevo en `Building`.
// Tamaño requerido por especie calibrado a mano en `companionSupervivencia.ts` (sin campo nuevo en
// el catálogo, mismo criterio que pide el propio doc). Materiales 100% crudos, escalados por
// tamaño — igual que Campamento, sin oficio exigido: cualquiera puede levantar una jaula sencilla.
export const JAULA_PEQUENA_RECIPE: ConstructionRecipe = {
  key: 'jaula-pequena',
  name: 'una jaula pequeña',
  description: 'Una jaula sencilla de varas de madera clavadas en tierra y atadas con cuerda, del tamaño justo para un animal pequeño — pensada para sujetarlo mientras se intenta ganar su confianza, no para retenerlo para siempre.',
  nounRegex: /(?=.*jaula)(?=.*pequen)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 4, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 2, label: 'cuerda de tendón' },
  ],
  companionSlots: 0,
};

export const JAULA_MEDIANA_RECIPE: ConstructionRecipe = {
  key: 'jaula-mediana',
  name: 'una jaula mediana',
  description: 'Una jaula robusta de postes de madera reforzados con hueso, lo bastante amplia para un animal de tamaño medio — barras bien espaciadas para que respire y se mueva sin poder escapar.',
  nounRegex: /(?=.*jaula)(?=.*median)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 8, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'hueso-largo-gargantua' }, cantidad: 2, label: 'hueso largo de gargantúa' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 4, label: 'cuerda de tendón' },
  ],
  companionSlots: 0,
};

export const JAULA_GRANDE_RECIPE: ConstructionRecipe = {
  key: 'jaula-grande',
  name: 'una jaula grande',
  description: 'Un cercado sólido de postes de madera y hueso largo de gargantúa, reforzado con piedra en la base — lo único capaz de contener a una bestia de verdadero tamaño mientras se intenta domarla.',
  nounRegex: /(?=.*jaula)(?=.*grande)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 14, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'hueso-largo-gargantua' }, cantidad: 5, label: 'hueso largo de gargantúa' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 6, label: 'piedra' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 6, label: 'cuerda de tendón' },
  ],
  companionSlots: 0,
};

// Orden deliberado (2026-08-04): grande y mediano ANTES que pequeño — `CONSTRUCTION_RECIPES.find`
// se queda con la primera receta cuya `nounRegex` matchea, y el texto "ayuntamiento mediano"
// también matchea el patrón (más simple) del pequeño si ese se comprobara antes. Mismo criterio
// aplicado a las 3 Jaulas nuevas.
export const CONSTRUCTION_RECIPES: ConstructionRecipe[] = [
  CAMPAMENTO_RECIPE,
  CHOZA_RECIPE,
  MAKTOR_CLAN_TOTEM_RECIPE,
  AYUNTAMIENTO_GRANDE_RECIPE,
  AYUNTAMIENTO_MEDIANO_RECIPE,
  AYUNTAMIENTO_PEQUENO_RECIPE,
  JAULA_GRANDE_RECIPE,
  JAULA_MEDIANA_RECIPE,
  JAULA_PEQUENA_RECIPE,
];

/// `key` de las recetas que dependen de tener un Ayuntamiento (choza, futuro "puesto avanzado") —
/// para contar cuántas hay activas contra la capacidad del Ayuntamiento sin hardcodear 'choza' en
/// turnResolution.ts.
const REINO_BUILDING_RECIPE_KEYS: string[] = CONSTRUCTION_RECIPES.filter((r) => r.requiresAyuntamiento).map((r) => r.key);

/// Slots de compañero que da una construcción, por su `recipeKey` guardada en `Building` — 0 para
/// construcciones libres del modelo (`recipeKey: null`) o cualquier clave que no matchee ninguna
/// receta conocida (defensivo: nunca debería pasar, pero no debe reventar si pasa).
export function companionSlotsForRecipeKey(recipeKey: string | null): number {
  return CONSTRUCTION_RECIPES.find((r) => r.key === recipeKey)?.companionSlots ?? 0;
}

/// Capacidad de edificios de reino según el nivel actual del Ayuntamiento (`Building.tier`) —
/// deriva de las 3 recetas en vez de repetir los números 10/25/60 sueltos en turnResolution.ts.
function reinoBuildingCapacityForTier(tier: number): number {
  const recipe = [AYUNTAMIENTO_PEQUENO_RECIPE, AYUNTAMIENTO_MEDIANO_RECIPE, AYUNTAMIENTO_GRANDE_RECIPE].find(
    (r) => r.ayuntamientoNivel === tier,
  );
  return recipe?.reinoBuildingCapacity ?? 0;
}

/// Reglas de reino (2026-08-04, docs/17-reglas-construcciones-reino.md) — cupo por región, cercanía/
/// cupo del Ayuntamiento, mejora en el nivel justo anterior, y unicidad del Ayuntamiento. Recibe
/// `db` como parámetro (en vez de cerrar sobre `prisma`) para poder llamarse dos veces con el mismo
/// código: una vez de solo lectura ANTES de la transacción (aviso al LLM, mejor esfuerzo) y otra
/// vez con `tx`, DENTRO de la transacción, justo antes de crear/mejorar de verdad (auditoría
/// 2026-08-04, bug real: sin la segunda llamada, dos turnos de "construir X" casi simultáneos
/// podían colarse ambos por el primer chequeo y duplicar Ayuntamientos/Territorios — misma clase de
/// carrera ya cerrada para crafteo con `freshInventoryRows`/`planCraftConsumption`).
///
/// Movida desde turnResolution.ts (refactor de deuda técnica 2026-08-13) — es lógica de dominio
/// pura sobre construcción, no de orquestación de turno; GET /saves/:id/recipes-status
/// (recipesStatus.ts) también la reutiliza en modo solo-lectura (mismo `prisma` en vez de `tx`,
/// igual que la llamada "mejor esfuerzo" de turnResolution.ts) — antes ese endpoint solo miraba
/// materiales/atributos y podía marcar como "disponible" un edificio de reino que turnResolution.ts
/// iba a rechazar de todos modos (sin Ayuntamiento, fuera de región, cupo lleno...), dejando el
/// botón de Habilidades/Enciclopedia habilitado sin motivo.
export async function computeBuildBlockedReason(params: {
  db: Prisma.TransactionClient;
  saveId: string;
  worldId: string;
  buildRecipe: ConstructionRecipe;
  activeRegion: string | null;
  currentLocationRecord: { id: string };
}): Promise<string | null> {
  const { db, saveId, worldId, buildRecipe, activeRegion, currentLocationRecord } = params;
  if (buildRecipe.maxPerRegion) {
    const sameRegionCount = await db.building.count({
      where: { saveId, recipeKey: buildRecipe.key, status: { in: ['ACTIVO', 'EN_CONSTRUCCION'] }, location: { region: activeRegion ?? undefined } },
    });
    if (sameRegionCount >= buildRecipe.maxPerRegion) {
      return `ya tiene ${buildRecipe.name} activo en esta región (máximo ${buildRecipe.maxPerRegion} por región)`;
    }
  }
  if (buildRecipe.requiresAyuntamiento) {
    const ayuntamiento = await db.building.findFirst({
      where: { saveId, recipeKey: 'ayuntamiento', status: 'ACTIVO' },
      include: { location: true },
    });
    if (!ayuntamiento?.location) {
      return 'necesita un Ayuntamiento construido antes de poder levantar esto';
    }
    if (ayuntamiento.location.region !== activeRegion) {
      return 'debe construirse en la misma región donde está el Ayuntamiento';
    }
    const links = await db.locationLink.findMany({
      where: { from: { worldId } },
      select: { fromId: true, toId: true, minutosBase: true, terreno: true, riesgo: true },
    });
    const path = shortestPath(buildAdjacency(links), ayuntamiento.location.id, currentLocationRecord.id);
    if (!path || path.totalMinutos > MAX_MINUTOS_DESDE_AYUNTAMIENTO) {
      return 'está demasiado lejos del Ayuntamiento para depender de él';
    }
    const reinoCount = await db.building.count({
      where: { saveId, recipeKey: { in: REINO_BUILDING_RECIPE_KEYS }, status: 'ACTIVO' },
    });
    const capacity = reinoBuildingCapacityForTier(ayuntamiento.tier ?? 1);
    if (reinoCount >= capacity) {
      return `el Ayuntamiento ya está en su cupo máximo de edificios de reino (${capacity})`;
    }
  }
  if (buildRecipe.upgradesRecipeKey) {
    // `status: 'ACTIVO'` (2026-08-23, Grupo 3 § Building.status): antes de que EN_CONSTRUCCION
    // fuera alcanzable de verdad, esta fila SIEMPRE era ACTIVO, así que el filtro no hacía falta —
    // ahora sí, para no dejar mejorar un Ayuntamiento que todavía se está terminando de levantar.
    const target = await db.building.findFirst({ where: { saveId, recipeKey: buildRecipe.upgradesRecipeKey, status: 'ACTIVO' } });
    const expectedCurrentTier = (buildRecipe.ayuntamientoNivel ?? 1) - 1;
    if (!target) {
      return 'no tiene ningún Ayuntamiento que mejorar todavía';
    }
    if ((target.tier ?? 1) !== expectedCurrentTier) {
      return 'su Ayuntamiento no está en el nivel justo anterior para esta mejora';
    }
  }
  // Máximo 1 Ayuntamiento por partida (de facto, "por continente" — hoy solo Berig está en juego):
  // solo aplica al tier 1 (construcción NUEVA, sin `upgradesRecipeKey`) — las mejoras ya están
  // cubiertas por la comprobación de arriba, que exige que SÍ exista uno.
  if (buildRecipe.key === 'ayuntamiento' && !buildRecipe.upgradesRecipeKey) {
    const existing = await db.building.findFirst({ where: { saveId, recipeKey: 'ayuntamiento' } });
    if (existing) {
      return 'solo puede haber un Ayuntamiento por continente — hay que mejorar el que ya existe, no construir otro';
    }
  }
  return null;
}

/// Building.status EN_CONSTRUCCION real (2026-08-23, Grupo 3 — auditoría de elementos
/// desconectados, 2026-08-23: "EN_CONSTRUCCION/DANADO/ABANDONADO son todos inalcanzables, todo se
/// crea directamente como ACTIVO"). Hasta ahora, la fila de `Building` no existía en absoluto
/// hasta que la construcción ya estaba terminada (se crea dentro de `narrateAndPersistTurn`, solo
/// al resolverse el `CharacterTransit` de la acción larga) — no había ningún momento intermedio
/// visible en la partida donde "existe pero se está construyendo".
///
/// Llamada desde `turn.ts` en el mismo instante en que se crea ese `CharacterTransit` (chequeo
/// barato de intención primero, mismo criterio que `detectDeterministicCraft`), para poder crear
/// la fila YA con `status: 'EN_CONSTRUCCION'` — el propio panel de Reino ya sabía pintar esa
/// etiqueta, solo esperaba a que el motor la produjera alguna vez. El chequeo de aquí es "mejor
/// esfuerzo" (con `prisma`, no `tx`) exactamente igual que `resolveBuildIntentContext`
/// (turnResolution.ts): la revalidación real y obligatoria sigue pasando dentro de la transacción
/// al resolver, que puede seguir rechazando la construcción si algo cambió mientras tanto — ver
/// `earlyBuildingId` en turnResolution.ts para cómo se borra esa fila a medias si eso pasa.
///
/// Acotado a construcción NUEVA (`!buildRecipe.upgradesRecipeKey`): una mejora de Ayuntamiento
/// sigue resolviéndose síncrona como siempre, sin fila EN_CONSTRUCCION propia — el edificio base
/// ya existe y sigue ACTIVO mientras dura la mejora, no hace falta un estado intermedio nuevo para
/// eso (alcance acordado con la usuaria, primera pasada).
export async function planDeterministicBuild(params: {
  action: string;
  worldId: string;
  saveId: string;
  currentLocationId: string;
  activeRegion: string | null;
  inventoryRows: InventoryRowLike[];
  attributes: AttributeBlock;
  secondaryAttributes: SecondaryAttributeBlock;
}): Promise<ConstructionRecipe | null> {
  const { action, worldId, saveId, currentLocationId, activeRegion, inventoryRows, attributes, secondaryAttributes } = params;
  const buildRecipe = CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, action));
  if (!buildRecipe || buildRecipe.upgradesRecipeKey) return null;

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
  const alivio = buildRecipe.oficio ? alivioForLevel(oficioNivelById.get(buildRecipe.oficio) ?? 1) : 0;
  const tieneOficio = buildRecipe.oficio ? oficioNivelById.has(buildRecipe.oficio) : true;

  const check = checkRecipe(buildRecipe, inventoryRows, catalogBySlug, attributes, secondaryAttributes, alivio, tieneOficio);
  if (!check.met) return null;
  const blockedReason = await computeBuildBlockedReason({
    db: prisma,
    saveId,
    worldId,
    buildRecipe,
    activeRegion,
    currentLocationRecord: { id: currentLocationId },
  });
  if (blockedReason) return null;
  return buildRecipe;
}
