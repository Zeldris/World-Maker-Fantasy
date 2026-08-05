import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { narrateAndPersistTurn, TransitCancelledError } from '../services/turnResolution.js';
import { computeDuration } from '../services/timedActions.js';
import { effectiveAttributes, effectiveSecondaryAttributes, effectiveDefense, equippedWeaponNames, equippedItemsSummary } from '../services/equipment.js';
import { normalizeSecondaryAttributes } from '../services/secondaryAttributes.js';
import { characterSummaryFor } from '../services/characterSummary.js';
import { loadSessionFacts } from '../services/worldFacts.js';
import { growAllPopulations } from '../services/population.js';
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
}

/// Worker local del reloj de mundo (decisiones técnicas 3 y 4 en docs/04-decisiones-tecnicas.md).
/// Se pausa solo con el proceso del backend — no hay "recuperación al arrancar" (decisión de
/// producto 4, revisada): el mundo retoma justo donde lo dejó la última vez que corrió.
///
/// `WorldState.agenda` (revisado 2026-07-18, auditoría de docs/11-roadmap.md § 2.6): el diseño
/// original (docs/01-analisis-producto.md, 03-arquitectura.md) preveía una agenda estructurada
/// de eventos de facciones/NPCs que el Cronista resolvería aquí al vencer. En la práctica, el
/// panel "El mundo" (`services/entorno.ts`) ya cubre esa necesidad con un mecanismo más simple
/// — ambientación periódica + evento probabilístico (25%) — sin que nada llegara a escribir
/// nunca en `agenda` (sigue creándose vacío en `POST /saves` y `/restart`). No se construye la
/// maquinaria de resolución de una cola que no tiene productor: si en el futuro se diseña
/// contenido real de agenda (ej. eventos de facciones en la guerra Alianza/Concordia), retomar
/// aquí; hasta entonces, el campo queda como reservado sin uso, igual que `PregeneratedCharacter`/
/// `SessionSummary`.
/// Colchón de reclamo (roadmap 2026-07-20, bug real encontrado con la partida de verdad de
/// Gorhorn): sin esto, dos ejecuciones solapadas de `resolveDueTransits` (el siguiente tick del
/// worker disparándose mientras la narración del anterior seguía en marcha — nada raro en este
/// hardware, 30-220s+ reintentos, muy por encima de los 2 min entre ticks) cogían el MISMO
/// tránsito, lo narraban las dos, y la segunda `delete()` fallaba tras haber persistido XP/hechos
/// por duplicado. Reproducido de verdad al lanzar dos resoluciones manuales a la vez.
const CLAIM_BUFFER_MS = 10 * 60_000;

export async function resolveDueTransits(): Promise<void> {
  const due = await prisma.characterTransit.findMany({
    // `save.pausedAt: null` (roadmap 2026-07-20, "quiero que la partida se pause si salgo de
    // ella"): mientras la jugadora no está en GameView, el tránsito puede seguir "vencido" sin
    // resolverse — `POST /saves/:id/resume` alarga `busyUntil` al volver, así que esto nunca
    // hace que se pierda tiempo de espera, solo lo congela mientras está fuera.
    where: { busyUntil: { lte: new Date() }, save: { pausedAt: null } },
    // `currentLocation` (auditoría 2026-07-24, checklist 2026-07-23 pendiente "contexto de
    // narración diferida más pobre que el turno en vivo"): hacía falta para poder construir el
    // mismo resumen de personaje rico (`characterSummaryFor`) que ya recibe el turno síncrono.
    include: { save: { include: { worldState: true, inventoryItems: { where: { slot: { not: null } } }, currentLocation: true } } },
  });

  for (const transit of due) {
    // Reclamo atómico: solo sigue esta ejecución si de verdad consigue mover `busyUntil` fuera de
    // la ventana "vencido" — si otra ejecución concurrente ya lo reclamó primero, `count` es 0 y
    // se salta. Si la narración falla más abajo, el tránsito vuelve a estar "vencido" pasado el
    // colchón, así que se reintenta solo, sin quedar huérfano.
    const claim = await prisma.characterTransit.updateMany({
      where: { id: transit.id, busyUntil: { lte: new Date() } },
      data: { busyUntil: new Date(Date.now() + CLAIM_BUFFER_MS) },
    });
    if (claim.count === 0) continue;

    try {
      const { action, classification, roll, travel, travelInterruptionNpcId, travelInterruptionOriginalDestinationName } =
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
        timeLabel,
        sessionFacts,
        currentXp: save.xp,
        currentLevel: save.level,
        classification,
        roll,
        attributes,
        secondaryAttributes,
        defensa,
        equippedWeapons,
        equippedItems,
        raza: save.raza,
        currentLocationId: save.currentLocationId,
        travel,
        minutosDeEsteTurno,
        fictionalMinutesActuales: save.worldState?.fictionalMinutes ?? 480,
        produccion: duration?.produccion,
        condicionFisica: save.condicionFisica,
        energia: save.energia,
        dificultad: save.dificultad,
        deathCount: save.deathCount,
        lastRestLocationId: save.lastRestLocationId,
        // El borrado real del CharacterTransit ya ocurre DENTRO de narrateAndPersistTurn, en la
        // misma transacción que aplica XP/objetos/hechos — ver TransitCancelledError.
        transitIdToFinalize: transit.id,
        travelInterruptionNpcId,
        travelInterruptionOriginalDestinationName,
      });
    } catch (err) {
      if (err instanceof TransitCancelledError) {
        // El jugador canceló mientras se narraba (POST /saves/:id/transit/cancel ya borró la
        // fila y registró su propio LogEntry) — nada que reintentar ni que loguear como error.
        continue;
      }
      // Un tránsito que falla al resolver se reintenta en el siguiente tick — no se borra.
      console.error(`[worldTick] error resolviendo tránsito ${transit.id}:`, err);
    }
  }
}

async function tick(): Promise<void> {
  await resolveDueTransits();
  // Población dinámica (docs/16-poblacion-dinamica.md) — `WorldPopulation` es del World, no de
  // una Save concreta, así que crece en el mismo tick de fondo en vez de en el turno síncrono.
  await growAllPopulations(prisma).catch((err) => console.error('[worldTick] error creciendo población:', err));
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
