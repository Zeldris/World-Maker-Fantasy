// Saqueo, efectos de muerte, intercambio de combate 1v1 y despiece extraídos de turnResolution.ts
// (Fase 12 del plan, refactor puro: mismo código, solo cambia de archivo).


import { registrarFinDeMision } from './cronista/emisores.js';
import { registrarSuceso } from './cronista/sucesos.js';
import { slugify } from '../lib/slugify.js';
import type { NewInventoryItemInfo } from './turnResolution.js';
import { recordFactionEvent } from './factionRelations.js';

import { completeNpcTargetQuests, type QuestCompletedInfo } from './questResolution.js';
import { applyFactionRepDelta, parseFactionsStatus, FACTION_REP_ATTACK_DELTA, REGION_OWNING_FACTIONS, type FactionRepChangeInfo } from './reputation.js';

import { scopeFor, hasPendingLoot, type NpcInScene } from './npcScene.js';

import { type HarvestMatch } from './harvest.js';

import { decrementPopulationOnDeath } from './population.js';

import { posicionDeObjetivo, minutoDeReaparicion, moverJugadorA } from './zonaPosicion.js';

import { whisperText } from './death.js';

import { prisma } from '../lib/prisma.js';
import { type ActiveEffect } from './activeEffects.js';
import type { RollResult } from './dice.js';

import { Prisma } from '@prisma/client';
import type { CondicionFisica, AbilityEffect } from '@prisma/client';
import { ambitoFacciones } from './mundoPartida.js';
import { testigosEnLugar } from './cronista/testigos.js';

export interface LootModeResult {
  actualLootedNames: string[];
  newInventoryItems: NewInventoryItemInfo[];
  createdItemNames: string[];
  partiallyLootedSlugs: string[];
  questRewardXp: number;
  /// null si el número de objetos realmente saqueados coincidió con `lootPreviewCount` (el
  /// preview en streaming, emitido ANTES de esta transacción, seguía siendo honesto) — el caller
  /// solo tiene que sustituir `narration.narration` cuando no es null (auditoría 2026-08-06,
  /// narración mentirosa si se pierde la carrera contra otro "saquear" casi simultáneo).
  narrationOverride: string | null;
}

export function pickFlavor(variants: readonly string[], random: () => number = Math.random): string {
  return variants[Math.floor(random() * variants.length)];
}

export const LOOT_FLAVOR_SUCCESS = [
  'Nada llamativo, pero útil.',
  'El polvo y la sangre seca cubren cada hallazgo.',
  'Guarda cada pieza sin perder tiempo, atento a la zona.',
  'El silencio del lugar hace que cada movimiento se sienta más pesado.',
] as const;
export const LOOT_FLAVOR_EMPTY = ['Solo quedan jirones y polvo.', 'Alguien —o algo— se le adelantó.', 'El lugar ya está limpio de todo valor.'] as const;
export const HARVEST_FLAVOR_YA_DESPIEZADA = [
  'No queda ni un jirón que merezca la pena.',
  'Los restos, ya vacíos, no tienen nada más que ofrecer.',
] as const;

/// Saqueo (docs/12 § 4.5), extraído de la transacción de `narrateAndPersistTurn` (refactor de
/// deuda técnica 2026-08-13) — entrada/salida acotada: solo toca `NpcState`/`InventoryItem`/
/// `Quest` de los NPCs saqueados este turno, nada del resto del turno. El caller solo tiene que
/// sumar/concatenar el resultado a sus propios acumuladores y aplicar `narrationOverride` si lo
/// hay. La ÚNICA fuente de botín sigue siendo lo que el NPC lleva encima (NpcItem), nunca una
/// invención del modelo.
export async function applyLootMode(params: {
  tx: Prisma.TransactionClient;
  lootTargets: NpcInScene[];
  lootItemNames: string[] | null | undefined;
  /// Longitud de `lootPreview` (calculado antes de la transacción, con `prisma`) — solo hace
  /// falta el número para decidir si el preview en streaming sigue siendo honesto, no la lista
  /// entera.
  lootPreviewCount: number;
  currentLocationId: string | null;
  saveId: string;
  characterName: string;
}): Promise<LootModeResult> {
  const { tx, lootTargets, lootItemNames, lootPreviewCount, currentLocationId, saveId, characterName } = params;
  const actualLootedNames: string[] = [];
  const newInventoryItems: NewInventoryItemInfo[] = [];
  const createdItemNames: string[] = [];
  const partiallyLootedSlugs: string[] = [];
  let questRewardXp = 0;
  for (const npc of lootTargets) {
    const scope = scopeFor(npc.kind, currentLocationId);
    // Revalidación anti-carrera (auditoría de deuda técnica 2026-08-04, mismo patrón ya cerrado
    // para construcción/crafteo/despiece): `npc.saqueado`/`npc.lootedItemNames` vienen de
    // `npcsInScene`, leído con `prisma` ANTES de esta transacción — dos turnos de "saqueo" casi
    // simultáneos sobre el mismo NPC (doble clic, reintento de red, dos pestañas) podían pasar
    // ambos el guard con la misma foto ya obsoleta y duplicar el botín de una sola muerte. Se
    // relee fresco con `tx` justo antes de decidir qué llevarse.
    const freshState = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope } } });
    // NpcState: una vez saqueado DEL TODO, no hay nada más que ofrecer — se sigue saltando.
    if (freshState?.saqueado) continue;
    const yaTomados = freshState?.lootedItemNames ?? npc.lootedItemNames;
    const itemsToLoot = (lootItemNames ? npc.items.filter((item) => lootItemNames.includes(item.name)) : npc.items).filter(
      (item) => !yaTomados.includes(item.name),
    );
    for (const item of itemsToLoot) {
      const created = await tx.inventoryItem.create({
        data: {
          saveId,
          name: item.cantidad > 1 ? `${item.name} ×${item.cantidad}` : item.name,
          description: item.notas ?? `Botín de ${npc.name}.`,
          origin: `botín de ${npc.name}`,
          // Los bonificadores de equipo (si el objeto los tenía en el catálogo) viajan con él —
          // un hacha robada sigue dando su bonificador al equiparla.
          statBonuses: item.statBonuses ?? Prisma.JsonNull,
          catalogSlug: item.catalogSlug,
        },
      });
      newInventoryItems.push({ ...created, slot: null, equipSlot: item.equipSlot, effectKey: item.effectKey, tipo: item.tipo });
      createdItemNames.push(created.name);
      actualLootedNames.push(created.name);
    }
    // Bug real (auditoría de código completa, 2026-08-07): el guard `npc.items.length > 0`
    // saltaba ESTE BLOQUE ENTERO para un NPC con loadout vacío — `npc.items.every(...)` sobre un
    // array vacío ya es `true` por definición (nada que tomar = todo tomado), así que quitar el
    // guard basta.
    // B27 (pruebas 2026-09-28): sin Reino no había NINGUNA forma de ganar Goirnos (aprender un
    // oficio cuesta 10). Un humanoide (sin `ataqueNatural`, a diferencia de la fauna) lleva unas
    // monedas que se cogen la primera vez que se registra su cuerpo — decisión por defecto,
    // revisable por Álvaro (`goirnosDeBotin`).
    const primerRegistro = !freshState || (freshState.lootedItemNames.length === 0 && !freshState.saqueado);
    if (primerRegistro && npc.ataqueNatural === null) {
      const goirnos = goirnosDeBotin(npc.level);
      await tx.save.update({ where: { id: saveId }, data: { goirnos: { increment: goirnos } } });
      actualLootedNames.push(`${goirnos} Goirnos`);
    }
    const nuevosTomados = [...new Set([...yaTomados, ...itemsToLoot.map((item) => item.name)])];
    const todoTomado = npc.items.every((item) => nuevosTomados.includes(item.name));
    if (!todoTomado) partiallyLootedSlugs.push(npc.slug);
    await tx.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope } },
      create: { saveId, npcId: npc.id, scope, saqueado: todoTomado, lootedItemNames: nuevosTomados },
      update: { saqueado: todoTomado, lootedItemNames: nuevosTomados },
    });

    // Recompensa estática de misión al saquear (petición explícita, 2026-07-25): si el NPC
    // saqueado es el objetivo de una misión ACTIVA con XP de recompensa definida, se concede aquí
    // y la misión se cierra como resuelta. Guardado por el `if (freshState?.saqueado) continue`
    // de arriba — un NPC ya saqueado nunca vuelve a pasar por aquí, así que esto solo concede la
    // recompensa una vez, sin importar cuántas veces se intente registrar el cuerpo.
    const rewardQuest = await tx.quest.findFirst({ where: { saveId, targetNpcId: npc.id, status: 'ACTIVA', rewardXp: { not: null } } });
    if (rewardQuest) {
      questRewardXp += rewardQuest.rewardXp!;
      await tx.quest.update({ where: { id: rewardQuest.id }, data: { status: 'COMPLETADA' } });
      await registrarFinDeMision(tx, { saveId, titulo: rewardQuest.title, estado: 'COMPLETADA' });
    }
  }
  const narrationOverride =
    actualLootedNames.length !== lootPreviewCount
      ? actualLootedNames.length > 0
        ? `${characterName} rebusca entre los restos y se hace con lo siguiente: ${actualLootedNames.join(', ')}. ${pickFlavor(LOOT_FLAVOR_SUCCESS)}`
        : `${characterName} rebusca entre los restos, pero alguien se le ha adelantado — no queda nada que llevarse. ${pickFlavor(LOOT_FLAVOR_EMPTY)}`
      : null;
  return { actualLootedNames, newInventoryItems, createdItemNames, partiallyLootedSlugs, questRewardXp, narrationOverride };
}

/// B27 (2026-09-28) — Goirnos que lleva encima un humanoide derrotado, por nivel (nivel 1 → 4,
/// nivel 5 → 12). Puro, para poder testearlo y ajustarlo en un único sitio.
export function goirnosDeBotin(nivel: number): number {
  return 2 + Math.max(1, nivel) * 2;
}

/// Aplica el resultado YA resuelto del intercambio de combate (`resolveCombatExchangePhase`) al
/// `NpcState` del objetivo — extraído de la transacción de `narrateAndPersistTurn` (refactor de
/// deuda técnica 2026-08-13). Sistema de fatiga simétrico (2026-07-30): `npcNuevaEnergia` viaja
/// en el MISMO upsert que la condición física en vez de uno aparte, porque los dos pueden cambiar
/// en el mismo intercambio (un golpe que además gasta energía) y un NPC solo tiene una fila
/// NpcState por scope. Si el golpe deja al NPC CONVALECIENTE/MUERTO, cierra también su misión
/// asociada, resta reputación de facción y decrementa población — mismo camino que usa "Matar"
/// desde 2026-08-30 (ya no tiene función de cierre propia, es un ataque normal como cualquier
/// otro).
export async function applyCombatExchangeToNpcState(params: {
  tx: Prisma.TransactionClient;
  npcAttackTarget: NpcInScene | null;
  npcNuevaEnergia: number | null;
  npcAttackHits: boolean;
  npcTargetNewCondicion: CondicionFisica | null;
  analizarRivalExito: boolean;
  /// Tope de usos por combate (2026-08-15, AbilityEffect.LIMITADA/maxUsesPerCombat) — nombres de
  /// habilidad (jugador y/o NPC) que se usaron DE VERDAD este intercambio y llevan tope; cada
  /// nombre sube +1 en `NpcState.abilityUsesThisEncounter`. El caller ya descarta aquí cualquier
  /// intento bloqueado por haber agotado el tope (nunca se cuenta dos veces).
  abilityNamesToIncrement: string[];
  /// Fase 2 de efectos de clase (2026-08-26) — `CombatExchangePhaseResult.npcActiveEffectsNext`
  /// tal cual, ya con el push/decremento de este intercambio aplicado por
  /// `resolveCombatExchangePhase`. Se sobreescribe a `[]` si `condicionAEscribir === 'ILESO'`
  /// (más abajo), mismo criterio de reset que `abilityUsesThisEncounter`.
  npcActiveEffectsNext: ActiveEffect[];
  saveId: string;
  worldId: string;
  currentLocationId: string | null;
  nuevoFictionalMinutes: number;
  nuevaFictionalDateLabel: string;
  activeRegion: string | null;
  /// Ver comentario de `completeNpcTargetQuests` (questResolution.ts) — reloj sintético
  /// "después de mainLogEntry" para que la recompensa de misión se lea en el orden correcto.
  nextAfterMainLogCreatedAt?: () => Date;
}): Promise<{ questCompletedInfo: QuestCompletedInfo | null; factionRepChange: FactionRepChangeInfo | null }> {
  const {
    tx,
    npcAttackTarget,
    npcNuevaEnergia,
    npcAttackHits,
    npcTargetNewCondicion,
    analizarRivalExito,
    abilityNamesToIncrement,
    npcActiveEffectsNext,
    saveId,
    worldId,
    currentLocationId,
    nuevoFictionalMinutes,
    nuevaFictionalDateLabel,
    activeRegion,
    nextAfterMainLogCreatedAt,
  } = params;
  let questCompletedInfo: QuestCompletedInfo | null = null;
  let factionRepChange: FactionRepChangeInfo | null = null;
  if (
    !npcAttackTarget ||
    !(npcNuevaEnergia !== null || (npcAttackHits && npcTargetNewCondicion) || analizarRivalExito || abilityNamesToIncrement.length > 0)
  ) {
    return { questCompletedInfo, factionRepChange };
  }
  const scope = scopeFor(npcAttackTarget.kind, currentLocationId);
  const esGolpeDeMuerte = npcAttackHits && npcTargetNewCondicion && (npcTargetNewCondicion === 'CONVALECIENTE' || npcTargetNewCondicion === 'MUERTO');
  // Caza en grupo (2026-08-13) — ver el hint gemelo en `resolveCombatExchangePhase` (misma
  // condición exacta, `npcAttackTarget.groupSize`/`.groupDefeated` ya leídos en el mismo turno
  // ANTES de narrar, para que lo que se escribe aquí coincida con lo que se le pidió narrar al
  // modelo). Si quedan más miembros, el individuo ACTUAL "resucita" a ILESO para el siguiente en
  // vez de quedarse en CONVALECIENTE/MUERTO — misma fila, `groupDefeated` sube uno.
  const grupoContinua = !!(esGolpeDeMuerte && npcAttackTarget.groupSize && npcAttackTarget.groupDefeated + 1 < npcAttackTarget.groupSize);
  const condicionAEscribir = grupoContinua ? 'ILESO' : npcTargetNewCondicion;
  // Tope de usos por combate (2026-08-15) — se resetea a `{}` en cuanto el NPC vuelve a ILESO
  // (descanso/curación real entre combates, nunca durante uno; mismo criterio ya documentado en
  // schema.prisma § NpcState.abilityUsesThisEncounter), y suma +1 por cada nombre usado este
  // intercambio que lleve tope. Solo se escribe si de verdad cambia algo, mismo criterio que el
  // resto de este upsert.
  const abilityUsesReset = condicionAEscribir === 'ILESO';
  const abilityUsesNext = abilityUsesReset ? {} : { ...npcAttackTarget.abilityUsesThisEncounter };
  for (const name of abilityNamesToIncrement) abilityUsesNext[name] = (abilityUsesNext[name] ?? 0) + 1;
  const abilityUsesChanged = abilityUsesReset || abilityNamesToIncrement.length > 0;
  // Fase 2 de efectos de clase (2026-08-26) — mismo reset-on-ILESO que `abilityUsesNext`, arriba.
  const activeEffectsToWrite = condicionAEscribir === 'ILESO' ? [] : npcActiveEffectsNext;
  // "Matar" persistido (2026-09-05, bug real: se perdía al recargar) — mismo reset-on-ILESO que
  // `abilityUsesNext`/`activeEffectsToWrite`: en cuanto el NPC vuelve a ILESO (curación entre
  // combates) ya no tiene sentido seguir "marcado para matar" del encuentro anterior.
  const targetedForKillReset = condicionAEscribir === 'ILESO';
  // Punto del jugador en el mapa de Zona (2026-09-04) — combate ganado de verdad (golpe de muerte
  // y, si era un grupo, ya no queda nadie más) marca al NPC ausente 6h de ficción. `grupoContinua`
  // deja esto fuera a propósito: todavía hay alguien vivo de ese grupo en la zona.
  const marcarAusente = esGolpeDeMuerte && !grupoContinua;
  const zonaAusenteData = marcarAusente ? { zonaAusenteHastaMinutes: minutoDeReaparicion(nuevoFictionalMinutes), zonaLocationId: currentLocationId } : {};
  await tx.npcState.upsert({
    where: { saveId_npcId_scope: { saveId, npcId: npcAttackTarget.id, scope } },
    create: {
      saveId,
      npcId: npcAttackTarget.id,
      scope,
      ...(npcTargetNewCondicion ? { condicionFisica: condicionAEscribir!, condicionFisicaSinceMinutes: nuevoFictionalMinutes } : {}),
      ...(npcNuevaEnergia !== null ? { energia: npcNuevaEnergia } : {}),
      // Rediseño de combate (2026-08-09, "Analizar rival") — permanente por NPC/scope en esta
      // partida, nunca se vuelve a poner en false (mismo criterio idempotente que `saqueado`).
      ...(analizarRivalExito ? { analizado: true } : {}),
      ...(esGolpeDeMuerte && npcAttackTarget.groupSize ? { groupDefeated: 1, corpsesLooted: 0 } : {}),
      ...(abilityUsesChanged ? { abilityUsesThisEncounter: abilityUsesNext } : {}),
      ...zonaAusenteData,
      activeEffects: activeEffectsToWrite as unknown as Prisma.InputJsonValue,
    },
    update: {
      ...(npcAttackHits && npcTargetNewCondicion
        ? { condicionFisica: condicionAEscribir!, condicionFisicaSinceMinutes: nuevoFictionalMinutes, ...(esGolpeDeMuerte && npcAttackTarget.groupSize ? { groupDefeated: { increment: 1 } } : {}) }
        : {}),
      ...(npcNuevaEnergia !== null ? { energia: npcNuevaEnergia } : {}),
      ...(analizarRivalExito ? { analizado: true } : {}),
      ...(abilityUsesChanged ? { abilityUsesThisEncounter: abilityUsesNext } : {}),
      ...(targetedForKillReset ? { targetedForKill: false } : {}),
      ...zonaAusenteData,
      activeEffects: activeEffectsToWrite as unknown as Prisma.InputJsonValue,
    },
  });
  // Punto del jugador (2026-09-04) — cualquier intercambio de combate real contra este objetivo
  // (golpe recibido, energía gastada, tope de habilidad, análisis) lo acerca al jugador: primero
  // se busca su `ZonePoint` real (catálogo curado), si no existe se cae a la posición ya asignada
  // como dinámico (`NpcState.zonaPosX/Y` — asignada en la lectura de `GET /saves/:id/zona`, ver
  // zona.ts; si nunca se ha leído el mapa con este NPC en escena, todavía puede ser null, y
  // entonces no hay a dónde mover al jugador este turno).
  const zonaObjetivo = currentLocationId ? await posicionDeObjetivo(tx, saveId, currentLocationId, npcAttackTarget.slug) : null;
  if (zonaObjetivo) {
    await moverJugadorA(tx, saveId, zonaObjetivo.x, zonaObjetivo.y);
  } else {
    const npcStateConPosicion = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: npcAttackTarget.id, scope } }, select: { zonaPosX: true, zonaPosY: true } });
    if (npcStateConPosicion?.zonaPosX != null && npcStateConPosicion?.zonaPosY != null) {
      await moverJugadorA(tx, saveId, npcStateConPosicion.zonaPosX, npcStateConPosicion.zonaPosY);
    }
  }

  if (esGolpeDeMuerte) {
    const killSideEffects = await applyKillSideEffects({
      tx,
      npc: npcAttackTarget,
      nuevaCondicion: npcTargetNewCondicion,
      saveId,
      worldId,
      nuevoFictionalMinutes,
      nuevaFictionalDateLabel,
      activeRegion,
      nextAfterMainLogCreatedAt,
      // Petición explícita 2026-08-31: "Acabar con el Orco Enfurecido" (y cualquier quest futura
      // de "derrotar a X" que use targetNpcId) solo debe completarse con la MUERTE real del NPC —
      // dejarlo CONVALECIENTE (perdonar/capturar) ya no basta. De paso, esto es lo que da pie a
      // "fin de tutorial" como primer punto de guardado implícito (ver whisperText/death.ts): sin
      // este cambio, un jugador que perdona al orco nunca vería su quest completarse pero SÍ
      // contaría como tutorial superado, dos señales desalineadas.
      completeQuest: npcTargetNewCondicion === 'MUERTO',
    });
    questCompletedInfo = killSideEffects.questCompletedInfo;
    factionRepChange = killSideEffects.factionRepChange;
  }
  return { questCompletedInfo, factionRepChange };
}

/// Aplica un delta de reputación de facción y devuelve el resultado ya listo para propagar al
/// `LogEntry` del turno (2026-09-04, extraído del bloque que antes vivía inline en
/// `applyKillSideEffects` — ahora también lo usan Capturar/Clemente, `companeros.ts`/`session.ts`,
/// cada uno con su propio delta y su propio momento de "decisión final" sobre un CONVALECIENTE).
/// `faction: null` (fauna, NPC independientes) es un no-op explícito, no un error.
export async function applyFactionRepDeltaForResolution(
  tx: Prisma.TransactionClient,
  saveId: string,
  faction: string | null,
  delta: number,
): Promise<FactionRepChangeInfo | null> {
  if (!faction) return null;
  const currentWorldState = await tx.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true } });
  const currentStatus = parseFactionsStatus(currentWorldState?.factionsStatus);
  const updatedFactionsStatus = applyFactionRepDelta(currentStatus, faction, delta);
  await tx.worldState.update({ where: { saveId }, data: { factionsStatus: updatedFactionsStatus } });
  return { faction, delta, newValue: updatedFactionsStatus[faction] };
}

/// Extraído de `applyCombatExchangeToNpcState` (Combate múltiple, 2026-08-25) — cierre de
/// misión/reputación de facción/población dinámica al caer un NPC, separado de la ESCRITURA de
/// `NpcState` (que `applyCombatExchangeToNpcState` sigue haciendo justo antes de llamar a esto).
/// Reutilizado también por el enganche de `CombatEncounter` más abajo: un individuo real de grupo
/// NUNCA escribe `NpcState` (su condición vive en `CombatParticipant.condicionFisicaGrupo`, ver
/// schema.prisma), pero SÍ necesita este mismo cierre de misión/reputación/población al caer.
export async function applyKillSideEffects(params: {
  tx: Prisma.TransactionClient;
  npc: { id: string; name: string; raza: string | null; slug: string; faction: string | null; articulo: string | null };
  nuevaCondicion: CondicionFisica;
  saveId: string;
  worldId: string;
  nuevoFictionalMinutes: number;
  nuevaFictionalDateLabel: string;
  activeRegion: string | null;
  nextAfterMainLogCreatedAt?: () => Date;
  /// Petición explícita 2026-08-31: "derrotar a X" (targetNpcId) solo cuenta como completada con
  /// la MUERTE real — CONVALECIENTE (perdonar/capturar) ya no basta. Todo lo demás de esta función
  /// (reputación, saqueo/desuello, etc.) sigue disparándose igual con cualquier `esGolpeDeMuerte`.
  completeQuest: boolean;
}): Promise<{ questCompletedInfo: QuestCompletedInfo | null; factionRepChange: FactionRepChangeInfo | null }> {
  const { tx, npc, nuevaCondicion, saveId, worldId, nuevoFictionalMinutes, nuevaFictionalDateLabel, activeRegion, nextAfterMainLogCreatedAt, completeQuest } =
    params;
  // Cierre detectable por backend (roadmap 2026-07-19, mecánicas): si alguna misión ACTIVA
  // apuntaba a este NPC (Quest.targetNpcId, ver newQuest más arriba), derrotarlo la cierra sola
  // en cuanto cae — el modelo nunca tiene que acertar el título EXACTO vía questProgress para
  // el caso más común de misión de combate ("derrotar a X"). También concede rewardItems/
  // rewardXp de verdad y narra la recompensa (docs/19 pieza 3).
  const questCompletedInfo = completeQuest
    ? await completeNpcTargetQuests(tx, saveId, worldId, npc.id, nuevaFictionalDateLabel, nuevoFictionalMinutes, nextAfterMainLogCreatedAt)
    : null;

  // Reputación de facción determinista (roadmap 2026-07-19, prioridad 4): reutiliza
  // `WorldState.factionsStatus` (gauge 0-5000 por facción, ver reputation.ts — reemplaza el
  // viejo ±1 sin límite). Atacar a un NPC de una facción concreta resta bastante más de lo que
  // se recupera resolviendo algo en paz (deltas asimétricos, "pozo real" para ENEMIGO); sin
  // facción (fauna, NPCs independientes) no afecta a nada.
  //
  // Feedback de UX (2026-08-30, petición explícita: "falta que la suma de repu o la perdida se
  // refleje en la UX de alguna forma, sino el usuario ni se entera") — el delta ya se aplicaba y
  // persistía desde 2026-07-19, pero nunca se comunicaba de vuelta: el jugador solo podía
  // enterarse abriendo el panel de Reputación por su cuenta, sin ninguna señal de que algo acababa
  // de cambiar. Se devuelve aquí el resultado (facción/delta/valor nuevo) para que
  // `narrateAndPersistTurn` lo propague hasta el LogEntry del turno, mismo patrón que `xpDelta`.
  //
  // Solo con MUERTO (2026-09-04, bug real jugando en vivo, ver comentario de
  // `FACTION_REP_CAPTURE_DELTA`) — CONVALECIENTE ya no resta nada aquí: la decisión real todavía no
  // se ha tomado. Capturar/Clemente aplican su propio delta en sus endpoints (`companeros.ts`/
  // `session.ts`), nunca aquí.
  const factionRepChange = nuevaCondicion === 'MUERTO' ? await applyFactionRepDeltaForResolution(tx, saveId, npc.faction, FACTION_REP_ATTACK_DELTA) : null;

  // Población dinámica (docs/mecanicas/16-poblacion-dinamica.md): solo MUERTO resta población de verdad —
  // CONVALECIENTE es solo derrotado, no una baja real de la especie/raza.
  if (nuevaCondicion === 'MUERTO') {
    await decrementPopulationOnDeath(tx, saveId, npc.raza, npc.slug, activeRegion);
    // H-3 (2026-09-28): BAJA_DE_GUERRA — el jugador con Reino fundado (su propia `Faction`, el
    // `source`) mata a un NPC de otra facción dentro de una región de esa facción. Sin Reino
    // fundado no hay `source` y no se dispara. Cubre a la vez el golpe clásico y el combate
    // múltiple, que comparten esta función.
    if (npc.faction && activeRegion && REGION_OWNING_FACTIONS[activeRegion]?.includes(npc.faction)) {
      const playerFaction = await tx.faction.findFirst({ where: { saveId, origenSlug: null }, select: { id: true, name: true } });
      if (playerFaction && playerFaction.name !== npc.faction) {
        // CR-7: la copia de esa facción en esta partida.
        const targetFaction = await tx.faction.findFirst({ where: { ...(await ambitoFacciones(tx, saveId)), name: npc.faction }, select: { id: true } });
        if (targetFaction) {
          const fact = await recordFactionEvent(tx, worldId, playerFaction.id, targetFaction.id, 'BAJA_DE_GUERRA', saveId);
          if (fact) {
            await tx.logEntry.create({
              data: { saveId, channel: 'WORLD', text: fact, timeLabel: nuevaFictionalDateLabel, fictionalMinutes: nuevoFictionalMinutes, isSystemMessage: true },
            });
          }
        }
      }
    }
  }
  // Muerte permanente (2026-08-31) — fin de tutorial = primer punto de guardado implícito, ver
  // comentario de `Save.tutorialCompletedAt` (schema.prisma). `updateMany` con el guard `null`
  // evita reescribir la fecha si el jugador vuelve a matar a otro "orco-enfurecido-hondonada" más
  // adelante (mismo slug de PLANTILLA, otra aparición) — solo cuenta la primera vez de verdad.
  if (nuevaCondicion === 'MUERTO' && npc.slug === 'orco-enfurecido-hondonada') {
    await tx.save.updateMany({ where: { id: saveId, tutorialCompletedAt: null }, data: { tutorialCompletedAt: new Date() } });
  }
  // Libro de Sucesos (CR-3, hito 0.2): matar es una muerte causada; dejarlo convaleciente, un
  // combate ganado (lo que haga después — rematar, capturar, perdonar — es otro suceso). En combate
  // de grupo el golpe puede ser de un compañero: el autor es el bando del jugador, que lo representa.
  const save = await tx.save.findUnique({ where: { id: saveId }, select: { characterName: true, currentLocationId: true } });
  if (save && (nuevaCondicion === 'MUERTO' || nuevaCondicion === 'CONVALECIENTE')) {
    // CR-11: quién lo vio (para una posible venganza).
    const testigos = nuevaCondicion === 'MUERTO' && save.currentLocationId ? await testigosEnLugar(tx, saveId, worldId, save.currentLocationId, npc.id) : [];
    const actores = [
      { entidadTipo: 'PERSONAJE' as const, entidadId: saveId, papel: 'AUTOR' as const },
      { entidadTipo: 'NPC' as const, entidadId: npc.id, papel: 'VICTIMA' as const },
      ...testigos.map((id) => ({ entidadTipo: 'NPC' as const, entidadId: id, papel: 'TESTIGO' as const })),
    ];
    const comun = { saveId, fictionalMinutes: nuevoFictionalMinutes, regionSlug: activeRegion ? slugify(activeRegion) : null, locationId: save.currentLocationId, origen: 'JUGADOR' as const, actores };
    if (nuevaCondicion === 'MUERTO') {
      await registrarSuceso(tx, { ...comun, tipo: 'MUERTE_CAUSADA', datos: { personaje: save.characterName, victima: npc.name, articuloVictima: npc.articulo ?? null } });
    } else {
      await registrarSuceso(tx, { ...comun, tipo: 'COMBATE_GANADO', datos: { personaje: save.characterName, rival: npc.name, articuloRival: npc.articulo ?? null } });
    }
  }
  return { questCompletedInfo, factionRepChange };
}

/// Despiece/recolección (§ 3.3), extraído de la transacción de `narrateAndPersistTurn` (refactor
/// de deuda técnica 2026-08-13) — solo si la acción tuvo éxito (o no requería tirada). Revalida
/// `harvestMatch` (calculado con `prisma`, ANTES de esta transacción) contra `tx` justo aquí,
/// mismo criterio anti-carrera que crafteo/construcción/saqueo: dos turnos de despiece casi
/// simultáneos sobre el mismo cadáver de fauna no pueden duplicar el botín de un solo cuerpo.
export async function applyHarvest(params: {
  tx: Prisma.TransactionClient;
  harvestMatch: HarvestMatch | null;
  harvestOutcome: 'sin_presa' | 'ya_despiezada' | 'fallo' | 'exito' | null;
  roll: RollResult | null | undefined;
  saveId: string;
  currentLocationId: string | null;
  characterName: string;
}): Promise<{ newInventoryItems: NewInventoryItemInfo[]; createdItemNames: string[]; narrationOverride: string | null }> {
  const { tx, harvestMatch, harvestOutcome, roll, saveId, currentLocationId, characterName } = params;
  const newInventoryItems: NewInventoryItemInfo[] = [];
  const createdItemNames: string[] = [];
  // Solo aplica a fauna (`npcId` presente, el único caso con tope real); los recursos
  // vegetales/minerales no tienen límite de por sí (renovables, por diseño — ver harvest.ts).
  // Bug real (auditoría de bugs 2026-08-21): este guard solo miraba `.saqueado` — para caza en
  // grupo (`NpcState.groupSize` no nulo), `saqueado` nunca se marca por esta vía (ver más abajo,
  // que ahora incrementa `corpsesLooted` en su lugar, mismo criterio que `recolectar.ts`), así que
  // `harvestStillValid` salía SIEMPRE `true` para un grupo — el despiece narrado por texto libre
  // (a diferencia del panel dedicado "Despiece", que sí usa `corpsesLooted`/`groupDefeated` desde
  // el principio) podía repetirse turno tras turno sobre el mismo cadáver ya aprovechado,
  // duplicando materiales sin límite. `hasPendingLoot` (npcScene.ts) es el único punto de verdad
  // ya compartido por recolectar.ts/harvest.ts/panels.ts para este mismo criterio.
  const freshHarvestState =
    harvestMatch?.npcId && harvestMatch.npcKind
      ? await tx.npcState.findUnique({
          where: { saveId_npcId_scope: { saveId, npcId: harvestMatch.npcId, scope: scopeFor(harvestMatch.npcKind, currentLocationId) } },
        })
      : null;
  const harvestStillValid = harvestMatch?.npcId && harvestMatch.npcKind ? hasPendingLoot(freshHarvestState) : true;
  if (harvestMatch && (!roll || roll.success) && harvestStillValid) {
    for (const y of harvestMatch.yields) {
      const created = await tx.inventoryItem.create({
        data: {
          saveId,
          name: y.cantidad > 1 ? `${y.itemName} (${y.cantidad})` : y.itemName,
          description: `Obtenido despiezando/recolectando: ${harvestMatch.sourceName}.`,
          origin: 'despiece/recolección',
          catalogSlug: y.itemSlug,
        },
      });
      // Materia prima cruda — siempre tipo RECURSO por diseño (nunca EQUIPABLE ni ESPECIAL,
      // equipSlot/effectKey siempre null; ver comentario del enum ItemTipo).
      newInventoryItems.push({ ...created, slot: null, equipSlot: null, effectKey: null, tipo: 'RECURSO' });
      createdItemNames.push(created.name);
    }
    // Bug real (auditoría 2026-07-28): sin esto, el mismo cadáver de fauna ya derrotada se podía
    // despiezar sin límite — marca este NpcState como ya aprovechado, para que harvest.ts lo
    // bloquee la próxima vez. Caza en grupo (auditoría 2026-08-21, ver comentario de
    // `harvestStillValid` arriba): un grupo (`groupSize` no nulo) reclama el cadáver actual subiendo
    // `corpsesLooted` en vez de `saqueado` (booleano, solo tiene sentido para 1 individuo) — mismo
    // criterio exacto que ya usa `recolectar.ts` para el panel dedicado de Despiece.
    if (harvestMatch.npcId && harvestMatch.npcKind && harvestMatch.yields.length > 0) {
      const scope = scopeFor(harvestMatch.npcKind, currentLocationId);
      if (freshHarvestState?.groupSize) {
        await tx.npcState.updateMany({
          where: { saveId, npcId: harvestMatch.npcId, scope, corpsesLooted: { lt: freshHarvestState.groupDefeated } },
          data: { corpsesLooted: { increment: 1 } },
        });
      } else {
        await tx.npcState.upsert({
          where: { saveId_npcId_scope: { saveId, npcId: harvestMatch.npcId, scope } },
          create: { saveId, npcId: harvestMatch.npcId, scope, saqueado: true },
          update: { saqueado: true },
        });
      }
    }
  }
  // Narración mentirosa si se pierde la carrera (auditoría 2026-08-06, mismo patrón que loot/
  // build): `harvestOutcome === 'exito'` (antes de esta transacción) ya fijó y emitió en
  // streaming "despieza/recolecta X y consigue: ...", pero `harvestStillValid` (releído con `tx`)
  // puede decir que otro turno casi simultáneo ya se llevó ese mismo cadáver — sin corregir aquí,
  // el jugador vería en su Diario un botín que nunca recibió.
  const narrationOverride =
    harvestOutcome === 'exito' && harvestMatch && !harvestStillValid
      ? `${characterName} rebusca en los restos de ${harvestMatch.sourceName}, pero ya se llevó antes todo lo aprovechable. ${pickFlavor(HARVEST_FLAVOR_YA_DESPIEZADA)}`
      : null;
  return { newInventoryItems, createdItemNames, narrationOverride };
}
