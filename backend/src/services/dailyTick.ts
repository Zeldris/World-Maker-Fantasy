import { formatFictionalDate } from './worldClock.js';
import { registrarSuceso } from './cronista/sucesos.js';
import { comidaDelReinoDia, datosComidaDelReino, huecoDeMateriales, slugsDeMateriales, suministrosDelReino } from './cronista/economiaReino.js';
import { sucesosDeClima } from './cronista/clima.js';
import type { Prisma } from '@prisma/client';
import { tickKingdom, daysCrossed, hambrunaNueva, DIAS_PARA_CONSOLIDAR, DIAS_PARA_REBELION, type KingdomStatsBlock } from './kingdomTick.js';
import { registrarHambruna } from './cronista/hambruna.js';
import { comidaDe } from './cronista/ganaderia.js';
import { tickOrdenesProduccion, companionesQueCuraCasaDeCuras, type TrabajadorReino, type OrdenProduccionInput } from './kingdomProduction.js';
import { ownerKeyFor } from './reinoOwner.js';
import { xpForCraftSuccess, professionLevelForXp } from './professionProgress.js';
import { CRAFTING_RECIPES } from './crafting.js';

// Tick diario extraído de `turnResolution.ts` (Fase 7 del plan, refactor puro): todo lo que corre
// UNA vez por turno que cruza al menos un día de ficción. La producción/consumo de facción vive
// aparte, en `factionEconomy.ts` (`producirFacciones`, desde el avance diario de la partida,
// `avanceDiario.ts`).

export interface DailyTickResult {
  /** true si este tick pasó algún territorio a CONSOLIDADO (suma XP de Reino en el turno). */
  territoryConsolidatedThisTurn: boolean;
}

/**
 * Tick diario de Reino (sesión de diseño 2026-07-23, kingdomTick.ts) — solo si ya existe una fila
 * KingdomStats. Incluye Territory.control/population (2026-08-23, Grupo 3).
 */
export async function advanceKingdomStatsDay(
  tx: Prisma.TransactionClient,
  saveId: string,
  diasCruzados: number,
  /// Minuto de ficción al final del salto (el `minutosDespues` del turno); sin él, el de `WorldState`.
  ahora?: number,
): Promise<DailyTickResult> {
  let territoryConsolidatedThisTurn = false;
  const kingdomStats = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) } });
  if (kingdomStats) {
    const { poblacion, felicidad, comida, bebida, riqueza, soldados, trabajadores, visitantes, diasFelicidadAlta, diasFelicidadBaja, diasHambre, diasSed } = kingdomStats;
    // CR-53: agua de pozos y fuente natural, y topes del almacén.
    const suministros = await suministrosDelReino(tx, saveId);
    // CR-58 (Q27): un trabajador sin herramienta produce la mitad.
    const trabajadoresEfectivos = Math.max(0, trabajadores - Math.ceil((kingdomStats.sinHerramienta ?? 0) / 2));
    // CR-61: ya no hay comida pasiva; la dan las tareas de los súbditos (recolector, pescador, cocinero).
    // QA-19: cada día cruzado con su estación y la reserva que queda, igual en un salto que día a día.
    const hasta = ahora ?? (await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } }))?.fictionalMinutes ?? 0;
    const ultimoDia = Math.floor(hasta / 1440);
    const factor = trabajadores > 0 ? trabajadoresEfectivos / trabajadores : 1;
    const datosComida = await datosComidaDelReino(tx, saveId, hasta);
    let dia: KingdomStatsBlock = { poblacion, felicidad, comida, bebida, riqueza, soldados, trabajadores: trabajadoresEfectivos, visitantes, diasFelicidadAlta, diasFelicidadBaja, diasHambre, diasSed };
    for (let d = ultimoDia - diasCruzados + 1; d <= ultimoDia; d++) {
      const comidaDia = comidaDelReinoDia(datosComida, d * 1440 + 720, dia.comida, factor);
      dia = tickKingdom(dia, 1, d, { ...suministros, comidaDia });
    }
    const ticked = { ...dia, trabajadores };
    await tx.kingdomStats.update({ where: { ownerKey: ownerKeyFor({ saveId }) }, data: ticked });
    // CR-12 (12c): 3 días seguidos de hambre → HAMBRUNA en el Libro (la reacción baja la cohesión).
    if (hambrunaNueva(diasHambre, ticked.diasHambre ?? 0, diasCruzados)) await registrarHambruna(tx, saveId, 'REINO_JUGADORA');

    // Territory.control/population (2026-08-23, Grupo 3 — docs/mecanicas/10-niveles-xp-reino.md § 5.4,
    // nunca implementado hasta ahora) — misma cadencia que el tick de arriba, felicidad
    // sostenida decide si el reino se asienta o se rebela. Rebelión primero: si un territorio
    // se pierde ESTE mismo tick, su población cae a 0 de golpe (huida, no decadencia gradual)
    // y sus edificios quedan fuera del reparto de crecimiento de abajo.
    const territories = await tx.territory.findMany({ where: { saveId } });
    if (territories.length > 0) {
      let perdiendoIds: string[] = [];
      if (ticked.diasFelicidadBaja >= DIAS_PARA_REBELION) {
        perdiendoIds = territories.filter((t) => t.control !== 'PERDIDO').map((t) => t.id);
        if (perdiendoIds.length > 0) {
          // Se conserva la fila (docs/10 § 5.4: "es historia del reino") — nunca se borra.
          await tx.territory.updateMany({ where: { id: { in: perdiendoIds } }, data: { control: 'PERDIDO', population: 0 } });
          await tx.building.updateMany({ where: { territoryId: { in: perdiendoIds }, status: 'ACTIVO' }, data: { status: 'ABANDONADO' } });
        }
      } else if (ticked.diasFelicidadAlta >= DIAS_PARA_CONSOLIDAR) {
        const { count } = await tx.territory.updateMany({ where: { saveId, control: { in: ['RECLAMADO', 'DISPUTADO'] } }, data: { control: 'CONSOLIDADO' } });
        territoryConsolidatedThisTurn = count > 0;
      }

      // REI-118 (hito 0.3): la población de cada territorio ya no crece sola; son sus súbditos
      // (`recalcularPoblacion`, cronista/subditos.ts).
    }
  }
  return { territoryConsolidatedThisTurn };
}

/** Panel de Reino real: un tick por Building con OrdenProduccion activa (§ 4.4-ter, 2026-09-21). */
export async function tickProduccionReino(tx: Prisma.TransactionClient, saveId: string, worldId: string): Promise<void> {
  // Panel de Reino real (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4-ter, 2026-09-21) — HERMANO de
  // `if (kingdomStats)`, no anidado dentro: un `Building` con trabajadores puede existir sin
  // que el Reino tenga fila `KingdomStats` todavía (son entidades separadas en el schema, un
  // campamento libre no exige haber fundado el primer Territory) — bug real encontrado
  // escribiendo el test de integración, el tick de producción nunca corría en ese caso. Mismo
  // día de ficción cruzado que el resto de este bloque, UN tick por Building con OrdenProduccion
  // activa (no por día individual, a diferencia de tickKingdom: una orden ya representa "lo
  // que se produce ese día", repetir `diasCruzados` veces exigiría re-leer Almacén entre cada
  // pasada — se deja para cuando haga falta jugando, mismo criterio de "primera pasada
  // ajustable" que el resto de constantes de kingdomTick.ts).
  const buildingsConOrdenes = await tx.building.findMany({
    where: { saveId, status: 'ACTIVO', ordenesProduccion: { some: { activa: true } } },
    include: { ordenesProduccion: { where: { activa: true } }, trabajadores: { where: { rolReino: { not: null } } } },
  });
  if (buildingsConOrdenes.length > 0) {
    const recipesByKey = new Map(CRAFTING_RECIPES.map((r) => [r.key, r]));
    // CR-53 (Q2): materiales y su hueco, una vez por tick (se descuenta lo que se va metiendo).
    const slugsMateriales = await slugsDeMateriales(tx, saveId);
    let huecoMateriales = await huecoDeMateriales(tx, saveId);
    const [almacenRows, almacenLimites, professionRows] = await Promise.all([
      tx.almacenItem.findMany({ where: { saveId } }),
      tx.almacenLimite.findMany({ where: { saveId } }),
      tx.professionProgress.findMany({ where: { companionId: { in: buildingsConOrdenes.flatMap((b) => b.trabajadores.map((t) => t.id)) } } }),
    ]);
    const catalogSlugs = [...new Set(almacenRows.map((r) => r.catalogSlug).filter((s): s is string => s !== null))];
    const catalogRows = catalogSlugs.length > 0 ? await tx.itemCatalog.findMany({ where: { worldId, slug: { in: catalogSlugs } }, select: { slug: true, tipo: true, category: true } }) : [];
    const catalogBySlug = new Map(catalogRows.map((c) => [c.slug, { tipo: c.tipo, category: c.category }]));
    const limitePorSlug = new Map(almacenLimites.map((l) => [l.catalogSlug, l.limite]));
    const cantidadAlmacenPorSlug = new Map<string, number>();
    for (const row of almacenRows) {
      if (!row.catalogSlug) continue;
      cantidadAlmacenPorSlug.set(row.catalogSlug, (cantidadAlmacenPorSlug.get(row.catalogSlug) ?? 0) + 1);
    }
    const xpByCompanion = new Map<string, Record<string, number>>();
    for (const p of professionRows) {
      if (!p.companionId) continue;
      const entry = xpByCompanion.get(p.companionId) ?? {};
      entry[p.professionId] = p.xp;
      xpByCompanion.set(p.companionId, entry);
    }
    let almacenRowsRestantes = almacenRows.map((r) => ({ id: r.id, name: r.name, catalogSlug: r.catalogSlug }));

    for (const building of buildingsConOrdenes) {
      const trabajadores: TrabajadorReino[] = building.trabajadores.map((t) => ({ companionId: t.id, xpPorOficio: xpByCompanion.get(t.id) ?? {} }));
      const ordenesInput: OrdenProduccionInput[] = building.ordenesProduccion.map((o) => ({
        id: o.id,
        recipeKey: o.recipeKey,
        modo: o.modo as 'unico' | 'reponer',
        limite: o.limite,
        prioridad: o.prioridad,
        cantidadProducidaAcumulada: o.cantidadProducidaAcumulada,
        activa: o.activa,
      }));
      const resultados = tickOrdenesProduccion(ordenesInput, trabajadores, recipesByKey, cantidadAlmacenPorSlug, limitePorSlug, almacenRowsRestantes, catalogBySlug, building.tier);

      for (const resultado of resultados) {
        if (resultado.resultado !== 'PRODUCIDA') {
          if (resultado.resultado === 'ORDEN_COMPLETADA') {
            await tx.ordenProduccion.update({ where: { id: resultado.ordenId }, data: { activa: false } });
          }
          // SIN_TRABAJADOR_CON_NIVEL/SIN_MATERIA_PRIMA/ALMACEN_LLENO/RECETA_DESCONOCIDA/
          // NIVEL_EDIFICIO_INSUFICIENTE: sin escritura — es información de gestión del panel
          // de Reino (se lee en vivo desde OrdenProduccion + el estado real de Almacén/
          // trabajadores), no un LogEntry de narración (mismo criterio que el resto de nudges
          // deterministas de este archivo: el jugador ve el resultado en el panel, no en el
          // diario de ficción).
          continue;
        }
        const recipe = recipesByKey.get(ordenesInput.find((o) => o.id === resultado.ordenId)!.recipeKey)!;
        // Consumir ingredientes reales de AlmacenItem — mismo criterio FIFO simple del motor
        // puro (1 fila = 1 unidad, sin fraccionar). Se borran las primeras filas que matcheen
        // cada ingrediente entre las que aún no se consumieron en este mismo tick.
        for (const ing of resultado.ingredientesConsumidos) {
          let restante = ing.cantidad;
          const idsABorrar: string[] = [];
          for (const row of almacenRowsRestantes) {
            if (restante <= 0) break;
            const matchExact = ing.match.kind === 'exact' && row.catalogSlug === ing.match.catalogSlug;
            const matchCategory = ing.match.kind === 'category' && catalogBySlug.get(row.catalogSlug ?? '')?.category === ing.match.category;
            if (matchExact || matchCategory) {
              idsABorrar.push(row.id);
              restante -= 1;
            }
          }
          if (idsABorrar.length > 0) {
            await tx.almacenItem.deleteMany({ where: { id: { in: idsABorrar } } });
            almacenRowsRestantes = almacenRowsRestantes.filter((r) => !idsABorrar.includes(r.id));
          }
        }
        // Depositar el resultado — mismo shape que el depósito manual del jugador
        // (POST /saves/:id/almacen/depositar/:itemId, companeros.ts): 1 fila = 1 unidad, sin
        // campo de cantidad, `resultCantidad` filas repetidas.
        // CR-53 (Q2): un material solo entra hasta el tope del Almacén; lo demás se pierde.
        const esMat = !!resultado.resultCatalogSlug && slugsMateriales.has(resultado.resultCatalogSlug);
        const cabe = esMat ? Math.min(resultado.resultCantidad, huecoMateriales) : resultado.resultCantidad;
        if (esMat) huecoMateriales -= Math.max(0, cabe);
        if (resultado.resultCatalogSlug && cabe > 0) {
          await tx.almacenItem.createMany({
            data: Array.from({ length: cabe }, () => ({
              saveId,
              name: recipe.resultName,
              description: recipe.resultDescription,
              catalogSlug: recipe.resultCatalogSlug ?? null,
              statBonuses: recipe.statBonuses ?? undefined,
            })),
          });
        }
        // Cocina → KingdomStats.comida real (docs/rpgtarkor/sistemas-reino/
        // edificios-de-oficio.md § 7, 2026-09-28) — sustituye el nudge inventado
        // `COMIDA_POR_TRABAJADOR` (kingdomTick.ts) por producción REAL: cada unidad que sale de
        // una receta de cocinero suma 1 de comida al Reino, igual que cualquier otro objeto
        // depositado en Almacén pero sin ocupar una fila de AlmacenItem (la comida es un
        // contador agregado, no un objeto con InventoryRow propio). Mismo guard de existencia
        // de fila que `bumpKingdomStats` (más abajo en este archivo) — sin Reino fundado
        // todavía, no hay dónde sumar.
        if (recipe.oficio === 'cocinero-orcos-llanuras') {
          const kingdomStatsRow = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { ownerKey: true } });
          if (kingdomStatsRow) {
            // CR-61 (61d): cada plato suma lo que vale (`curaHambre`, 10 = 1 de comida); sin valor, 1.
            const plato = recipe.resultCatalogSlug ? await tx.itemCatalog.findFirst({ where: { worldId, slug: recipe.resultCatalogSlug }, select: { curaHambre: true } }) : null;
            const comidaPlato = plato?.curaHambre ? comidaDe(plato.curaHambre, resultado.resultCantidad) : resultado.resultCantidad;
            await tx.kingdomStats.update({ where: { ownerKey: ownerKeyFor({ saveId }) }, data: { comida: { increment: comidaPlato } } });
          }
        }
        const ordenOriginal = ordenesInput.find((o) => o.id === resultado.ordenId)!;
        const nuevaCantidadAcumulada = ordenOriginal.cantidadProducidaAcumulada + resultado.resultCantidad;
        // 'unico' que YA alcanza su límite con esta misma producción se desactiva en el acto
        // (no hace falta esperar al siguiente tick para que el motor puro devuelva
        // ORDEN_COMPLETADA — ese caso cubre la carrera de un tick futuro que la encuentra ya
        // completa, este cubre el propio tick que la completa).
        const seCompletaAhora = ordenOriginal.modo === 'unico' && ordenOriginal.limite != null && nuevaCantidadAcumulada >= ordenOriginal.limite;
        await tx.ordenProduccion.update({
          where: { id: resultado.ordenId },
          data: { cantidadProducidaAcumulada: { increment: resultado.resultCantidad }, ...(seCompletaAhora ? { activa: false } : {}) },
        });
        // XP de oficio del trabajador que produjo — mismo camino de código que el jugador
        // (awardProfessionXp, más abajo en este archivo), solo que aquí escribe en
        // ProfessionProgress.companionId en vez de saveId. `xpByCompanion` se actualiza en
        // memoria tras cada producción (aunque hoy un Companion no puede trabajar en dos
        // Buildings ni producir dos veces en el mismo tick, por diseño de `buildingId` único
        // + "una asignación por trabajador por tick" del motor puro) para no depender de esa
        // garantía implícita si el reparto cambia en el futuro.
        if (recipe.oficio) {
          const xpDelta = xpForCraftSuccess(recipe.tier);
          const xpAnterior = xpByCompanion.get(resultado.companionId)?.[recipe.oficio] ?? 0;
          const xpNueva = xpAnterior + xpDelta;
          await tx.professionProgress.upsert({
            where: { companionId_professionId: { companionId: resultado.companionId, professionId: recipe.oficio } },
            create: { companionId: resultado.companionId, professionId: recipe.oficio, nivel: professionLevelForXp(xpNueva), xp: xpNueva },
            update: { xp: { increment: xpDelta }, nivel: professionLevelForXp(xpNueva) },
          });
          const entry = xpByCompanion.get(resultado.companionId) ?? {};
          entry[recipe.oficio] = xpNueva;
          xpByCompanion.set(resultado.companionId, entry);
        }
      }
    }
  }
}

/** Servicio de la Casa de curas (edificios-de-oficio.md § 3/§ 7, 2026-09-28). */
export async function servicioCasaDeCuras(tx: Prisma.TransactionClient, saveId: string): Promise<void> {
  // Servicio de la Casa de curas (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md § 3/§ 7,
  // 2026-09-28) — hermano del bloque de OrdenProduccion de arriba, no depende de él: cura a
  // TODOS los Companion de Reino (`rolReino` no null) de ESTA partida, no solo a los que
  // trabajan en la propia Casa de curas (el documento dice "los compañeros heridos del reino
  // se recuperan", sin acotarlo a los asignados a ese Building concreto). Solo si hay alguna
  // Casa de curas (o su mejora) ACTIVA — cualquier nivel sirve, el servicio no escala con tier.
  const casaDeCurasActiva = await tx.building.findFirst({
    where: { saveId, status: 'ACTIVO', recipeKey: { in: ['casa-de-curas', 'casa-de-curas-obrador', 'casa-de-curas-gran-obrador'] } },
  });
  if (casaDeCurasActiva) {
    const companionsReino = await tx.companion.findMany({
      where: { saveId, rolReino: { not: null } },
      select: { id: true, rolReino: true, condicionFisica: true },
    });
    const curados = companionesQueCuraCasaDeCuras(companionsReino);
    for (const c of curados) {
      await tx.companion.update({ where: { id: c.id }, data: { condicionFisica: c.nuevaCondicion } });
    }
  }
}

/**
 * Punto de entrada: si entre `minutosAntes` y `minutosDespues` se cruza algún día de ficción,
 * ejecuta el tick de Reino, la producción de edificios y el servicio de la Casa de curas.
 */
export async function runDailyTick(
  tx: Prisma.TransactionClient,
  args: { saveId: string; worldId: string; minutosAntes: number; minutosDespues: number },
): Promise<DailyTickResult> {
  const { saveId, worldId, minutosAntes, minutosDespues } = args;
  const diasCruzados = daysCrossed(minutosAntes, minutosDespues);
  if (diasCruzados <= 0) return { territoryConsolidatedThisTurn: false };
  const result = await advanceKingdomStatsDay(tx, saveId, diasCruzados, minutosDespues);
  // La producción/consumo de facción (H-6/H-2) y el decaimiento de presión (H-4) NO corren aquí:
  // viven en `producirFacciones`/`decaerRelaciones` (factionEconomy.ts), desde `avanceDiario.ts`.
  // Hermanos (no anidados en KingdomStats): un Building puede existir sin fila KingdomStats.
  await tickProduccionReino(tx, saveId, worldId);
  await servicioCasaDeCuras(tx, saveId);
  // Libro de Sucesos (CR-3, hito 0.2): tormentas donde está el personaje y cambios de estación.
  const save = await tx.save.findUnique({ where: { id: saveId }, select: { raza: true, currentLocation: { select: { region: true } } } });
  for (const suceso of sucesosDeClima(minutosAntes, minutosDespues, save?.currentLocation?.region ?? null, save?.raza ?? null)) {
    await registrarSuceso(tx, { ...suceso, saveId, origen: 'MUNDO' });
  }
  return result;
}

/**
 * Punto común para avanzar el reloj de ficción de una partida (P216/P217): fija `fictionalMinutes` y la
 * etiqueta, y corre `runDailyTick` una vez por cada medianoche cruzada. Todo avance de reloj fuera del
 * turno de texto (avance de días del escenario, «Descansar en el campamento») pasa por aquí, para que el
 * Reino no se quede sin su tick. Si `minutosDespues <= minutosAntes` no hace nada.
 */
export async function avanzarRelojConTick(
  tx: Prisma.TransactionClient,
  args: { saveId: string; worldId: string; minutosAntes: number; minutosDespues: number },
): Promise<DailyTickResult> {
  const { saveId, minutosAntes, minutosDespues } = args;
  if (minutosDespues <= minutosAntes) return { territoryConsolidatedThisTurn: false };
  await tx.worldState.update({
    where: { saveId },
    data: { fictionalMinutes: minutosDespues, fictionalDateLabel: formatFictionalDate(minutosDespues) },
  });
  // Un tramo por medianoche: la producción del Reino y la Casa de curas corren una vez por día, igual
  // que el consumo (revisión previa al PR de P216).
  let territoryConsolidatedThisTurn = false;
  for (let desde = minutosAntes; desde < minutosDespues; ) {
    const hasta = Math.min(minutosDespues, (Math.floor(desde / 1440) + 1) * 1440);
    const r = await runDailyTick(tx, { ...args, minutosAntes: desde, minutosDespues: hasta });
    territoryConsolidatedThisTurn ||= r.territoryConsolidatedThisTurn;
    desde = hasta;
  }
  return { territoryConsolidatedThisTurn };
}
