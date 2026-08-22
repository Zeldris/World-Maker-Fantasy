import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { metodoForOficio, attributeForOficio } from '../../services/harvestAbilities.js';
import { detectNpcsInScene, scopeFor, hasPendingLoot } from '../../services/npcScene.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import { inventoryCapacityFor, totalInventoryUnits } from '../../services/inventoryCapacity.js';
import { effectiveAttributes, effectiveInventorySlotsBonus, effectiveSecondaryAttributes } from '../../services/equipment.js';
import { stripRegionArticle } from '../../services/population.js';
import { pasaFiltroTerreno } from '../../services/terrain.js';
import { locationTerrainTags, harvestSourceTerrainTag, sourceCategoryNameFor } from '../../scripts/worldCatalog.js';
import { quantityOf } from '../../services/ingredients.js';
import { hasToolForOficio, OFICIOS_CON_HERRAMIENTA_REQUERIDA } from '../../services/crafting.js';
import { closeItemQuests } from '../../services/questResolution.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import { advanceFictionalMinutes, formatFictionalDate } from '../../services/worldClock.js';
import { alivioForLevel } from '../../services/professionProgress.js';
import { normalizeSecondaryAttributes } from '../../services/secondaryAttributes.js';
import { rollGathering, dificultadForTier, gradoForRecurso, cantidadForGrado } from '../../services/dice.js';
import type { GatheringRollResult, AttributeBlock } from '../../services/dice.js';
import { Prisma } from '@prisma/client';
import type { MetodoObtencion } from '@prisma/client';

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
const RECOLECCION_COOLDOWN_MS = 30 * 60_000;

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

interface SourceCandidate {
  sourceSlug: string;
  sourceCategory: string;
  disponible: number;
  /// `tier` (rediseño de recolección, 2026-08-22) solo se usa para calcular la dificultad de
  /// `rollGathering` dentro de esta misma ruta — nunca sale hacia `groupByCategory`/el frontend
  /// (`CategoryYield` no lo declara, así que se descarta sin más al agrupar).
  yields: { itemSlug: string; itemName: string; cantidadMaxima: number; tier: number | null }[];
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

/// Fuentes candidatas para `oficio` en la región actual: las que tienen HarvestYield con el
/// método correcto Y una fila WorldPopulation tipo RECURSO con población real > 0 en esa región
/// (nunca se ofrece recolectar algo que el propio mundo dice que no queda) Y que no estén en
/// cooldown por haberse recolectado hace poco EN ESTA MISMA Location. `anyOnCooldown` distingue
/// "no hay nada aquí" de "lo que hay está agotado por ahora" para el mensaje del frontend.
///
/// Cooldown location-aware (bug real jugando en vivo, 2026-08-13: "avanzo por la hondonada
/// buscando más elementos... ahí sí que debería poder volver a usarla, al igual que si cambiamos
/// de zona" — antes el cooldown de 30 min era puro reloj, sin memoria de sitio, así que moverte a
/// otra Location no servía de nada). Pasa el guard si CUALQUIERA de las dos condiciones se cumple:
/// pasaron los 30 min reales, O `locationId` no coincide con `lastHarvestedLocationId`.
async function candidateSourcesFor(
  worldId: string,
  metodo: MetodoObtencion,
  region: string | null,
  locationId: string | null,
  locationSlug: string | null,
): Promise<{ candidates: SourceCandidate[]; anyOnCooldown: boolean }> {
  const rows = await prisma.harvestYield.findMany({ where: { worldId, metodoObtencion: metodo }, include: { item: true } });
  if (rows.length === 0) return { candidates: [], anyOnCooldown: false };
  const bySlug = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!bySlug.has(row.sourceSlug)) bySlug.set(row.sourceSlug, []);
    bySlug.get(row.sourceSlug)!.push(row);
  }
  const populations = await prisma.worldPopulation.findMany({
    where: { worldId, targetType: 'RECURSO', targetSlug: { in: [...bySlug.keys()] }, poblacion: { gt: 0 } },
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
    // región de arriba, ver terrain.ts.
    if (!pasaFiltroTerreno(locationSlug ? locationTerrainTags[locationSlug] : undefined, harvestSourceTerrainTag[pop.targetSlug])) continue;
    const sourceRows = bySlug.get(pop.targetSlug) ?? [];
    if (sourceRows.length === 0) continue;
    const sameLocation = locationId !== null && pop.lastHarvestedLocationId === locationId;
    if (pop.lastHarvestedAt && pop.lastHarvestedAt.getTime() > cooldownCutoff && sameLocation) {
      anyOnCooldown = true;
      continue;
    }
    candidates.push({
      sourceSlug: pop.targetSlug,
      sourceCategory: sourceRows[0].sourceCategory,
      disponible: pop.poblacion,
      yields: sourceRows.map((r) => ({ itemSlug: r.item.slug, itemName: r.item.name, cantidadMaxima: r.cantidad, tier: r.item.tier })),
    });
  }
  return { candidates, anyOnCooldown };
}

/// Desuello (2026-08-09, ver comentario de cabecera) — "candidatos" son fauna ya en escena
/// (`detectNpcsInScene`, mismo mecanismo determinista que ya usan saqueo/decapitar) que está
/// vencida (`condicionFisica` CONVALECIENTE o MUERTO — se pueda o no rematar/decapitar, no hace
/// falta que esté MUERTA en concreto) y que todavía no se ha despiezado del todo
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
async function carcassCandidatesFor(worldId: string, saveId: string, currentLocationId: string | null, sessionFacts: string[]): Promise<SourceCandidate[]> {
  const npcsInScene = await detectNpcsInScene({ action: '', worldId, sessionFacts, saveId, currentLocationId });
  const carcasses = npcsInScene.filter(
    (n) => n.ataqueNatural !== null && hasPendingLoot(n) && (n.condicionFisica === 'CONVALECIENTE' || n.condicionFisica === 'MUERTO' || !!n.groupDefeated),
  );
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
    .filter((c) => bySlug.has(c.slug))
    .map((c) => {
      const yieldRows = bySlug.get(c.slug)!;
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
        yields: yieldRows.map((r) => ({ itemSlug: r.item.slug, itemName: r.item.name, cantidadMaxima: r.cantidad, tier: r.item.tier })),
      };
    });
}

/// Save con los datos mínimos para calcular `rollGathering` (equipo puesto para bonus de
/// atributos/secundarios + nivel del oficio concreto que se está usando) — un único shape
/// compartido por `/explorar` y el GET de desollador en vez de repetir el cálculo dos veces.
interface GatheringRollInputs {
  attributes: AttributeBlock;
  secondaryAttributesJson: unknown;
  inventoryItems: { statBonuses: unknown }[];
  professionProgress: { professionId: string; nivel: number }[];
}

/// Una sola tirada por acción de Explorar/Desollar (rediseño de recolección, 2026-08-22) —
/// aplicada luego contra la dificultad de CADA recurso candidato (`applyGatheringRoll` más abajo),
/// nunca una tirada por recurso: el margen de un único resultado ya decide a la vez qué aparece y
/// cuánta cantidad, igual que un único chequeo de Supervivencia en D&D revela más cuanto mejor se
/// tira. `oficio` es el `professionId` exacto pulsado (ej. "minero-llanuras"), no un prefijo.
function gatheringRollFor(save: GatheringRollInputs, oficio: string): GatheringRollResult {
  const attributes = effectiveAttributes(save.attributes, save.inventoryItems);
  const secondaryAttributes = effectiveSecondaryAttributes(normalizeSecondaryAttributes(save.secondaryAttributesJson), save.inventoryItems);
  const nivelOficio = save.professionProgress.find((p) => p.professionId === oficio)?.nivel ?? 1;
  // Ya validado más arriba (metodoForOficio no fue null): attributeForOficio busca el mismo
  // prefijo y siempre encuentra pareja.
  const attribute = attributeForOficio(oficio)!;
  return rollGathering(attributes, attribute, alivioForLevel(nivelOficio), secondaryAttributes.suerte);
}

/// Aplica el resultado de `gatheringRollFor` a una lista de candidatos: cada yield individual (no
/// la fuente entera, una misma fuente puede dar varios objetos de distinto tier) se filtra/recorta
/// según su propio grado — una fuente que se queda sin ningún yield tras esto desaparece del todo
/// del listado (fallo total de la tirada para ese recurso concreto).
function applyGatheringRoll(candidates: SourceCandidate[], roll: GatheringRollResult): SourceCandidate[] {
  return candidates
    .map((c) => ({
      ...c,
      yields: c.yields
        .map((y) => ({ ...y, cantidadMaxima: cantidadForGrado(gradoForRecurso(roll.result, dificultadForTier(y.tier)), y.cantidadMaxima) }))
        .filter((y) => y.cantidadMaxima > 0),
    }))
    .filter((c) => c.yields.length > 0);
}

/// Tirada congelada (petición explícita, 2026-08-22: "para poder ver algo siempre deberías pasar
/// por esta tirada... al menos una vez y ya se guarda" — sin esto, reabrir el pop-up tras localizar
/// algo enseñaba la lista CRUDA sin recortar por grado (ignorando la tirada por completo), y
/// Desollar volvía a tirar en cada apertura del panel, dejando "pescar" un resultado mejor cerrando
/// y reabriendo). `Save.harvestRollCache` (Json) guarda el resultado YA filtrado por
/// `applyGatheringRoll` — nunca los candidatos crudos — junto al oficio/ubicación en que se tiró,
/// para saber si sigue siendo válido. Reemplaza por completo el viejo mecanismo de
/// `detectHarvestSourcesInScene` para "ya localizado" en este archivo (Cazar, ruta aparte, sigue
/// usando ese mecanismo — fuera del alcance de este cambio).
interface HarvestRollCache {
  oficio: string;
  locationId: string | null;
  sources: SourceCandidate[];
}

function cachedRollFor(save: { harvestRollCache: unknown }, oficio: string, locationId: string | null): SourceCandidate[] | null {
  const cache = save.harvestRollCache as HarvestRollCache | null;
  if (!cache || cache.oficio !== oficio || cache.locationId !== locationId) return null;
  return cache.sources;
}

function saveRollCache(saveId: string, oficio: string, locationId: string | null, sources: SourceCandidate[]) {
  const cache: HarvestRollCache = { oficio, locationId, sources };
  return prisma.save.update({ where: { id: saveId }, data: { harvestRollCache: cache as unknown as Prisma.InputJsonValue } });
}

export async function recolectarRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string; oficio: string } }>('/saves/:id/recolectar/:oficio', async (request, reply) => {
    const metodo = metodoForOficio(request.params.oficio);
    if (!metodo) {
      return reply.status(400).send({ error: `"${request.params.oficio}" no es un oficio recolector` });
    }
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: {
        currentLocation: true,
        inventoryItems: { where: { slot: { not: null } }, select: { statBonuses: true } },
        professionProgress: { select: { professionId: true, nivel: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    if (metodo === 'CAZA') {
      // Tirada congelada (rediseño de recolección, 2026-08-22) — antes se tiraba de nuevo en CADA
      // apertura del panel (simplificación consciente original, ya descartada): dejaba "pescar" un
      // resultado mejor cerrando y reabriendo. Ahora, si ya se tiró para este oficio en esta misma
      // ubicación, se devuelve tal cual, sin tirar otra vez.
      const cachedSources = cachedRollFor(save, request.params.oficio, save.currentLocationId);
      if (cachedSources) return { sources: groupByCategory(cachedSources), puedeExplorar: false, enCooldown: false };

      const sessionFacts = await loadSessionFacts(save.id);
      const rawCandidates = await carcassCandidatesFor(save.worldId, save.id, save.currentLocationId, sessionFacts);
      if (rawCandidates.length === 0) return { sources: [], puedeExplorar: false, enCooldown: false };
      const roll = gatheringRollFor(
        { attributes: save.attributes as AttributeBlock, secondaryAttributesJson: save.secondaryAttributes, inventoryItems: save.inventoryItems, professionProgress: save.professionProgress },
        request.params.oficio,
      );
      const filtered = applyGatheringRoll(rawCandidates, roll);
      await saveRollCache(save.id, request.params.oficio, save.currentLocationId, filtered);
      return { sources: groupByCategory(filtered), roll, puedeExplorar: false, enCooldown: false };
    }

    // Tirada congelada (mismo criterio que arriba) — reemplaza por completo el viejo
    // `detectHarvestSourcesInScene`: "ya localizado" ahora significa "ya se tiró aquí", nunca "la
    // narración lo mencionó", así que ver algo SIEMPRE implica haber pasado por una tirada real
    // (en /explorar) al menos una vez.
    const cachedSources = cachedRollFor(save, request.params.oficio, save.currentLocationId);
    if (cachedSources) return { sources: groupByCategory(cachedSources), puedeExplorar: false, enCooldown: false };

    const { candidates, anyOnCooldown } = await candidateSourcesFor(
      save.worldId,
      metodo,
      save.currentLocation?.region ?? null,
      save.currentLocationId,
      save.currentLocation?.slug ?? null,
    );
    if (candidates.length === 0) return { sources: [], puedeExplorar: false, enCooldown: anyOnCooldown };
    return { sources: [], puedeExplorar: true, enCooldown: false };
  });

  // Determinista, sin gastar turno ni pasar por Ollama (decisión de diseño, 2026-08-07: ya existe
  // WorldPopulation con población real por región, no hace falta narrar para saber qué hay) —
  // registra el hallazgo como hecho de sesión para que futuras aperturas del pop-up (y el propio
  // Narrador) ya lo den por localizado sin tener que volver a explorar.
  app.post<{ Params: { id: string; oficio: string } }>('/saves/:id/recolectar/:oficio/explorar', async (request, reply) => {
    const metodo = metodoForOficio(request.params.oficio);
    if (!metodo || metodo === 'CAZA') {
      return reply.status(400).send({ error: `"${request.params.oficio}" no es un oficio recolector con exploración` });
    }
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: {
        currentLocation: true,
        inventoryItems: { where: { slot: { not: null } }, select: { statBonuses: true } },
        professionProgress: { select: { professionId: true, nivel: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    // Bug real (auditoría de bugs, 2026-08-21): a diferencia de /turn/classify y /combat/flee
    // (session.ts), ninguna ruta de recolección comprobaba `save.endedAt` — con la partida ya
    // terminada por muerte definitiva, el composer principal queda bloqueado en el frontend, pero
    // el panel de Habilidades/Minar-Talar-Desollar sigue accesible y permitía seguir recolectando
    // (mutando `WorldPopulation`/inventario de verdad) para un personaje que la propia partida ya
    // da por definitivamente muerto.
    if (save.endedAt) return reply.status(409).send({ error: 'Esta partida ha terminado', endedAt: save.endedAt });

    const { candidates, anyOnCooldown } = await candidateSourcesFor(
      save.worldId,
      metodo,
      save.currentLocation?.region ?? null,
      save.currentLocationId,
      save.currentLocation?.slug ?? null,
    );
    if (candidates.length === 0) return { sources: [], enCooldown: anyOnCooldown };

    // Tirada visible (rediseño de recolección, 2026-08-22, petición explícita: "cuando le das a
    // explorar") — una sola por pulsación de "Explorar", su margen decide a la vez qué recurso de
    // los candidatos aparece y con cuánta cantidad (`applyGatheringRoll`). Un roll malo puede dejar
    // `filteredCandidates` vacío pese a haber candidatos reales: se devuelve igualmente `roll` para
    // que el frontend anime el dado y explique "no encontraste nada esta vez", en vez de mentir con
    // el mensaje de "no hay nada aquí" que usa `anyOnCooldown`.
    const roll = gatheringRollFor(
      { attributes: save.attributes as AttributeBlock, secondaryAttributesJson: save.secondaryAttributes, inventoryItems: save.inventoryItems, professionProgress: save.professionProgress },
      request.params.oficio,
    );
    const filteredCandidates = applyGatheringRoll(candidates, roll);
    // Congela el resultado (rediseño de recolección, 2026-08-22) — incluso si salió vacío (mala
    // suerte): reabrir el panel debe ver SIEMPRE lo mismo, nunca una oportunidad gratis de volver
    // a tirar por un resultado mejor. Se guarda antes de nada más, para que sobreviva aunque el
    // resto del turno (hechos de sesión) falle por cualquier motivo.
    await saveRollCache(save.id, request.params.oficio, save.currentLocationId, filteredCandidates);

    const sessionFacts = await loadSessionFacts(save.id);
    // Una frase por categoría DISTINTA descubierta (2026-08-15, ya no por sourceSlug) — evita
    // repetir "localiza mineral en la zona" dos veces si hay dos fuentes minerales a la vez. Solo
    // por lo que la tirada de verdad reveló, no por todos los candidatos crudos.
    const distinctCategories = [...new Set(filteredCandidates.map((c) => c.sourceCategory))];
    if (distinctCategories.length > 0) {
      await appendSessionFacts(
        save.id,
        sessionFacts,
        distinctCategories.map((cat) => `${save.characterName} localiza ${sourceCategoryNameFor(cat).toLowerCase()} en la zona.`),
      );
    }
    return { sources: groupByCategory(filteredCandidates), roll };
  });

  app.post<{ Params: { id: string }; Body: { selections: { sourceSlug: string; itemSlug: string; cantidad: number }[] } }>(
    '/saves/:id/recolectar/confirmar',
    async (request, reply) => {
      const { selections } = request.body;
      if (!Array.isArray(selections) || selections.length === 0) {
        return reply.status(400).send({ error: 'Falta el campo: selections' });
      }

      const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      // Bug real (auditoría de bugs, 2026-08-21) — ver comentario de /recolectar/:oficio/explorar arriba.
      if (save.endedAt) return reply.status(409).send({ error: 'Esta partida ha terminado', endedAt: save.endedAt });

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
        // la herramienta encima) — comprobado UNA vez para toda la petición, no por selección:
        // metodoObtencion 'CAZA' aquí es siempre desuello (despiece de una presa ya derrotada, ver
        // comentario de cabecera), nunca la caza de una presa viva (eso vive en otra ruta).
        const hasDesolladorTool = OFICIOS_CON_HERRAMIENTA_REQUERIDA.includes('desollador')
          ? await (async () => {
              const toolRows = await tx.inventoryItem.findMany({ where: { saveId: save.id }, select: { id: true, name: true, catalogSlug: true } });
              const toolCatalogSlugs = [...new Set(toolRows.map((r) => r.catalogSlug).filter((s): s is string => Boolean(s)))];
              const toolCatalogRows = toolCatalogSlugs.length
                ? await tx.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: toolCatalogSlugs } }, select: { slug: true, tipo: true, category: true, herramientaParaOficio: true } })
                : [];
              const toolCatalogBySlug = new Map(toolCatalogRows.map((c) => [c.slug, c]));
              return hasToolForOficio('desollador', toolRows, toolCatalogBySlug);
            })()
          : true;

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
          const cantidad = Math.min(sel.cantidad, yieldRow.cantidad, unitsRemaining);

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
              const npc = await tx.npc.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: sel.sourceSlug } }, select: { id: true, kind: true } });
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
          } else {
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
                worldId: save.worldId,
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
        let logEntry: { id: string; text: string; timeLabel: string; createdAt: string; fictionalMinutes: number } | null = null;
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
          const created = await tx.logEntry.create({
            data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel: nuevaFictionalDateLabel, fictionalMinutes: nuevoFictionalMinutes, isPlayerAction: false },
          });
          logEntry = { id: created.id, text, timeLabel: nuevaFictionalDateLabel, createdAt: created.createdAt.toISOString(), fictionalMinutes: nuevoFictionalMinutes };
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

        return { touched, logEntry };
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
        // despiezado), así que la foto guardada por `saveRollCache` ya no refleja lo que queda.
        // Se limpia el slot entero (un único caché por partida, no por oficio) para que la próxima
        // apertura del panel/Explorar recalcule desde cero, con una tirada nueva.
        await prisma.save.update({ where: { id: save.id }, data: { harvestRollCache: Prisma.JsonNull } });
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

      return { items, updatedItems, logEntry: touched.logEntry };
    },
  );
}
