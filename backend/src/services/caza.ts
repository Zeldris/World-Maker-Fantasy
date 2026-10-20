import type { Npc, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AttributeBlock } from './dice.js';
import { scopeFor } from './npcScene.js';
import { posicionDeObjetivo, moverJugadorA, minutoDeReaparicion, celdaAdyacenteOMisma, celdaDePixel } from './zonaPosicion.js';
import { decrementPopulationOnDeath } from './population.js';
import { advanceFictionalMinutes, formatFictionalDate } from './worldClock.js';
import { loadSessionFacts, appendSessionFacts } from './worldFacts.js';
import { recordEntityDiscoveries } from './entityDiscovery.js';
import { iniciarCombatEncounter, resolverTurnosAutonomosHastaJugadora, type CombatienteInicial, type IniciativaParticipanteInfo } from './combateMultipleOrquestacion.js';
import { MAX_COMBATIENTES_POR_BANDO } from './combateMultiple.js';
import { MAX_RONDAS_SUBCOMBATE } from './combateDeFondo.js';
import { lockRowForUpdate } from '../routes/saves/shared.js';
import { ambitoPoblacion } from './mundoPartida.js';
import { companeroDispuestoACombatir } from './cronista/aprobacion.js';
import { nombreDeEncuentro, pluralDeEspecie } from './dynamicMode.js';
import { sinComillasSueltas } from './accionCitada.js';
import { aprovecharseDeLoAjeno } from './cronista/testigos.js';
import { guardarSlugsDeCombate } from './combateDesde.js';

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

/// Fase 10 (2026-09-29, "todas las tiradas visibles") — la caza sigilosa (`intentarCazaLimpia`) era
/// `Math.random() * 100 < chance` sin ningún dato visible. Ahora se expone como un d100 contra la
/// probabilidad real (`chance`, sin cambiarla): `roll` = `floor(r)+1` con `r` el mismo número
/// aleatorio de siempre, así que `roll <= chance` coincide con `r < chance` (chance entera).
export interface TiradaCazaLimpia {
  kind: 'caza-sigilo';
  /// Probabilidad real de éxito, en % (tope 90).
  chance: number;
  /// d100, 1-100. Éxito si `roll <= chance`.
  roll: number;
  exito: boolean;
  npcName: string;
}

/// Tirada de "cuántos del grupo entran al combate" (`rollGroupEngagement`) por especie.
export interface TiradaGrupoInfo {
  slug: string;
  name: string;
  /// d6 real (1-6): 1-2 = uno menos, 3-4 = lo elegido, 5-6 = uno más.
  roll: number;
  delta: -1 | 0 | 1;
  cantidadElegida: number;
  /// Individuos reales del grupo (tope).
  avistados: number;
  /// Resultado de la tirada tras topar por 0..avistados.
  cantidadTirada: number;
  /// Lo que entra de verdad al combate (un AGRESIVO nunca se dispersa del todo: 0 pasa a 1).
  cantidadReal: number;
}

/// Forma persistida en `LogEntry.roll` cuando arranca un combate múltiple.
export interface CombateGrupoLogRoll {
  kind: 'combate-grupo';
  engagement: TiradaGrupoInfo[];
  iniciativa: IniciativaParticipanteInfo[];
}

export type IniciarCazaResultado =
  | {
      resuelveSinCombate: true;
      exito: true;
      combate: { npcs: [{ slug: string; name: string; condicionFisica: 'MUERTO'; saqueado: false; lootedItemNames: [] }] };
      logEntry: { id: string; text: string; timeLabel: string; createdAt: string; roll: TiradaCazaLimpia };
      cazaLimpia: TiradaCazaLimpia;
    }
  | {
      resuelveSinCombate: false;
      exito: false | null;
      actionText: string;
      /// P90/P130: lo que sale en el diario como acción de la jugadora (`accionEnDiarioDeCaza`);
      /// `null` en una emboscada. Ausente = `actionText` tal cual.
      accionEnDiario?: string | null;
      /// Solo cuando la caza sigilosa se intentó y falló.
      cazaLimpia?: TiradaCazaLimpia;
      /// Solo en combate múltiple: una tirada por especie con grupo real.
      tiradasGrupo?: TiradaGrupoInfo[];
      /// Solo en combate múltiple: LogEntry de sistema con las tiradas (engagement + iniciativa).
      /// F9-4: también en la caza sigilosa fallida (LogEntry de sistema con el d100, `roll.kind` = 'caza-sigilo').
      logEntry?: { id: string; text: string; timeLabel: string; createdAt: string; roll: CombateGrupoLogRoll | TiradaCazaLimpia };
    }
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
export function rollGroupEngagementDetail(cantidadElegida: number, avistados: number, random: () => number = Math.random): { roll: number; delta: -1 | 0 | 1; cantidadTirada: number } {
  const roll = Math.floor(random() * 6) + 1;
  const delta = roll <= 2 ? -1 : roll >= 5 ? 1 : 0;
  return { roll, delta, cantidadTirada: Math.max(0, Math.min(avistados, cantidadElegida + delta)) };
}

export function rollGroupEngagement(cantidadElegida: number, avistados: number, random: () => number = Math.random): number {
  return rollGroupEngagementDetail(cantidadElegida, avistados, random).cantidadTirada;
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

/// P191 (QA-27): la misma variación para el diario, en tercera persona y con frase entera («Gorhorn solo
/// consigue acorralar a 5 de los 6 Múrgoles que había marcado.»); la de arriba, en primera, va al narrador.
export function groupVarianceDiario(personaje: string, especie: string, cantidadElegida: number, cantidadReal: number, femenina = false): string | null {
  if (cantidadReal === cantidadElegida) return null;
  const plural = pluralDeEspecie(especie);
  if (cantidadReal === 0) return `El grupo de ${plural} se dispersa antes de que ${personaje} pueda acorralar a ${femenina ? 'ninguna' : 'ninguno'}.`;
  if (cantidadReal > cantidadElegida) {
    const extra = cantidadReal - cantidadElegida;
    return extra === 1 ? `Al acercarse ${personaje}, se suma ${femenina ? 'otra' : 'otro'} ${especie} sin previo aviso.` : `Al acercarse ${personaje}, se suman ${extra} ${plural} más sin previo aviso.`;
  }
  return `${personaje} solo consigue acorralar a ${cantidadReal === 1 ? (femenina ? 'una' : 'uno') : cantidadReal} de ${femenina ? 'las' : 'los'} ${cantidadElegida} ${plural} que había marcado.`;
}

/// Grupos de fauna reales (Fase 2, 2026-09-28) — el `ZonePoint` del que sale un objetivo pierde
/// exactamente los individuos ENFRENTADOS (nunca los avistados/elegidos: si el grupo se dispersa
/// sin comprometerse, `enfrentados` puede ser 0 y el punto no pierde nada). Si llega a 0: la fila
/// ancla (`label` no nulo, la curada de catálogo) nunca se borra, se deja `activo:false`; cualquier
/// otra fila de grupo se borra del todo (mismo criterio que `reconciliarGrupos`, zonePoints.ts).
export async function descontarZonePointCaza(tx: Prisma.TransactionClient, saveId: string, zonePointId: string, enfrentados: number): Promise<void> {
  if (enfrentados <= 0) return;
  const punto = await tx.zonePoint.findUnique({ where: { id: zonePointId } });
  if (!punto || punto.saveId !== saveId) return; // ya no existe (o es de otra partida) (carrera rara) — nada que descontar.
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

/// P187 (QA-27, decidido por la usuaria 2026-10-15): cazar un animal de un bando (`ZonePoint.factionSlug`)
/// se puede, pero si alguien de ese bando lo ve, resta mucha reputación con él. Solo cuando la jugadora
/// sale a cazar (no en una emboscada, ni en las cacerías de NPC o viajeros). La frase para el diario, o null.
async function cazaDeLoAjeno(tx: Prisma.TransactionClient, saveId: string, worldId: string, zonePointIds: string[], que: 'cazar' | 'atacar' = 'cazar'): Promise<string | null> {
  if (zonePointIds.length === 0) return null;
  const punto = await tx.zonePoint.findFirst({ where: { id: { in: zonePointIds }, saveId, factionSlug: { not: null } }, select: { factionSlug: true, locationId: true } });
  if (!punto) return null;
  return (await aprovecharseDeLoAjeno(tx, { saveId, worldId, locationId: punto.locationId, faccion: punto.factionSlug, que }))?.frase ?? null;
}

/// Caza limpia sin combate — SOLO cuando el jugador seleccionó una única especie y esa presa es
/// débil de verdad (mismo criterio EXACTO que el código original: nunca mira `cantidadObjetivo`,
/// mata siempre a UN único individuo, aunque el grupo real tenga más). `zonePointId` (si lo hay)
/// pierde exactamente ese individuo.
async function intentarCazaLimpia(save: SaveParaCaza, target: CazaTarget): Promise<IniciarCazaResultado> {
  const { npc, zonePointId } = target;
  const chance = Math.min(CHANCE_CAZA_LIMPIA_TOPE, npc.capturablePct + save.attributes.destreza);
  const r = Math.random() * 100;
  const exito = r < chance;
  const cazaLimpia: TiradaCazaLimpia = { kind: 'caza-sigilo', chance, roll: Math.min(100, Math.floor(r) + 1), exito, npcName: npc.name };

  if (!exito) {
    // F9-4 (2026-09-29): el fallo antes no dejaba LogEntry y su dado solo se veía en vivo. Ahora se
    // persiste como entrada de sistema con la tirada (sobrevive a una recarga).
    const textoFallo = `${npc.name} detecta el intento de caza sigilosa.`;
    const timeLabelFallo = formatFictionalDate(save.fictionalMinutes);
    const creada = await prisma.logEntry.create({
      data: { saveId: save.id, channel: 'CHARACTER', text: textoFallo, timeLabel: timeLabelFallo, fictionalMinutes: save.fictionalMinutes, isPlayerAction: false, isSystemMessage: true, roll: cazaLimpia as unknown as Prisma.InputJsonValue },
    });
    return {
      resuelveSinCombate: false,
      exito: false,
      cazaLimpia,
      logEntry: { id: creada.id, text: textoFallo, timeLabel: timeLabelFallo, createdAt: creada.createdAt.toISOString(), roll: cazaLimpia },
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
  let fraseAjena: string | null = null;
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
      const zonaObjetivo = await posicionDeObjetivo(tx, save.id, currentLocationId, npc.slug);
      if (zonaObjetivo) await moverJugadorA(tx, save.id, zonaObjetivo.x, zonaObjetivo.y);
    }
    await decrementPopulationOnDeath(tx, save.id, null, npc.slug, save.region);
    await tx.worldState.update({ where: { saveId: save.id }, data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: timeLabel } });
    fraseAjena = zonePointId ? await cazaDeLoAjeno(tx, save.id, save.worldId, [zonePointId]) : null;
    const created = await tx.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text: fraseAjena ? `${text} ${fraseAjena}` : text, timeLabel, fictionalMinutes: nuevoFictionalMinutes, isPlayerAction: false, isSystemMessage: true, roll: cazaLimpia as unknown as Prisma.InputJsonValue } });
    await guardarSlugsDeCombate(tx, save.id, [npc.slug]);
    // Grupos de fauna reales (Fase 2) — la caza limpia siempre enfrenta a UN único individuo
    // (nunca al grupo entero, ver comentario de cabecera de esta función); el punto del que salió
    // pierde exactamente ese individuo.
    if (zonePointId) await descontarZonePointCaza(tx, save.id, zonePointId, 1);
    return created;
  });

  if (!logEntry) {
    return { error: 'Ya se está resolviendo una caza contra esta presa — espera un momento.', status: 409 };
  }

  // Bug real (reconfirmado 2026-09-08, ver comentario original completo en `cazar.ts`) — se limpia
  // aquí, ya fuera de la transacción (la ventana de carrera de arriba ya cerró en cuanto esa
  // transacción hizo commit).
  await prisma.save.update({ where: { id: save.id }, data: { pendingCombatNpcSlugs: [], combateDesde: null } });

  const sessionFacts = await loadSessionFacts(save.id);
  await appendSessionFacts(save.id, sessionFacts, [text]);
  await recordEntityDiscoveries({ saveId: save.id, worldId: save.worldId, mentionedText: text, npcSlugsInScene: [npc.slug] });

  return {
    resuelveSinCombate: true,
    exito: true,
    combate: { npcs: [{ slug: npc.slug, name: npc.name, condicionFisica: 'MUERTO' as const, saqueado: false, lootedItemNames: [] }] },
    logEntry: { id: logEntry.id, text: fraseAjena ? `${text} ${fraseAjena}` : text, timeLabel, createdAt: logEntry.createdAt.toISOString(), roll: cazaLimpia },
    cazaLimpia,
  };
}

/// Caza en grupo/combate — cualquier caso que no sea la caza limpia de arriba: varias especies
/// seleccionadas, o una sola pero no lo bastante débil. Solo se crea un `CombatEncounter` real si
/// AL MENOS una especie objetivo tiene más de un individuo real (`hayGrupoReal`); si no, el combate
/// lo abre el turno normal de texto libre como siempre (1v1 clásico, `pendingCombatNpcSlugs`), sin
/// tocar la base de datos aquí — mismas reglas EXACTAS que el bloque original de `cazar.ts`.
async function intentarCazaEnGrupo(save: SaveParaCaza, targets: CazaTarget[], emboscada = false): Promise<IniciarCazaResultado> {
  const currentLocationId = save.currentLocationId;
  const varianceClauses: string[] = [];
  // P191: la versión de diario de una cláusula de `varianceClauses` cuando no es la misma frase.
  const enDiario = new Map<string, string>();
  const hayGrupoReal = targets.some((t) => t.cantidadObjetivo > 1);
  const especiesDispersadas: string[] = [];
  const tiradasGrupo: TiradaGrupoInfo[] = [];
  let fraseAjenaCaza: string | null = null;
  let logEntryGrupo: { id: string; text: string; timeLabel: string; createdAt: string; roll: CombateGrupoLogRoll } | undefined;

  if (hayGrupoReal) {
    const jugadorAttrs = save.attributes;
    const combatientes: (CombatienteInicial & { destreza: number; inteligencia: number })[] = [
      { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: jugadorAttrs.destreza, inteligencia: jugadorAttrs.inteligencia, constitucion: jugadorAttrs.constitucion, nombre: save.characterName },
      ...(
        await prisma.companion.findMany({
          where: { saveId: save.id, combatGroupSlotIndex: 0, condicionFisica: { not: 'MUERTO' }, ...companeroDispuestoACombatir },
          select: { id: true, name: true, attributes: true },
        })
      )
        .filter((c) => c.attributes)
        .map((c) => {
          const attrs = c.attributes as AttributeBlock;
          return { bando: 'JUGADOR' as const, tipo: 'COMPANION' as const, companionId: c.id, destreza: attrs.destreza, inteligencia: attrs.inteligencia, constitucion: attrs.constitucion, nombre: c.name };
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
        const engagement = rollGroupEngagementDetail(cantidadElegida, target.cantidadObjetivo);
        let cantidadReal = engagement.cantidadTirada;
        // Un grupo AGRESIVO no se dispersa por las buenas — ver comentario completo original en
        // `cazar.ts` (matiz explícito de la usuaria, 2026-09-02).
        if (cantidadReal === 0 && npc.temperamento === 'AGRESIVO' && save.level <= (npc.levelMax ?? npc.level)) {
          cantidadReal = 1;
        }
        tiradasGrupo.push({
          slug: npc.slug,
          name: npc.name,
          roll: engagement.roll,
          delta: engagement.delta,
          cantidadElegida,
          avistados: target.cantidadObjetivo,
          cantidadTirada: engagement.cantidadTirada,
          cantidadReal,
        });
        if (cantidadReal === 0) especiesDispersadas.push(npc.slug);
        for (let i = 0; i < cantidadReal; i++) {
          combatientes.push({ bando: 'ENEMIGO', tipo: 'NPC', npcId: npc.id, npcScope: scope, destreza: npcAttrs.destreza, inteligencia: npcAttrs.inteligencia, esGrupo: true, nombre: npc.name });
        }
        if (zonePointId) enfrentadosPorZonePoint.set(zonePointId, (enfrentadosPorZonePoint.get(zonePointId) ?? 0) + cantidadReal);
        const clause = groupVarianceClause(cantidadElegida, cantidadReal);
        if (clause) {
          const conNarrador = `Con '${npc.name}', ${clause}.`;
          varianceClauses.push(conNarrador);
          const diario = groupVarianceDiario(save.characterName, npc.name, cantidadElegida, cantidadReal, npc.articulo === 'la' || npc.genero === 'F');
          if (diario) enDiario.set(conNarrador, diario);
        }
      } else {
        combatientes.push({ bando: 'ENEMIGO', tipo: 'NPC', npcId: npc.id, npcScope: scope, destreza: npcAttrs.destreza, inteligencia: npcAttrs.inteligencia, nombre: npc.name });
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

    // CR-62 (62d, ADR 0002): tus grupos 2, 3… (`combatGroupSlotIndex` > 0) pelean de fondo contra los
    // grupos enemigos que no caben en el combate en vivo de tu Grupo 1: el grupo k contra el fragmento
    // enemigo k. Un fragmento sin grupo tuyo se queda como antes (no tiene con quién pelear).
    const otrosGrupos = await gruposDeFondo(save.id);
    // Condición de carrera real (auditoría 2026-08-25) — ver comentario completo original.
    const resultado = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      const activeEncounterFresco = await tx.combatEncounter.findFirst({ where: { saveId: save.id, estado: 'EN_CURSO', jugable: true } });
      if (activeEncounterFresco) return null;
      const { iniciativa: iniciativaJugable } = await iniciarCombatEncounter(tx, save.id, [...bandoJugadorCompleto, ...fragmentosParaCrear[0]]);
      // Fase 10 (2026-09-29) — la iniciativa de cada combatiente y la tirada de cuántos entran ya no
      // se descartan: un LogEntry de sistema las guarda (sobrevive a una recarga) y se devuelven.
      const timeLabelGrupo = formatFictionalDate(save.fictionalMinutes);
      const logRoll: CombateGrupoLogRoll = { kind: 'combate-grupo', engagement: tiradasGrupo, iniciativa: iniciativaJugable };
      const textoGrupo = `Comienza el combate: cada combatiente tira iniciativa.`;
      const createdGrupo = await tx.logEntry.create({
        data: { saveId: save.id, channel: 'CHARACTER', text: textoGrupo, timeLabel: timeLabelGrupo, fictionalMinutes: save.fictionalMinutes, isPlayerAction: false, isSystemMessage: true, roll: logRoll as unknown as Prisma.InputJsonValue },
      });
      logEntryGrupo = { id: createdGrupo.id, text: textoGrupo, timeLabel: timeLabelGrupo, createdAt: createdGrupo.createdAt.toISOString(), roll: logRoll };
      const autonomosIds: string[] = [];
      const deFondo: { encounterId: string; grupo: GrupoDeFondo; enemigos: number }[] = [];
      for (const [i, fragmento] of fragmentosParaCrear.slice(1).entries()) {
        const grupo = otrosGrupos[i];
        const { encounterId } = await iniciarCombatEncounter(tx, save.id, grupo ? [...grupo.combatientes, ...fragmento] : fragmento, false);
        autonomosIds.push(encounterId);
        if (grupo) deFondo.push({ encounterId, grupo, enemigos: fragmento.length });
      }
      if (currentLocationId) {
        for (const slug of especiesDispersadas) {
          await tx.worldPopulation.updateMany({
            where: { ...(await ambitoPoblacion(tx, save.id)), targetType: 'FAUNA', targetSlug: slug },
            data: { dispersadoEnLocationId: currentLocationId, dispersadoDesdeMinutes: save.fictionalMinutes },
          });
        }
      }
      // Grupos de fauna reales (Fase 2) — el/los `ZonePoint` de origen pierden los individuos
      // realmente enfrentados, en la misma transacción que crea el combate.
      if (!emboscada) fraseAjenaCaza = await cazaDeLoAjeno(tx, save.id, save.worldId, [...enfrentadosPorZonePoint.keys()], 'atacar');
      for (const [zonePointId, enfrentados] of enfrentadosPorZonePoint) {
        await descontarZonePointCaza(tx, save.id, zonePointId, enfrentados);
      }
      return { autonomosIds, deFondo };
    });
    if (!resultado) {
      return { error: 'Ya hay un combate en curso — resuélvelo antes de salir a cazar.', status: 400 };
    }

    // Resolución determinista de los sub-combates sin la jugadora presente — ver comentario
    // completo original en `cazar.ts` (2026-09-01).
    let caidosAutonomos = 0;
    for (const encounterId of resultado.autonomosIds) {
      // Un sub-combate de fondo se resuelve entero (con tus grupos 2+ dentro ya no basta el tope de
      // seguridad de 30 turnos); si aun así llega al tope de rondas, acaba en tablas y se cierra.
      const participantes = await prisma.combatParticipant.count({ where: { encounterId } });
      const { caidos, encounterTerminado } = await resolverTurnosAutonomosHastaJugadora({ prisma, worldId: save.worldId, saveId: save.id, encounterId, weaponNamesPorDefecto: [], narrarFn: async () => '', maxIteraciones: participantes * MAX_RONDAS_SUBCOMBATE });
      if (!encounterTerminado) await prisma.combatEncounter.update({ where: { id: encounterId }, data: { estado: 'RESUELTO', resolvedAt: new Date() } });
      const conGrupo = resultado.deFondo.find((d) => d.encounterId === encounterId);
      if (conGrupo) {
        // CR-62 (62d): resumen del sub-combate de fondo de tu grupo (reporte de § 4, con plantilla).
        const enemigosCaidos = caidos.filter((c) => c.tipo === 'NPC').length;
        const estado = await prisma.companion.findMany({ where: { id: { in: conGrupo.grupo.companionIds } }, select: { name: true, condicionFisica: true } });
        varianceClauses.push(resumenGrupoDeFondo(conGrupo.grupo.nombre, conGrupo.enemigos, enemigosCaidos, estado));
      } else {
        caidosAutonomos += caidos.length;
      }
    }
    // P77 (QA-27): «6 de 6 entran» y solo 4 en la iniciativa — el diario no decía que el resto se
    // queda fuera del combate en vivo (como mucho `MAX_COMBATIENTES_POR_BANDO` por bando).
    // Esos rezagados pelean de fondo entre sí y con el terreno (frase de `caidosAutonomos`, abajo).
    const fueraDelAlcance = fragmentosParaCrear.slice(1).reduce((n, f, i) => n + (otrosGrupos[i] ? 0 : f.length), 0);
    if (fueraDelAlcance > 0) {
      varianceClauses.push(`Solo ${MAX_COMBATIENTES_POR_BANDO} alcanzan a ${save.characterName} a la vez; ${fueraDelAlcance === 1 ? 'el otro queda' : `los otros ${fueraDelAlcance} quedan`} fuera de su alcance.`);
    }
    if (caidosAutonomos > 0) {
      varianceClauses.push(`Los que quedan fuera de su alcance se revuelven entre sí y contra el terreno; ${caidosAutonomos} caen sin que ${save.characterName} llegue a verlo.`);
    }
  } else {
    // 1v1 clásico: el combate lo abre el turno de texto libre, pero el individuo enfrentado ya no
    // está en su punto del mapa — mismo descuento que el camino de grupo (si no, tras matarlo el
    // pin seguiría ahí con la misma cantidad).
    const conPunto = targets.filter((t) => t.zonePointId);
    if (conPunto.length > 0) {
      await prisma.$transaction(async (tx) => {
        if (!emboscada) fraseAjenaCaza = await cazaDeLoAjeno(tx, save.id, save.worldId, conPunto.map((t) => t.zonePointId!), 'atacar');
        for (const t of conPunto) await descontarZonePointCaza(tx, save.id, t.zonePointId!, 1);
      });
    }
  }

  if (fraseAjenaCaza) varianceClauses.push(fraseAjenaCaza);
  const names = targets.map((t) => t.npc.name);
  const citados = names.map((n) => `'${n}'`).join(', ');
  // P90 (QA-27): emboscada = el grupo vio antes a la jugadora; ella no eligió salir a cazar.
  const actionText = [emboscada ? `${PREFIJO_EMBOSCADA}${citados}, ${SUFIJO_EMBOSCADA}` : `${PREFIJO_CAZA}${citados}.`, ...varianceClauses].join(' ');
  // P90/P130 (QA-27): en el diario, lo que cuenta el sistema (la emboscada, cuántos alcanzan a la
  // jugadora, quién cae de fondo) va en la entrada de sistema del combate, no pegado a su acción.
  if (logEntryGrupo) {
    const aviso = emboscada ? `${nombreDeEncuentro(names.join(', '), targets.reduce((n, t) => n + t.cantidadObjetivo, 0), true)} te embosca.` : null;
    const texto = [aviso, logEntryGrupo.text, ...varianceClauses.map((c) => enDiario.get(c) ?? sinComillasSueltas(c))].filter(Boolean).join(' ');
    await prisma.logEntry.update({ where: { id: logEntryGrupo.id }, data: { text: texto } });
    logEntryGrupo = { ...logEntryGrupo, text: texto };
  }
  return { resuelveSinCombate: false, exito: null, actionText, accionEnDiario: accionEnDiarioDeCaza(actionText), ...(tiradasGrupo.length > 0 ? { tiradasGrupo } : {}), ...(logEntryGrupo ? { logEntry: logEntryGrupo } : {}) };
}

const PREFIJO_CAZA = 'Salgo a cazar y ataco a ';
const PREFIJO_EMBOSCADA = 'Me defiendo de ';
const SUFIJO_EMBOSCADA = 'que me tienden una emboscada.';

/// P90/P130 (QA-27): lo que de un `actionText` de caza sale en el diario como acción de la jugadora.
/// La frase entera sigue yendo al narrador; en el diario, solo lo que ella hizo («Salgo a cazar y
/// ataco a …»), y nada si la emboscaron (lo cuenta la entrada de sistema del combate). Cualquier
/// otra acción sale tal cual.
export function accionEnDiarioDeCaza(action: string): string | null {
  if (action.startsWith(PREFIJO_EMBOSCADA) && action.includes(SUFIJO_EMBOSCADA)) return null;
  if (!action.startsWith(PREFIJO_CAZA)) return action;
  return /^Salgo a cazar y ataco a (?:'[^']*'(?:, )?)+\./.exec(action)?.[0] ?? action;
}

/// Punto de entrada único del servicio — decide entre caza limpia y caza en grupo/combate, mismas
/// reglas EXACTAS que tenía `cazar/confirmar` antes de este traslado (ver comentario de cabecera
/// del módulo). `permitirCazaLimpia: false` (agresivo en grupo, `dynamicMode.ts`) fuerza siempre el
/// camino de combate — "un agresivo que te corta el paso nunca se resuelve sigiloso".
export async function iniciarCaza(params: { save: SaveParaCaza; targets: CazaTarget[]; permitirCazaLimpia?: boolean; emboscada?: boolean }): Promise<IniciarCazaResultado> {
  const { save, targets } = params;
  const permitirCazaLimpia = params.permitirCazaLimpia ?? true;

  if (permitirCazaLimpia && targets.length === 1 && esDebil(targets[0].npc, save.level)) {
    return intentarCazaLimpia(save, targets[0]);
  }
  return intentarCazaEnGrupo(save, targets, params.emboscada ?? false);
}

/// B29 (2026-09-29, pruebas 2026-09-28): "Ataco al Gesgurio" con el Gesgurio adyacente daba una
/// tirada y nada más. Textos que ESTE mismo servicio devuelve como `actionText` para mandarlos por
/// el turno normal — `/turn/classify` no debe volver a interceptarlos como "atacar por texto"
/// (bucle infinito: el texto cita a la fauna con verbo de ataque).
export function esActionTextDeCaza(action: string): boolean {
  return action.startsWith(PREFIJO_CAZA) || (action.startsWith(PREFIJO_EMBOSCADA) && action.includes(SUFIJO_EMBOSCADA)) || (action.startsWith("Me acerco a '") && action.includes('con sigilo, pero me detecta antes de tiempo'));
}

/// B29 — de las fauna NOMBRADAS en el texto libre (`slugsNombrados`), la primera con un `ZonePoint`
/// FAUNA activo de ESTA partida en la celda del jugador o adyacente (mismo criterio que la colisión,
/// `celdaAdyacenteOMisma`) y con individuos vivos. `null` si ninguna está cerca (comportamiento de
/// siempre: turno normal). Devuelve el `Npc` de catálogo y el punto, listos para `iniciarCaza`.
export async function faunaCercanaNombrada(params: {
  saveId: string;
  worldId: string;
  locationId: string | null;
  zonaPosX: number | null;
  zonaPosY: number | null;
  slugsNombrados: string[];
}): Promise<{ npc: Npc; punto: { id: string; cantidad: number } } | null> {
  const { saveId, worldId, locationId, zonaPosX, zonaPosY, slugsNombrados } = params;
  if (!locationId || zonaPosX == null || zonaPosY == null || slugsNombrados.length === 0) return null;
  const celdaJugador = celdaDePixel({ x: zonaPosX, y: zonaPosY });
  const puntos = await prisma.zonePoint.findMany({
    where: { saveId, locationId, tipo: 'FAUNA', activo: true, cantidad: { gt: 0 }, targetSlug: { in: slugsNombrados } },
    select: { id: true, x: true, y: true, cantidad: true, targetSlug: true },
  });
  for (const punto of puntos) {
    if (!celdaAdyacenteOMisma(celdaDePixel(punto), celdaJugador)) continue;
    const npc = await prisma.npc.findFirst({ where: { worldId, slug: punto.targetSlug, saveId: null } });
    if (!npc) continue;
    // Ya derrotada/convaleciente en esta partida: eso es "matar/saquear" (interacción post-combate),
    // no una caza nueva.
    const estado = await prisma.npcState.findFirst({ where: { saveId, npcId: npc.id, condicionFisica: { in: ['MUERTO', 'CONVALECIENTE'] } }, select: { id: true } });
    if (estado) continue;
    return { npc, punto: { id: punto.id, cantidad: punto.cantidad } };
  }
  return null;
}

// ─────────────────────────── CR-62 (62d): tus otros grupos, de fondo ───────────────────────────

export interface GrupoDeFondo {
  slotIndex: number;
  nombre: string;
  companionIds: string[];
  combatientes: (CombatienteInicial & { destreza: number; inteligencia: number })[];
}

/// Tus grupos de combate 2, 3… con compañeros dispuestos a pelear (hasta 4 cada uno), por orden.
async function gruposDeFondo(saveId: string): Promise<GrupoDeFondo[]> {
  const [companeros, nombres] = await Promise.all([
    prisma.companion.findMany({
      where: { saveId, combatGroupSlotIndex: { gt: 0 }, condicionFisica: { not: 'MUERTO' }, ...companeroDispuestoACombatir },
      select: { id: true, name: true, attributes: true, combatGroupSlotIndex: true },
      orderBy: [{ combatGroupSlotIndex: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.combatGroup.findMany({ where: { saveId }, select: { slotIndex: true, name: true } }),
  ]);
  const porSlot = new Map<number, GrupoDeFondo>();
  for (const c of companeros.filter((x) => x.attributes)) {
    const g = porSlot.get(c.combatGroupSlotIndex) ?? {
      slotIndex: c.combatGroupSlotIndex,
      nombre: nombres.find((n) => n.slotIndex === c.combatGroupSlotIndex)?.name ?? `Grupo ${c.combatGroupSlotIndex + 1}`,
      companionIds: [],
      combatientes: [],
    };
    if (g.combatientes.length >= MAX_COMBATIENTES_POR_BANDO) continue;
    const attrs = c.attributes as AttributeBlock;
    g.companionIds.push(c.id);
    g.combatientes.push({ bando: 'JUGADOR', tipo: 'COMPANION', companionId: c.id, destreza: attrs.destreza, inteligencia: attrs.inteligencia, constitucion: attrs.constitucion, nombre: c.name });
    porSlot.set(c.combatGroupSlotIndex, g);
  }
  return [...porSlot.values()].sort((a, b) => a.slotIndex - b.slotIndex);
}

/// Puro: «Grupo 2 se enfrenta a 4 más: caen 3; Ana queda malherida.»
export function resumenGrupoDeFondo(nombre: string, enemigos: number, enemigosCaidos: number, companeros: { name: string; condicionFisica: string }[]): string {
  const estado: Record<string, string> = { HERIDO: 'herido', GRAVE: 'malherido', CONVALECIENTE: 'fuera de combate', MUERTO: 'muerto' };
  const tocados = companeros.filter((c) => estado[c.condicionFisica]).map((c) => `${c.name} queda ${estado[c.condicionFisica]}`);
  return `${nombre} se enfrenta a ${enemigos} más, lejos de la vista: ${enemigosCaidos > 0 ? `caen ${enemigosCaidos}` : 'ninguno cae'}${tocados.length > 0 ? `; ${tocados.join(', ')}` : ''}.`;
}

