import type { Npc, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AttributeBlock } from './dice.js';
import { scopeFor } from './npcScene.js';
import { posicionDeObjetivo, moverJugadorA, minutoDeReaparicion } from './zonaPosicion.js';
import { decrementPopulationOnDeath } from './population.js';
import { advanceFictionalMinutes, formatFictionalDate } from './worldClock.js';
import { loadSessionFacts, appendSessionFacts } from './worldFacts.js';
import { recordEntityDiscoveries } from './entityDiscovery.js';
import { iniciarCombatEncounter, resolverTurnosAutonomosHastaJugadora, type CombatienteInicial } from './combateMultipleOrquestacion.js';
import { MAX_COMBATIENTES_POR_BANDO } from './combateMultiple.js';
import { lockRowForUpdate } from '../routes/saves/shared.js';

/// Servicio de caza (Fase 2, 2026-09-28, `plan-mecanicas-por-zona-2026-09-28.md`) — extraído del
/// núcleo de `POST /saves/:id/cazar/confirmar` (`cazar.ts`, todo lo que corre TRAS elegir
/// `selected`) para poder reutilizarlo también desde `POST /saves/:id/zona/cazar` (cazar el grupo
/// EXACTO con el que se ha colisionado en el mapa) y desde `abrirCombateForzadoDesdeInteractuar`
/// (dynamicMode.ts, un agresivo en grupo). Mismas reglas EXACTAS que ya tenía `cazar/confirmar` —
/// nada de esto es un rediseño, solo un traslado de sitio; `cazar.ts` pasa a llamar a este servicio
/// sin cambiar su comportamiento observable (sus tests existentes siguen en verde).
///
/// Cada elemento de `targets` es UNA especie seleccionada — `cazar/confirmar` puede pedir varias a
/// la vez (combate combinado contra todas), mientras que `zona/cazar`/el agresivo en grupo siempre
/// llaman con un único elemento (el grupo exacto con el que se ha colisionado). El caller siempre
/// resuelve los `Npc` de catálogo completos ANTES de llamar (mismo criterio de separación que el
/// resto del proyecto: el servicio no decide candidatos, solo ejecuta la caza ya decidida).
export interface CazaTarget {
  npc: Npc;
  /// Cuántos individuos hay REALMENTE ahora mismo — `avistadosFor(capturablePct, poblacion)` para
  /// el camino viejo (sin `ZonePoint` concreto), o `ZonePoint.cantidad` para el camino nuevo (el
  /// punto exacto con el que se ha colisionado, nunca por sorteo).
  cantidadObjetivo: number;
  /// `ZonePoint` del que sale este objetivo (Fase 2) — presente cuando la caza viene de colisionar
  /// con un grupo real en el mapa (`zona/cazar`, agresivo en grupo). Al iniciar la caza, el punto
  /// pierde los individuos enfrentados (ver `descontarZonePointCaza` más abajo); ausente para el
  /// camino viejo de `cazar/confirmar` (población regional, sin `ZonePoint` concreto).
  zonePointId?: string;
  /// Cuántos quiere enfrentar el jugador de esta especie (`cantidades[slug]` del body de
  /// `cazar/confirmar`) — `undefined` = enfrentar el grupo completo (`cantidadObjetivo`), mismo
  /// fallback que el código original.
  cantidadElegida?: number;
}

export interface SaveParaCaza {
  id: string;
  worldId: string;
  characterName: string;
  level: number;
  attributes: AttributeBlock;
  currentLocationId: string | null;
  region: string | null;
  fictionalMinutes: number;
}

export type IniciarCazaResultado =
  | {
      resuelveSinCombate: true;
      exito: true;
      combate: { npcs: [{ slug: string; name: string; condicionFisica: 'MUERTO'; saqueado: false; lootedItemNames: [] }] };
      logEntry: { id: string; text: string; timeLabel: string; createdAt: string };
    }
  | { resuelveSinCombate: false; exito: false | null; actionText: string }
  | { error: string; status: number };

/// Umbral de "presa débil" — mismo criterio que la banda "Fácil" de `difficultyHintFor`
/// (npcScene.ts), ver comentario completo de cabecera original en `cazar.ts`.
const NIVEL_DIFERENCIA_PRESA_DEBIL = 2;
const CHANCE_CAZA_LIMPIA_TOPE = 90;
const CAZA_LIMPIA_MINUTOS = 10;
const DISPERSION_COOLDOWN_MINUTES = 4 * 60;

function esDebil(npc: Npc, playerLevel: number): boolean {
  return npc.level <= playerLevel - NIVEL_DIFERENCIA_PRESA_DEBIL;
}

/// Puro — mismo criterio que `npcRecoversFromConvaleciente` (death.ts): `null` = nunca se dispersó,
/// nunca bloquea. Reexportado desde `cazar.ts` para no romper importadores existentes.
export function dispersionCooldownActivo(sinceMinutes: number | null, nowMinutes: number): boolean {
  if (sinceMinutes === null) return false;
  return nowMinutes - sinceMinutes < DISPERSION_COOLDOWN_MINUTES;
}

/// Tirada simple 1d6 — 1-2 uno menos, 3-4 exactamente lo elegido, 5-6 uno más. Ver comentario
/// completo original en `cazar.ts` (petición explícita de la usuaria, 2026-08-13/2026-09-02).
export function rollGroupEngagement(cantidadElegida: number, avistados: number, random: () => number = Math.random): number {
  const roll = Math.floor(random() * 6) + 1;
  const delta = roll <= 2 ? -1 : roll >= 5 ? 1 : 0;
  return Math.max(0, Math.min(avistados, cantidadElegida + delta));
}

/// Cláusula determinista para el texto de acción cuando lo que se compromete al combate difiere de
/// lo elegido — ver comentario completo original en `cazar.ts`.
export function groupVarianceClause(cantidadElegida: number, cantidadReal: number): string | null {
  if (cantidadReal === cantidadElegida) return null;
  if (cantidadReal === 0) return 'aunque al final el grupo entero se dispersa antes de que pueda acorralar a ninguno';
  if (cantidadReal > cantidadElegida) {
    const extra = cantidadReal - cantidadElegida;
    return extra === 1
      ? 'aunque al acercarme, otro más se suma de repente, sin previo aviso'
      : `aunque al acercarme, ${extra} más se suman de repente, sin previo aviso`;
  }
  return cantidadReal === 1
    ? 'aunque al final solo consigo acorralar a uno de los que había marcado'
    : `aunque al final solo consigo acorralar a ${cantidadReal} de los que había marcado`;
}

/// Grupos de fauna reales (Fase 2, 2026-09-28) — el `ZonePoint` del que sale un objetivo pierde
/// exactamente los individuos ENFRENTADOS (nunca los avistados/elegidos: si el grupo se dispersa
/// sin comprometerse, `enfrentados` puede ser 0 y el punto no pierde nada). Si llega a 0: la fila
/// ancla (`label` no nulo, la curada de catálogo) nunca se borra, se deja `activo:false`; cualquier
/// otra fila de grupo se borra del todo (mismo criterio que `reconciliarGrupos`, zonePoints.ts).
async function descontarZonePointCaza(tx: Prisma.TransactionClient, zonePointId: string, enfrentados: number): Promise<void> {
  if (enfrentados <= 0) return;
  const punto = await tx.zonePoint.findUnique({ where: { id: zonePointId } });
  if (!punto) return; // ya no existe (carrera rara) — nada que descontar.
  const nuevaCantidad = Math.max(0, punto.cantidad - enfrentados);
  if (nuevaCantidad === 0) {
    if (punto.label != null) {
      await tx.zonePoint.update({ where: { id: zonePointId }, data: { cantidad: 0, activo: false } });
    } else {
      await tx.zonePoint.delete({ where: { id: zonePointId } });
    }
  } else {
    await tx.zonePoint.update({ where: { id: zonePointId }, data: { cantidad: nuevaCantidad } });
  }
}

/// Caza limpia sin combate — SOLO cuando el jugador seleccionó una única especie y esa presa es
/// débil de verdad (mismo criterio EXACTO que el código original: nunca mira `cantidadObjetivo`,
/// mata siempre a UN único individuo, aunque el grupo real tenga más). `zonePointId` (si lo hay)
/// pierde exactamente ese individuo.
async function intentarCazaLimpia(save: SaveParaCaza, target: CazaTarget): Promise<IniciarCazaResultado> {
  const { npc, zonePointId } = target;
  const chance = Math.min(CHANCE_CAZA_LIMPIA_TOPE, npc.capturablePct + save.attributes.destreza);
  const exito = Math.random() * 100 < chance;

  if (!exito) {
    return {
      resuelveSinCombate: false,
      exito: false,
      // B21 (pruebas 2026-09-28): "…pero fallo" seguido de la tirada de APERTURA del combate (que
      // puede salir en éxito) se leía como una contradicción. El sigilo se pierde porque la presa
      // detecta al jugador; la tirada que viene después es la del ataque, no la de la caza.
      actionText: `Me acerco a '${npc.name}' con sigilo, pero me detecta antes de tiempo — no queda más remedio que atacarla de frente.`,
    };
  }

  const currentLocationId = save.currentLocationId;
  const scope = scopeFor(npc.kind, currentLocationId);
  const text = `${save.characterName} caza limpiamente a ${npc.name}, sin darle ninguna opción de reaccionar.`;
  const nuevoFictionalMinutes = advanceFictionalMinutes(save.fictionalMinutes, CAZA_LIMPIA_MINUTOS);
  const timeLabel = formatFictionalDate(nuevoFictionalMinutes);

  // Condición de carrera real (auditoría 2026-09-01, ver comentario original completo en
  // `cazar.ts`) — `SELECT ... FOR UPDATE` sobre `Save` + relectura de `pendingCombatNpcSlugs`
  // dentro de la transacción antes de escribir nada.
  const logEntry = await prisma.$transaction(async (tx) => {
    const freshSave = await lockRowForUpdate<{ pendingCombatNpcSlugs: string[] }>(tx, 'Save', save.id, ['pendingCombatNpcSlugs']);
    if (freshSave.pendingCombatNpcSlugs.includes(npc.slug)) return null;

    await tx.npcState.upsert({
      where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } },
      create: {
        saveId: save.id,
        npcId: npc.id,
        scope,
        condicionFisica: 'MUERTO',
        condicionFisicaSinceMinutes: nuevoFictionalMinutes,
        zonaAusenteHastaMinutes: minutoDeReaparicion(nuevoFictionalMinutes),
        zonaLocationId: currentLocationId,
      },
      update: {
        condicionFisica: 'MUERTO',
        condicionFisicaSinceMinutes: nuevoFictionalMinutes,
        zonaAusenteHastaMinutes: minutoDeReaparicion(nuevoFictionalMinutes),
        zonaLocationId: currentLocationId,
      },
    });
    if (currentLocationId) {
      const zonaObjetivo = await posicionDeObjetivo(tx, currentLocationId, npc.slug);
      if (zonaObjetivo) await moverJugadorA(tx, save.id, zonaObjetivo.x, zonaObjetivo.y);
    }
    await decrementPopulationOnDeath(tx, save.worldId, null, npc.slug, save.region);
    await tx.worldState.update({ where: { saveId: save.id }, data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: timeLabel } });
    const created = await tx.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes: nuevoFictionalMinutes, isPlayerAction: false, isSystemMessage: true } });
    await tx.save.update({ where: { id: save.id }, data: { pendingCombatNpcSlugs: [npc.slug] } });
    // Grupos de fauna reales (Fase 2) — la caza limpia siempre enfrenta a UN único individuo
    // (nunca al grupo entero, ver comentario de cabecera de esta función); el punto del que salió
    // pierde exactamente ese individuo.
    if (zonePointId) await descontarZonePointCaza(tx, zonePointId, 1);
    return created;
  });

  if (!logEntry) {
    return { error: 'Ya se está resolviendo una caza contra esta presa — espera un momento.', status: 409 };
  }

  // Bug real (reconfirmado 2026-09-08, ver comentario original completo en `cazar.ts`) — se limpia
  // aquí, ya fuera de la transacción (la ventana de carrera de arriba ya cerró en cuanto esa
  // transacción hizo commit).
  await prisma.save.update({ where: { id: save.id }, data: { pendingCombatNpcSlugs: [] } });

  const sessionFacts = await loadSessionFacts(save.id);
  await appendSessionFacts(save.id, sessionFacts, [text]);
  await recordEntityDiscoveries({ saveId: save.id, worldId: save.worldId, mentionedText: text, npcSlugsInScene: [npc.slug] });

  return {
    resuelveSinCombate: true,
    exito: true,
    combate: { npcs: [{ slug: npc.slug, name: npc.name, condicionFisica: 'MUERTO' as const, saqueado: false, lootedItemNames: [] }] },
    logEntry: { id: logEntry.id, text, timeLabel, createdAt: logEntry.createdAt.toISOString() },
  };
}

/// Caza en grupo/combate — cualquier caso que no sea la caza limpia de arriba: varias especies
/// seleccionadas, o una sola pero no lo bastante débil. Solo se crea un `CombatEncounter` real si
/// AL MENOS una especie objetivo tiene más de un individuo real (`hayGrupoReal`); si no, el combate
/// lo abre el turno normal de texto libre como siempre (1v1 clásico, `pendingCombatNpcSlugs`), sin
/// tocar la base de datos aquí — mismas reglas EXACTAS que el bloque original de `cazar.ts`.
async function intentarCazaEnGrupo(save: SaveParaCaza, targets: CazaTarget[]): Promise<IniciarCazaResultado> {
  const currentLocationId = save.currentLocationId;
  const varianceClauses: string[] = [];
  const hayGrupoReal = targets.some((t) => t.cantidadObjetivo > 1);
  const especiesDispersadas: string[] = [];

  if (hayGrupoReal) {
    const jugadorAttrs = save.attributes;
    const combatientes: (CombatienteInicial & { destreza: number; inteligencia: number })[] = [
      { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: jugadorAttrs.destreza, inteligencia: jugadorAttrs.inteligencia },
      ...(
        await prisma.companion.findMany({
          where: { saveId: save.id, combatGroupSlotIndex: 0, condicionFisica: { not: 'MUERTO' } },
          select: { id: true, attributes: true },
        })
      )
        .filter((c) => c.attributes)
        .map((c) => {
          const attrs = c.attributes as AttributeBlock;
          return { bando: 'JUGADOR' as const, tipo: 'COMPANION' as const, companionId: c.id, destreza: attrs.destreza, inteligencia: attrs.inteligencia };
        }),
    ];
    // Grupos de fauna reales (Fase 2) — cuántos individuos ENFRENTADOS de verdad descuenta cada
    // `ZonePoint` (0 si el grupo entero se dispersa sin comprometerse) — se aplica dentro de la
    // MISMA transacción que crea el combate, junto al cooldown de dispersión.
    const enfrentadosPorZonePoint = new Map<string, number>();

    for (const target of targets) {
      const { npc, zonePointId } = target;
      const npcAttrs = npc.attributes as AttributeBlock;
      const scope = scopeFor(npc.kind, currentLocationId);
      if (target.cantidadObjetivo > 1) {
        const cantidadElegida = Math.max(1, Math.min(target.cantidadObjetivo, Math.round(target.cantidadElegida ?? target.cantidadObjetivo)));
        let cantidadReal = rollGroupEngagement(cantidadElegida, target.cantidadObjetivo);
        // Un grupo AGRESIVO no se dispersa por las buenas — ver comentario completo original en
        // `cazar.ts` (matiz explícito de la usuaria, 2026-09-02).
        if (cantidadReal === 0 && npc.temperamento === 'AGRESIVO' && save.level <= (npc.levelMax ?? npc.level)) {
          cantidadReal = 1;
        }
        if (cantidadReal === 0) especiesDispersadas.push(npc.slug);
        for (let i = 0; i < cantidadReal; i++) {
          combatientes.push({ bando: 'ENEMIGO', tipo: 'NPC', npcId: npc.id, npcScope: scope, destreza: npcAttrs.destreza, inteligencia: npcAttrs.inteligencia, esGrupo: true });
        }
        if (zonePointId) enfrentadosPorZonePoint.set(zonePointId, (enfrentadosPorZonePoint.get(zonePointId) ?? 0) + cantidadReal);
        const clause = groupVarianceClause(cantidadElegida, cantidadReal);
        if (clause) varianceClauses.push(`Con '${npc.name}', ${clause}.`);
      } else {
        combatientes.push({ bando: 'ENEMIGO', tipo: 'NPC', npcId: npc.id, npcScope: scope, destreza: npcAttrs.destreza, inteligencia: npcAttrs.inteligencia });
        if (zonePointId) enfrentadosPorZonePoint.set(zonePointId, (enfrentadosPorZonePoint.get(zonePointId) ?? 0) + 1);
      }
    }

    // Sub-partición >4v4 — ver comentario completo original en `cazar.ts` (docs/rpgtarkor/combate-
    // multiple.md § 3, checklist 2026-09-01).
    const bandoJugadorCompleto = combatientes.filter((c) => c.bando === 'JUGADOR').slice(0, MAX_COMBATIENTES_POR_BANDO);
    const enemigos = combatientes.filter((c) => c.bando === 'ENEMIGO');
    const fragmentosEnemigos: typeof enemigos[] = [];
    for (let i = 0; i < enemigos.length; i += MAX_COMBATIENTES_POR_BANDO) {
      fragmentosEnemigos.push(enemigos.slice(i, i + MAX_COMBATIENTES_POR_BANDO));
    }
    const fragmentosParaCrear = fragmentosEnemigos.length > 0 ? fragmentosEnemigos : [[]];

    // Condición de carrera real (auditoría 2026-08-25) — ver comentario completo original.
    const resultado = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      const activeEncounterFresco = await tx.combatEncounter.findFirst({ where: { saveId: save.id, estado: 'EN_CURSO', jugable: true } });
      if (activeEncounterFresco) return null;
      await iniciarCombatEncounter(tx, save.id, [...bandoJugadorCompleto, ...fragmentosParaCrear[0]]);
      const autonomosIds: string[] = [];
      for (const fragmento of fragmentosParaCrear.slice(1)) {
        const { encounterId } = await iniciarCombatEncounter(tx, save.id, fragmento, false);
        autonomosIds.push(encounterId);
      }
      if (currentLocationId) {
        for (const slug of especiesDispersadas) {
          await tx.worldPopulation.update({
            where: { worldId_targetType_targetSlug: { worldId: save.worldId, targetType: 'FAUNA', targetSlug: slug } },
            data: { dispersadoEnLocationId: currentLocationId, dispersadoDesdeMinutes: save.fictionalMinutes },
          });
        }
      }
      // Grupos de fauna reales (Fase 2) — el/los `ZonePoint` de origen pierden los individuos
      // realmente enfrentados, en la misma transacción que crea el combate.
      for (const [zonePointId, enfrentados] of enfrentadosPorZonePoint) {
        await descontarZonePointCaza(tx, zonePointId, enfrentados);
      }
      return { autonomosIds };
    });
    if (!resultado) {
      return { error: 'Ya hay un combate en curso — resuélvelo antes de salir a cazar.', status: 400 };
    }

    // Resolución determinista de los sub-combates sin la jugadora presente — ver comentario
    // completo original en `cazar.ts` (2026-09-01).
    let caidosAutonomos = 0;
    for (const encounterId of resultado.autonomosIds) {
      const { caidos } = await resolverTurnosAutonomosHastaJugadora({ prisma, worldId: save.worldId, saveId: save.id, encounterId, weaponNamesPorDefecto: [], narrarFn: async () => '' });
      caidosAutonomos += caidos.length;
    }
    if (caidosAutonomos > 0) {
      varianceClauses.push(`El resto de la manada, fuera del alcance directo de ${save.characterName}, se enfrenta entre sí y con el terreno — ${caidosAutonomos} caen sin que ${save.characterName} llegue a verlo.`);
    }
  } else {
    // 1v1 clásico: el combate lo abre el turno de texto libre, pero el individuo enfrentado ya no
    // está en su punto del mapa — mismo descuento que el camino de grupo (si no, tras matarlo el
    // pin seguiría ahí con la misma cantidad).
    const conPunto = targets.filter((t) => t.zonePointId);
    if (conPunto.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const t of conPunto) await descontarZonePointCaza(tx, t.zonePointId!, 1);
      });
    }
  }

  const names = targets.map((t) => t.npc.name);
  const actionText = [`Salgo a cazar y ataco a ${names.map((n) => `'${n}'`).join(', ')}.`, ...varianceClauses].join(' ');
  return { resuelveSinCombate: false, exito: null, actionText };
}

/// Punto de entrada único del servicio — decide entre caza limpia y caza en grupo/combate, mismas
/// reglas EXACTAS que tenía `cazar/confirmar` antes de este traslado (ver comentario de cabecera
/// del módulo). `permitirCazaLimpia: false` (agresivo en grupo, `dynamicMode.ts`) fuerza siempre el
/// camino de combate — "un agresivo que te corta el paso nunca se resuelve sigiloso".
export async function iniciarCaza(params: { save: SaveParaCaza; targets: CazaTarget[]; permitirCazaLimpia?: boolean }): Promise<IniciarCazaResultado> {
  const { save, targets } = params;
  const permitirCazaLimpia = params.permitirCazaLimpia ?? true;

  if (permitirCazaLimpia && targets.length === 1 && esDebil(targets[0].npc, save.level)) {
    return intentarCazaLimpia(save, targets[0]);
  }
  return intentarCazaEnGrupo(save, targets);
}
