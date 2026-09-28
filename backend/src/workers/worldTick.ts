import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { narrateAndPersistTurn, TransitCancelledError } from '../services/turnResolution.js';
import { computeDuration } from '../services/timedActions.js';
import { effectiveAttributes, effectiveSecondaryAttributes, effectiveDefense, equippedWeaponNames, equippedItemsSummary } from '../services/equipment.js';
import { parseActiveEffects } from '../services/activeEffects.js';
import { normalizeSecondaryAttributes } from '../services/secondaryAttributes.js';
import { characterSummaryFor } from '../services/characterSummary.js';
import { loadSessionFacts } from '../services/worldFacts.js';
import { claimTurnInFlight, releaseTurnInFlight } from '../services/turnLock.js';
import { growAllPopulations, syncFactionPopulationToKingdomStats } from '../services/population.js';
import { advanceWorldAgenda } from '../services/worldAgenda.js';
import { advanceCompanionSurvival, advancePlayerSurvival, advanceCorpseAndRecoveryTimeouts } from '../services/companionSupervivencia.js';
import type { ClassificationResult } from '../services/narrador.js';
import type { RollResult, AttributeBlock } from '../services/dice.js';
import type { TravelResolution } from '../services/travel.js';

interface TransitZoneContext {
  action: string;
  classification: ClassificationResult;
  roll?: RollResult;
  travel?: TravelResolution | null;
  /// Eventos de viaje interactivos (2026-08-05) — ver turn.ts/travelInterruption.ts. Presente si
  /// este `travel` (ya truncado al crear el tránsito) corresponde a un viaje interrumpido.
  travelInterruptionNpcId?: string | null;
  /// Nombre del destino que el jugador pidió de verdad, antes de truncar — solo para el aviso
  /// determinista de "tu viaje se interrumpió" (turnResolution.ts), nunca se lo pasa al Narrador.
  travelInterruptionOriginalDestinationName?: string | null;
  /// Building.status EN_CONSTRUCCION real (2026-08-23, Grupo 3 § Building.status, ver
  /// planDeterministicBuild en construction.ts) — id de la fila creada YA al iniciar una
  /// construcción determinista, para que `narrateAndPersistTurn` la complete (o la borre si la
  /// construcción falla al resolver) en vez de crear una fila nueva. null/ausente = esta acción
  /// larga no es una construcción determinista (viaje, descanso, crafteo con transit propio...).
  buildingId?: string | null;
  /// Marca de reclamo (auditoría 2026-08-06, bug real): antes, el único indicio de "esto ya se
  /// está narrando" era `busyUntil` empujado `CLAIM_BUFFER_MS` al futuro — el mismo campo que
  /// `POST /saves/:id/transit/cancel` usa para decidir "esto sigue esperando, se puede cancelar".
  /// Los dos casos son indistinguibles con solo `busyUntil`, así que cancelar podía borrar un
  /// tránsito que ya estaba narrándose de verdad — sin duplicar nada (el borrado dentro de
  /// `narrateAndPersistTurn` ya aborta limpio si la fila desaparece primero, ver
  /// `TransitCancelledError`), pero sí con una narración ya generada tirada a la basura y un
  /// LogEntry falso de "cambia de idea antes de empezar" para una acción que ya había arrancado.
  claimedAt?: string;
}

/// Worker local del reloj de mundo (decisiones técnicas 3 y 4 en docs/arquitectura/04-decisiones-tecnicas.md).
/// Se pausa solo con el proceso del backend — no hay "recuperación al arrancar" (decisión de
/// producto 4, revisada): el mundo retoma justo donde lo dejó la última vez que corrió.
///
/// `WorldState.agenda` (revisado 2026-07-18, auditoría de docs/archivo/11-roadmap-historico.md § 2.6; auditoría de
/// elementos desconectados 2026-08-23 confirmó que sigue sin ningún productor real — el panel "El
/// mundo", `services/entorno.ts`, cubre "que el mundo se sienta vivo" con algo más simple:
/// ambientación periódica + evento probabilístico 25%, sin relación con esta cola). Petición
/// explícita de la usuaria el mismo día ("me gusta, quiero construirlo de verdad"): SÍ hay valor
/// real aquí, más allá de lo que ya cubre `entorno.ts` — un mundo que avanza con hitos propios con
/// el tiempo (ej. escalada de la guerra Alianza/Concordia si nadie interviene), no solo
/// ambientación pasiva. Diseño e implementación todavía pendientes — el campo sigue vacío hasta
/// entonces, esta vez a propósito como cola en espera de su feature, no como dato abandonado.
/// Colchón de reclamo (roadmap 2026-07-20, bug real encontrado con la partida de verdad de
/// Gorhorn): sin esto, dos ejecuciones solapadas de `resolveDueTransits` (el siguiente tick del
/// worker disparándose mientras la narración del anterior seguía en marcha — nada raro en este
/// hardware, 30-220s+ reintentos, muy por encima de los 2 min entre ticks) cogían el MISMO
/// tránsito, lo narraban las dos, y la segunda `delete()` fallaba tras haber persistido XP/hechos
/// por duplicado. Reproducido de verdad al lanzar dos resoluciones manuales a la vez.
const CLAIM_BUFFER_MS = 10 * 60_000;

type DueTransit = Awaited<ReturnType<typeof fetchDueTransits>>[number];

async function fetchDueTransits() {
  // `save.pausedAt: null` (roadmap 2026-07-20, "quiero que la partida se pause si salgo de
  // ella"): mientras la jugadora no está en GameView, el tránsito puede seguir "vencido" sin
  // resolverse — `POST /saves/:id/resume` alarga `busyUntil` al volver, así que esto nunca
  // hace que se pierda tiempo de espera, solo lo congela mientras está fuera.
  return prisma.characterTransit.findMany({
    // `narrationClaimedAt: null` (2026-08-13, espera de viaje precalculada) — una fila que
    // `startEagerTransitResolution` ya está resolviendo por adelantado (turn.ts, viaje sin
    // evento) queda excluida de este barrido aunque `busyUntil` ya haya vencido: las dos vías
    // nunca deben narrar la misma fila dos veces. Se libera sola si esa resolución falla del
    // todo (el catch de abajo no la vuelve a poner a null a propósito — un tránsito eternamente
    // reclamado pero nunca resuelto ya lo cubre el mismo colchón que el resto de este archivo:
    // se reintenta desde cero solo si el proceso se reinicia, ver comentario de `agenda` arriba).
    where: { busyUntil: { lte: new Date() }, narrationClaimedAt: null, save: { pausedAt: null } },
    // `currentLocation` (auditoría 2026-07-24, checklist 2026-07-23 pendiente "contexto de
    // narración diferida más pobre que el turno en vivo"): hacía falta para poder construir el
    // mismo resumen de personaje rico (`characterSummaryFor`) que ya recibe el turno síncrono.
    include: { save: { include: { worldState: true, inventoryItems: { where: { slot: { not: null } } }, currentLocation: true } } },
  });
}

/// Cuerpo real de resolver UN tránsito — extraído (2026-08-13, espera de viaje precalculada) de
/// `resolveDueTransits` para que `startEagerTransitResolution` (turn.ts, viaje sin evento) pueda
/// reusarlo tal cual, con la única diferencia de CUÁNDO se llama y qué `notBefore` le pasa a
/// `narrateAndPersistTurn`. El caller ya reclamó la fila (`narrationClaimedAt`) antes de llamar.
async function resolveClaimedTransit(transit: DueTransit, notBefore?: Date): Promise<void> {
  // Candado de turno (auditoría de código completa, 2026-08-07, ver turnLock.ts) — este mismo
  // `saveId` puede tener un turno EN VIVO resolviéndose ahora mismo vía POST /turn/narrate
  // (turn.ts), que comparte este mismo candado. Sin esto, un tránsito diferido y una acción
  // manual del jugador podían llamar a `narrateAndPersistTurn` en paralelo para la misma
  // partida — la resolución exacta que este candado existe para evitar.
  if (!claimTurnInFlight(transit.save.id)) return;

  try {
    const { action, classification, roll, travel, travelInterruptionNpcId, travelInterruptionOriginalDestinationName, buildingId } =
      transit.zoneContext as unknown as TransitZoneContext;
    const save = transit.save;
    const sessionFacts = await loadSessionFacts(save.id);
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
    const attributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
    const secondaryAttributes = effectiveSecondaryAttributes(normalizeSecondaryAttributes(save.secondaryAttributes), save.inventoryItems);
    const defensa = effectiveDefense(save.inventoryItems);
    const equippedWeapons = equippedWeaponNames(save.inventoryItems);
    const equippedItems = equippedItemsSummary(save.inventoryItems);
    const duration = travel ? null : computeDuration(action, classification.banda, attributes, classification.duracionEstimadaMinutos);
    const minutosDeEsteTurno = travel ? travel.minutos : duration!.minutos;

    // Mismo resumen de personaje rico que el turno síncrono (auditoría 2026-07-24) — antes esto
    // era solo "{nombre}, {arquetipo}. {origen} {motivación}", sin ubicación/atributos/condición
    // física, así que un viaje/descanso largo real resuelto en diferido narraba a ciegas sobre
    // dónde está el personaje o cómo llegó — encontrado de rebote auditando otro bug el
    // 2026-07-23, quedó pendiente como "ya lo veremos" en el checklist de esa sesión.
    const characterSummary = characterSummaryFor(save, {
      timeLabel,
      locationName: save.currentLocation?.name ?? null,
      region: save.currentLocation?.region ?? null,
      level: save.level,
      attributes,
      condicionFisica: save.condicionFisica,
    });

    await narrateAndPersistTurn({
      saveId: save.id,
      worldId: save.worldId,
      action,
      characterSummary,
      characterName: save.characterName,
      clase: save.clase,
      especializacion: save.especializacion,
      timeLabel,
      sessionFacts,
      currentXp: save.xp,
      currentLevel: save.level,
      classification,
      roll,
      // Franja 3 de "Interactuar" (2026-09-08) — ver comentario completo en turnResolution.ts.
      zonaPosX: save.zonaPosX,
      zonaPosY: save.zonaPosY,
      attributes,
      secondaryAttributes,
      defensa,
      equippedWeapons,
      equippedItems,
      jugadorZonaPosEntradaX: save.zonaPosEntradaX,
      jugadorZonaPosEntradaY: save.zonaPosEntradaY,
      raza: save.raza,
      currentLocationId: save.currentLocationId,
      travel,
      minutosDeEsteTurno,
      fictionalMinutesActuales: save.worldState?.fictionalMinutes ?? 480,
      produccion: duration?.produccion,
      condicionFisica: save.condicionFisica,
      energia: save.energia,
      lastAteAtMinutes: save.lastAteAtMinutes,
      lastDrankAtMinutes: save.lastDrankAtMinutes,
      lastRestAtMinutes: save.lastRestAtMinutes,
      activeEffects: parseActiveEffects(save.activeEffects),
      dificultad: save.dificultad,
      deathCount: save.deathCount,
      lastRestLocationId: save.lastRestLocationId,
      // El borrado real del CharacterTransit ya ocurre DENTRO de narrateAndPersistTurn, en la
      // misma transacción que aplica XP/objetos/hechos — ver TransitCancelledError.
      transitIdToFinalize: transit.id,
      travelInterruptionNpcId,
      travelInterruptionOriginalDestinationName,
      earlyBuildingId: buildingId ?? undefined,
      notBefore,
    });
  } catch (err) {
    if (err instanceof TransitCancelledError) {
      // El jugador canceló mientras se narraba (POST /saves/:id/transit/cancel ya borró la
      // fila y registró su propio LogEntry) — nada que reintentar ni que loguear como error.
      return;
    }
    // Un tránsito que falla al resolver se reintenta en el siguiente tick — no se borra. Libera
    // el reclamo de narración para que `fetchDueTransits` vuelva a encontrarla (si venía de la
    // vía anticipada) — sin esto, un fallo en `startEagerTransitResolution` dejaría la fila
    // atascada para siempre, sin que el barrido periódico pudiera reintentarla nunca.
    await prisma.characterTransit.updateMany({ where: { id: transit.id }, data: { narrationClaimedAt: null } }).catch(() => {});
    console.error(`[worldTick] error resolviendo tránsito ${transit.id}:`, err);
  } finally {
    releaseTurnInFlight(transit.save.id);
  }
}

export async function resolveDueTransits(): Promise<void> {
  const due = await fetchDueTransits();

  for (const transit of due) {
    // Reclamo atómico (auditoría 2026-08-06, colchón contra dos ticks solapados, ver
    // `CLAIM_BUFFER_MS`) — solo sigue esta ejecución si de verdad consigue reclamar la fila; si
    // otra ejecución concurrente (u otro arranque anticipado) ya lo hizo primero, `count` es 0 y
    // se salta. `claimedAt` (dentro de `zoneContext`, distinto de la columna `narrationClaimedAt`)
    // viaja en el mismo `updateMany` atómico — así `POST /saves/:id/transit/cancel` puede negarse
    // a cancelar en cuanto vea la marca, sin depender solo de comparar `busyUntil` contra "ahora".
    const claimedZoneContext = { ...(transit.zoneContext as object), claimedAt: new Date().toISOString() };
    const claim = await prisma.characterTransit.updateMany({
      where: { id: transit.id, busyUntil: { lte: new Date() }, narrationClaimedAt: null },
      data: { busyUntil: new Date(Date.now() + CLAIM_BUFFER_MS), narrationClaimedAt: new Date(), zoneContext: claimedZoneContext },
    });
    if (claim.count === 0) continue;

    await resolveClaimedTransit(transit);
  }
}

/// Espera de viaje precalculada (2026-08-13, petición explícita de la usuaria: "el prompt se
/// lanza ya en medio de la espera... dejandolo calculado" — no esperar los minutos reales y LUEGO
/// llamar al modelo, solapar las dos cosas). `turn.ts` la llama SIN esperar (fire-and-forget) justo
/// al crear un `CharacterTransit` de viaje sin evento (`pickTravelInterruption` ya devolvió null,
/// así que no hay nada más que resolver más adelante) — el cómputo entero (incluida la llamada al
/// modelo) arranca YA, y `narrateAndPersistTurn` retiene el commit real hasta `notBefore`
/// (`busyUntil`, la misma cuenta atrás que ya ve el jugador) — así nunca se ve la llegada antes de
/// que termine la espera visual prometida, pero tampoco se apila la latencia del modelo DESPUÉS.
///
/// Reclamo por id, SIN condición de `busyUntil` (a diferencia de `resolveDueTransits`, que solo
/// reclama tránsitos ya vencidos) — esta fila se acaba de crear, `busyUntil` está en el futuro a
/// propósito. `claimedAt` (dentro de `zoneContext`, mismo criterio que `resolveDueTransits`) viaja
/// en el mismo reclamo — sin esto, `POST /saves/:id/transit/cancel` no vería que esta fila ya se
/// está resolviendo de verdad (esa ruta solo mira `zoneContext.claimedAt`, nunca la columna
/// `narrationClaimedAt`) y dejaría cancelar mientras esta función sigue en marcha; no sería un bug
/// de datos (`TransitCancelledError` ya lo cubre limpio, ver `resolveClaimedTransit`), pero sí
/// tiraría a la basura una narración ya generada — el mismo desperdicio que ese comentario describe.
export async function startEagerTransitResolution(transitId: string, notBefore: Date): Promise<void> {
  const found = await prisma.characterTransit.findUnique({
    where: { id: transitId },
    include: { save: { include: { worldState: true, inventoryItems: { where: { slot: { not: null } } }, currentLocation: true } } },
  });
  // Borrada entre la creación y esta lectura (cancelada al vuelo, carrera improbable con el
  // propio POST que la creó) — nada que resolver.
  if (!found) return;

  const claimedZoneContext = { ...(found.zoneContext as object), claimedAt: new Date().toISOString() };
  const claim = await prisma.characterTransit.updateMany({
    where: { id: transitId, narrationClaimedAt: null },
    data: { narrationClaimedAt: new Date(), zoneContext: claimedZoneContext },
  });
  if (claim.count === 0) return;

  await resolveClaimedTransit(found, notBefore);
}

async function tick(): Promise<void> {
  await resolveDueTransits();
  // Población dinámica (docs/mecanicas/16-poblacion-dinamica.md) — `WorldPopulation` es del World, no de
  // una Save concreta, así que crece en el mismo tick de fondo en vez de en el turno síncrono.
  await growAllPopulations(prisma).catch((err) => console.error('[worldTick] error creciendo población:', err));
  // Reproducción poblacional de facciones (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.6, 2026-09-21) —
  // refleja el crecimiento de arriba en el KingdomStats real de cada Faction, mismo tick de fondo
  // (nunca en el turno síncrono, mismo criterio que growAllPopulations).
  await syncFactionPopulationToKingdomStats(prisma).catch((err) => console.error('[worldTick] error sincronizando población de facción:', err));
  // Agenda de mundo (Grupo 3, 2026-08-24, ver worldAgenda.ts) — mismo criterio que arriba: hitos
  // que avanzan con el tiempo de ficción, no con el turno síncrono.
  await advanceWorldAgenda(prisma).catch((err) => console.error('[worldTick] error avanzando agenda de mundo:', err));
  // Compañeros y supervivencia (Grupo 3, 2026-08-25, ver companionSupervivencia.ts) — Comida/Agua
  // se derivan en vivo (no necesitan tick), pero el DESCUIDO de Felicidad y la Hambre/Sed del
  // propio personaje sí son mutaciones reales que hay que aplicar en algún punto — mismo criterio
  // de fondo que población/agenda, nunca en el turno síncrono.
  await advanceCompanionSurvival(prisma).catch((err) => console.error('[worldTick] error en supervivencia de compañeros:', err));
  await advancePlayerSurvival(prisma).catch((err) => console.error('[worldTick] error en Hambre/Sed del personaje:', err));
  // Recuperación de CONVALECIENTE / desaparición de cadáveres (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md
  // § 5-bis punto 11, 2026-09-21) — coexiste con applyCondicionTimeouts (turnResolution.ts, dentro
  // del turno síncrono): el mundo sigue aunque el jugador no actúe, mismo criterio que
  // población/agenda de arriba.
  await advanceCorpseAndRecoveryTimeouts(prisma).catch((err) => console.error('[worldTick] error en recuperación/desaparición de NPC:', err));
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startWorldTickWorker(): void {
  if (intervalHandle) return;
  const intervalMs = env.worldTickIntervalMinutes * 60_000;
  // Bug real (2026-07-19): `setInterval` no dispara nada hasta que pasa el primer intervalo
  // completo — cada reinicio del backend dejaba cualquier CharacterTransit ya vencido esperando
  // hasta 20 min más antes de que alguien lo revisara, aunque su `busyUntil` ya hubiera pasado.
  // Un tick inmediato al arrancar resuelve de golpe lo que ya estaba vencido de una sesión anterior.
  tick().catch((err) => console.error('[worldTick] error en el tick inicial:', err));
  intervalHandle = setInterval(() => {
    tick().catch((err) => console.error('[worldTick] error en el tick:', err));
  }, intervalMs);
  console.log(`[worldTick] worker iniciado, tick cada ${env.worldTickIntervalMinutes} min`);
}

export function stopWorldTickWorker(): void {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}
