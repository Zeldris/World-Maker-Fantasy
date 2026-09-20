import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { characterSummaryFor } from '../../services/characterSummary.js';
import { advanceFictionalMinutes, formatFictionalDate } from '../../services/worldClock.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import {
  MAX_VUELTAS_MODO_DINAMICO,
  MINUTOS_POR_VUELTA_MODO_DINAMICO,
  resumenModoDinamicoParaLog,
  narrarVueltaGistera,
  respuestaGisteraDesdeOpcion,
  narrarAperturaCombateForzado,
  COMBATE_FORZADO_OPCION_COMBATIR,
  type PendingDynamicMode,
  type DynamicModeTipo,
  type RespuestaGistera,
} from '../../services/dynamicMode.js';
import { narrarVueltaModoDinamico } from '../../services/dynamicModeNarracion.js';
import { aceptarQuest } from './quests.js';
import { detectNpcsInScene } from '../../services/npcScene.js';

/// "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — mini-flujo acotado ofrecido
/// al final de un turno normal (`dynamicModeOffer`, turnResolution.ts), nunca lo interrumpe. Estas
/// 2 rutas son las ÚNICAS que avanzan/cierran la interacción — mismo espíritu que
/// `POST /saves/:id/quests/aceptar`: el motor ya decidió el candidato en el turno normal, esto solo
/// lo materializa, sin volver a pasar por el clasificador de intención de `/turn/narrate`.
///
/// Mismo título/descripción que `turnResolution.ts` usa para el gancho de texto libre — reconocido
/// por `quests.ts` § `ORCO_ENFURECIDO_QUEST_SLUG` sin importar de qué camino vino la oferta.
const ORCO_ENFURECIDO_QUEST_TITLE = 'Acabar con el Orco Enfurecido';
const ORCO_ENFURECIDO_QUEST_DESCRIPTION =
  'Gistera Koh, expulsada del Clan Serhu, pide ayuda para acabar con el guerrero que la persigue. Aceptar la pondría a salvo.';

/// Bug real jugando en vivo (2026-09-09, ver memoria `tarkor_hallazgo_dialogo_gistera_sin_persistir`):
/// "Interactuar" nunca pasa por `turnResolution.ts`, así que cerrar una conversación con un NPC no
/// dejaba NINGÚN rastro determinista — ni `SessionFact` (el NPC quedaba "ausente de escena" para
/// turnos de texto libre posteriores) ni, en el caso de Gistera Koh, la oferta de su misión
/// principal (que solo se generaba desde el gancho hardcodeado de `turnResolution.ts`, incompatible
/// con este camino). Fix en 2 partes, solo al CERRAR la conversación (`turno.cierra`) y solo para
/// tipo 'NPC' (FAUNA/RECURSO no tienen este problema — nunca quedan "ausentes" de la misma forma,
/// no hay ningún gancho de misión esperándolos):
/// 1. Genérico, cualquier NPC: un SessionFact con su nombre, para que `detectNpcsInScene` lo
///    reconozca como conocido en turnos futuros (mismo criterio que `matchNpcAliases`, ver
///    `npcScene.ts` — basta con que el texto contenga su nombre).
/// 2. Caso especial Gistera Koh (decisión explícita del usuario, 2026-09-09: "cambiemos los
///    mensajes deterministas para que cuadre con interactuar... y siga siendo un encuentro dinámico,
///    con presentación y oferta"): si la conversación con ella se cierra y todavía no existe la
///    Quest del Orco Enfurecido, se genera `pendingQuestOfferInfo` igual que el gancho de texto
///    libre — el jugador sigue viendo los botones Aceptar/Cancelar de siempre (quests.ts ya es
///    100% idempotente y no le importa de qué camino vino la oferta).
/// SessionFact fuera de la transacción a propósito (mismo criterio que `recolectar.ts` línea
/// ~1103: `appendSessionFacts` llama a Ollama para el embedding, nunca dentro de una transacción de
/// Prisma) — se llama DESPUÉS de que `persistirCierreNpcEnTransaccion` ya confirmó.
///
/// `DiscoveredEntity` (2026-09-09, generalización del nombre oculto — Álvaro: "esta lógica se debe
/// aplicar a todos los que tienen nombre propio") — conversar con un NPC vía Interactuar es una
/// señal de presencia real tan válida como `npcsInScene` del turno normal (`recordEntityDiscoveries`,
/// entityDiscovery.ts), pero ese escaneo nunca corre en este camino (Interactuar no pasa por
/// `turnResolution.ts`). Sin esto, un NPC PRINCIPAL seguiría mostrándose oculto en el mapa/colisión
/// para siempre aunque el jugador ya hubiera hablado con él — `upsert` porque puede ya estar CITADO
/// (mención previa en prosa) y esto lo sube a DESCUBIERTO, o no existir fila todavía.
/// Hallazgo 47 (revisar-partida-hallazgos.md, 2026-09-15): antes una sola función hacía las dos
/// escrituras (`discoveredEntity.upsert` + `appendSessionFacts`) SIEMPRE fuera de la transacción
/// que cierra la conversación — si esa llamada fallaba o el proceso moría justo ahí, la
/// conversación ya quedaba cerrada/persistida en el log pero el NPC nunca se marcaba DESCUBIERTO.
/// Separada en dos piezas: `marcarNpcConocidoRapido` (solo el upsert, rápido, sin red — puede vivir
/// DENTRO de la transacción de cierre) y `registrarNpcConocidoSessionFact` (embebido real vía
/// `embed()`, servicio externo potencialmente lento — se queda fuera a propósito, nunca dentro de
/// una transacción Postgres). La ventana de riesgo real que queda es mucho más estrecha: solo el
/// sessionFact narrativo (recuperable, no bloquea nada mecánico) puede perderse, nunca la marca de
/// "descubierto" que decide visibilidad en el mapa.
async function marcarNpcConocidoRapido(tx: Prisma.TransactionClient, saveId: string, targetSlug: string): Promise<void> {
  await tx.discoveredEntity.upsert({
    where: { saveId_entityType_entitySlug: { saveId, entityType: 'npc', entitySlug: targetSlug } },
    create: { saveId, entityType: 'npc', entitySlug: targetSlug, fase: 'DESCUBIERTO' },
    update: { fase: 'DESCUBIERTO' },
  });
}

async function registrarNpcConocidoSessionFact(saveId: string, targetName: string): Promise<void> {
  const sessionFacts = await loadSessionFacts(saveId);
  await appendSessionFacts(saveId, sessionFacts, [`${targetName} conversa con el personaje.`]);
}

/// Solo se llama para el camino GENÉRICO de modo dinámico (LLM) — mismo criterio previo a
/// 2026-09-09, ahora acotado explícitamente a "no Gistera" en el caller. Gistera ya NO ofrece
/// (`pendingQuestOfferInfo`, exige una segunda confirmación por botones): su guion determinista
/// SABE con certeza que el jugador aceptó, así que crea la Quest de verdad (`aceptarQuest`,
/// quests.ts) directamente al cerrar — ver el bloque dedicado más abajo en `/responder`.
async function persistirCierreNpcEnTransaccion(
  tx: Prisma.TransactionClient,
  saveId: string,
  targetSlug: string,
): Promise<{ pendingQuestOfferInfo: { title: string; description: string } | null }> {
  if (targetSlug !== 'gistera-koh') return { pendingQuestOfferInfo: null };
  // Alcanzable solo si algún caller futuro reintroduce Gistera por el camino genérico — hoy nunca
  // ocurre (interceptada en ambas rutas antes de llegar aquí), documentado por seguridad.
  return { pendingQuestOfferInfo: null };
}

/// Combate directo desde Interactuar (2026-09-20, "todo debe saltar el interactuar, incluido un
/// agresivo" — hasta ahora un AGRESIVO en Zona solo dejaba un aviso de texto, el combate real
/// esperaba a que el jugador escribiera algo en su siguiente turno de texto libre y
/// `shouldForceCombat` lo detectara, `turnResolution.ts`). Reutiliza `detectNpcsInScene` (mismo
/// filtro real de presencia/momento del día/núcleo jugable que ya usa el resto del motor) en vez de
/// reconstruir el shape de `combateIniciado` a mano. Escribe `Save.pendingCombatNpcSlugs` directo
/// (mismo campo que lee `GameView.tsx`/`GET /saves/:id` para abrir CombatPanel), sin pasar por
/// `CombatEncounter` (innecesario para un 1v1 simple, ver `cazar.ts` § caza en grupo para el patrón
/// equivalente cuando sí hace falta).
///
/// Bug real jugando en vivo (2026-09-20, verificación tras implementar esto: "Ese encuentro ya no
/// está disponible aquí" al pulsar Combatir) — `targetName` que llega del body puede ser el nombre
/// OCULTO genérico (`NOMBRE_OCULTO_GENERICO`, "Alguien") si el NPC todavía no está `DiscoveredEntity`
/// (ej. el Orco Enfurecido, siempre así la primera vez que se le colisiona): usarlo como `action`
/// para el match de alias de `detectNpcsInScene` nunca podía coincidir con sus alias reales, así que
/// el NPC — pese a ser `kind: 'PRINCIPAL'` y por tanto ya candidato plausible — nunca pasaba el
/// filtro de "mencionado". Se resuelve el nombre REAL por `targetSlug` antes de construir `action`.
async function abrirCombateForzadoDesdeInteractuar(
  save: { id: string; worldId: string; currentLocationId: string | null },
  targetSlug: string,
  targetName: string,
  fictionalMinutes: number,
) {
  const npcCatalogo = await prisma.npc.findFirst({ where: { worldId: save.worldId, slug: targetSlug }, select: { name: true } });
  const sessionFacts = await loadSessionFacts(save.id);
  const npcsInScene = await detectNpcsInScene({
    action: npcCatalogo?.name ?? targetName,
    worldId: save.worldId,
    sessionFacts,
    saveId: save.id,
    currentLocationId: save.currentLocationId,
    fictionalMinutes,
  });
  const target = npcsInScene.find((n) => n.slug === targetSlug);
  if (!target || target.condicionFisica === 'MUERTO') return null;
  await prisma.save.update({ where: { id: save.id }, data: { pendingCombatNpcSlugs: [targetSlug] } });
  return {
    npcs: [
      {
        slug: target.slug,
        name: target.name,
        condicionFisica: target.condicionFisica,
        saqueado: target.saqueado,
        lootedItemNames: target.lootedItemNames,
        analizado: target.analizado,
        capturable: target.capturable,
        activeEffects: target.activeEffects,
        targetedForKill: target.targetedForKill,
      },
    ],
  };
}

export async function dynamicModeRoutes(app: FastifyInstance) {
  /// Primera vuelta — el jugador pulsó "Interactuar" sobre la oferta que ya vio en el `done` del
  /// turno anterior. `tipo`/`targetName` vienen del body (mismo criterio que `quests/aceptar`
  /// recibe `title`/`description`: el frontend reenvía lo que YA le devolvió el turno, sin que el
  /// backend tenga que recalcular el candidato aquí).
  app.post<{
    Params: { id: string };
    Body: { tipo: DynamicModeTipo; targetSlug: string; targetName: string; quienInicia?: 'jugador' | 'npc'; combateForzado?: boolean };
  }>('/saves/:id/modo-dinamico/interactuar', async (request, reply) => {
      const { tipo, targetSlug, targetName, quienInicia, combateForzado } = request.body;
      if (!tipo || !targetSlug || !targetName?.trim()) {
        return reply.status(400).send({ error: 'Faltan campos: tipo, targetSlug, targetName' });
      }
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;
      if (save.pendingDynamicMode) {
        return reply.status(409).send({ error: 'Ya hay un modo dinámico en curso' });
      }

      const fictionalMinutesActuales0 = save.worldState?.fictionalMinutes ?? 480;

      // AGRESIVO/ENEMIGO (2026-09-20, "todo debe provocar el interactuar, incluido un agresivo") —
      // bifurcación ANTES de cualquier narración: si el NPC/fauna vio primero al jugador
      // (`quienInicia: 'npc'`), no hay nada que elegir — combate directo, sin `pendingDynamicMode`
      // de por medio. Si el jugador lo vio primero, sí hay elección real (ver más abajo, tras
      // narrar la apertura con `narrarAperturaCombateForzado`) — la rama de "npc" se resuelve aquí
      // mismo porque no necesita ninguna narración previa, el combate ya empieza.
      if (combateForzado && quienInicia === 'npc') {
        const combate = await abrirCombateForzadoDesdeInteractuar(save, targetSlug, targetName, fictionalMinutesActuales0);
        if (!combate) {
          return reply.status(400).send({ error: 'Ese encuentro ya no está disponible aquí.' });
        }
        return { narration: '', opciones: [], cierra: true, vuelta: 1, timeLabel: formatFictionalDate(fictionalMinutesActuales0), newQuestOfferInfo: null, combate };
      }

      const esGistera = targetSlug === 'gistera-koh';

      // Bug real jugando en vivo (2026-08-27, "hay que darle mucho más contenido determinista
      // para que no invente" — el LLM narraba lugares/hechos que no existen, ej. una "Isla
      // Cambiante" inventada de la nada): sin esto, narrarVueltaModoDinamico solo recibía el
      // resumen del PERSONAJE, nunca datos reales de con quién/dónde ocurre la interacción.
      // Omitido para Gistera (2026-09-09) — su guion es 100% determinista, no necesita bio/Location
      // porque no hay LLM al que dárselos.
      const [targetNpc, currentLocation] = esGistera
        ? [null, null]
        : await Promise.all([
            prisma.npc.findFirst({ where: { worldId: save.worldId, slug: targetSlug }, select: { bio: true } }),
            save.currentLocationId
              ? prisma.location.findUnique({ where: { id: save.currentLocationId }, select: { name: true, description: true } })
              : null,
          ]);

      const characterSummary = characterSummaryFor(save);
      // AGRESIVO/ENEMIGO, el jugador lo vio primero (2026-09-20) — texto fijo determinista
      // ofreciendo Combatir/Huir (ver `narrarAperturaCombateForzado`, dynamicMode.ts), nunca
      // conversación LLM ni el guion de Gistera (ella nunca es AGRESIVO/ENEMIGO por diseño).
      const turno = combateForzado
        ? narrarAperturaCombateForzado(targetName)
        : esGistera
          ? narrarVueltaGistera(1, null)
          : // Guion determinista de Gistera Koh (2026-09-09, ver comentario de `narrarVueltaGistera`,
            // dynamicMode.ts — bug real: "ya no estamos usando los mensajes deterministas... y qué
            // tiene que ver el tótem con ella") — cero llamadas a Ollama, texto fijo revisado por Álvaro.
            await narrarVueltaModoDinamico({
              tipo,
              targetName,
              vuelta: 1,
              maxVueltas: MAX_VUELTAS_MODO_DINAMICO,
              characterSummary,
              respuestaJugador: null,
              targetBio: targetNpc?.bio ?? null,
              locationContext: currentLocation,
              quienInicia,
            });

      const fictionalMinutesActuales = save.worldState?.fictionalMinutes ?? 480;
      const nuevoFictionalMinutes = advanceFictionalMinutes(fictionalMinutesActuales, MINUTOS_POR_VUELTA_MODO_DINAMICO);
      const nuevaFictionalDateLabel = formatFictionalDate(nuevoFictionalMinutes);

      // `pendingDynamicMode.targetName` es SIEMPRE el nombre real, interno (usado por
      // `marcarNpcConocido`/persistencia) — nunca se muestra directamente en el modal (que solo
      // pinta `narration`/`opciones`, ver DynamicModeModal.tsx), así que no necesita ocultarse aquí.
      // El nombre oculto (`NOMBRE_OCULTO_GENERICO`, dynamicMode.ts § servicio) solo aplica a la
      // TARJETA de oferta previa (`pendingDynamicModeOffer`) y a la colisión de Zona — los dos
      // sitios donde el nombre real puede llegar a la UI antes de que el NPC se presente.
      const historialNarracion = [turno.narration];
      const pendingDynamicMode: PendingDynamicMode | null = turno.cierra
        ? null
        : {
            tipo,
            targetSlug,
            targetName,
            vuelta: 1,
            iniciadoAtMinutes: fictionalMinutesActuales,
            narration: turno.narration,
            opciones: turno.opciones,
            targetBio: targetNpc?.bio ?? null,
            locationContext: currentLocation,
            historialNarracion,
            ...(combateForzado ? { combateForzado: true as const } : {}),
          };

      const pendingQuestOfferInfo = await prisma.$transaction(async (tx) => {
        await tx.save.update({
          where: { id: save.id },
          // Bug real 2026-08-28 ("oferta de modo dinámico no sobrevive a una recarga") — al pulsar
          // "Interactuar" la oferta ya se resolvió, se limpia `pendingDynamicModeOffer` a la vez que
          // se escribe `pendingDynamicMode` (la conversación ya en curso).
          data: {
            pendingDynamicMode: pendingDynamicMode ? (pendingDynamicMode as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            pendingDynamicModeOffer: Prisma.JsonNull,
          },
        });
        await tx.worldState.update({
          where: { saveId: save.id },
          data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: nuevaFictionalDateLabel },
        });
        // Franja 0 (2026-09-08) — si el LLM cierra ya en la primera vuelta, se vuelca igual: nunca
        // debe perderse una conversación sin dejar rastro en el log, ni siquiera de una vuelta.
        if (turno.cierra) {
          await tx.logEntry.create({
            data: {
              saveId: save.id,
              channel: 'CHARACTER' as const,
              text: resumenModoDinamicoParaLog(historialNarracion),
              timeLabel: nuevaFictionalDateLabel,
              fictionalMinutes: nuevoFictionalMinutes,
            },
          });
        }
        if (turno.cierra && tipo === 'NPC') {
          await marcarNpcConocidoRapido(tx, save.id, targetSlug);
          const { pendingQuestOfferInfo } = await persistirCierreNpcEnTransaccion(tx, save.id, targetSlug);
          return pendingQuestOfferInfo;
        }
        return null;
      });
      if (turno.cierra && tipo === 'NPC') {
        await registrarNpcConocidoSessionFact(save.id, targetName);
      }

      return {
        narration: turno.narration,
        opciones: turno.opciones,
        cierra: turno.cierra,
        vuelta: 1,
        timeLabel: nuevaFictionalDateLabel,
        newQuestOfferInfo: pendingQuestOfferInfo,
      };
    },
  );

  /// Vueltas siguientes — el jugador ya eligió una de las `opciones` de la vuelta anterior.
  app.post<{ Params: { id: string }; Body: { respuesta: string } }>('/saves/:id/modo-dinamico/responder', async (request, reply) => {
    const { respuesta } = request.body;
    if (!respuesta?.trim()) {
      return reply.status(400).send({ error: 'Falta el campo: respuesta' });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const pending = save.pendingDynamicMode as unknown as PendingDynamicMode | null;
    if (!pending) {
      return reply.status(409).send({ error: 'No hay ningún modo dinámico en curso' });
    }

    // AGRESIVO/ENEMIGO, el jugador ya eligió (2026-09-20) — "Combatir" abre combate directo
    // (mismo mecanismo que el caso `quienInicia: 'npc'` de `/interactuar`, el jugador ataca con
    // ventaja por haberlo visto primero); "Huir" cierra sin combate, gratis (decisión explícita de
    // Álvaro: la tirada de "quién ve a quién" ya decidió si hay elección, huir en sí no vuelve a
    // tirar dados). Cualquier otra respuesta se trata como huida — nunca se cuelga esperando texto
    // que este modal no ofrece.
    if (pending.combateForzado) {
      await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicMode: Prisma.JsonNull } });
      if (respuesta === COMBATE_FORZADO_OPCION_COMBATIR) {
        const fictionalMinutesActuales = save.worldState?.fictionalMinutes ?? 480;
        const combate = await abrirCombateForzadoDesdeInteractuar(save, pending.targetSlug, pending.targetName, fictionalMinutesActuales);
        if (!combate) {
          return reply.status(400).send({ error: 'Ese encuentro ya no está disponible aquí.' });
        }
        return { narration: '', opciones: [], cierra: true, vuelta: pending.vuelta + 1, timeLabel: formatFictionalDate(fictionalMinutesActuales), newQuestOfferInfo: null, combate };
      }
      const nuevoFictionalMinutes = advanceFictionalMinutes(save.worldState?.fictionalMinutes ?? 480, MINUTOS_POR_VUELTA_MODO_DINAMICO);
      const timeLabel = formatFictionalDate(nuevoFictionalMinutes);
      const text = `${save.characterName} logra alejarse de ${pending.targetName} sin que llegue a haber combate.`;
      await prisma.$transaction([
        prisma.worldState.update({ where: { saveId: save.id }, data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: timeLabel } }),
        prisma.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes: nuevoFictionalMinutes, isPlayerAction: false, isSystemMessage: true } }),
      ]);
      return { narration: text, opciones: [], cierra: true, vuelta: pending.vuelta + 1, timeLabel, newQuestOfferInfo: null };
    }

    const esGistera = pending.targetSlug === 'gistera-koh';
    const characterSummary = characterSummaryFor(save);
    // "Preguntar más antes de decidir" recicla la presentación (misma vuelta lógica, ver
    // `narrarVueltaGistera`) — no avanza el contador `vuelta` para que una recarga (F5) a mitad no
    // salte a un desenlace que nunca ocurrió. El resto de respuestas SÍ avanza como siempre.
    const respuestaGistera = esGistera ? respuestaGisteraDesdeOpcion(respuesta) : null;
    const siguienteVuelta = esGistera && respuestaGistera === 'preguntar' ? pending.vuelta : pending.vuelta + 1;
    const turno = esGistera
      ? narrarVueltaGistera(siguienteVuelta, respuestaGistera)
      : await narrarVueltaModoDinamico({
          tipo: pending.tipo,
          targetName: pending.targetName,
          vuelta: siguienteVuelta,
          maxVueltas: MAX_VUELTAS_MODO_DINAMICO,
          characterSummary,
          respuestaJugador: respuesta,
          // Contexto real resuelto en la primera vuelta (2026-08-27, ver comentario de
          // PendingDynamicMode) — reutilizado tal cual, nunca re-consultado.
          targetBio: pending.targetBio,
          locationContext: pending.locationContext,
        });

    const fictionalMinutesActuales = save.worldState?.fictionalMinutes ?? 480;
    const nuevoFictionalMinutes = advanceFictionalMinutes(fictionalMinutesActuales, MINUTOS_POR_VUELTA_MODO_DINAMICO);
    const nuevaFictionalDateLabel = formatFictionalDate(nuevoFictionalMinutes);

    // Franja 0 (2026-09-08) — partidas ya en curso antes de esta migración pueden no tener
    // `historialNarracion` todavía (campo nuevo en un Json sin migración de esquema); se reconstruye
    // con la última vuelta conocida en vez de perder el historial anterior por completo.
    const historialPrevio = pending.historialNarracion ?? [pending.narration];
    const historialNarracion = [...historialPrevio, turno.narration];
    const pendingDynamicMode: PendingDynamicMode | null = turno.cierra
      ? null
      : { ...pending, vuelta: siguienteVuelta, narration: turno.narration, opciones: turno.opciones, historialNarracion };

    const pendingQuestOfferInfo = await prisma.$transaction(async (tx) => {
      await tx.save.update({
        where: { id: save.id },
        data: { pendingDynamicMode: pendingDynamicMode ? (pendingDynamicMode as unknown as Prisma.InputJsonValue) : Prisma.JsonNull },
      });
      await tx.worldState.update({
        where: { saveId: save.id },
        data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: nuevaFictionalDateLabel },
      });
      if (turno.cierra) {
        await tx.logEntry.create({
          data: {
            saveId: save.id,
            channel: 'CHARACTER' as const,
            text: resumenModoDinamicoParaLog(historialNarracion),
            timeLabel: nuevaFictionalDateLabel,
            fictionalMinutes: nuevoFictionalMinutes,
          },
        });
      }
      if (turno.cierra && pending.tipo === 'NPC') {
        await marcarNpcConocidoRapido(tx, save.id, pending.targetSlug);
        const { pendingQuestOfferInfo } = await persistirCierreNpcEnTransaccion(tx, save.id, pending.targetSlug);
        return pendingQuestOfferInfo;
      }
      return null;
    });
    if (turno.cierra && pending.tipo === 'NPC') {
      await registrarNpcConocidoSessionFact(save.id, pending.targetName);
    }

    // Gistera Koh, aceptación real (2026-09-09, bug real jugando en vivo — Álvaro: "al acabar de
    // interactuar me sale para aceptar la misión otra vez... como ya aceptamos esto no debería
    // salir... solo un log al final... que confirme que la misión se ha aceptado") — a diferencia
    // del resto de NPC (que solo OFRECEN la misión, exigiendo una segunda confirmación por
    // botones), Gistera ya sabe con certeza que el jugador aceptó dentro de la propia conversación:
    // crea la Quest DIRECTAMENTE aquí (`aceptarQuest`, mismo camino que usa el botón "Aceptar" de
    // la tarjeta amarilla, extraído a función reutilizable) — nunca devuelve `newQuestOfferInfo`,
    // así que ningún botón adicional llega a pintarse. Fuera de la transacción de arriba a
    // propósito (mismo motivo que la ruta HTTP de quests.ts: `aceptarQuest` narra con Ollama y
    // gestiona su propia transacción interna).
    let questAceptada: Awaited<ReturnType<typeof aceptarQuest>> | null = null;
    if (turno.cierra && esGistera && respuestaGistera === 'aceptar') {
      questAceptada = await aceptarQuest(save, ORCO_ENFURECIDO_QUEST_TITLE, ORCO_ENFURECIDO_QUEST_DESCRIPTION);
    }

    return {
      narration: turno.narration,
      opciones: turno.opciones,
      cierra: turno.cierra,
      vuelta: siguienteVuelta,
      timeLabel: nuevaFictionalDateLabel,
      newQuestOfferInfo: pendingQuestOfferInfo,
      // Reutiliza el mismo campo que ya consume el frontend tras pulsar "Aceptar" en la tarjeta
      // amarilla (ver AbilityForm/GameView § handleAceptarMision) — la Quest ya nace ACTIVA, así
      // que el jugador solo ve la confirmación, nunca un botón que pedirle pulsar de nuevo.
      questAceptada,
    };
  });

  /// Botón "Ignorar" (oferta sin aceptar) / "Salir" (conversación ya en curso) — dos usos del mismo
  /// endpoint. Para la oferta sin aceptar (bug real 2026-08-28, ver `pendingDynamicModeOffer` en
  /// schema.prisma) ahora SÍ hay algo que limpiar en la BD — antes no se persistía nada hasta
  /// Interactuar, así que "Ignorar" era un no-op real. Para una conversación YA en curso (checklist
  /// frontend 2026-08-27, B.5 — "el único modal de elección de la app sin vía de escape") sigue
  /// limpiando `pendingDynamicMode`, para que el jugador pueda abandonarla en cualquier vuelta sin
  /// esperar a que el LLM decida cerrarla él solo.
  app.post<{ Params: { id: string } }>('/saves/:id/modo-dinamico/ignorar', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        endedAt: true,
        pendingDeathResolution: true,
        pendingDynamicMode: true,
        pendingDynamicModeOffer: true,
        worldState: { select: { fictionalMinutes: true, fictionalDateLabel: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (save.pendingDynamicMode || save.pendingDynamicModeOffer) {
      // Franja 0 (2026-09-08) — "Salir" de una conversación YA en curso también debe dejar rastro
      // en el log (antes se perdía igual que un cierre por `cierra: true`); "Ignorar" una oferta sin
      // abrir (pendingDynamicMode null) no tiene nada que narrar, no crea ningún LogEntry.
      const pending = save.pendingDynamicMode as unknown as PendingDynamicMode | null;
      const historialNarracion = pending?.historialNarracion ?? (pending ? [pending.narration] : null);

      // Salir a medias (nunca llegó a `cierra` real del LLM) SÍ deja al NPC "conocido" en escena
      // (mismo fix genérico de arriba), pero NUNCA dispara la oferta de misión de Gistera — su
      // aceptación es obligatoria en la trama (decisión explícita del usuario, 2026-09-09), así
      // que abandonar la conversación a medias no puede contar como si ya hubiera "formulado la
      // petición" del todo. Solo el cierre natural (`turno.cierra`, rutas de arriba) la ofrece.
      //
      // Excepción para Gistera (2026-09-09, nombre oculto generalizado) — salir en la VUELTA 1
      // (avistamiento, todavía sin nombre) no debe marcarla como descubierta: nunca llegó a
      // presentarse, así que su nombre real seguiría siendo un spoiler. Desde la vuelta 2 en
      // adelante (la presentación ya se narró) sí cuenta como conocida, igual que cualquier otro NPC.
      const gisteraSinPresentarTodavia = pending?.targetSlug === 'gistera-koh' && pending.vuelta < 2;
      const marcaComoConocido = pending && pending.tipo === 'NPC' && !gisteraSinPresentarTodavia;

      // Bug real jugando en vivo (2026-09-15, hallazgo Álvaro: "cerrar el modal de Interactuar no
      // deja rastro en el log") — el LogEntry SÍ se creaba aquí, pero esta ruta solo devolvía
      // `{ ok: true }`: el frontend (`handleSalirDynamicMode`, GameView.tsx) nunca lo recibía para
      // insertarlo en `characterLog`, así que la conversación desaparecía visualmente aunque
      // estuviera bien persistida. Se captura el resultado de la creación (si hubo) para devolverlo.
      //
      // Hallazgo 47 (2026-09-15) — convertida de `$transaction([...])` (batch de escrituras) a
      // callback para poder meter `marcarNpcConocidoRapido` DENTRO, atómico con el cierre.
      const logEntryCreado = await prisma.$transaction(async (tx) => {
        await tx.save.update({
          where: { id: save.id },
          data: { pendingDynamicMode: Prisma.JsonNull, pendingDynamicModeOffer: Prisma.JsonNull },
        });
        if (marcaComoConocido) {
          await marcarNpcConocidoRapido(tx, save.id, pending!.targetSlug);
        }
        if (!historialNarracion) return null;
        return tx.logEntry.create({
          data: {
            saveId: save.id,
            channel: 'CHARACTER' as const,
            text: resumenModoDinamicoParaLog(historialNarracion),
            timeLabel: save.worldState?.fictionalDateLabel ?? '',
            fictionalMinutes: save.worldState?.fictionalMinutes ?? 0,
          },
        });
      });
      if (marcaComoConocido) {
        await registrarNpcConocidoSessionFact(save.id, pending!.targetName);
      }
      if (logEntryCreado) {
        return {
          ok: true,
          logEntry: {
            id: logEntryCreado.id,
            text: logEntryCreado.text,
            timeLabel: logEntryCreado.timeLabel,
            createdAt: logEntryCreado.createdAt.toISOString(),
          },
        };
      }
    }
    return { ok: true, logEntry: null };
  });
}
