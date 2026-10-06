import { normalizeText, buildAdjacency, shortestPath } from './travel.js';
import type { AttributeBlock } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';
import { checkRequisitos, type Requisitos } from './requisitos.js';
import { totalQuantity, planConsumption, type IngredientRequirement, type CatalogLookup, type InventoryRowLike } from './ingredients.js';
import { prisma } from '../lib/prisma.js';
import { alivioForLevel } from './professionProgress.js';
import { matchesOficioPrefix } from './harvestAbilities.js';
import { locationTerrainTags } from '../scripts/worldCatalog.js';
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
  /// Reglas de construcciones/reino (2026-08-04, docs/mecanicas/17-reglas-construcciones-reino.md) — cuántos
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
  /// Conquista territorial estilo X4 (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — cuántos
  /// Cuarteles Avanzados (`CUARTEL_AVANZADO_RECIPE.key`) puedes tener ACTIVOS a la vez con este
  /// nivel de Ayuntamiento. Cupo NUEVO e INDEPENDIENTE de `reinoBuildingCapacity` (edificios
  /// normales) — solo lo llevan las 3 recetas de Ayuntamiento. Cifra de partida (1/5/10), ajustable
  /// jugando, mismo criterio que `reinoBuildingCapacity` (10/25/60, tampoco verificado en vivo).
  cuartelAvanzadoCapacity?: number;
  /// true SOLO en `CUARTEL_AVANZADO_RECIPE` — distingue "el puesto avanzado en sí" (cuenta contra
  /// `cuartelAvanzadoCapacity` del Ayuntamiento, 1 por región) de sus edificios internos futuros
  /// (`edificioTipo` abajo, cuentan contra el cupo LOCAL de ESE Cuartel concreto). Necesario porque
  /// `requiresAyuntamiento` por sí solo no basta para distinguirlos: ambos lo llevan.
  isCuartelAvanzado?: boolean;
  /// Bono de cupo LOCAL que da una mejora de Cuartel (`CUARTEL_DE_GUERRA_RECIPE`/
  /// `PUESTO_COMERCIAL_RECIPE`, ambas con `upgradesRecipeKey: 'cuartel-avanzado'`) — bifurcación
  /// única, nunca ambas a la vez (mismo criterio que especialización de clase del jugador: una
  /// vez elegida una rama, la otra deja de estar disponible para ESE Cuartel). Solo uno de los dos
  /// campos relleno por receta.
  cuartelUpgradeBonus?: { defensa?: number; produccion?: number };
  /// Solo tiene sentido en un edificio que cuelga DENTRO de un Cuartel Avanzado concreto (todavía
  /// sin ninguna receta real que lo use — "poca variedad de edificios todavía", ver § 7.4) — cuenta
  /// contra el cupo LOCAL de defensa o producción de ESE Cuartel, no contra ningún cupo de partida.
  edificioTipo?: 'defensa' | 'produccion';
  /// Edificios de oficio (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md, 2026-09-28) — qué
  /// `CraftingRecipe.oficio` (crafting.ts) puede trabajarse dentro de este `Building` una vez
  /// `ACTIVO`. Solo lo llevan las 14 recetas de nivel 1 de edificios de oficio (sus mejoras heredan
  /// el mismo oficio del edificio que actualizan, no hace falta repetirlo). `kingdomProduction.ts`
  /// lo usa para el gate `NIVEL_EDIFICIO_INSUFICIENTE` — ver `oficioProducidoForRecipeKey` más abajo.
  oficioProducido?: string;
  /// Regla de sitio (mismo documento, § 3): 'costa' exige que la Location tenga el TerrainTag
  /// 'costero' o 'acuatico' (locationTerrainTags, worldCatalog.ts); 'veta' exige 'rocoso' (proxy de
  /// "tiene mena" — no existe un tag 'veta' propio, y tuguear uno nuevo para una sola condición de
  /// sitio sería sobre-ingeniería). Solo Boca de mina y Embarcadero de pesca lo llevan. Una Location
  /// sin tags catalogados (la mayoría del núcleo jugable hoy, incluido Karot Veku) nunca bloquea —
  /// mismo criterio "solo penaliza si hay dato real" que `pasaFiltroTerreno` (terrain.ts).
  condicionRegion?: 'costa' | 'veta';
  /// Nivel de edificio de oficio que esta receta deja tras completarse (1/2/3 = Taller/Obrador/Gran
  /// obrador) — se copia a `Building.tier`, mismo mecanismo que `ayuntamientoNivel` pero para
  /// edificios de oficio. Solo lo llevan las 14 recetas base (nivel 1) y sus 28 mejoras.
  edificioOficioNivel?: number;
  /// Nivel de Ayuntamiento mínimo (`Building.tier` del Ayuntamiento ACTIVO) para poder levantar/
  /// mejorar a este nivel de edificio de oficio (§ 2: Obrador exige Ayuntamiento mediano, Gran
  /// obrador exige grande). El nivel de oficio `constructor` mínimo (3/6) se exige, en cambio, vía
  /// `requisitos`/`oficio` normales igual que ya hace el propio Ayuntamiento mediano/grande (más
  /// atributo, no un umbral de nivel de oficio nuevo — no existe ese mecanismo en el proyecto y
  /// añadir uno solo para esto sería sobre-ingeniería).
  ayuntamientoNivelMinimo?: number;
  /// CR-53 (hito 0.3, Fase D, Q1-Q2): lo que este edificio da a la economía de supervivencia del
  /// Reino — agua al día y capacidad de almacén por categoría (`cronista/economiaReino.ts`).
  suministro?: { aguaDia?: number; topeComida?: number; topeBebida?: number; topeMateriales?: number };
}

/// Nivel de edificio requerido por tier de receta de oficio (docs/rpgtarkor/sistemas-reino/
/// edificios-de-oficio.md § 2, D&D "tres escalones"): Taller (1) admite tiers 1-3, Obrador (2)
/// tiers 4-6, Gran obrador (3) tiers 7-9 — `Math.ceil(tier / 3)` es la misma tabla en una línea.
/// Exportado para que `kingdomProduction.ts` no reimplique el mismo criterio.
export function nivelEdificioRequeridoParaTier(tier: number): number {
  return Math.ceil(Math.max(1, tier) / 3);
}

/// Valor de `Building.tier` que deja una receta al completarse: nivel de Ayuntamiento o nivel de
/// edificio de oficio. Único punto de verdad para los cuatro sitios que crean o mejoran un Building.
export function buildingTierFor(recipe: ConstructionRecipe): number | null {
  return recipe.ayuntamientoNivel ?? recipe.edificioOficioNivel ?? null;
}

/// Plazas de trabajador por nivel de edificio de oficio (mismo documento, § 2: "Bellwright: una
/// estación admite varios aldeanos, más plazas es la recompensa natural de mejorarla") — 1/2/4,
/// null para edificios sin `Building.tier` propio (Campamento, Choza... nunca gatean por plazas).
/// Exportado para que la ruta de asignar Companion a Building (companeros.ts) lo use como tope.
export function plazasTrabajadorParaTier(tier: number | null): number | null {
  if (tier == null) return null;
  if (tier <= 1) return 1;
  if (tier === 2) return 2;
  return 4;
}

/// Distancia máxima (minutos de viaje reales, mismo grafo que `shortestPath`/`buildAdjacency` de
/// travel.ts) entre un edificio de tipo reino y el Ayuntamiento del que depende — bastante para
/// cubrir el núcleo medido de una región (docs/mecanicas/13-escala-del-mundo.md § 1.1: la mayoría de tramos
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
/// docs/mecanicas/17-reglas-construcciones-reino.md): antes `ConstructionRecipe.oficio` solo
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
  // docs/mecanicas/17-reglas-construcciones-reino.md): antes solo 15 piedra + 10 leña (2
  // categorías). El pequeño se queda 100% crudo a propósito (mediano/grande SÍ pasan a materiales
  // procesados por oficio regional — ver AYUNTAMIENTO_MEDIANO_RECIPE/AYUNTAMIENTO_GRANDE_RECIPE
  // más abajo, mismo día) — cifras dadas por la usuaria.
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
  cuartelAvanzadoCapacity: 1,
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
  // docs/mecanicas/17-reglas-construcciones-reino.md): antes solo 30 piedra + 25 leña crudas.
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
  cuartelAvanzadoCapacity: 5,
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
  cuartelAvanzadoCapacity: 10,
};

// Jaula (Grupo 3 § Compañeros y supervivencia, 2026-08-25, ver
// docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md § 2) — "el sitio físico donde se cuida al animal
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

// Edificios de oficio (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md, 2026-09-28) — un
// edificio por profesión orca, `edificioTipo: 'produccion'`, `requiresAyuntamiento: true` (cuentan
// contra `reinoBuildingCapacity` igual que la Choza). 3 niveles cada uno (Taller/Obrador/Gran
// obrador, `edificioOficioNivel` 1/2/3, mismo mecanismo UPDATE-de-tier que el Ayuntamiento). Coste
// nivel 1 calibrado contra la Choza (~20 materiales básicos + 1 pieza propia del oficio, § 3);
// cada mejora ronda el doble y pide un material procesado real del catálogo. Todas construcción
// orca de las Llanuras (`raza: 'orcos'`) — las 3 variantes regionales de aspecto (Llanuras/Cristal
// Helado/Ciénaga) quedan para cuando esas regiones sean jugables (§ 3), aquí solo la de Llanuras.
//
// Ingredientes: solo materiales/piezas que ya existen en el catálogo (worldCatalog.ts/
// crafting.ts) — no se inventa ningún `catalogSlug` nuevo. La "caña de pescar" del documento sí
// existe (CraftingRecipe 'canaPesca', crafting.ts, `resultCatalogSlug: 'cana-pesca'`).
export const HERRERIA_RECIPE: ConstructionRecipe = {
  key: 'herreria',
  name: 'una herrería orca de las Llanuras',
  description:
    'Fragua de piedra y arcilla cocida con un yunque real, donde fundir mena en lingotes y forjar armas y armaduras de metal — el primer paso para que un reino deje de depender de comprar cada hoja fuera.',
  raza: 'orcos',
  nounRegex: /(?=.*herrer)(?!.*(orcos del clan|del clan serhu))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 12, label: 'piedra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'mena' }, cantidad: 6, label: 'mena' },
    { match: { kind: 'exact', catalogSlug: 'piedra-de-afilar' }, cantidad: 1, label: 'piedra de afilar' },
  ],
  requisitos: { fuerza: 10 },
  oficio: 'herrero-orcos-llanuras',
  oficioProducido: 'herrero-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const HERRERIA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'herreria-obrador',
  name: 'un obrador de herrería',
  description: 'La fragua crece: un segundo yunque, un fuelle de tiro más largo y estanterías reales para las aleaciones — ya admite encargos de más peso.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*herrer)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'lingote-de-hierro' }, cantidad: 2, label: 'lingote de hierro' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'mena' }, cantidad: 8, label: 'mena' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 2, label: 'bloque de piedra tallada' },
  ],
  requisitos: { fuerza: 16 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'herreria',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const HERRERIA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'herreria-gran-obrador',
  name: 'un gran obrador de herrería',
  description: 'La forja de un reino de verdad: varios puestos de yunque a la vez y un horno capaz de fundir aleaciones que antes exigían viajar a la Meseta.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*herrer)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'lingote-de-hierro' }, cantidad: 5, label: 'lingote de hierro' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 4, label: 'bloque de piedra tallada' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'mena' }, cantidad: 10, label: 'mena' },
  ],
  requisitos: { fuerza: 22 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'herreria',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const CURTIDURIA_RECIPE: ConstructionRecipe = {
  key: 'curtiduria',
  name: 'una curtiduría orca de las Llanuras',
  description: 'Bastidores de madera alrededor de una hoguera baja que nunca se apaga del todo, donde tensar y curtir pieles crudas hasta cuero real — la base de cualquier armadura de piel pesada.',
  raza: 'orcos',
  nounRegex: /(?=.*curtidur)(?!.*(orcos del clan|del clan serhu))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 10, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 8, label: 'piel' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 3, label: 'cuerda de tendón' },
    { match: { kind: 'exact', catalogSlug: 'cuchillo-deshuello' }, cantidad: 1, label: 'cuchillo de deshuello' },
  ],
  requisitos: { destreza: 8 },
  oficio: 'curtidor-orcos-llanuras',
  oficioProducido: 'curtidor-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const CURTIDURIA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'curtiduria-obrador',
  name: 'un obrador de curtiduría',
  description: 'Más bastidores y una segunda hoguera de curtido — varias pieles a la vez sin que ninguna se eche a perder por esperar turno.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*curtidur)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 16, label: 'piel' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 2, label: 'viga de madera tallada' },
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 2, label: 'cordaje trenzado' },
  ],
  requisitos: { destreza: 14 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'curtiduria',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const CURTIDURIA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'curtiduria-gran-obrador',
  name: 'un gran obrador de curtiduría',
  description: 'La curtiduría de un reino de verdad: bastidores cubiertos en fila, capaces de procesar la caza de varias partidas de caza a la vez sin que se acumule sin curtir.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*curtidur)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 24, label: 'piel' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 4, label: 'viga de madera tallada' },
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 4, label: 'cordaje trenzado' },
  ],
  requisitos: { destreza: 20 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'curtiduria',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const PELETERIA_RECIPE: ConstructionRecipe = {
  key: 'peleteria',
  name: 'una peletería orca de las Llanuras',
  description: 'Mesas de corte y agujas de hueso para dar forma a ropa y abrigo de piel real — capas, capuchas, guantes — a partir del cuero que ya sale de la curtiduría.',
  raza: 'orcos',
  nounRegex: /(?=.*peleter)(?!.*(orcos del clan|del clan helsig))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 10, label: 'piel' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 6, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'kit-costura-hueso' }, cantidad: 1, label: 'kit de costura de hueso' },
  ],
  requisitos: { destreza: 8 },
  oficio: 'peletero-orcos-llanuras',
  oficioProducido: 'peletero-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const PELETERIA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'peleteria-obrador',
  name: 'un obrador de peletería',
  description: 'Más mesas de corte y estanterías de patrones — varias prendas a la vez, no una a una.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*peleter)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'kit-costura-hueso' }, cantidad: 2, label: 'kit de costura de hueso' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 8, label: 'fibra' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 1, label: 'viga de madera tallada' },
  ],
  requisitos: { destreza: 14 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'peleteria',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const PELETERIA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'peleteria-gran-obrador',
  name: 'un gran obrador de peletería',
  description: 'Un taller de sastres reales, no de aprendices — de aquí puede salir el abrigo de todo un ejército en marcha.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*peleter)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'kit-costura-hueso' }, cantidad: 4, label: 'kit de costura de hueso' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 14, label: 'fibra' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 2, label: 'viga de madera tallada' },
  ],
  requisitos: { destreza: 20 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'peleteria',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const DESOLLADERO_RECIPE: ConstructionRecipe = {
  key: 'desolladero',
  name: 'un desolladero orco de las Llanuras',
  description: 'Bastidores para tensar pieles y un canal que saca la sangre lejos del resto del reino — aquí se despieza de verdad lo que trae cada partida de caza: carne, piel, hueso, garra.',
  raza: 'orcos',
  nounRegex: /(?=.*desollader)(?!.*(orcos del clan|del clan serhu))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 8, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 6, label: 'piedra' },
    { match: { kind: 'exact', catalogSlug: 'cuchillo-hielo-silice' }, cantidad: 1, label: 'cuchillo de hielo sílice' },
  ],
  requisitos: { fuerza: 10 },
  oficio: 'desollador-orcos-llanuras',
  oficioProducido: 'desollador-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const DESOLLADERO_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'desolladero-obrador',
  name: 'un obrador de desolladero',
  description: 'Más bastidores y un segundo canal de sangre — varias presas a la vez sin que se echen a perder esperando.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*desollader)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 2, label: 'bloque de piedra tallada' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'hueso' }, cantidad: 6, label: 'hueso' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 3, label: 'cuerda de tendón' },
  ],
  requisitos: { fuerza: 16 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'desolladero',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const DESOLLADERO_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'desolladero-gran-obrador',
  name: 'un gran obrador de desolladero',
  description: 'Una línea entera de despiece, capaz de procesar la caza de una partida grande en una sola tarde.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*desollader)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 4, label: 'bloque de piedra tallada' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'hueso' }, cantidad: 10, label: 'hueso' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 6, label: 'cuerda de tendón' },
  ],
  requisitos: { fuerza: 22 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'desolladero',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const CORRALES_RECIPE: ConstructionRecipe = {
  key: 'corrales',
  name: 'unos corrales del Domador',
  description: 'Recinto de postes reforzados con un abrevadero de piedra, donde aclimatar a las bestias recién capturadas antes de que pasen a ser compañeros de verdad — la leche, lana y crías de los animales domados también salen de aquí.',
  raza: 'orcos',
  nounRegex: /(?=.*corral)(?!.*(domador$|del domador$))|corrales del domador/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 10, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'hueso-largo-gargantua' }, cantidad: 3, label: 'hueso largo de gargantúa' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 4, label: 'cuerda de tendón' },
  ],
  requisitos: { voluntad: 8 },
  oficio: 'domador-orcos-llanuras',
  oficioProducido: 'domador-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const CORRALES_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'corrales-obrador',
  name: 'un obrador de corrales',
  description: 'Más recinto y un segundo abrevadero — varias bestias aclimatándose a la vez sin que se disputen el sitio.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*corral)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'hueso-largo-gargantua' }, cantidad: 5, label: 'hueso largo de gargantúa' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 8, label: 'piedra' },
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 2, label: 'cordaje trenzado' },
  ],
  requisitos: { voluntad: 14 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'corrales',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const CORRALES_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'corrales-gran-obrador',
  name: 'un gran obrador de corrales',
  description: 'El recinto de un reino que ya doma en serio — sitio real para varias bestias grandes a la vez, no solo las que caben en una jaula.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*corral)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'hueso-largo-gargantua' }, cantidad: 8, label: 'hueso largo de gargantúa' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 14, label: 'piedra' },
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 4, label: 'cordaje trenzado' },
  ],
  requisitos: { voluntad: 20 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'corrales',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const CARPINTERIA_RECIPE: ConstructionRecipe = {
  key: 'carpinteria',
  name: 'una carpintería orca de las Llanuras',
  description: 'Bancos con herramientas de asta y hueso donde dar forma a madera en vigas talladas y cordaje real — mangos de arma y astas, la base de la mitad de las mejoras de un reino.',
  raza: 'orcos',
  nounRegex: /(?=.*carpinter)(?!.*(orcos del clan|del clan serhu))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 12, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 6, label: 'fibra' },
    { match: { kind: 'exact', catalogSlug: 'hacha-de-mano-orca' }, cantidad: 1, label: 'hacha de mano orca' },
  ],
  requisitos: { fuerza: 10 },
  oficio: 'carpintero-orcos-llanuras',
  oficioProducido: 'carpintero-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const CARPINTERIA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'carpinteria-obrador',
  name: 'un obrador de carpintería',
  description: 'Un segundo banco y sierras más largas — varias vigas a la vez, no una detrás de otra.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*carpinter)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 2, label: 'viga de madera tallada' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 10, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 2, label: 'cordaje trenzado' },
  ],
  requisitos: { fuerza: 16 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'carpinteria',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const CARPINTERIA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'carpinteria-gran-obrador',
  name: 'un gran obrador de carpintería',
  description: 'El taller de un reino que ya construye en serio — vigas y cordaje suficientes para levantar el resto de edificios de oficio sin depender de comprarlos fuera.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*carpinter)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 4, label: 'viga de madera tallada' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 16, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 4, label: 'cordaje trenzado' },
  ],
  requisitos: { fuerza: 22 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'carpinteria',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const SASTRERIA_RECIPE: ConstructionRecipe = {
  key: 'sastreria',
  name: 'una sastrería orca de las Llanuras',
  description: 'Mesas de corte y estanterías de tela y fieltro real, donde coser mochilas y prendas de fibra o lana — lo que la peletería no cubre porque no es piel.',
  raza: 'orcos',
  nounRegex: /sastreria|sastrería/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 12, label: 'fibra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 4, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'kit-costura-hueso' }, cantidad: 1, label: 'kit de costura de hueso' },
  ],
  requisitos: { destreza: 8 },
  oficio: 'sastre-orcos-llanuras',
  oficioProducido: 'sastre-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const SASTRERIA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'sastreria-obrador',
  name: 'un obrador de sastrería',
  description: 'Más mesas de corte y un segundo telar de fieltro — varias prendas de fibra a la vez.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*sastrer)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 18, label: 'fibra' },
    { match: { kind: 'exact', catalogSlug: 'kit-costura-hueso' }, cantidad: 2, label: 'kit de costura de hueso' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 1, label: 'viga de madera tallada' },
  ],
  requisitos: { destreza: 14 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'sastreria',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const SASTRERIA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'sastreria-gran-obrador',
  name: 'un gran obrador de sastrería',
  description: 'Un taller de fieltro y fibra a escala de reino, capaz de vestir a una guarnición entera.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*sastrer)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 26, label: 'fibra' },
    { match: { kind: 'exact', catalogSlug: 'kit-costura-hueso' }, cantidad: 3, label: 'kit de costura de hueso' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 2, label: 'viga de madera tallada' },
  ],
  requisitos: { destreza: 20 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'sastreria',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const HERBORISTERIA_RECIPE: ConstructionRecipe = {
  key: 'herboristeria',
  name: 'una herboristería orca de las Llanuras',
  description: 'Estancia baja de adobe con cuerdas para secar hierbas de la región — de aquí salen los manojos y cataplasmas básicas, y la materia prima de la alquimia.',
  raza: 'orcos',
  nounRegex: /(?=.*herboris)(?!.*(orcos del clan|del clan serhu|del clan helsig))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 6, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 6, label: 'piedra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 5, label: 'fibra' },
  ],
  requisitos: { inteligencia: 8 },
  oficio: 'herborista-orcos-llanuras',
  oficioProducido: 'herborista-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const HERBORISTERIA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'herboristeria-obrador',
  name: 'un obrador de herboristería',
  description: 'Más cuerdas de secado y un segundo mortero de piedra — varios manojos secándose a la vez.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*herboris)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 10, label: 'fibra' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 1, label: 'bloque de piedra tallada' },
    { match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 3, label: 'manojo de salvia del polvo' },
  ],
  requisitos: { inteligencia: 14 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'herboristeria',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const HERBORISTERIA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'herboristeria-gran-obrador',
  name: 'un gran obrador de herboristería',
  description: 'Un herbario real, con hileras enteras de plantas secándose — la reserva de medicina de un reino que ya no depende solo de lo que trae cada partida.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*herboris)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 16, label: 'fibra' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 2, label: 'bloque de piedra tallada' },
    { match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 6, label: 'manojo de salvia del polvo' },
  ],
  requisitos: { inteligencia: 20 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'herboristeria',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const CASA_DE_CURAS_RECIPE: ConstructionRecipe = {
  key: 'casa-de-curas',
  name: 'una casa de curas orca de las Llanuras',
  description: 'Camastros y mesas de vendaje donde los compañeros heridos del reino se recuperan más rápido — servicio, no solo producción: mientras esté ACTIVA, cura un estado más cada día.',
  raza: 'orcos',
  nounRegex: /casa de curas|casa-de-curas/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 8, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 6, label: 'piel' },
    { match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 3, label: 'manojo de salvia del polvo' },
  ],
  requisitos: { voluntad: 8 },
  oficio: 'primeros-auxilios-orcos-llanuras',
  oficioProducido: 'primeros-auxilios-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const CASA_DE_CURAS_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'casa-de-curas-obrador',
  name: 'un obrador de casa de curas',
  description: 'Más camastros y vendajes de reserva — varios compañeros heridos a la vez, no uno detrás de otro.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*casa)(?=.*curas)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 10, label: 'piel' },
    { match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 5, label: 'manojo de salvia del polvo' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 1, label: 'viga de madera tallada' },
  ],
  requisitos: { voluntad: 14 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'casa-de-curas',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const CASA_DE_CURAS_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'casa-de-curas-gran-obrador',
  name: 'un gran obrador de casa de curas',
  description: 'Una enfermería de reino de verdad, con camastros suficientes para toda una guarnición herida.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*casa)(?=.*curas)/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 16, label: 'piel' },
    { match: { kind: 'exact', catalogSlug: 'manojo-salvia-polvo' }, cantidad: 10, label: 'manojo de salvia del polvo' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 2, label: 'viga de madera tallada' },
  ],
  requisitos: { voluntad: 20 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'casa-de-curas',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const TALLER_ALQUIMIA_RECIPE: ConstructionRecipe = {
  key: 'taller-alquimia',
  name: 'un taller de alquimia orco de las Llanuras',
  description: 'Un fogón de fuego lento y recipientes reales donde convertir lo que trae la herboristería en pociones, contravenenos y filtros de verdad.',
  raza: 'orcos',
  nounRegex: /(?=.*taller)(?=.*alquimi)(?!.*(orcos del clan|del clan serhu))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 6, label: 'piedra' },
    { match: { kind: 'exact', catalogSlug: 'lena-matorral-cuerno' }, cantidad: 4, label: 'leña de matorral de cuerno' },
    { match: { kind: 'exact', catalogSlug: 'glandula-ignea' }, cantidad: 1, label: 'glándula ígnea' },
  ],
  requisitos: { inteligencia: 10 },
  oficio: 'alquimista-orcos-llanuras',
  oficioProducido: 'alquimista-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const TALLER_ALQUIMIA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'taller-alquimia-obrador',
  name: 'un obrador de alquimia',
  description: 'Un segundo fogón y más recipientes de cuerno — varias mezclas a fuego lento a la vez.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*alquimi)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'lena-matorral-cuerno' }, cantidad: 8, label: 'leña de matorral de cuerno' },
    { match: { kind: 'exact', catalogSlug: 'glandula-ignea' }, cantidad: 2, label: 'glándula ígnea' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 1, label: 'bloque de piedra tallada' },
  ],
  requisitos: { inteligencia: 16 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'taller-alquimia',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const TALLER_ALQUIMIA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'taller-alquimia-gran-obrador',
  name: 'un gran obrador de alquimia',
  description: 'Un laboratorio de reino, varios fuegos lentos en fila — la producción de pociones de una facción entera, no de un solo alquimista.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*alquimi)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'lena-matorral-cuerno' }, cantidad: 14, label: 'leña de matorral de cuerno' },
    { match: { kind: 'exact', catalogSlug: 'glandula-ignea' }, cantidad: 4, label: 'glándula ígnea' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 2, label: 'bloque de piedra tallada' },
  ],
  requisitos: { inteligencia: 22 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'taller-alquimia',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const COCINA_RECIPE: ConstructionRecipe = {
  key: 'cocina',
  name: 'una cocina común orca de las Llanuras',
  description: 'Ollas de hierro sobre brasas siempre vivas bajo un cobertizo abierto — ahumados, pan y cuajada de verdad para todo el reino, no solo raciones sueltas.',
  raza: 'orcos',
  nounRegex: /(?=.*cocina)(?!.*(orcos del clan|del clan serhu|del clan helsig|comun de karot veku|comun de helske tugh))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 8, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 6, label: 'piedra' },
    { match: { kind: 'exact', catalogSlug: 'odre-agua' }, cantidad: 1, label: 'odre de agua' },
  ],
  requisitos: { constitucion: 8 },
  oficio: 'cocinero-orcos-llanuras',
  oficioProducido: 'cocinero-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const COCINA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'cocina-obrador',
  name: 'un obrador de cocina',
  description: 'Más ollas y un segundo ahumadero — de aquí sale comida de verdad para todo un reino en crecimiento.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*cocina)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'lingote-de-hierro' }, cantidad: 1, label: 'lingote de hierro' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 2, label: 'bloque de piedra tallada' },
    { match: { kind: 'exact', catalogSlug: 'odre-agua' }, cantidad: 2, label: 'odre de agua' },
  ],
  requisitos: { constitucion: 14 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'cocina',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const COCINA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'cocina-gran-obrador',
  name: 'un gran obrador de cocina',
  description: 'La cocina de una capital de verdad — suficiente para alimentar a soldados, trabajadores y visitantes sin que nadie pase hambre.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*cocina)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'lingote-de-hierro' }, cantidad: 2, label: 'lingote de hierro' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 4, label: 'bloque de piedra tallada' },
    { match: { kind: 'exact', catalogSlug: 'odre-agua' }, cantidad: 4, label: 'odre de agua' },
  ],
  requisitos: { constitucion: 20 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'cocina',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const EMBARCADERO_PESCA_RECIPE: ConstructionRecipe = {
  key: 'embarcadero-pesca',
  name: 'un embarcadero de pesca orco de las Llanuras',
  description: 'Un muelle sencillo de madera con cordaje real, para faenar pesca y marisco de verdad — solo tiene sentido junto a costa o agua.',
  raza: 'orcos',
  nounRegex: /embarcadero(?!.*(de ceniza|silh makut))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 10, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 4, label: 'cuerda de tendón' },
    // 'cana-pesca' SÍ existe en el catálogo real (CraftingRecipe 'canaPesca', crafting.ts) — la
    // pieza propia del oficio que el documento pedía sin encontrarla la primera vez que se buscó.
    { match: { kind: 'exact', catalogSlug: 'cana-pesca' }, cantidad: 1, label: 'caña de pescar' },
  ],
  requisitos: { destreza: 8 },
  // 'pescador' sin sufijo regional a propósito (ver comentario junto a `maestro-pescador-serhu`,
  // worldCatalog.ts): es universal, no un combo raza+región de professions.ts.
  oficio: 'pescador',
  oficioProducido: 'pescador',
  edificioOficioNivel: 1,
  condicionRegion: 'costa',
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const EMBARCADERO_PESCA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'embarcadero-pesca-obrador',
  name: 'un obrador de embarcadero de pesca',
  description: 'Un segundo muelle y más cordaje — varias barcas faenando a la vez.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*embarcadero)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 2, label: 'cordaje trenzado' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 2, label: 'viga de madera tallada' },
  ],
  requisitos: { destreza: 14 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'embarcadero-pesca',
  edificioOficioNivel: 2,
  condicionRegion: 'costa',
  ayuntamientoNivelMinimo: 2,
};
export const EMBARCADERO_PESCA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'embarcadero-pesca-gran-obrador',
  name: 'un gran obrador de embarcadero de pesca',
  description: 'Un puerto pesquero de reino — varios muelles y barcas reales faenando la costa entera.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*embarcadero)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 4, label: 'cordaje trenzado' },
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 4, label: 'viga de madera tallada' },
  ],
  requisitos: { destreza: 20 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'embarcadero-pesca',
  edificioOficioNivel: 3,
  condicionRegion: 'costa',
  ayuntamientoNivelMinimo: 3,
};

export const OBRADOR_PIEDRA_RECIPE: ConstructionRecipe = {
  key: 'obrador-piedra',
  name: 'un taller de piedra orco de las Llanuras',
  description: 'Bloques de piedra tallada y columnas de hueso reales — el material de las mejoras de todo el reino, no solo de este edificio.',
  raza: 'orcos',
  nounRegex: /(?=.*taller)(?=.*piedra)(?!.*(herrer|curtidur|peleter|desollader|corral|carpinter|sastrer|herboris|curas|alquimi|cocina|embarcadero|mina))/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 14, label: 'piedra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'hueso' }, cantidad: 4, label: 'hueso' },
    { match: { kind: 'exact', catalogSlug: 'pico-minero' }, cantidad: 1, label: 'pico de minero' },
  ],
  requisitos: { fuerza: 10 },
  oficio: 'constructor-orcos-llanuras',
  oficioProducido: 'constructor-orcos-llanuras',
  edificioOficioNivel: 1,
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const OBRADOR_PIEDRA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'obrador-piedra-obrador',
  name: 'un obrador de piedra',
  description: 'Más canteros y un segundo puesto de tallado — bloques y columnas a mejor ritmo.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*piedra)(?!.*gran)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 3, label: 'bloque de piedra tallada' },
    { match: { kind: 'exact', catalogSlug: 'columna-hueso' }, cantidad: 1, label: 'columna de hueso' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 10, label: 'piedra' },
  ],
  requisitos: { fuerza: 16 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'obrador-piedra',
  edificioOficioNivel: 2,
  ayuntamientoNivelMinimo: 2,
};
export const OBRADOR_PIEDRA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'obrador-piedra-gran-obrador',
  name: 'un gran obrador de piedra',
  description: 'La cantera de un reino de verdad — bloques y columnas suficientes para levantar un gran Ayuntamiento sin depender de la Meseta.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*piedra)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 6, label: 'bloque de piedra tallada' },
    { match: { kind: 'exact', catalogSlug: 'columna-hueso' }, cantidad: 2, label: 'columna de hueso' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 16, label: 'piedra' },
  ],
  requisitos: { fuerza: 22 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'obrador-piedra',
  edificioOficioNivel: 3,
  ayuntamientoNivelMinimo: 3,
};

export const BOCA_MINA_RECIPE: ConstructionRecipe = {
  key: 'boca-mina',
  name: 'una boca de mina orca de las Llanuras',
  description: 'Entrada excavada y apuntalada con vigas, de donde extraer mena y mineral de la región — solo tiene sentido en una zona con veta real.',
  raza: 'orcos',
  nounRegex: /boca de mina|boca-mina/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 10, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 8, label: 'piedra' },
    { match: { kind: 'exact', catalogSlug: 'pico-minero' }, cantidad: 1, label: 'pico de minero' },
  ],
  requisitos: { fuerza: 10 },
  // 'minero-llanuras' (solo región, sin raza) — mismo patrón que 'talador-llanuras', ver
  // startingProfessions.ts: minero/talador escalan solo por región, no por raza+región.
  oficio: 'minero-llanuras',
  oficioProducido: 'minero-llanuras',
  edificioOficioNivel: 1,
  condicionRegion: 'veta',
  companionSlots: 0,
  requiresAyuntamiento: true,
};
export const BOCA_MINA_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'boca-mina-obrador',
  name: 'un obrador de boca de mina',
  description: 'Galerías más profundas y más apuntaladas — mena de mejor calidad, más deprisa.',
  raza: 'orcos',
  nounRegex: /(?=.*obrador)(?=.*mina)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 2, label: 'viga de madera tallada' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 2, label: 'bloque de piedra tallada' },
  ],
  requisitos: { fuerza: 16 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'boca-mina',
  edificioOficioNivel: 2,
  condicionRegion: 'veta',
  ayuntamientoNivelMinimo: 2,
};
export const BOCA_MINA_GRAN_OBRADOR_RECIPE: ConstructionRecipe = {
  key: 'boca-mina-gran-obrador',
  name: 'un gran obrador de boca de mina',
  description: 'Una mina de reino de verdad, varias galerías apuntaladas a la vez — el mineral que sostiene toda la herrería y la construcción.',
  raza: 'orcos',
  nounRegex: /(?=.*gran)(?=.*obrador)(?=.*mina)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 4, label: 'viga de madera tallada' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 4, label: 'bloque de piedra tallada' },
  ],
  requisitos: { fuerza: 22 },
  oficio: 'constructor-orcos-llanuras',
  upgradesRecipeKey: 'boca-mina',
  edificioOficioNivel: 3,
  condicionRegion: 'veta',
  ayuntamientoNivelMinimo: 3,
};

// Cuartel Avanzado (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — "puesto avanzado" ya
// anticipado en el comentario de AYUNTAMIENTO_PEQUENO_RECIPE desde 2026-08-04. A diferencia de la
// Choza (`requiresAyuntamiento`, cuenta contra `reinoBuildingCapacity`), este cuenta contra su
// PROPIO cupo nuevo (`cuartelAvanzadoCapacity` del Ayuntamiento) — `isCuartelAvanzado: true` es
// lo que `computeBuildBlockedReason` usa para no confundir los dos cupos. 1 por región a propósito
// (mismo criterio que Campamento: es la "base física real" de esa región, no tiene sentido 2 —
// coherente con X4, donde una estación de expansión reclama un sector entero, no una esquina de
// él). Igual que la Choza, requiere Ayuntamiento ya en pie (aunque sea en OTRA región — es
// expansión DESDE la capital, no un segundo reino independiente).
export const CUARTEL_AVANZADO_RECIPE: ConstructionRecipe = {
  key: 'cuartel-avanzado',
  name: 'un cuartel avanzado',
  description:
    'Un puesto fortificado modesto, lejos del ayuntamiento — palizada baja, un almacén techado y un fuego de guardia permanente. No gobierna nada por sí solo, pero planta bandera real en una región donde antes no había ninguna: el primer paso de cualquier expansión seria fuera del núcleo del reino.',
  raza: 'orcos',
  nounRegex: /cuartel.*avanzad|avanzad.*cuartel/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 10, label: 'piedra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 10, label: 'leña' },
    { match: { kind: 'exact', catalogSlug: 'cuerda-tendon' }, cantidad: 4, label: 'cuerda de tendón' },
  ],
  requisitos: { fuerza: 12 },
  oficio: 'carpintero-orcos-llanuras',
  companionSlots: 1,
  requiresAyuntamiento: true,
  maxPerRegion: 1,
  isCuartelAvanzado: true,
};

// Mejora A: Cuartel de Guerra — bifurcación única con Puesto Comercial (mismo criterio que
// especialización de clase del jugador: una vez elegida una rama para ESTE Cuartel concreto, la
// otra deja de ofrecerse — `computeBuildBlockedReason` lo impone comprobando que el Cuartel de
// origen no lleve ya la mejora contraria).
export const CUARTEL_DE_GUERRA_RECIPE: ConstructionRecipe = {
  key: 'cuartel-de-guerra',
  name: 'un cuartel de guerra',
  description:
    'El puesto avanzado se refuerza para la guerra de verdad: murallas más altas, torres de vigía en las esquinas, un arsenal real bajo llave. Ya no es un simple campamento fortificado — es un bastión pensado para resistir un asedio, no solo para anunciar presencia.',
  raza: 'orcos',
  nounRegex: /(?=.*cuartel)(?=.*guerra)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'lingote-de-hierro' }, cantidad: 3, label: 'lingote de hierro' },
    { match: { kind: 'exact', catalogSlug: 'bloque-piedra-tallada' }, cantidad: 4, label: 'bloque de piedra tallada' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'mena' }, cantidad: 4, label: 'mena' },
  ],
  requisitos: { fuerza: 16 },
  oficio: 'herrero-orcos-llanuras',
  upgradesRecipeKey: 'cuartel-avanzado',
  cuartelUpgradeBonus: { defensa: 10 },
};

// Mejora B: Puesto Comercial — la otra rama, nunca junto a Cuartel de Guerra en el mismo Cuartel.
export const PUESTO_COMERCIAL_RECIPE: ConstructionRecipe = {
  key: 'puesto-comercial',
  name: 'un puesto comercial',
  description:
    'El puesto avanzado se vuelca en la producción: almacenes ampliados, talleres cubiertos, una explanada donde secar y curtir sin depender del clima. Ya no es solo un punto de guardia — es donde la región empieza a rendir de verdad para el reino.',
  raza: 'orcos',
  nounRegex: /(?=.*puesto)(?=.*comercial)/,
  requirements: [
    { match: { kind: 'exact', catalogSlug: 'viga-madera-tallada' }, cantidad: 4, label: 'viga de madera tallada' },
    { match: { kind: 'exact', catalogSlug: 'cordaje-trenzado' }, cantidad: 3, label: 'cordaje trenzado' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 6, label: 'fibra' },
  ],
  requisitos: { carisma: 14 },
  oficio: 'carpintero-orcos-llanuras',
  upgradesRecipeKey: 'cuartel-avanzado',
  cuartelUpgradeBonus: { produccion: 10 },
};

// CR-40 (hito 0.2, Q12): tablón de avisos del Reino — muestra las misiones secundarias de las
// facciones con las que el Reino tiene tratado o alianza. Común a todos los pueblos, uno por región.
export const TABLON_AVISOS_RECIPE: ConstructionRecipe = {
  key: 'tablon-avisos',
  name: 'un tablón de avisos',
  description:
    'Un poste ancho clavado en la plaza del reino, con tablillas y cordeles donde se cuelgan los avisos de quien necesita manos: cacerías, entregas, escoltas. Quien pasa por el reino sabe que aquí se encuentra trabajo.',
  // CR-43: también por el nombre de cada pueblo (poste de cacería, estela de edictos, muro de los
  // susurros, árbol de las marcas).
  nounRegex: /tabl[oó]n.*avisos?|poste de cacer[ií]a|estela de edictos|muro de los susurros|[aá]rbol de las marcas/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 6, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 4, label: 'fibra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 2, label: 'piel' },
  ],
  tier: 1,
  requisitos: { carisma: 8 },
  requiresAyuntamiento: true,
  maxPerRegion: 1,
};

// CR-47 (hito 0.2, Fase G): Mercado del Reino — donde se dejan las órdenes permanentes de compra y
// venta que cumplen las caravanas (como el Mercado de Bellwright). Común a todos los pueblos, uno
// por región, con Ayuntamiento.
export const MERCADO_RECIPE_KEY = 'mercado';
export const MERCADO_RECIPE: ConstructionRecipe = {
  key: MERCADO_RECIPE_KEY,
  name: 'un mercado',
  description:
    'Una explanada con puestos cubiertos, una báscula y un corral para las bestias de carga. Desde aquí salen las caravanas del reino a comerciar con quien tenga trato con él, y aquí se apunta qué comprar y qué vender cuando sobra o falta.',
  nounRegex: /\bmercado\b/,
  requirements: [
    { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 8, label: 'leña' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 6, label: 'fibra' },
    { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 4, label: 'piel' },
  ],
  tier: 1,
  requisitos: { carisma: 10 },
  requiresAyuntamiento: true,
  maxPerRegion: 1,
};

// CR-53 (hito 0.3, Fase D, decisiones Q1-Q2 de la usuaria del 2026-10-06): edificios de la economía
// de supervivencia, comunes a todos los pueblos y con Ayuntamiento. Pozo: agua; Granero, Cisterna y
// Leñera: capacidad de almacén (comida, agua y materiales). Varios por Reino.
const REQUISITOS_SUMINISTRO = (extra: IngredientRequirement[]): IngredientRequirement[] => [
  { match: { kind: 'category', tipo: 'RECURSO', category: 'madera' }, cantidad: 6, label: 'leña' },
  ...extra,
];
export const POZO_RECIPE: ConstructionRecipe = {
  key: 'pozo',
  name: 'un pozo',
  description: 'Un brocal de piedra sobre un agujero cavado hasta dar con agua, con un torno y un cubo. Saca agua para doce bocas al día.',
  nounRegex: /\bpozo\b/,
  requirements: REQUISITOS_SUMINISTRO([{ match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 6, label: 'piedra' }]),
  tier: 1,
  requisitos: { fuerza: 8 },
  requiresAyuntamiento: true,
  suministro: { aguaDia: 12 },
};
export const GRANERO_RECIPE: ConstructionRecipe = {
  key: 'granero',
  name: 'un granero',
  description: 'Un cobertizo alzado sobre postes, lejos de la humedad y de los roedores, donde se guarda la comida del Reino.',
  nounRegex: /\bgranero\b/,
  requirements: REQUISITOS_SUMINISTRO([{ match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 4, label: 'fibra' }]),
  tier: 1,
  requisitos: { inteligencia: 8 },
  requiresAyuntamiento: true,
  suministro: { topeComida: 120 },
};
export const CISTERNA_RECIPE: ConstructionRecipe = {
  key: 'cisterna',
  name: 'una cisterna',
  description: 'Un depósito de piedra enlucida que recoge y guarda el agua del Reino para los días secos.',
  nounRegex: /\bcisterna\b|\baljibe\b/,
  requirements: REQUISITOS_SUMINISTRO([{ match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 8, label: 'piedra' }]),
  tier: 1,
  requisitos: { inteligencia: 8 },
  requiresAyuntamiento: true,
  suministro: { topeBebida: 120 },
};
export const LENERA_RECIPE: ConstructionRecipe = {
  key: 'lenera',
  name: 'una leñera',
  description: 'Un tejadillo contra el viento donde se apilan la leña, la piedra y la fibra del Reino.',
  nounRegex: /\ble[nñ]era\b/,
  requirements: REQUISITOS_SUMINISTRO([{ match: { kind: 'category', tipo: 'RECURSO', category: 'fibras' }, cantidad: 2, label: 'fibra' }]),
  tier: 1,
  requisitos: { fuerza: 8 },
  requiresAyuntamiento: true,
  suministro: { topeMateriales: 120 },
};

// Orden deliberado (2026-08-04): grande y mediano ANTES que pequeño — `CONSTRUCTION_RECIPES.find`
// se queda con la primera receta cuya `nounRegex` matchea, y el texto "ayuntamiento mediano"
// también matchea el patrón (más simple) del pequeño si ese se comprobara antes. Mismo criterio
// aplicado a las 3 Jaulas nuevas, y a Cuartel de Guerra/Puesto Comercial antes que Cuartel
// Avanzado (mismo motivo: "cuartel de guerra" también contiene "cuartel").
export const CONSTRUCTION_RECIPES: ConstructionRecipe[] = [
  CAMPAMENTO_RECIPE,
  CHOZA_RECIPE,
  MAKTOR_CLAN_TOTEM_RECIPE,
  AYUNTAMIENTO_GRANDE_RECIPE,
  AYUNTAMIENTO_MEDIANO_RECIPE,
  AYUNTAMIENTO_PEQUENO_RECIPE,
  CUARTEL_DE_GUERRA_RECIPE,
  PUESTO_COMERCIAL_RECIPE,
  CUARTEL_AVANZADO_RECIPE,
  TABLON_AVISOS_RECIPE,
  MERCADO_RECIPE,
  POZO_RECIPE,
  GRANERO_RECIPE,
  CISTERNA_RECIPE,
  LENERA_RECIPE,
  JAULA_GRANDE_RECIPE,
  JAULA_MEDIANA_RECIPE,
  JAULA_PEQUENA_RECIPE,
  // Edificios de oficio (2026-09-28) — mismo criterio de orden que Ayuntamiento/Jaula arriba: el
  // "gran obrador" DEBE comprobarse antes que "obrador" a secas, porque su `nounRegex` no excluye
  // "obrador" (solo exige "gran"+"obrador"+oficio) — si "obrador" fuera primero, "un gran obrador
  // de herrería" ya matchearía esa receta más simple antes de llegar a la correcta.
  HERRERIA_GRAN_OBRADOR_RECIPE,
  HERRERIA_OBRADOR_RECIPE,
  HERRERIA_RECIPE,
  CURTIDURIA_GRAN_OBRADOR_RECIPE,
  CURTIDURIA_OBRADOR_RECIPE,
  CURTIDURIA_RECIPE,
  PELETERIA_GRAN_OBRADOR_RECIPE,
  PELETERIA_OBRADOR_RECIPE,
  PELETERIA_RECIPE,
  DESOLLADERO_GRAN_OBRADOR_RECIPE,
  DESOLLADERO_OBRADOR_RECIPE,
  DESOLLADERO_RECIPE,
  CORRALES_GRAN_OBRADOR_RECIPE,
  CORRALES_OBRADOR_RECIPE,
  CORRALES_RECIPE,
  CARPINTERIA_GRAN_OBRADOR_RECIPE,
  CARPINTERIA_OBRADOR_RECIPE,
  CARPINTERIA_RECIPE,
  SASTRERIA_GRAN_OBRADOR_RECIPE,
  SASTRERIA_OBRADOR_RECIPE,
  SASTRERIA_RECIPE,
  HERBORISTERIA_GRAN_OBRADOR_RECIPE,
  HERBORISTERIA_OBRADOR_RECIPE,
  HERBORISTERIA_RECIPE,
  CASA_DE_CURAS_GRAN_OBRADOR_RECIPE,
  CASA_DE_CURAS_OBRADOR_RECIPE,
  CASA_DE_CURAS_RECIPE,
  TALLER_ALQUIMIA_GRAN_OBRADOR_RECIPE,
  TALLER_ALQUIMIA_OBRADOR_RECIPE,
  TALLER_ALQUIMIA_RECIPE,
  COCINA_GRAN_OBRADOR_RECIPE,
  COCINA_OBRADOR_RECIPE,
  COCINA_RECIPE,
  EMBARCADERO_PESCA_GRAN_OBRADOR_RECIPE,
  EMBARCADERO_PESCA_OBRADOR_RECIPE,
  EMBARCADERO_PESCA_RECIPE,
  OBRADOR_PIEDRA_GRAN_OBRADOR_RECIPE,
  OBRADOR_PIEDRA_OBRADOR_RECIPE,
  OBRADOR_PIEDRA_RECIPE,
  BOCA_MINA_GRAN_OBRADOR_RECIPE,
  BOCA_MINA_OBRADOR_RECIPE,
  BOCA_MINA_RECIPE,
];

/// `key` de las recetas que cuentan contra `reinoBuildingCapacity` (edificios normales de reino,
/// como la choza) — `requiresAyuntamiento` por sí solo ya NO basta desde que existe el Cuartel
/// Avanzado (también lo lleva, pero cuenta contra su PROPIO cupo, `cuartelAvanzadoCapacity`, ver
/// `CUARTEL_AVANZADO_RECIPE`) — de ahí el `!r.isCuartelAvanzado` explícito.
const REINO_BUILDING_RECIPE_KEYS: string[] = CONSTRUCTION_RECIPES.filter((r) => r.requiresAyuntamiento && !r.isCuartelAvanzado).map((r) => r.key);

/// Mismo criterio que `REINO_BUILDING_RECIPE_KEYS`, pero para el cupo NUEVO de Cuarteles
/// Avanzados — solo la receta base cuenta (las 2 mejoras actualizan la MISMA fila, nunca crean
/// una nueva, igual que las mejoras de Ayuntamiento).
const CUARTEL_AVANZADO_RECIPE_KEYS: string[] = CONSTRUCTION_RECIPES.filter((r) => r.isCuartelAvanzado).map((r) => r.key);

/// Slots de compañero que da una construcción, por su `recipeKey` guardada en `Building` — 0 para
/// construcciones libres del modelo (`recipeKey: null`) o cualquier clave que no matchee ninguna
/// receta conocida (defensivo: nunca debería pasar, pero no debe reventar si pasa).
export function companionSlotsForRecipeKey(recipeKey: string | null): number {
  return CONSTRUCTION_RECIPES.find((r) => r.key === recipeKey)?.companionSlots ?? 0;
}

/// Oficio que se trabaja dentro de un `Building`, por su `recipeKey` guardada — null si el edificio
/// no es de oficio (Choza, Campamento, construcciones libres...). Las mejoras (Obrador/Gran obrador)
/// no cambian la `recipeKey` del edificio (actualizan la misma fila), así que basta con la receta
/// base; por si acaso, una mejora resuelve a la base vía `upgradesRecipeKey`.
export function oficioProducidoForRecipeKey(recipeKey: string | null): string | null {
  if (!recipeKey) return null;
  const receta = CONSTRUCTION_RECIPES.find((r) => r.key === recipeKey);
  if (!receta) return null;
  if (receta.oficioProducido) return receta.oficioProducido;
  const base = receta.upgradesRecipeKey ? CONSTRUCTION_RECIPES.find((r) => r.key === receta.upgradesRecipeKey) : undefined;
  return base?.oficioProducido ?? null;
}

/// Capacidad de edificios de reino según el nivel actual del Ayuntamiento (`Building.tier`) —
/// deriva de las 3 recetas en vez de repetir los números 10/25/60 sueltos en turnResolution.ts.
function reinoBuildingCapacityForTier(tier: number): number {
  const recipe = [AYUNTAMIENTO_PEQUENO_RECIPE, AYUNTAMIENTO_MEDIANO_RECIPE, AYUNTAMIENTO_GRANDE_RECIPE].find(
    (r) => r.ayuntamientoNivel === tier,
  );
  return recipe?.reinoBuildingCapacity ?? 0;
}

/// Mismo criterio que `reinoBuildingCapacityForTier`, para el cupo NUEVO de Cuarteles Avanzados
/// (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — deriva de `cuartelAvanzadoCapacity` en
/// vez de repetir 1/5/10 sueltos.
function cuartelAvanzadoCapacityForTier(tier: number): number {
  const recipe = [AYUNTAMIENTO_PEQUENO_RECIPE, AYUNTAMIENTO_MEDIANO_RECIPE, AYUNTAMIENTO_GRANDE_RECIPE].find(
    (r) => r.ayuntamientoNivel === tier,
  );
  return recipe?.cuartelAvanzadoCapacity ?? 0;
}

/// `key` de las 2 mejoras de Cuartel Avanzado — para comprobar la bifurcación única (nunca ambas
/// en el mismo Cuartel, ver `computeBuildBlockedReason`).
const CUARTEL_UPGRADE_RECIPE_KEYS: string[] = CONSTRUCTION_RECIPES.filter((r) => r.cuartelUpgradeBonus).map((r) => r.key);

/// Reglas de reino (2026-08-04, docs/mecanicas/17-reglas-construcciones-reino.md) — cupo por región, cercanía/
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
  /// Bug real (auditoría en vivo, 2026-09-01, camino DIFERIDO de construcción — `earlyBuildingId`
  /// en turnResolution.ts): la fila `Building EN_CONSTRUCCION` de ESTA MISMA construcción ya
  /// existe cuando se revalida dentro de la transacción (turn.ts la crea al iniciar el turno
  /// largo) — sin excluirla, el conteo de cupo por región se autocontaba a sí misma, bloqueando
  /// PARA SIEMPRE cualquier construcción diferida real con `maxPerRegion` (el propio Campamento:
  /// "ya tiene Campamento Base activo en esta región" contra su propia fila todavía a medio
  /// construir). El camino síncrono (`/turn/narrate` directo, sin `earlyBuildingId`) nunca lo
  /// sufre porque su `Building` se crea DESPUÉS de esta revalidación, no antes.
  excludeBuildingId?: string;
}): Promise<string | null> {
  const { db, saveId, worldId, buildRecipe, activeRegion, currentLocationRecord, excludeBuildingId } = params;
  // Hueco real confirmado jugando en vivo (2026-09-08): nada impedía construir un campamento
  // personal DENTRO de la misma Location que ya tiene infraestructura de una facción NPC sembrada
  // de catálogo (Ketg'lukar, Herrería, Curtiduría... del Clan Serhu) — el tope de `maxPerRegion`
  // de arriba solo cuenta `Building` del propio jugador, nunca ve esos `ZonePoint` de catálogo (que
  // no tienen `Building` real asociado en absoluto). `Location` no tiene ningún campo de facción
  // propio (`factionSlug` de ZonePoint está sin rellenar en la práctica) — la señal real y ya
  // presente en el catálogo es "esta Location ya tiene algún ZonePoint tipo EDIFICIO", que es
  // justo cómo se representan hoy los asentamientos de facción (ver worldCatalog.ts). Bloquea
  // cualquier receta, no solo Campamento — construir DENTRO del asentamiento de otra facción nunca
  // tiene sentido, sea cual sea el edificio.
  const zonePointsEdificioEnLocation = await db.zonePoint.count({
    where: { saveId, locationId: currentLocationRecord.id, tipo: 'EDIFICIO' },
  });
  if (zonePointsEdificioEnLocation > 0) {
    return 'este lugar ya tiene edificios de otra facción — construye en una zona libre';
  }
  // Reglas de sitio de los edificios de oficio (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md
  // § 3, 2026-09-28) — 'costa' exige el TerrainTag 'costero'/'acuatico', 'veta' exige 'rocoso'
  // (proxy de "tiene mena", ver comentario de `condicionRegion` en la interfaz). Una Location sin
  // tags catalogados nunca bloquea (mismo criterio que `pasaFiltroTerreno`, terrain.ts) — hoy eso
  // cubre todo el núcleo jugable real (Karot Veku no tiene tags), así que esto no bloquea nada
  // todavía en la práctica, solo queda listo para cuando haya más zonas tagueadas.
  if (buildRecipe.condicionRegion) {
    const locationSlug = await db.location.findUnique({ where: { id: currentLocationRecord.id }, select: { slug: true } });
    const tags = locationSlug ? locationTerrainTags[locationSlug.slug] : undefined;
    const cumpleCondicion =
      !tags ||
      tags.length === 0 ||
      (buildRecipe.condicionRegion === 'costa' ? tags.some((t) => t === 'costero' || t === 'acuatico') : tags.includes('rocoso'));
    if (!cumpleCondicion) {
      return buildRecipe.condicionRegion === 'costa'
        ? 'esto solo se puede levantar en una zona de costa o agua'
        : 'esto solo se puede levantar en una zona con veta de mena';
    }
  }
  if (buildRecipe.maxPerRegion) {
    const sameRegionCount = await db.building.count({
      where: {
        saveId,
        recipeKey: buildRecipe.key,
        status: { in: ['ACTIVO', 'EN_CONSTRUCCION'] },
        location: { region: activeRegion ?? undefined },
        ...(excludeBuildingId ? { id: { not: excludeBuildingId } } : {}),
      },
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
    // Conquista territorial estilo X4 (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21): el
    // Cuartel Avanzado es justo lo contrario de la Choza — expansión DESDE la capital HACIA otra
    // región, nunca dentro de la misma. Las 2 restricciones de abajo (misma región, distancia
    // máxima) solo tienen sentido para edificios normales de reino, que sí dependen de estar cerca
    // del Ayuntamiento para funcionar.
    if (!buildRecipe.isCuartelAvanzado) {
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
    } else {
      // Mismo criterio "1 por región" que Campamento (`maxPerRegion`, ya comprobado arriba) más el
      // cupo NUEVO agregado de toda la partida (cuántos Cuarteles Avanzados en total, según nivel
      // de Ayuntamiento) — un Cuartel Avanzado en su región de origen (la del propio Ayuntamiento)
      // no tiene sentido (sería un segundo "edificio de reino" normal ahí), así que también se
      // bloquea, igual que la Choza.
      if (activeRegion === ayuntamiento.location.region) {
        return 'un Cuartel Avanzado se levanta en una región distinta a la del Ayuntamiento — para expandir dentro de la misma región ya está la Choza (la levanta un carpintero, desde Habilidades → Profesiones)';
      }
      const cuartelCount = await db.building.count({
        where: { saveId, recipeKey: { in: CUARTEL_AVANZADO_RECIPE_KEYS }, status: 'ACTIVO' },
      });
      const cuartelCapacity = ayuntamiento.tier ? cuartelAvanzadoCapacityForTier(ayuntamiento.tier) : 0;
      if (cuartelCount >= cuartelCapacity) {
        return `el Ayuntamiento ya está en su cupo máximo de Cuarteles Avanzados (${cuartelCapacity})`;
      }
    }
  }
  if (buildRecipe.cuartelUpgradeBonus) {
    // Bifurcación única (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4) — Cuartel de Guerra y Puesto
    // Comercial comparten `upgradesRecipeKey: 'cuartel-avanzado'`, así que el bloque genérico de
    // abajo ya exige que exista un Cuartel Avanzado ACTIVO; aquí además se impide que ESE MISMO
    // Cuartel ya lleve la mejora contraria (nunca las dos a la vez, mismo criterio que
    // especialización de clase del jugador).
    const targetCuartel = await db.building.findFirst({ where: { saveId, recipeKey: 'cuartel-avanzado', status: 'ACTIVO' } });
    if (targetCuartel) {
      const otraMejora = CUARTEL_UPGRADE_RECIPE_KEYS.filter((k) => k !== buildRecipe.key);
      const yaMejorado = await db.building.findFirst({ where: { saveId, recipeKey: { in: otraMejora }, status: 'ACTIVO' } });
      if (yaMejorado) {
        return 'ese Cuartel Avanzado ya eligió su otra especialización — no puede tener ambas';
      }
    }
  }
  if (buildRecipe.upgradesRecipeKey) {
    // `status: 'ACTIVO'` (2026-08-23, Grupo 3 § Building.status): antes de que EN_CONSTRUCCION
    // fuera alcanzable de verdad, esta fila SIEMPRE era ACTIVO, así que el filtro no hacía falta —
    // ahora sí, para no dejar mejorar un Ayuntamiento que todavía se está terminando de levantar.
    // Edificios de oficio (2026-09-28): `upgradesRecipeKey` aquí es la `key` del edificio de nivel
    // 1 (p.ej. 'herreria'), no una key compartida como Ayuntamiento/Cuartel — cada Building de
    // oficio tiene su propia `recipeKey` estable, la mejora hace `UPDATE` de esa misma fila
    // (turnResolution.ts, mismo mecanismo que ya usa Ayuntamiento).
    const target = await db.building.findFirst({ where: { saveId, recipeKey: buildRecipe.upgradesRecipeKey, status: 'ACTIVO' } });
    if (!target) {
      return buildRecipe.cuartelUpgradeBonus
        ? 'no tiene ningún Cuartel Avanzado que mejorar todavía'
        : buildRecipe.edificioOficioNivel
          ? 'no tiene ese edificio construido todavía'
          : 'no tiene ningún Ayuntamiento que mejorar todavía';
    }
    // Ayuntamiento y edificios de oficio escalan por `tier` (1→2→3, exigen el nivel justo
    // anterior); el Cuartel Avanzado no tiene niveles — su única condición es "existe y está
    // ACTIVO", ya comprobado arriba.
    if (buildRecipe.ayuntamientoNivel) {
      const expectedCurrentTier = buildRecipe.ayuntamientoNivel - 1;
      if ((target.tier ?? 1) !== expectedCurrentTier) {
        return 'su Ayuntamiento no está en el nivel justo anterior para esta mejora';
      }
    }
    if (buildRecipe.edificioOficioNivel) {
      const expectedCurrentTier = buildRecipe.edificioOficioNivel - 1;
      if ((target.tier ?? 1) !== expectedCurrentTier) {
        return 'ese edificio no está en el nivel justo anterior para esta mejora';
      }
    }
  }
  // Nivel mínimo de Ayuntamiento para edificios de oficio de nivel 2/3 (§ 2: Obrador exige
  // Ayuntamiento mediano, Gran obrador exige grande) — comprobación aparte de `requiresAyuntamiento`
  // de arriba porque aquí importa el NIVEL, no solo que exista.
  if (buildRecipe.ayuntamientoNivelMinimo) {
    const ayuntamiento = await db.building.findFirst({ where: { saveId, recipeKey: 'ayuntamiento', status: 'ACTIVO' } });
    if (!ayuntamiento || (ayuntamiento.tier ?? 1) < buildRecipe.ayuntamientoNivelMinimo) {
      return `necesita un Ayuntamiento de nivel ${buildRecipe.ayuntamientoNivelMinimo} o superior`;
    }
  }
  // Corrales del Domador (§ 3: "necesitan al menos una Jaula del reino, las capturas pasan de la
  // Jaula al Corral") — sin esto, construir Corrales sin haber capturado nunca nada no tendría
  // ninguna Jaula real de la que recibir animales.
  if (buildRecipe.key === 'corrales' && !buildRecipe.upgradesRecipeKey) {
    const jaulaCount = await db.building.count({
      where: { saveId, recipeKey: { in: ['jaula-pequena', 'jaula-mediana', 'jaula-grande'] }, status: 'ACTIVO' },
    });
    if (jaulaCount === 0) {
      return 'necesita al menos una Jaula construida — los Corrales reciben a los animales desde ahí';
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
