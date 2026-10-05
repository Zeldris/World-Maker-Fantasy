import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { metodoForOficio, attributeForOficio, attributeSecundarioForMetodo, professionIdForOficio, matchesOficioPrefix } from '../../services/harvestAbilities.js';
import { scopeFor, hasPendingLoot } from '../../services/npcScene.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import { inventoryCapacityFor, totalInventoryUnits } from '../../services/inventoryCapacity.js';
import { effectiveAttributes, effectiveInventorySlotsBonus, effectiveSecondaryAttributes } from '../../services/equipment.js';
import { stripRegionArticle } from '../../services/population.js';
import { pasaFiltroTerreno } from '../../services/terrain.js';
import { locationTerrainTags, harvestSourceTerrainTag, faunaTerrainTag, sourceCategoryNameFor, harvestSourceHomeLocationSlug } from '../../scripts/worldCatalog.js';
import { matchesHarvestSourceHome } from '../../services/harvest.js';
import { quantityOf, baseNameOf, totalQuantity, planConsumption, type IngredientRequirement } from '../../services/ingredients.js';
import { hasToolForOficio, OFICIOS_CON_HERRAMIENTA_REQUERIDA } from '../../services/crafting.js';
import { closeItemQuests } from '../../services/questResolution.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import { advanceFictionalMinutes, formatFictionalDate, estacionFor, climaFor, climaSeveridadAlMenos } from '../../services/worldClock.js';
import { alivioForLevel } from '../../services/professionProgress.js';
import { normalizeSecondaryAttributes } from '../../services/secondaryAttributes.js';
import { rollGathering, dificultadForTier, gradoForRecurso, cantidadForGrado } from '../../services/dice.js';
import type { GatheringRollResult, AttributeBlock, Attribute, GradoRecurso } from '../../services/dice.js';
import { Prisma } from '@prisma/client';
import type { Estacion, EstadoClima, MetodoObtencion } from '@prisma/client';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { posicionDeObjetivo, moverJugadorA } from '../../services/zonaPosicion.js';
import { ambitoPoblacion, poblacionDeCatalogo, type FiltroPoblacion } from '../../services/mundoPartida.js';

/// Recolección (rediseño de profesiones, 2026-08-07) — lado "recolectora" (minero/talador/
/// desollador): a diferencia de las de oficio creador (crafting.ts, un solo objeto por texto
/// libre), aquí el pop-up de la habilidad base ("Minar"/"Talar"/"Desollar") necesita saber QUÉ hay
/// recolectable antes de que el jugador escriba nada.
///
/// Desuello (CAZA, petición explícita 2026-08-09: "que al usar la habilidad de profesión de
/// desollar funcione como el resto y explore la zona con los cadáveres derrotados en la zona")
/// funciona distinto al resto de recolectoras: no hay `WorldPopulation` tipo RECURSO ni
/// "Explorar" propio — sus "fuentes" son fauna YA vencida en combate (CONVALECIENTE/MUERTO,
/// decapitada o no) que la propia escena ya reconoce (`detectNpcsInScene`, mismo mecanismo
/// determinista que saqueo/decapitar) y que todavía no se ha despiezado. Ver
/// `carcassCandidatesFor` más abajo.

/// Cooldown real por fuente (bug real jugando en vivo, 2026-08-07: "puedo darle a minar
/// indefinidamente sin moverme de la zona" — la habilidad no costaba turno ni tenía ningún límite
/// entre usos, así que una veta de 500 de población se sentía infinita en la práctica). Real, no
/// de ficción: mismo criterio que `updatedAt`/crecimiento de `growAllPopulations` (population.ts),
/// más simple que depender del reloj de ficción de una `Save` concreta para una fila que es del
/// `World` (compartida entre partidas). Cifra de partida, ajustable — no es un cierre definitivo.
export const RECOLECCION_COOLDOWN_MS = 30 * 60_000;

/// Coste de tiempo ficticio (bug real jugando en vivo + petición explícita, 2026-08-14: "recolectar,
/// talar...todas las acciones no estan contabilizando el en el reloj de mundo....toda accion lleva
/// un tiempo y las de recoleccion de las profesiones deberian ser minimo 10 mins de juego hasta 30
/// mins....todo depende de la cantidad recolectada") — esta ruta nunca tocaba
/// `WorldState.fictionalMinutes`, a diferencia de `narrateAndPersistTurn` (worldClock.ts): Minar/
/// Talar/Desollar salían gratis en el reloj de ficción, y además el propio `LogEntry` que crean
/// quedaba sellado con la hora YA OBSOLETA de `save.worldState` (leída antes de esta petición, nunca
/// avanzada) — mismo síntoma raíz que el reloj del cliente (`GameView.tsx`, `fictionalDate`) nunca
/// se actualiza tras un turno normal. Escala lineal simple, sin IA: 10 min para 1 unidad conseguida,
/// +2 min por unidad adicional, tope 30 (mismo criterio del resto del motor: nunca lo decide el
/// modelo, solo mecánica determinista).
const RECOLECCION_MINUTOS_BASE = 10;
const RECOLECCION_MINUTOS_TOPE = 30;
const RECOLECCION_MINUTOS_POR_UNIDAD_EXTRA = 2;

function minutosRecoleccionFor(totalUnidades: number): number {
  if (totalUnidades <= 0) return 0;
  return Math.min(RECOLECCION_MINUTOS_TOPE, RECOLECCION_MINUTOS_BASE + (totalUnidades - 1) * RECOLECCION_MINUTOS_POR_UNIDAD_EXTRA);
}

/// Gate real de estación (2026-08-24, Grupo 3 § Sistema de estaciones, ver
/// docs/rpgtarkor/lore-mundo/estaciones.md) — `null` = disponible todo el año, igual que hoy la mayoría del
/// catálogo. A diferencia de `sinTirada`/`requiereHerramienta` (que afectan a la tirada o al
/// resultado), esto filtra ANTES de tirar, mismo punto que `pasaFiltroTerreno`: fuera de su
/// estación, el recurso no cuenta como candidato en absoluto, no solo "sale con cantidad 0".
function pasaFiltroEstacion(estacionRequerida: Estacion | null, estacionActual: Estacion): boolean {
  return !estacionRequerida || estacionRequerida === estacionActual;
}

/// Gate real de clima (2026-08-24, Grupo 3 § Eventos de clima puntuales, ver
/// docs/rpgtarkor/lore-mundo/clima-tormentas.md) — umbral de severidad MÍNIMA, no igualdad exacta como
/// `pasaFiltroEstacion`. Mismo punto de filtrado que estación/terreno: ANTES de tirar.
function pasaFiltroClima(climaRequerido: EstadoClima | null, climaActual: EstadoClima | null): boolean {
  return !climaRequerido || climaSeveridadAlMenos(climaActual, climaRequerido);
}

/// Nivel de oficio limita qué tier es accesible (2026-09-02, petición explícita: "el nivel de
/// habilidad también define qué sale... no tiene sentido que siendo minero nivel 0 me salgan
/// recursos de tier alto... lo que define que aparece es tu nivel de profesión"). Mapeo directo,
/// sin tope artificial propio: nivel 1 → tier máximo 1, nivel 2 → tier máximo 2, etc. — un
/// candidato sin `tier` cuenta como tier 1 (mismo default que `dificultadForTier`, dice.ts).
/// Aplica a los 5 oficios recolectores reales (minero/talador/desollador/herborista/pescador);
/// PASIVO ("Recoger") y CAZA-desuello no pasan por aquí a propósito — ver comentario de cada rama
/// en `recolectarRoutes` de por qué quedan fuera (objetos narrativos sin tier "de recurso" real, y
/// despiece de un cadáver ya concreto respectivamente).
function pasaFiltroNivelOficio(tier: number | null | undefined, nivelOficio: number): boolean {
  return (tier ?? 1) <= nivelOficio;
}

/// Cooldown de "pescador" (2026-09-02, Pieza 1) — DISTINTO del cooldown estándar de recolección
/// (`RECOLECCION_COOLDOWN_MS`, "1 uso, luego 30 min" por FUENTE): Pescar/Buscar admitían usos
/// SEGUIDOS antes de entrar en cooldown, contado POR JUGADOR (`Save.pescaUsosSeguidos`/
/// `pescaCooldownDesde`). Retirado en Fase 4 (2026-09-28) junto con `POST /recolectar/:oficio/
/// explorar` — Pescar/Buscar ya no tienen botón ni ruta propia; `pasaFiltroEstacion`/
/// `esFaunaMetodo` (más abajo) siguen vivos porque `candidateSourcesFor` los sigue usando desde
/// `dynamicModeRecurso.ts`, pero el contador de usos seguidos (solo se escribía desde la ruta
/// retirada) no tiene ya ningún caller — los campos `Save.pescaUsosSeguidos`/`pescaCooldownDesde`
/// se dejan sin usar en el schema en vez de migrarlos, fuera del alcance de esta fase.

/// Doble tirada en tier alto (2026-09-02, Pieza 2, cita textual de la usuaria: "1 tirada busca y
/// si lo marcas para recolectar, por cada item especial se hace una tirada que es la que indica si
/// lo conseguiste recolectar") — la tirada de Explorar (`gatheringRollFor`/`applyGatheringRoll`)
/// sigue decidiendo QUÉ aparece y CUÁNTO como siempre, sin tocar; esto es una SEGUNDA comprobación,
/// solo al CONFIRMAR una selección cuyo `ItemCatalog.tier` alcanza este umbral — candidatos de tier
/// más bajo nunca la disparan, se comportan exactamente igual que hoy. 6 porque es el primer tier
/// que hoy no tiene ningún HarvestYield real por debajo (el catálogo salta de tier 1 a tier 6+ para
/// todo lo "especial" — escamas de Toluh, carne de Toluh — mientras que tier 2-5 no se usa en
/// ningún recurso recolectable todavía), cifra de partida ajustable como el resto de umbrales de
/// este sistema.
const SEGUNDA_TIRADA_TIER_MINIMO = 6;

/// Umbral EXACTO de la segunda tirada (2026-09-02) — mismo criterio que el resto del archivo
/// (`gradoForRecurso`/`dificultadForTier`, dice.ts): nunca un umbral propio inventado aparte. Un
/// resultado 'fallo' no materializa nada de esta selección concreta (mismo criterio que
/// `cantidadForGrado('fallo', ...) === 0`); 'con_coste'/'claro' sí, recortando la cantidad exacto
/// igual que ya hace `applyGatheringRoll` para la tirada de Explorar — la más consistente con el
/// resto del sistema: dos tiradas independientes, cada una con su propio grado, nunca una regla
/// especial solo para esta. `suerte` fijo a 0 (decisión propia dentro del margen del encargo, sin
/// pedirlo la usuaria): Suerte ya dio ventaja en la PRIMERA tirada (la de Explorar, la que decide
/// si el candidato tier alto aparece siquiera) — dársela otra vez aquí doblaría su peso para el
/// mismo intento de recolección. Revisar si en la práctica se echa en falta.
function pasaSegundaTirada(attributes: AttributeBlock, attribute: Attribute, bonusOficio: number, tier: number | null | undefined): { paso: boolean; grado: GradoRecurso; roll: GatheringRollResult; dificultad: number } {
  const roll = rollGathering(attributes, attribute, bonusOficio, 0);
  const dificultad = dificultadForTier(tier);
  const grado = gradoForRecurso(roll.result, dificultad);
  return { paso: grado !== 'fallo', grado, roll, dificultad };
}

/// Fase 10 (2026-09-29, "todas las tiradas visibles") — la segunda tirada de tier alto ya no se
/// descarta: se devuelve por objeto afectado (`segundasTiradas` de `resolverRecoleccion`) y se
/// guarda en `LogEntry.roll` junto a la tirada de Explorar (si la hubo), para que sobreviva a una
/// recarga. Misma forma que `GatheringRollResult` + qué objeto, la dificultad contra la que se tiró
/// y el grado resultante.
export interface SegundaTiradaInfo {
  sourceSlug: string;
  itemSlug: string;
  itemName: string;
  roll: GatheringRollResult;
  dificultad: number;
  grado: GradoRecurso;
  paso: boolean;
}

/// Forma persistida en `LogEntry.roll` para una recolección (discriminada por `kind` — las tiradas
/// de combate/huida guardan un `RollInfo` plano sin `kind`).
export interface RecoleccionLogRoll {
  kind: 'recoleccion';
  tirada?: GatheringRollResult;
  segundas?: SegundaTiradaInfo[];
}

export interface SourceCandidate {
  sourceSlug: string;
  sourceCategory: string;
  disponible: number;
  /// `tier` (rediseño de recolección, 2026-08-22) solo se usa para calcular la dificultad de
  /// `rollGathering` dentro de esta misma ruta — nunca sale hacia `groupByCategory`/el frontend
  /// (`CategoryYield` no lo declara, así que se descarta sin más al agrupar). `sinTirada`
  /// (2026-08-23) igual: solo lo lee `applyGatheringRoll` para saltarse el filtro de grado en
  /// este mismo yield, nunca sale hacia el frontend.
  yields: { itemSlug: string; itemName: string; cantidadMaxima: number; tier: number | null; sinTirada: boolean }[];
}

interface CategoryYield {
  /// Fuente real de la que viene ESTE yield concreto (2026-08-15, agrupado por categoría) — el
  /// frontend lo necesita para mandar la selección correcta a /confirmar, aunque visualmente varias
  /// fuentes distintas ahora compartan una sola tarjeta.
  sourceSlug: string;
  itemSlug: string;
  itemName: string;
  cantidadMaxima: number;
  /// Población real de LA FUENTE de este yield (no un tope compartido de todo el grupo) — dos
  /// fuentes de la misma categoría pueden tener poblaciones distintas.
  disponible: number;
}

interface CategoryCandidate {
  sourceCategory: string;
  sourceCategoryName: string;
  yields: CategoryYield[];
}

/// Agrupa candidatos individuales (uno por `sourceSlug`) en tarjetas por categoría amplia
/// (2026-08-15, petición explícita: "que sea automático, lo que meta en el enum y lo que linke en
/// el item... que aparezcan los items categorizados en el front bajo esa categoría nueva") — dar de
/// alta una categoría nueva en `SOURCE_CATEGORY_NAMES` (worldCatalog.ts) y enlazarla desde una fila
/// de `HarvestYield` basta para que aparezca agrupada aquí, sin tocar este archivo. El cooldown/
/// consumo real sigue siendo por `sourceSlug` individual (cada yield agrupado conserva el suyo) —
/// el agrupado es puramente de presentación.
function groupByCategory(rawCandidates: SourceCandidate[]): CategoryCandidate[] {
  const yieldsByCategory = new Map<string, CategoryYield[]>();
  for (const c of rawCandidates) {
    if (!yieldsByCategory.has(c.sourceCategory)) yieldsByCategory.set(c.sourceCategory, []);
    yieldsByCategory.get(c.sourceCategory)!.push(
      ...c.yields.map((y) => ({ sourceSlug: c.sourceSlug, itemSlug: y.itemSlug, itemName: y.itemName, cantidadMaxima: y.cantidadMaxima, disponible: c.disponible })),
    );
  }
  return [...yieldsByCategory.entries()].map(([sourceCategory, yields]) => ({
    sourceCategory,
    sourceCategoryName: sourceCategoryNameFor(sourceCategory),
    yields,
  }));
}

/// Método PESCA/BUSQUEDA = fauna real (peces/marisco de Playa de Ceniza Blanca), a diferencia de
/// MINERIA/TALA/EXTRACCION (`WorldPopulation.targetType: 'RECURSO'`) — mismo `targetType: 'FAUNA'`
/// que ya usa Cazar (`cazar.ts` § `candidateFaunaFor`), NUNCA depletado aquí: Pescar/Buscar no
/// reducen la población mundial de peces al confirmar (a diferencia de Cazar, no hay combate ni
/// muerte real — el pez vuelve a nadar), así que tampoco aplican el cooldown estándar por FUENTE
/// (`RECOLECCION_COOLDOWN_MS`/`lastHarvestedAt`) — su límite real es el contador de usos por
/// JUGADOR de `Save.pescaUsosSeguidos` (ver `pescaDisponible`), comprobado aparte en la ruta.
function esFaunaMetodo(metodo: MetodoObtencion): boolean {
  return metodo === 'PESCA' || metodo === 'BUSQUEDA';
}

/// Fuentes candidatas para `oficio` en la región actual: las que tienen HarvestYield con el
/// método correcto Y una fila WorldPopulation (tipo RECURSO para MINERIA/TALA/EXTRACCION, tipo
/// FAUNA para PESCA/BUSQUEDA — ver `esFaunaMetodo`) con población real > 0 en esa región (nunca se
/// ofrece recolectar algo que el propio mundo dice que no queda) Y que no estén en cooldown por
/// haberse recolectado hace poco EN ESTA MISMA Location (PESCA/BUSQUEDA no tienen cooldown por
/// fuente, ver comentario de `esFaunaMetodo`). `anyOnCooldown` distingue "no hay nada aquí" de "lo
/// que hay está agotado por ahora" para el mensaje del frontend.
///
/// Cooldown location-aware (bug real jugando en vivo, 2026-08-13: "avanzo por la hondonada
/// buscando más elementos... ahí sí que debería poder volver a usarla, al igual que si cambiamos
/// de zona" — antes el cooldown de 30 min era puro reloj, sin memoria de sitio, así que moverte a
/// otra Location no servía de nada). Pasa el guard si CUALQUIERA de las dos condiciones se cumple:
/// pasaron los 30 min reales, O `locationId` no coincide con `lastHarvestedLocationId`.
///
/// `nivelOficio` (2026-09-02, Pieza 3: "el nivel de habilidad también define qué sale... lo que
/// define que aparece es tu nivel de profesión") recorta cada YIELD individual (no la fuente
/// entera — una misma fuente puede tener yields de tier bajo Y alto a la vez) cuyo `tier` supere el
/// nivel actual: ese yield ni siquiera cuenta como candidato, antes de que exista ninguna tirada.
export async function candidateSourcesFor(
  worldId: string,
  metodo: MetodoObtencion,
  region: string | null,
  locationId: string | null,
  locationSlug: string | null,
  estacionActual: Estacion,
  climaActual: EstadoClima | null,
  nivelOficio: number,
  /// Cliente inyectable (Fase 13-B, expediciones de facción): la función es solo lectura y no
  /// depende de ninguna partida, así que `factionExpeditions.ts` la reutiliza con su propio `db`/`tx`.
  db: Pick<typeof prisma, 'harvestYield' | 'worldPopulation'> = prisma,
  /// CR-6 (hito 0.2): población de la partida (por defecto, la del mundo: expediciones de facción).
  poblacion: FiltroPoblacion = poblacionDeCatalogo(worldId),
): Promise<{ candidates: SourceCandidate[]; anyOnCooldown: boolean }> {
  const rows = await db.harvestYield.findMany({ where: { worldId, metodoObtencion: metodo }, include: { item: true } });
  if (rows.length === 0) return { candidates: [], anyOnCooldown: false };
  const bySlug = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!bySlug.has(row.sourceSlug)) bySlug.set(row.sourceSlug, []);
    bySlug.get(row.sourceSlug)!.push(row);
  }
  const esFauna = esFaunaMetodo(metodo);
  const populations = await db.worldPopulation.findMany({
    where: { ...poblacion, targetType: esFauna ? 'FAUNA' : 'RECURSO', targetSlug: { in: [...bySlug.keys()] }, poblacion: { gt: 0 } },
  });
  const cooldownCutoff = Date.now() - RECOLECCION_COOLDOWN_MS;
  const candidates: SourceCandidate[] = [];
  let anyOnCooldown = false;
  for (const pop of populations) {
    // Sin región conocida (save.currentLocation nulo — posible según el schema), falla CERRADO:
    // ninguna fuente es candidata, en vez de ofrecer las de todas las regiones del mundo por
    // saltarse el filtro (bug real encontrado en auditoría, 2026-08-07 — antes `region && ...`
    // con region=null no filtraba nada).
    if (!region) continue;
    // `distribucion` se siembra SIN artículo ("Llanuras del Viento Rojo"), `region` siempre lo
    // lleva completo ("Las Llanuras del Viento Rojo") — ver stripRegionArticle (population.ts,
    // bug real encontrado jugando en vivo 2026-08-07).
    const distribucion = pop.distribucion as Record<string, number>;
    if (!(distribucion[stripRegionArticle(region)] > 0)) continue;
    // Filtro por terreno de la zona (petición explícita, 2026-08-14: "en zonas aridas no deberia
    // haber muchas plantas y en zonas humedas deberias haber mas") — mismo punto que el filtro de
    // región de arriba, ver terrain.ts. Fauna (PESCA/BUSQUEDA) usa `faunaTerrainTag` (mismo mapa
    // que ya usa Cazar), no `harvestSourceTerrainTag` (solo EXTRACCION/MINERIA/TALA, ver su propio
    // comentario de cabecera en worldCatalog.ts) — ninguno de los 6 peces/marisco nuevos está
    // etiquetado ahí todavía, así que hoy no se filtran por terreno (mismo criterio "solo premia,
    // nunca penaliza" de siempre: sin tag, nunca se descarta por esto).
    const terrainTag = esFauna ? faunaTerrainTag[pop.targetSlug] : harvestSourceTerrainTag[pop.targetSlug];
    if (!pasaFiltroTerreno(locationSlug ? locationTerrainTags[locationSlug] : undefined, terrainTag)) continue;
    // Anclaje a Location EXACTA (checklist consolidado P1.1, 2026-08-27, bug real jugando en vivo:
    // Roca Luclara — con `harvestSourceHomeLocationSlug: 'sabana-alta-colmillar'` — salía minable
    // en La Hondonada del Eco): antes este campo solo se aplicaba en `pasivoCandidatesFor`
    // (recursos PASIVO), nunca en MINERIA/TALA/EXTRACCION — mismo criterio de comparación estricta
    // que ahí. Recursos sin el campo definido (la mayoría) no cambian de comportamiento. Fauna
    // (PESCA/BUSQUEDA) no lo necesita: los 6 Npc de peces/marisco ya llevan su propio
    // `homeLocationSlug` directo en la ficha (jashil/toluh/negueo/bulco, todos
    // 'playa-de-ceniza-blanca') — mismo criterio que jusha-esmeralda (fauna con Npc propio nunca
    // usa este mapa, solo lo usan fuentes SIN fila Npc, ver comentario de
    // `harvestSourceHomeLocationSlug` en worldCatalog.ts).
    const homeSlug = esFauna ? undefined : harvestSourceHomeLocationSlug[pop.targetSlug];
    if (!matchesHarvestSourceHome(homeSlug, locationSlug)) continue;
    const sourceRows = (bySlug.get(pop.targetSlug) ?? []).filter(
      (r) => pasaFiltroEstacion(r.estacionRequerida, estacionActual) && pasaFiltroClima(r.climaRequerido, climaActual) && pasaFiltroNivelOficio(r.item.tier, nivelOficio),
    );
    if (sourceRows.length === 0) continue;
    // Cooldown por fuente (2026-09-02) — PESCA/BUSQUEDA no lo aplican en absoluto (ver comentario
    // de `esFaunaMetodo`): su único límite es el contador de usos por jugador, comprobado aparte.
    if (!esFauna) {
      const sameLocation = locationId !== null && pop.lastHarvestedLocationId === locationId;
      if (pop.lastHarvestedAt && pop.lastHarvestedAt.getTime() > cooldownCutoff && sameLocation) {
        anyOnCooldown = true;
        continue;
      }
    }
    candidates.push({
      sourceSlug: pop.targetSlug,
      sourceCategory: sourceRows[0].sourceCategory,
      disponible: pop.poblacion,
      yields: sourceRows.map((r) => ({ itemSlug: r.item.slug, itemName: r.item.name, cantidadMaxima: r.cantidad, tier: r.item.tier, sinTirada: r.sinTirada })),
    });
  }
  return { candidates, anyOnCooldown };
}

/// Desuello (2026-08-09, ver comentario de cabecera) — "candidatos" son fauna ya en escena
/// (`detectNpcsInScene`, mismo mecanismo determinista que ya usan saqueo/decapitar) que está
/// vencida (`condicionFisica` MUERTO — CONVALECIENTE deja de ser desollable, 2026-08-26, decisión
/// explícita junto con el rediseño Matar/Capturar/Clemente: no tiene sentido desollar a alguien
/// todavía vivo) y que todavía no se ha despiezado del todo
/// (`hasPendingLoot`, npcScene.ts — único punto de verdad, auditoría de deuda técnica 2026-08-18,
/// compartido con `harvest.ts` § `yaDespiezada`/`panels.ts` § `saquear-zona`; antes esta función
/// comparaba `!saqueado` a secas, sin la rama de `groupSize`, lo que bloqueaba el desuello del
/// resto de un grupo cazado — bug real ya corregido). Solo cuenta fauna real (`ataqueNatural` no
/// nulo — humanoides no se desuellan) con al menos una fila HarvestYield de método CAZA para su
/// slug. Sin cooldown ni "Explorar": no hay nada que redescubrir, o el cadáver sigue en escena o no.
///
/// `|| !!n.groupDefeated` (bug real jugando en vivo, 2026-08-22, "he matado a un buitre pero
/// desollar no detecta el cadáver" — caza en grupo, `groupSize:5, groupDefeated:1`): en un grupo,
/// `condicionFisica` refleja al individuo ACTUAL/siguiente (sigue ILESO mientras queden más del
/// grupo por enfrentar), nunca a los ya caídos — un cadáver real y sin despiezar de un grupo se
/// quedaba invisible para Desollar aunque `hasPendingLoot` ya lo diera por pendiente. Mismo
/// criterio que `derrotada` en `harvest.ts` (`yaDespiezada`), que ya lo hacía bien — aquí faltaba.
async function carcassCandidatesFor(
  worldId: string,
  saveId: string,
  currentLocationId: string | null,
  estacionActual: Estacion,
  climaActual: EstadoClima | null,
): Promise<SourceCandidate[]> {
  // Fase 9 (verificación en vivo 2026-09-29): antes se partía de `detectNpcsInScene`, que solo ve
  // a un NPC si su nombre sale en la acción o en los hechos de sesión — el cadáver recién abatido
  // podía no estar "en escena" según lo que hubiera narrado el LLM, y Desollar decía "no hay nada"
  // aunque el pin del mapa sí lo mostrara. Ahora el mismo criterio determinista que el pin de
  // cadáver (`GET /zona`): `NpcState` MUERTO o con caídos de grupo, botín pendiente, de ESTA
  // Location (scope + `zonaLocationId`).
  const estados = await prisma.npcState.findMany({
    where: { saveId, OR: [{ condicionFisica: 'MUERTO' }, { groupDefeated: { gt: 0 } }] },
  });
  const pendientes = estados.filter(hasPendingLoot).filter((st) => st.zonaLocationId == null || st.zonaLocationId === currentLocationId);
  const npcsMuertos = pendientes.length
    ? await prisma.npc.findMany({ where: { worldId, id: { in: pendientes.map((st) => st.npcId) } }, select: { id: true, slug: true, kind: true, ataqueNatural: true } })
    : [];
  const npcById = new Map(npcsMuertos.map((n) => [n.id, n]));
  const carcasses = pendientes
    .map((st) => ({ st, npc: npcById.get(st.npcId) }))
    .filter((c): c is { st: (typeof pendientes)[number]; npc: (typeof npcsMuertos)[number] } => !!c.npc && c.npc.ataqueNatural !== null && scopeFor(c.npc.kind, currentLocationId) === c.st.scope)
    .map((c) => c.npc);
  if (carcasses.length === 0) return [];

  const rows = await prisma.harvestYield.findMany({
    where: { worldId, metodoObtencion: 'CAZA', sourceSlug: { in: carcasses.map((c) => c.slug) } },
    include: { item: true },
  });
  const bySlug = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!bySlug.has(row.sourceSlug)) bySlug.set(row.sourceSlug, []);
    bySlug.get(row.sourceSlug)!.push(row);
  }

  return carcasses
    .map((c) => ({
      c,
      yieldRows: (bySlug.get(c.slug) ?? []).filter(
        (r) => pasaFiltroEstacion(r.estacionRequerida, estacionActual) && pasaFiltroClima(r.climaRequerido, climaActual),
      ),
    }))
    .filter(({ yieldRows }) => yieldRows.length > 0)
    .map(({ c, yieldRows }) => {
      return {
        sourceSlug: c.slug,
        // 2026-08-15: ahora sí se agrupa por categoría (fauna), igual que el resto de fuentes —
        // dos cadáveres distintos en la misma escena se ven bajo la misma tarjeta "Fauna" en vez
        // de una tarjeta por cadáver.
        sourceCategory: yieldRows[0].sourceCategory,
        // A diferencia de RECURSO (`disponible` = población real, un tope compartido entre
        // yields), un cadáver da CADA yield una sola vez, entero — `disponible` aquí solo existe
        // para no truncar `Math.min(cantidadMaxima, disponible)` en el modal, así que se fija al
        // mayor `cantidad` de sus propios yields (nunca el cuello de botella real).
        disponible: Math.max(1, ...yieldRows.map((r) => r.cantidad)),
        yields: yieldRows.map((r) => ({ itemSlug: r.item.slug, itemName: r.item.name, cantidadMaxima: r.cantidad, tier: r.item.tier, sinTirada: r.sinTirada })),
      };
    });
}

/// "Recoger" (2026-08-25, retira el descubrimiento de texto libre — ver discovery.ts, ya
/// eliminado) — objetos narrativos ligados a una Location EXACTA (`harvestSourceHomeLocationSlug`,
/// worldCatalog.ts): recuerdos de clan/ofrendas, nunca hierbas/minerales de verdad (esos son
/// `sourceCategory: 'planta'`/`'mineral'` con `WorldPopulation` real, y pasan por MINERIA/TALA/
/// EXTRACCION como cualquier otro recurso de oficio — criterio explícito de la usuaria: "si son
/// recursos solo se puede recoger con profesiones, si son items entonces con este recoger"). Sin
/// tirada (`rollGathering` no aplica aquí — no hay dificultad real que superar, o el objeto está
/// a la vista en su sitio o no) y sin `WorldPopulation`/cooldown: se puede volver a recoger
/// mientras siga en la escena, mismo comportamiento que ya tenía el descubrimiento libre retirado
/// — no se modela agotamiento real para estos objetos (simplificación consciente, revisar si algún
/// día se nota como problema jugando).
async function pasivoCandidatesFor(worldId: string, currentLocationSlug: string | null): Promise<SourceCandidate[]> {
  if (!currentLocationSlug) return [];
  const rows = await prisma.harvestYield.findMany({ where: { worldId, metodoObtencion: 'PASIVO' }, include: { item: true } });
  const bySlug = new Map<string, typeof rows>();
  for (const row of rows) {
    // A diferencia de `candidateSourcesFor` (arriba, candado OPCIONAL — sin entrada, sigue
    // elegible en toda la región), aquí el candado es OBLIGATORIO: un objeto narrativo PASIVO sin
    // ninguna entrada en `harvestSourceHomeLocationSlug` nunca debería aparecer (comportamiento de
    // siempre, sin cambios) — `matchesHarvestSourceHome` no sirve tal cual (su `undefined` = "sí
    // elegible"), así que se compara con la entrada real sin pasar por esa función.
    const home = harvestSourceHomeLocationSlug[row.sourceSlug];
    const matchesHome = Array.isArray(home) ? home.includes(currentLocationSlug) : home === currentLocationSlug;
    if (!matchesHome) continue;
    if (!bySlug.has(row.sourceSlug)) bySlug.set(row.sourceSlug, []);
    bySlug.get(row.sourceSlug)!.push(row);
  }
  return [...bySlug.entries()].map(([sourceSlug, yieldRows]) => ({
    sourceSlug,
    sourceCategory: yieldRows[0].sourceCategory,
    disponible: Math.max(1, ...yieldRows.map((r) => r.cantidad)),
    yields: yieldRows.map((r) => ({ itemSlug: r.item.slug, itemName: r.item.name, cantidadMaxima: r.cantidad, tier: r.item.tier, sinTirada: true })),
  }));
}

/// Save con los datos mínimos para calcular `rollGathering` (equipo puesto para bonus de
/// atributos/secundarios + nivel del oficio concreto que se está usando) — un único shape
/// compartido por `/explorar` y el GET de desollador en vez de repetir el cálculo dos veces.
export interface GatheringRollInputs {
  attributes: AttributeBlock;
  secondaryAttributesJson: unknown;
  inventoryItems: { statBonuses: unknown }[];
  professionProgress: { professionId: string; nivel: number }[];
}

/// Una sola tirada por acción de Explorar/Desollar (rediseño de recolección, 2026-08-22) —
/// aplicada luego contra la dificultad de CADA recurso candidato (`applyGatheringRoll` más abajo),
/// nunca una tirada por recurso: el margen de un único resultado ya decide a la vez qué aparece y
/// cuánta cantidad, igual que un único chequeo de Supervivencia en D&D revela más cuanto mejor se
/// tira. `oficio` es el `professionId` exacto pulsado (ej. "minero-llanuras"), no un prefijo — con
/// la única excepción de pescador (2026-09-02, ver `professionIdForOficio`), donde la clave de
/// ruta ('pescador-pescar'/'pescador-buscar') y el `professionId` real ('pescador') divergen.
export function gatheringRollFor(save: GatheringRollInputs, oficio: string, random: () => number = Math.random): GatheringRollResult {
  const attributes = effectiveAttributes(save.attributes, save.inventoryItems);
  const secondaryAttributes = effectiveSecondaryAttributes(normalizeSecondaryAttributes(save.secondaryAttributesJson), save.inventoryItems);
  const nivelOficio = save.professionProgress.find((p) => p.professionId === professionIdForOficio(oficio))?.nivel ?? 1;
  // Ya validado más arriba (metodoForOficio no fue null): attributeForOficio busca el mismo
  // prefijo y siempre encuentra pareja.
  const attribute = attributeForOficio(oficio)!;
  return rollGathering(attributes, attribute, alivioForLevel(nivelOficio), secondaryAttributes.suerte, random);
}

/// Aplica el resultado de `gatheringRollFor` a una lista de candidatos: cada yield individual (no
/// la fuente entera, una misma fuente puede dar varios objetos de distinto tier) se filtra/recorta
/// según su propio grado — una fuente que se queda sin ningún yield tras esto desaparece del todo
/// del listado (fallo total de la tirada para ese recurso concreto).
export function applyGatheringRoll(candidates: SourceCandidate[], roll: GatheringRollResult): SourceCandidate[] {
  return candidates
    .map((c) => ({
      ...c,
      // `sinTirada` (2026-08-23): reconocimiento trivial, pasa intacto sin comparar contra
      // ninguna dificultad — nunca se recorta ni desaparece por un mal resultado.
      yields: c.yields
        .map((y) => (y.sinTirada ? y : { ...y, cantidadMaxima: cantidadForGrado(gradoForRecurso(roll.result, dificultadForTier(y.tier)), y.cantidadMaxima) }))
        .filter((y) => y.cantidadMaxima > 0),
    }))
    .filter((c) => c.yields.length > 0);
}

/// Tirada congelada (petición explícita, 2026-08-22: "para poder ver algo siempre deberías pasar
/// por esta tirada... al menos una vez y ya se guarda" — sin esto, reabrir el pop-up tras localizar
/// algo enseñaba la lista CRUDA sin recortar por grado (ignorando la tirada por completo), y
/// Desollar volvía a tirar en cada apertura del panel, dejando "pescar" un resultado mejor cerrando
/// y reabriendo). `Save.harvestRollCache` (Json) guarda el resultado YA filtrado por
/// `applyGatheringRoll` — nunca los candidatos crudos — junto a la ubicación en que se tiró, para
/// saber si sigue siendo válido. Reemplaza por completo el viejo mecanismo de
/// `detectHarvestSourcesInScene` para "ya localizado" en este archivo (Cazar, ruta aparte, sigue
/// usando ese mecanismo — fuera del alcance de este cambio).
///
/// Mapa `oficio → entrada` (bug real jugando en vivo, 2026-08-25: "profesiones que me deja usarlas
/// varias veces y repite las tiradas mostrando items diferentes"), no un único slot como antes de
/// este fix — un único JSON por partida se pisaba entero en cada `/explorar`, así que explorar
/// Talador invalidaba (sin avisar) la tirada ya congelada de Minero en la misma sesión.
interface HarvestRollCacheEntry {
  locationId: string | null;
  sources: SourceCandidate[];
}
type HarvestRollCache = Record<string, HarvestRollCacheEntry>;

function cachedRollFor(save: { harvestRollCache: unknown }, oficio: string, locationId: string | null): SourceCandidate[] | null {
  const cache = (save.harvestRollCache as HarvestRollCache | null)?.[oficio];
  if (!cache || cache.locationId !== locationId) return null;
  return cache.sources;
}

// `currentCache` viene del `save` YA cargado por el caller (`include` sin `select` ya trae
// `harvestRollCache`) — evita una segunda ida a la base de datos solo para leer lo que el caller
// ya tiene en la mano.
function saveRollCache(saveId: string, currentCache: unknown, oficio: string, locationId: string | null, sources: SourceCandidate[]) {
  const cache: HarvestRollCache = { ...(currentCache as HarvestRollCache | null), [oficio]: { locationId, sources } };
  return prisma.save.update({ where: { id: saveId }, data: { harvestRollCache: cache as unknown as Prisma.InputJsonValue } });
}

/// Confirmar recolección cambia el mundo real (población depletada/cadáver despiezado) — invalida
/// solo las entradas del mapa cuya tirada congelada incluyera alguna de las fuentes tocadas esta
/// vez, nunca el mapa entero (mismo bug de fondo que el de arriba: un oficio ajeno no tiene por qué
/// perder su tirada porque se confirmó una recolección de OTRO oficio). Mismo criterio que
/// `saveRollCache`: `currentCache` viene del `save` ya cargado por el caller.
function invalidateRollCacheFor(saveId: string, currentCache: unknown, touchedSourceSlugs: Set<string>) {
  const cache = currentCache as HarvestRollCache | null;
  if (!cache || touchedSourceSlugs.size === 0) return Promise.resolve();
  const next: HarvestRollCache = {};
  for (const [oficio, entry] of Object.entries(cache)) {
    if (!entry.sources.some((s) => touchedSourceSlugs.has(s.sourceSlug))) next[oficio] = entry;
  }
  return prisma.save.update({ where: { id: saveId }, data: { harvestRollCache: next as unknown as Prisma.InputJsonValue } });
}

/// Bug real (2026-08-29, reverificación en vivo tras cerrar combate múltiple): un cadáver que
/// aparece DESPUÉS de que el `useEffect` pasivo del frontend ya congeló `desollador` en `{sources:
/// []}` para esta ubicación (típicamente, cualquier combate que ocurra tras entrar a la escena)
/// quedaba huérfano para siempre en esa visita — `invalidateRollCacheFor` de arriba solo invalida
/// entradas cuyos `sources` mencionen el slug tocado, pero una entrada VACÍA no tiene ningún slug
/// que tocar. A diferencia de una recolección confirmada (donde se sabe exactamente qué
/// `sourceSlug` se tocó), un turno que mata a un NPC en combate (1v1, Decapitar o múltiple) no
/// tiene ese dato a mano en `turnResolution.ts` sin duplicar lógica en los 3 caminos — más simple y
/// igual de correcto: si este turno dejó algún NPC MUERTO en la ubicación actual, tirar la entrada
/// `desollador` entera para esa ubicación (si la había), forzando que la próxima consulta pasiva
/// vuelva a tirar de verdad. `tx` porque esto corre dentro de la transacción principal del turno.
export function invalidateCarcassRollCache(tx: Prisma.TransactionClient, saveId: string, currentCache: unknown, locationId: string | null) {
  const cache = currentCache as HarvestRollCache | null;
  const entry = cache?.['desollador'];
  if (!entry || entry.locationId !== locationId) return Promise.resolve();
  const { desollador: _omit, ...next } = cache!;
  return tx.save.update({ where: { id: saveId }, data: { harvestRollCache: next as unknown as Prisma.InputJsonValue } });
}

export async function recolectarRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string; oficio: string } }>('/saves/:id/recolectar/:oficio', async (request, reply) => {
    const metodo = metodoForOficio(request.params.oficio);
    if (!metodo) {
      return reply.status(400).send({ error: `"${request.params.oficio}" no es un oficio recolector` });
    }
    // Fase 4 (2026-09-28, `plan-mecanicas-por-zona-2026-09-28.md`) — Minar/Talar/Recolectar
    // hierbas/Pescar/Buscar/Recoger dejan de tener botón: esas acciones solo se hacen ya desde el
    // mapa de la zona (RECURSO → Interactuar → `dynamicModeRecurso.ts`, que llama a
    // `candidateSourcesFor`/`gatheringRollFor`/`applyGatheringRoll` DIRECTAMENTE, sin pasar por
    // esta ruta). Solo CAZA (Desollar, aviso pasivo real en la escena, ver `HarvestSelectionModal`
    // en el frontend) sigue teniendo un llamador real aquí.
    // MINERIA/TALA/EXTRACCION/PESCA/BUSQUEDA (Minar/Talar/Recolectar hierbas/Pescar/Buscar) ya no
    // tienen botón — quedan fuera de este GET, que ahora solo sirve a CAZA (Desollar, aviso pasivo
    // real en la escena) y PASIVO ("Recoger", objetos narrativos de la Location exacta): ninguno
    // de los dos depende de `WorldPopulation` regional ni de "Explorar", a diferencia del resto.
    if (metodo !== 'CAZA' && metodo !== 'PASIVO') {
      return reply.status(400).send({ error: `"${request.params.oficio}" ya no se explora aquí — busca en el mapa de la zona.` });
    }
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: {
        currentLocation: true,
        inventoryItems: { where: { slot: { not: null } }, select: { statBonuses: true } },
        professionProgress: { select: { professionId: true, nivel: true } },
        worldState: { select: { fictionalMinutes: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    // Gate de estación (2026-08-24, Grupo 3 § Sistema de estaciones) — sin `worldState` sembrado
    // todavía (partida recién creada), el reloj de ficción empieza en 0, mismo Día 1 = Ur'gathek
    // que ve cualquier partida nueva.
    const estacionActual = estacionFor(save.worldState?.fictionalMinutes ?? 0);
    const climaActual = climaFor(save.worldState?.fictionalMinutes ?? 0, save.currentLocation?.region ?? null);

    if (metodo === 'PASIVO') {
      // "Recoger" (2026-08-25) — sin tirada ni caché que congelar (ver `pasivoCandidatesFor`):
      // siempre la foto real de lo que hay en ESTA ubicación exacta ahora mismo.
      const candidates = await pasivoCandidatesFor(save.worldId, save.currentLocation?.slug ?? null);
      return { sources: groupByCategory(candidates), puedeExplorar: false, enCooldown: false };
    }

    // Tirada congelada (rediseño de recolección, 2026-08-22) — antes se tiraba de nuevo en CADA
    // apertura del panel (simplificación consciente original, ya descartada): dejaba "pescar" un
    // resultado mejor cerrando y reabriendo. Ahora, si ya se tiró para este oficio en esta misma
    // ubicación, se devuelve tal cual, sin tirar otra vez.
    const cachedSources = cachedRollFor(save, request.params.oficio, save.currentLocationId);
    if (cachedSources) return { sources: groupByCategory(cachedSources), puedeExplorar: false, enCooldown: false };

    const rawCandidates = await carcassCandidatesFor(save.worldId, save.id, save.currentLocationId, estacionActual, climaActual);
    if (rawCandidates.length === 0) return { sources: [], puedeExplorar: false, enCooldown: false };
    const roll = gatheringRollFor(
      { attributes: save.attributes as AttributeBlock, secondaryAttributesJson: save.secondaryAttributes, inventoryItems: save.inventoryItems, professionProgress: save.professionProgress },
      request.params.oficio,
    );
    const filtered = applyGatheringRoll(rawCandidates, roll);
    await saveRollCache(save.id, save.harvestRollCache, request.params.oficio, save.currentLocationId, filtered);
    return { sources: groupByCategory(filtered), roll, puedeExplorar: false, enCooldown: false };
  });

  app.post<{ Params: { id: string }; Body: { selections: { sourceSlug: string; itemSlug: string; cantidad: number }[] } }>(
    '/saves/:id/recolectar/confirmar',
    async (request, reply) => {
      const { selections } = request.body;
      if (!Array.isArray(selections) || selections.length === 0) {
        return reply.status(400).send({ error: 'Falta el campo: selections' });
      }

      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        include: SAVE_INCLUDE_PARA_CONFIRMAR,
      });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      // Bug real (auditoría de bugs, 2026-08-21) — ver comentario de /recolectar/:oficio/explorar arriba.
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      return resolverRecoleccion(save, selections);
    },
  );
}

/// Include exacto que necesita `resolverRecoleccion` — extraído como constante (2026-09-08,
/// "Interactuar" motor unificado de eventos de escena) para que el nuevo camino desde
/// `dynamicMode.ts` cargue el `Save` con el mismo shape exacto, sin repetir el objeto a mano y
/// arriesgarse a que diverja del que usa la ruta HTTP normal.
const SAVE_INCLUDE_PARA_CONFIRMAR = {
  worldState: true,
  currentLocation: true,
  // Segunda tirada en tier alto (2026-09-02, Pieza 2) — mismos inputs que `gatheringRollFor`
  // (equipo puesto + nivel de oficio), necesarios aquí porque la segunda tirada ocurre AL
  // CONFIRMAR, no al explorar.
  inventoryItems: { where: { slot: { not: null } }, select: { statBonuses: true } },
  professionProgress: { select: { professionId: true, nivel: true } },
} satisfies Prisma.SaveInclude;

type SaveParaConfirmar = Prisma.SaveGetPayload<{ include: typeof SAVE_INCLUDE_PARA_CONFIRMAR }>;

/// Núcleo real de "confirmar recolección" (2026-08-07 en adelante, ver comentario de cabecera del
/// archivo) — extraído de `POST /saves/:id/recolectar/confirmar` (2026-09-08, "Interactuar" motor
/// unificado de eventos de escena) para que el nuevo disparador de Interactuar sobre un RECURSO
/// (un candidato YA determinista, `selections` de un solo elemento) reutilice exactamente las
/// mismas reglas ya muy afinadas — cooldown por fuente, herramienta requerida, segunda tirada en
/// tier alto, capacidad de inventario, cierre de misiones, descubrimientos de Enciclopedia — en vez
/// de reimplementarlas. Ni un carácter de lógica cambiado respecto a la ruta HTTP original, solo
/// movido de sitio: la ruta ahora solo carga `save` y delega aquí.
export async function resolverRecoleccion(
  save: SaveParaConfirmar,
  selections: { sourceSlug: string; itemSlug: string; cantidad: number }[],
  /// Hallazgo real (auditoría de bugs 2026-09-15, revisar-partida-hallazgos.md #44): "Interactuar
  /// sobre RECURSO" (dynamicModeRecurso.ts) limpiaba `pendingDynamicModeOffer` en un SEGUNDO
  /// `save.update` suelto, después de que esta transacción ya hubiera cerrado — un crash entre
  /// medias dejaba el recurso ya recolectado pero la oferta de Interactuar todavía apuntando a él.
  /// Pasar `true` aquí mueve esa limpieza DENTRO de la misma transacción atómica que el resto de
  /// la recolección (mismo criterio que el proyecto ya aplica en `/combat/dejar-vivir`). `false`
  /// por defecto — `/recolectar/confirmar` (el otro caller) nunca toca este campo, no debe
  /// empezar a hacerlo.
  clearPendingDynamicModeOffer = false,
  /// Tirada de Explorar ya hecha por el caller (recolectar desde el mapa) — solo para guardarla en
  /// `LogEntry.roll`; nunca cambia el resultado de la recolección.
  primeraTirada?: GatheringRollResult,
) {
  interface TouchedStack {
    id: string;
    catalogName: string;
    description: string;
    catalogSlug: string;
    /// true = la fila YA existía antes de esta petición (el cliente ya la tiene en su estado
    /// local, hay que decirle que cambió de nombre); false = fila nueva, creada en esta misma
    /// petición (el cliente todavía no la conoce, hay que dársela entera).
    wasPreexisting: boolean;
    quantity: number;
    /// Cantidad cosechada en ESTA petición (distinta de `quantity`, el total de la pila tras
    /// sumar) — bug real jugando en vivo, 2026-08-13: el mensaje del log usaba `quantity`
    /// (total ya acumulado) para un verbo puntual ("recolecta: Piedra (N)"), así que "(N)" se
    /// leía como "cogiste N ahora" cuando en realidad era el total en inventario.
    harvestedThisTurn: number;
  }

  const cooldownCutoff = new Date(Date.now() - RECOLECCION_COOLDOWN_MS);
  const touched = await prisma.$transaction(async (tx) => {
        // Capacidad real (Parte D) — releída DENTRO de la transacción, igual que el resto de
        // gates de este proyecto (revalidar justo antes de escribir, no confiar en un conteo de
        // antes de abrir la transacción).
        //
        // Bug real jugando en vivo (2026-08-08, "podemos tener inventario infinito"): esto contaba
        // FILAS (`InventoryItem.count()`) contra el número de SELECCIONES de la petición — una vez
        // existe una pila ("Piedra (1)"), recolectar más solo incrementa su cantidad sin crear
        // fila nueva, así que `count()` nunca sube: inventario sin límite real para cualquier
        // recurso ya poseído. Ahora se mide en UNIDADES totales (`totalInventoryUnits`) — la
        // cantidad pedida (`sel.cantidad`, no 1 por selección) es lo que de verdad pesa.
        const [currentItems, equippedItems] = await Promise.all([
          tx.inventoryItem.findMany({ where: { saveId: save.id }, select: { name: true } }),
          tx.inventoryItem.findMany({ where: { saveId: save.id, slot: { not: null } }, select: { statBonuses: true } }),
        ]);
        const capacity = inventoryCapacityFor(
          (save.attributes as AttributeBlock).fuerza,
          (save.attributes as AttributeBlock).constitucion,
          effectiveInventorySlotsBonus(equippedItems),
        );
        // Topa por espacio libre real igual que ya se topa por `HarvestYield.cantidad`/población
        // más abajo — nunca un rechazo duro de toda la petición: si solo caben 3 de las 9 pedidas,
        // se añaden esas 3 (mismo criterio de "coger lo que se pueda" que el resto de este motor).
        let unitsRemaining = Math.max(0, capacity - totalInventoryUnits(currentItems));

        // Herramienta requerida (2026-08-17, "usar la recolección de desuello" depende de tener
        // la herramienta encima; ampliado 2026-08-23 a minero, ver OFICIOS_CON_HERRAMIENTA_REQUERIDA
        // en crafting.ts) — comprobado UNA vez para toda la petición, no por selección. La misma
        // foto de inventario sirve para ambos oficios: `hasToolFor` decide por `metodoObtencion` de
        // cada `yieldRow` dentro del bucle (CAZA aquí es siempre desuello — despiece de una presa
        // ya derrotada, ver comentario de cabecera — nunca la caza de una presa viva, que vive en
        // otra ruta; MINERIA es siempre minero).
        const [toolRows, toolCatalogBySlug] = await (async () => {
          const rows = await tx.inventoryItem.findMany({ where: { saveId: save.id }, select: { id: true, name: true, catalogSlug: true } });
          const catalogSlugs = [...new Set(rows.map((r) => r.catalogSlug).filter((s): s is string => Boolean(s)))];
          const catalogRows = catalogSlugs.length
            ? await tx.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: catalogSlugs } }, select: { slug: true, tipo: true, category: true, herramientaParaOficio: true } })
            : [];
          return [rows, new Map(catalogRows.map((c) => [c.slug, c]))] as const;
        })();
        const hasDesolladorTool = OFICIOS_CON_HERRAMIENTA_REQUERIDA.includes('desollador') ? hasToolForOficio('desollador', toolRows, toolCatalogBySlug) : true;
        // Minero (2026-08-23, Grupo 3 § HarvestYield.condicion) NO está en
        // OFICIOS_CON_HERRAMIENTA_REQUERIDA a propósito (bloquear el oficio entero impedía minar
        // hasta Piedra común) — este check se computa siempre, y solo se aplica más abajo a los
        // yields concretos marcados `requiereHerramienta` (mena de Yerreo, mena de hierro).
        const hasMineroTool = hasToolForOficio('minero', toolRows, toolCatalogBySlug);
        // Pescar (2026-09-02, Pieza 1) — caña de pescar, mismo gate por OFICIO ENTERO que
        // desollador/curtidor (bloquea Pescar completo sin caña, no un yield concreto). Buscar
        // (BUSQUEDA) no la necesita en absoluto — nunca se comprueba en esa rama, ver más abajo.
        const hasCanaPescar = hasToolForOficio('pescador-pescar', toolRows, toolCatalogBySlug);
        // Cebo (2026-09-02) — consumible que se GASTA al pescar (1 por petición de Pescar, no por
        // unidad capturada — mismo criterio "una tirada, un intento" que el resto de la
        // herramienta/consumo de este archivo), mismo mecanismo de `totalQuantity`/
        // `planConsumption` que ya usa crafting.ts/construction.ts para ingredientes. `toolRows`
        // sirve tal cual como `InventoryRowLike` (mismo shape: id/name/catalogSlug).
        const CEBO_INGREDIENT: IngredientRequirement = { match: { kind: 'exact', catalogSlug: 'cebo-pesca' }, cantidad: 1, label: 'cebo' };
        const hasCebo = totalQuantity(toolRows, CEBO_INGREDIENT, toolCatalogBySlug) >= 1;
        // Se consume UNA vez por petición (no por selección: varias selecciones de Pescar en la
        // misma petición vienen todas de la misma "tirada de caña" ya consumida en /explorar) —
        // aplicado la primera vez que aparece una selección PESCA, ver bucle principal.
        let ceboConsumido = false;
        const segundasTiradas: SegundaTiradaInfo[] = [];

        // Acumula en la pila ya existente en vez de crear siempre una fila nueva (bug real jugando
        // en vivo, 2026-08-07: "Piedra (3)" + "Piedra (3)" sueltas en vez de "Piedra (6)") — mismo
        // patrón de cantidad-en-el-nombre que ya usa crafteo/construcción (`quantityOf`/
        // `baseNameOf`, ingredients.ts). Keyed por `catalogSlug` para que dos selecciones del MISMO
        // objeto dentro de esta misma petición (dos fuentes distintas con el mismo yield) también
        // se sumen entre sí, no solo contra lo que ya hubiera de antes.
        const touched = new Map<string, TouchedStack>();
        // Fuentes (no objetos) ya validadas/depletadas EN ESTA MISMA petición — cooldown y
        // población son por `sourceSlug`, no por `itemSlug`; una fuente con 2 yields distintos
        // seleccionados a la vez solo debe pasar el guard de cooldown una vez (si no, la segunda
        // selección vería el `lastHarvestedAt` que la primera acaba de fijar hace un instante y se
        // bloquearía a sí misma en la misma petición).
        const sourcesTouchedThisRequest = new Set<string>();
        // Solo para el texto determinista final (2026-08-09): "recolecta" no encaja para desuello
        // ("Gorhorn recolecta: Piel de Corretolvas" suena a que la piel crecía en el suelo) — si
        // TODO lo conseguido en esta petición vino de CAZA, el texto dice "despieza" en su lugar.
        // El pop-up nunca mezcla oficios en una sola petición, pero esto no depende de esa
        // suposición: si hay una mezcla real, se queda con el verbo neutro ("recolecta").
        let anyCaza = false;
        let anyNonCaza = false;
        for (const sel of selections) {
          if (sel.cantidad <= 0 || unitsRemaining <= 0) continue;

          // Validación contra la fuente de verdad (2026-08-07, auditoría: sin esto, `selections`
          // viene del cliente sin comprobar nada — se podía pedir cualquier itemSlug para
          // cualquier sourceSlug, y `sel.cantidad` no tenía más tope que la población total del
          // mundo, saltándose por completo el máximo real por recolección de `HarvestYield.cantidad`
          // (p. ej. "3 piedras por recolección" se convertía en "toda la veta de una vez").
          const yieldRow = await tx.harvestYield.findFirst({
            where: { worldId: save.worldId, sourceSlug: sel.sourceSlug, item: { slug: sel.itemSlug } },
            include: { item: true },
          });
          if (!yieldRow) continue;
          let cantidad = Math.min(sel.cantidad, yieldRow.cantidad, unitsRemaining);

          // Segunda tirada en tier alto (2026-09-02, Pieza 2) — SOLO candidatos tier >= 6 (el
          // resto del catálogo, la inmensa mayoría, no cambia en absoluto). Se dispara AQUÍ, ANTES
          // de tocar NpcState/WorldPopulation/inventario: si falla, esta selección concreta no se
          // materializa — nunca se depleta población ni se reclama un cadáver por algo que al
          // final no se consigue de verdad.
          if ((yieldRow.item.tier ?? 1) >= SEGUNDA_TIRADA_TIER_MINIMO) {
            const segunda = attributeSecundarioForMetodo(yieldRow.metodoObtencion);
            if (segunda) {
              // `segunda.oficio` es siempre el PREFIJO base ("minero", nunca "minero-llanuras" —
              // `HARVEST_ABILITIES` no guarda variantes de región/raza, ver comentario de
              // `professionIdForOficio`) — mismo emparejamiento por prefijo que el resto del
              // archivo (`matchesOficioPrefix`), nunca una comparación exacta contra este string.
              const nivelOficio = (save.professionProgress ?? []).find((p) => matchesOficioPrefix(p.professionId, segunda.oficio))?.nivel ?? 1;
              const effectiveAttrs = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
              const { paso, grado, roll: segundaRoll, dificultad } = pasaSegundaTirada(effectiveAttrs, segunda.attribute, alivioForLevel(nivelOficio), yieldRow.item.tier);
              segundasTiradas.push({ sourceSlug: sel.sourceSlug, itemSlug: sel.itemSlug, itemName: yieldRow.item.name, roll: segundaRoll, dificultad, grado, paso });
              if (!paso) continue;
              cantidad = cantidadForGrado(grado, cantidad);
              if (cantidad <= 0) continue;
            }
          }

          if (yieldRow.metodoObtencion === 'CAZA') {
            if (!hasDesolladorTool) continue;
            // Desuello (2026-08-09): no hay `WorldPopulation` que depletar — el "recurso" es la
            // presa misma, ya reducida al morir en combate. Claim atómico sobre `NpcState.saqueado`
            // (mismo guard-en-el-where que ya usa el saqueo de NPCs con nombre): una única fuente
            // puede dar varios yields distintos (piel + hueso del mismo cadáver) en la misma
            // petición, así que el claim solo se intenta la PRIMERA vez que aparece este
            // `sourceSlug` — las siguientes selecciones de la misma fuente ya lo dan por hecho
            // (si no, la segunda vería `saqueado:true` recién puesto por la primera y se
            // bloquearía a sí misma dentro de la misma petición).
            if (!sourcesTouchedThisRequest.has(sel.sourceSlug)) {
              const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, slug: sel.sourceSlug, saveId: null }, select: { id: true, kind: true } });
              if (!npc) continue;
              const scope = scopeFor(npc.kind, save.currentLocationId);
              // Caza en grupo (2026-08-13) — un grupo (`groupSize` no nulo) tiene varios cadáveres
              // reales acumulados (`groupDefeated`, sube uno por cada individuo caído), cada uno
              // despiezable por separado — `saqueado` (booleano) solo tiene sentido para 1
              // individuo, ver comentario del campo en schema.prisma. Lectura previa (no dentro
              // del mismo `updateMany` atómico: Prisma no compara una columna contra otra en un
              // `where` sin SQL crudo) solo para saber qué camino tomar — el claim en sí SIGUE
              // siendo atómico (increment/`lt` se evalúan contra el valor en vivo en Postgres, no
              // contra esta foto), así que dos despieces casi simultáneos no pueden duplicar el
              // mismo cadáver.
              const freshState = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } } });
              const claimed = freshState?.groupSize
                ? await tx.npcState.updateMany({
                    where: { saveId: save.id, npcId: npc.id, scope, corpsesLooted: { lt: freshState.groupDefeated } },
                    data: { corpsesLooted: { increment: 1 } },
                  })
                : await tx.npcState.updateMany({
                    where: { saveId: save.id, npcId: npc.id, scope, saqueado: false },
                    data: { saqueado: true },
                  });
              if (claimed.count === 0) continue;
              sourcesTouchedThisRequest.add(sel.sourceSlug);
            }
            anyCaza = true;
          } else if (yieldRow.metodoObtencion === 'PASIVO') {
            // "Recoger" (2026-08-25) — sin `WorldPopulation` ni cooldown que comprobar (ver
            // `pasivoCandidatesFor`): si el candidato llegó hasta aquí es porque sigue en su
            // Location exacta ahora mismo, se concede directo. Mismo verbo que el resto de
            // no-CAZA en el texto final ("recolecta"), no hace falta una rama de texto aparte.
            anyNonCaza = true;
          } else if (yieldRow.metodoObtencion === 'PESCA' || yieldRow.metodoObtencion === 'BUSQUEDA') {
            // Pescador (2026-09-02, Pieza 1) — a diferencia de MINERIA/TALA/EXTRACCION (rama de
            // abajo), NUNCA toca `WorldPopulation`: pescar/buscar no depletan la población mundial
            // de peces/marisco (no hay muerte real, ver comentario de `esFaunaMetodo`), su único
            // límite real es el cooldown de 3-usos-seguidos ya aplicado en /explorar (Save.pescaUsosSeguidos).
            if (yieldRow.metodoObtencion === 'PESCA') {
              if (!hasCanaPescar || !hasCebo) continue;
              if (!ceboConsumido) {
                const plan = planConsumption(toolRows, CEBO_INGREDIENT, toolCatalogBySlug);
                for (const id of plan.deleteIds) await tx.inventoryItem.delete({ where: { id } });
                if (plan.updateRemainder) {
                  const row = toolRows.find((r) => r.id === plan.updateRemainder!.id)!;
                  const newName = plan.updateRemainder.newQuantity > 1 ? `${baseNameOf(row.name)} (${plan.updateRemainder.newQuantity})` : baseNameOf(row.name);
                  await tx.inventoryItem.update({ where: { id: plan.updateRemainder.id }, data: { name: newName } });
                }
                ceboConsumido = true;
              }
            }
            anyNonCaza = true;
          } else {
            // Pico de minero (2026-08-23) — igual que el guard de CAZA arriba, comprobado antes
            // de tocar población: sin herramienta, esta selección concreta no se materializa.
            if (yieldRow.requiereHerramienta && !hasMineroTool) continue;
            // Depleción atómica (mismo patrón que decrementPopulationOnDeath, population.ts) — el
            // guard `poblacion: { gte: cantidad }` evita bajar de 0 sin necesitar releer nada antes.
            // Cooldown real (bug real jugando en vivo, 2026-08-07: "minar indefinidamente sin
            // moverme de la zona") en el MISMO guard atómico: si ya se recolectó esta fuente hace
            // menos de `RECOLECCION_COOLDOWN_MS`, `count` da 0 igual que si no quedara población.
            // Location-aware (bug real jugando en vivo, 2026-08-13: "avanzo por la hondonada
            // buscando más elementos... debería poder volver a usarla, al igual que si cambiamos
            // de zona") — el cooldown también se salta si `currentLocationId` no coincide con
            // dónde se recolectó la última vez, aunque no hayan pasado los 30 min.
            //
            // Bug real de auditoría (2026-08-13): `{ not: save.currentLocationId }` con
            // `currentLocationId` NULO (campo nullable — posible tras `creation.ts`) se traduce en
            // Prisma como `IS NOT NULL`, cierto para CUALQUIER fuente ya recolectada antes — el
            // cooldown quedaba inservible en ese estado en vez de bloquear. Con ubicación
            // desconocida no hay "misma zona" que comprobar, así que esa rama del OR se omite del
            // todo (fallo cerrado: solo puede saltar el cooldown por tiempo, nunca por ubicación).
            const result = await tx.worldPopulation.updateMany({
              where: {
                ...(await ambitoPoblacion(tx, save.id)),
                targetType: 'RECURSO',
                targetSlug: sel.sourceSlug,
                poblacion: { gte: cantidad },
                ...(sourcesTouchedThisRequest.has(sel.sourceSlug)
                  ? {}
                  : {
                      OR: [
                        { lastHarvestedAt: null },
                        { lastHarvestedAt: { lt: cooldownCutoff } },
                        ...(save.currentLocationId ? [{ lastHarvestedLocationId: { not: save.currentLocationId } }] : []),
                      ],
                    }),
              },
              data: { poblacion: { decrement: cantidad }, lastHarvestedAt: new Date(), lastHarvestedLocationId: save.currentLocationId },
            });
            if (result.count === 0) continue;
            sourcesTouchedThisRequest.add(sel.sourceSlug);
            anyNonCaza = true;
          }
          unitsRemaining -= cantidad;

          const catalogItem = yieldRow.item;
          const alreadyTouched = touched.get(catalogItem.slug);
          if (alreadyTouched) {
            alreadyTouched.quantity += cantidad;
            alreadyTouched.harvestedThisTurn += cantidad;
            continue;
          }

          // Pila ya existente de una recolección anterior (nunca una fila equipada — un objeto
          // RECURSO nunca se equipa, pero el filtro deja la intención explícita).
          const existingRow = await tx.inventoryItem.findFirst({
            where: { saveId: save.id, catalogSlug: catalogItem.slug, slot: null },
          });
          if (existingRow) {
            touched.set(catalogItem.slug, {
              id: existingRow.id,
              catalogName: catalogItem.name,
              description: catalogItem.description,
              catalogSlug: catalogItem.slug,
              wasPreexisting: true,
              quantity: quantityOf(existingRow.name) + cantidad,
              harvestedThisTurn: cantidad,
            });
          } else {
            const createdRow = await tx.inventoryItem.create({
              data: { saveId: save.id, name: catalogItem.name, description: catalogItem.description, origin: 'recolección', catalogSlug: catalogItem.slug },
            });
            touched.set(catalogItem.slug, {
              id: createdRow.id,
              catalogName: catalogItem.name,
              description: catalogItem.description,
              catalogSlug: catalogItem.slug,
              wasPreexisting: false,
              quantity: cantidad,
              harvestedThisTurn: cantidad,
            });
          }
        }

        // Un solo write final por pila tocada, ya con la cantidad total sumada — evita escribir el
        // nombre a medias si la misma pila se tocó más de una vez en este bucle (dos selecciones
        // del mismo objeto en una sola petición).
        for (const stack of touched.values()) {
          const finalName = stack.quantity > 1 ? `${stack.catalogName} (${stack.quantity})` : stack.catalogName;
          await tx.inventoryItem.update({ where: { id: stack.id }, data: { name: finalName } });
        }

        // Registro escrito determinista de lo recolectado (petición explícita, 2026-08-07: "un
        // texto de narración que no dependa de la AI") — mismo criterio que el resto del motor de
        // turnos: nunca inventar prosa por IA para algo que ya se sabe con certeza mecánica. Solo
        // si de verdad se consiguió algo (no todas las peticiones tienen éxito: capacidad llena,
        // cooldown, población agotada a mitad de bucle).
        let logEntry: { id: string; text: string; timeLabel: string; createdAt: string; fictionalMinutes: number; roll?: RecoleccionLogRoll } | null = null;
        let nuevoFictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
        let nuevaFictionalDateLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
        if (touched.size > 0) {
          const resumen = [...touched.values()]
            .map((s) => (s.harvestedThisTurn > 1 ? `${s.catalogName} (${s.harvestedThisTurn})` : s.catalogName))
            .join(', ');
          const verbo = anyCaza && !anyNonCaza ? 'despieza una presa cercana' : 'recolecta en la zona';
          const text = `${save.characterName} ${verbo}: ${resumen}.`;
          const totalUnidades = [...touched.values()].reduce((sum, s) => sum + s.harvestedThisTurn, 0);
          const minutosCoste = minutosRecoleccionFor(totalUnidades);
          nuevoFictionalMinutes = advanceFictionalMinutes(save.worldState?.fictionalMinutes ?? 480, minutosCoste);
          nuevaFictionalDateLabel = formatFictionalDate(nuevoFictionalMinutes);
          await tx.worldState.update({
            where: { saveId: save.id },
            data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: nuevaFictionalDateLabel },
          });
          // isSystemMessage (ver comentario completo en schema.prisma) — texto fijo determinista.
          const logRoll: RecoleccionLogRoll | undefined =
            primeraTirada || segundasTiradas.length > 0
              ? { kind: 'recoleccion', ...(primeraTirada ? { tirada: primeraTirada } : {}), ...(segundasTiradas.length > 0 ? { segundas: segundasTiradas } : {}) }
              : undefined;
          const created = await tx.logEntry.create({
            data: {
              saveId: save.id,
              channel: 'CHARACTER',
              text,
              timeLabel: nuevaFictionalDateLabel,
              fictionalMinutes: nuevoFictionalMinutes,
              isPlayerAction: false,
              isSystemMessage: true,
              ...(logRoll ? { roll: logRoll as unknown as Prisma.InputJsonValue } : {}),
            },
          });
          logEntry = { id: created.id, text, timeLabel: nuevaFictionalDateLabel, createdAt: created.createdAt.toISOString(), fictionalMinutes: nuevoFictionalMinutes, ...(logRoll ? { roll: logRoll } : {}) };
        }

        // Cierre de misión "conseguir Z" (bug real, auditoría 2026-08-11 "pruebas por API"): este
        // endpoint determinista nunca pasaba por `narrateAndPersistTurn`, así que ninguna misión
        // `targetItemName` se cerraba nunca si el objeto venía de Minar/Talar/Desollar — mismo
        // criterio que turnResolution.ts, extraído a `closeItemQuests` para no duplicar la lógica.
        await closeItemQuests({
          tx,
          saveId: save.id,
          worldId: save.worldId,
          createdItemNames: [...touched.values()].map((s) => s.catalogName),
          timeLabel: nuevaFictionalDateLabel,
          fictionalMinutes: nuevoFictionalMinutes,
        });

        // Punto del jugador en el mapa de Zona (2026-09-04) — mueve al jugador al ÚLTIMO
        // `sourceSlug` de la lista (orden = orden de clic del jugador, razonable que el marcador
        // acabe junto al último recurso trabajado). Solo si ese recurso tiene `ZonePoint` real —
        // sin pin curado, no hay a dónde mover (los recursos nunca son "dinámicos" con posición
        // aleatoria, a diferencia de NPC/fauna, ver zona.ts).
        const currentLocationIdParaZona = save.currentLocation?.id ?? null;
        if (currentLocationIdParaZona && selections.length > 0) {
          const ultimoSourceSlug = selections[selections.length - 1].sourceSlug;
          const zonaObjetivo = await posicionDeObjetivo(tx, save.id, currentLocationIdParaZona, ultimoSourceSlug);
          if (zonaObjetivo) await moverJugadorA(tx, save.id, zonaObjetivo.x, zonaObjetivo.y);
        }

        if (clearPendingDynamicModeOffer) {
          await tx.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
        }

        return { touched, logEntry, segundasTiradas };
      });

      // Hecho de sesión (fuera de la transacción, igual que `appendSessionFacts` en /explorar —
      // no bloquea la transacción de DB con el embebido de Ollama) para que el propio Narrador
      // sepa más tarde que esos recursos ya se tomaron de esta fuente, si la menciona de nuevo.
      if (touched.touched.size > 0) {
        const sessionFacts = await loadSessionFacts(save.id);
        await appendSessionFacts(save.id, sessionFacts, [touched.logEntry!.text]);
        // Bug real (2026-08-14, petición explícita: "las cosas que recojo con profesiones... no se
        // están marcando como descubiertas en la enciclopedia") — este endpoint determinista nunca
        // pasaba por `narrateAndPersistTurn` (turnResolution.ts), el único sitio que hasta ahora
        // llamaba a `recordEntityDiscoveries`, así que un objeto conseguido por Minar/Talar/
        // Desollar podía quedar en el inventario sin desbloquear nunca su ficha de Enciclopedia.
        await recordEntityDiscoveries({ saveId: save.id, worldId: save.worldId, mentionedText: touched.logEntry!.text });
        // Tirada congelada (2026-08-22) — el mundo real cambió (población depletada/cadáver
        // despiezado), así que la foto guardada por `saveRollCache` de la(s) fuente(s) tocada(s) ya
        // no refleja lo que queda. Invalida SOLO esas entradas del mapa (bug real jugando en vivo,
        // 2026-08-25/26, ver `invalidateRollCacheFor`) — un oficio ajeno a estas fuentes no pierde
        // su propia tirada congelada por confirmar recolección de otro oficio distinto.
        await invalidateRollCacheFor(save.id, save.harvestRollCache, new Set(selections.map((s) => s.sourceSlug)));
      }

      // Materia prima cruda — siempre tipo RECURSO por diseño (nunca EQUIPABLE ni ESPECIAL), mismo
      // criterio que el resto de yields de despiece/recolección (turnResolution.ts). `tipo` aquí
      // (bug real jugando en vivo, 2026-08-07): sin él, el objeto recién recolectado aparecía "sin
      // categorizar" en el Inventario hasta la próxima recarga completa — mismo patrón exacto ya
      // arreglado dos veces antes para equipSlot/effectKey, olvidado para tipo en ambos arreglos.
      const items: { id: string; name: string; description: string; slot: null; catalogSlug: string; equipSlot: null; effectKey: null; tipo: 'RECURSO' }[] =
        [];
      // Pilas que YA existían antes de esta petición — el cliente las tiene en su estado local con
      // el nombre viejo, solo necesita el nombre nuevo (bug real jugando en vivo, 2026-08-07: "no
      // acumula los items" — cada recolección creaba una fila nueva en vez de sumar a la ya
      // existente, mismo patrón que `updatedInventoryItems` ya resuelve para crafteo/construcción).
      const updatedItems: { id: string; name: string }[] = [];
      for (const stack of touched.touched.values()) {
        const finalName = stack.quantity > 1 ? `${stack.catalogName} (${stack.quantity})` : stack.catalogName;
        if (stack.wasPreexisting) {
          updatedItems.push({ id: stack.id, name: finalName });
        } else {
          items.push({
            id: stack.id,
            name: finalName,
            description: stack.description,
            slot: null,
            catalogSlug: stack.catalogSlug,
            equipSlot: null,
            effectKey: null,
            tipo: 'RECURSO',
          });
        }
      }

  return { items, updatedItems, logEntry: touched.logEntry, segundasTiradas: touched.segundasTiradas };
}
