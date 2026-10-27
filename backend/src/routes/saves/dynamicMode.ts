import { entityTypeDeSerVivo, FUENTES_DE_CATALOGO } from '../../services/entityDiscovery.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath, toFrontendLogEntry } from './shared.js';
import { characterSummaryFor } from '../../services/characterSummary.js';
import { advanceFictionalMinutes, formatFictionalDate } from '../../services/worldClock.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import { deNombre, nombreDeEncuentro, nombreVisibleDeNpc, aNombre,
  MAX_VUELTAS_MODO_DINAMICO,
  MINUTOS_POR_VUELTA_MODO_DINAMICO,
  resumenModoDinamicoParaLog,
  narrarVueltaGistera,
  narrarReencuentroGistera,
  gisteraYaLoContoAntes,
  respuestaGisteraDesdeOpcion,
  narrarAperturaCombateForzado,
  COMBATE_FORZADO_OPCION_COMBATIR,
  type PendingDynamicMode,
  type DynamicModeTipo,
} from '../../services/dynamicMode.js';
import { narrarVueltaModoDinamico } from '../../services/dynamicModeNarracion.js';
import { aceptarQuest, ORCO_ENFURECIDO_QUEST_SLUG } from './quests.js';
import { detectNpcsInScene } from '../../services/npcScene.js';
import { abrirCombateDePersonas, grupoDePersona } from '../../services/combatePersonas.js';
import { iniciarCaza, accionEnDiarioDeCaza, type CazaTarget, type TiradaGrupoInfo, type CombateGrupoLogRoll, type TiradaCazaLimpia } from '../../services/caza.js';
import type { AttributeBlock, RollResult } from '../../services/dice.js';
import { tiradaDeHuida } from '../../services/tiradaDeHuida.js';
import { guardarSlugsDeCombate } from '../../services/combateDesde.js';
import { datosDeHuidaDeZona } from '../../services/entradasZona.js';

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
  const entityType = entityTypeDeSerVivo(targetSlug, FUENTES_DE_CATALOGO);
  await tx.discoveredEntity.upsert({
    where: { saveId_entityType_entitySlug: { saveId, entityType, entitySlug: targetSlug } },
    create: { saveId, entityType, entitySlug: targetSlug, fase: 'DESCUBIERTO' },
    update: { fase: 'DESCUBIERTO' },
  });
}

/// P324: corre DESPUÉS de la transacción que ya cerró la conversación, así que si el embebido (Ollama
/// lento, colgado o sin cuota) lanzaba, la ruta contestaba 500 con el cierre ya confirmado: «Salir» no
/// parecía cerrar y el reintento daba 409 («No hay ningún modo dinámico en curso»). El hecho de sesión
/// es solo contexto narrativo recuperable (nada mecánico depende de él), así que su fallo se anota y
/// no tumba la respuesta.
async function registrarNpcConocidoSessionFact(saveId: string, targetName: string): Promise<void> {
  try {
    const sessionFacts = await loadSessionFacts(saveId);
    await appendSessionFacts(saveId, sessionFacts, [`${targetName} conversa con el personaje.`]);
  } catch (err) {
    console.warn(`[modo-dinamico] no se pudo guardar el hecho de sesión de ${targetName} (save ${saveId}):`, err instanceof Error ? err.message : err);
  }
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
  save: { id: string; worldId: string; currentLocationId: string | null; characterName: string; level: number; attributes: Prisma.JsonValue },
  targetSlug: string,
  targetName: string,
  fictionalMinutes: number,
  // Agresivo en grupo (Fase 2, 2026-09-28, `plan-mecanicas-por-zona-2026-09-28.md`) — id/cantidad
  // del `ZonePoint` colisionado, presentes solo cuando la oferta forzada viene de un grupo de
  // FAUNA real (ver `dynamicModeOffer.zonePointId`/`cantidad`, zona.ts). Con `cantidad > 1` el 1v1
  // clásico de abajo queda descartado — "un agresivo que te corta el paso nunca se resuelve
  // sigiloso": todo el grupo entra a combate múltiple vía `iniciarCaza`, `permitirCazaLimpia:
  // false` a propósito (la caza limpia mataría a un único individuo sin combate, justo lo que este
  // caso debe evitar siempre).
  zonePointId?: string,
  cantidad?: number,
  /// P90: el grupo vio antes a la jugadora (`quienInicia: 'npc'`); ella no eligió atacar.
  emboscada = false,
): Promise<{ combate: ReturnType<typeof combateNpcShape> } | { actionText: string; accionEnDiario?: string | null; tiradasGrupo?: TiradaGrupoInfo[]; combateGrupoLogEntry?: { id: string; text: string; timeLabel: string; createdAt: string; roll: CombateGrupoLogRoll | TiradaCazaLimpia } } | null> {
  // CR-49: una persona con banda o con los suyos cerca no pelea sola — combate de varios con todos,
  // y el turno siguiente (con `actionText`) lo lleva el motor de grupo, como la caza en grupo.
  const persona = await prisma.npc.findFirst({
    where: { slug: targetSlug, raza: { not: null }, OR: [{ worldId: save.worldId, saveId: null }, { saveId: save.id }] },
    select: { id: true, slug: true, kind: true, faction: true, raza: true, attributes: true, name: true },
  });
  // Muerta o convaleciente no abre combate de grupo (el 1v1 de abajo ya lo descarta).
  const estadoPersona = persona ? await prisma.npcState.findFirst({ where: { saveId: save.id, npcId: persona.id }, select: { condicionFisica: true, muerto: true } }) : null;
  const personaEnPie = !!persona && !estadoPersona?.muerto && estadoPersona?.condicionFisica !== 'MUERTO' && estadoPersona?.condicionFisica !== 'CONVALECIENTE';
  if (persona && personaEnPie) {
    const grupo = await grupoDePersona(prisma, { saveId: save.id, worldId: save.worldId, locationId: save.currentLocationId, objetivo: persona });
    if (grupo.length > 1) {
      const abierto = await abrirCombateDePersonas(
        prisma,
        { id: save.id, characterName: save.characterName, attributes: save.attributes as AttributeBlock, fictionalMinutes, timeLabel: formatFictionalDate(fictionalMinutes) },
        grupo,
      );
      if (!abierto) return null;
      await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull, pendingDynamicMode: Prisma.JsonNull } });
      // P327: un PRINCIPAL aún desconocido no se identifica por abrirse el combate (ver abajo).
      const visiblePersona = await nombreVisibleDeNpc(prisma, save.id, persona);
      if (!visiblePersona.oculto) await recordEntityDiscoveries({ saveId: save.id, worldId: save.worldId, mentionedText: persona.name, npcSlugsInScene: [persona.slug] });
      // P90: si la vieron antes ellos, es una emboscada, no una acción suya (sin línea en el diario; lo
      // cuenta la narración). Mismo formato que la caza (`accionEnDiarioDeCaza`). Revisión P327: la acción
      // (que el turno casa por nombre) lleva el real; la línea del diario, el que conoce Gorhorn.
      const actionText = emboscada ? `Me defiendo de '${persona.name}' y de los suyos, que me tienden una emboscada.` : `Me enfrento a ${persona.name} y a los suyos.`;
      const enDiario = visiblePersona.oculto ? `Me enfrento ${aNombre(visiblePersona.nombre)} y a los suyos.` : actionText;
      return { actionText, accionEnDiario: emboscada ? accionEnDiarioDeCaza(actionText) : enDiario };
    }
  }

  if (zonePointId && cantidad != null && cantidad > 1) {
    const puntoBruto = await prisma.zonePoint.findUnique({ where: { id: zonePointId } });
    const punto = puntoBruto && puntoBruto.saveId === save.id ? puntoBruto : null;
    const npcCatalogoGrupo = punto ? await prisma.npc.findFirst({ where: { worldId: save.worldId, slug: punto.targetSlug } }) : null;
    if (!punto || !punto.activo || punto.cantidad <= 0 || !npcCatalogoGrupo) return null;
    const targets: CazaTarget[] = [{ npc: npcCatalogoGrupo, cantidadObjetivo: punto.cantidad, zonePointId: punto.id }];
    const resultado = await iniciarCaza({
      save: {
        id: save.id,
        worldId: save.worldId,
        characterName: save.characterName,
        level: save.level,
        attributes: save.attributes as AttributeBlock,
        currentLocationId: save.currentLocationId,
        region: null,
        fictionalMinutes,
      },
      targets,
      permitirCazaLimpia: false,
      emboscada,
    });
    if ('error' in resultado) return null;
    // `permitirCazaLimpia: false` descarta la rama de caza limpia — `resultado.resuelveSinCombate`
    // nunca debería ser `true` aquí (shape distinto, sin `analizado`/`capturable`/...), pero el
    // tipo de `iniciarCaza` lo contempla; se cubre por seguridad con un cast explícito, nunca
    // alcanzable en la práctica.
    return resultado.resuelveSinCombate ? { combate: resultado.combate as unknown as ReturnType<typeof combateNpcShape> } : { actionText: resultado.actionText, accionEnDiario: accionEnDiarioDeCaza(resultado.actionText), ...(resultado.tiradasGrupo ? { tiradasGrupo: resultado.tiradasGrupo } : {}), ...(resultado.logEntry ? { combateGrupoLogEntry: resultado.logEntry } : {}) };
  }

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
  // La oferta "X te corta el paso" ya se resolvió abriendo el combate (2026-09-28, bug real
  // jugando en vivo con Playwright: antes solo se escribía `pendingCombatNpcSlugs` y la oferta se
  // quedaba en BD — tras recargar reaparecía la tarjeta aunque el combate ya hubiera empezado o
  // terminado, y mientras siguiera pendiente ningún encuentro nuevo podía ofrecerse en la zona).
  await guardarSlugsDeCombate(prisma, save.id, [targetSlug], { extra: { pendingDynamicModeOffer: Prisma.JsonNull, pendingDynamicMode: Prisma.JsonNull } });
  // B9 (pruebas 2026-09-28): el encuentro decía "Alguien se abalanza..." pero la ficha de combate
  // mostraba al instante el nombre real y toda su historia. Al quedar cara a cara en combate se le
  // identifica: queda descubierto, así mapa, Enciclopedia y ficha cuentan lo mismo desde aquí.
  // P327 (decidido por la usuaria 2026-10-26): mientras Gorhorn no conozca a un PRINCIPAL, toda la escena lo
  // llama «el orco desconocido»: la tarjeta lo llamaba así y al abrir el combate saltaba su nombre real
  // («Orco enfurecido»). Ya no se le identifica por quedar cara a cara (antes B9); el nombre cambia solo al
  // presentarse o descubrirse. Un rol o una especie (no PRINCIPAL) sigue descubriéndose como antes.
  const visible = await nombreVisibleDeNpc(prisma, save.id, target);
  if (!visible.oculto) await recordEntityDiscoveries({ saveId: save.id, worldId: save.worldId, mentionedText: target.name, npcSlugsInScene: [target.slug] });
  return { combate: combateNpcShape({ ...target, name: visible.nombre }) };
}

function combateNpcShape(target: { slug: string; name: string; condicionFisica: string; saqueado: boolean; lootedItemNames: string[]; analizado: boolean; capturable: boolean; activeEffects: unknown; targetedForKill: boolean }) {
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
    Body: {
      tipo: DynamicModeTipo;
      targetSlug: string;
      targetName: string;
      quienInicia?: 'jugador' | 'npc';
      combateForzado?: boolean;
      // Agresivo en grupo (Fase 2, 2026-09-28) — id/cantidad del `ZonePoint` colisionado, del mismo
      // `dynamicModeOffer` que ya trae la tarjeta (zona.ts). Ausentes para un dinámico sin
      // `ZonePoint` propio, o para NPC/RECURSO (nunca se agrupan).
      zonePointId?: string;
      cantidad?: number;
    };
  }>('/saves/:id/modo-dinamico/interactuar', async (request, reply) => {
      const { tipo, targetSlug, targetName, quienInicia, combateForzado, zonePointId, cantidad } = request.body;
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

      // AGRESIVO/ENEMIGO (2026-09-20, "todo debe provocar el interactuar, incluido un agresivo") — P27
      // (decidido por la usuaria 2026-10-26): Interactuar con quien te corta el paso NUNCA abre el combate
      // directamente, tampoco cuando te vio primero: sale el paso de decisión (Combatir/Huir, más abajo, con
      // `narrarAperturaCombateForzado`) y el combate solo empieza al elegir Combatir (`/responder`).
      // `quienInicia: 'npc'` solo marca la emboscada (P90) para cuando elija pelear.

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
      // P244: un NPC que Gorhorn ya conoce (DESCUBIERTO) abre un reencuentro, no el primer encuentro.
      const reencuentro =
        !combateForzado && tipo === 'NPC' && !!(await prisma.discoveredEntity.findFirst({
          where: { saveId: save.id, entityType: 'npc', entitySlug: targetSlug, fase: 'DESCUBIERTO' },
          select: { id: true },
        }));
      const turno = combateForzado
        ? narrarAperturaCombateForzado(targetName, cantidad, quienInicia)
        : esGistera
          ? reencuentro
            ? narrarReencuentroGistera(!!(await prisma.quest.findFirst({ where: { saveId: save.id, questSlug: ORCO_ENFURECIDO_QUEST_SLUG }, select: { id: true } })))
            : narrarVueltaGistera(1, null)
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
              reencuentro,
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
            ...(combateForzado && quienInicia === 'npc' ? { emboscada: true as const } : {}),
            ...(reencuentro ? { reencuentro: true as const } : {}),
            // Agresivo en grupo (Fase 2, 2026-09-28) — se persisten para que `/responder` (el
            // jugador elige "Combatir" tras verlo primero) sepa que este encuentro es un grupo real
            // y abra combate múltiple en vez del 1v1 clásico.
            ...(zonePointId ? { zonePointId } : {}),
            ...(cantidad != null ? { cantidad } : {}),
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

    // AGRESIVO/ENEMIGO, el jugador ya eligió (2026-09-20) — "Combatir" abre combate directo (con
    // `emboscada` si el rival la vio antes, P90). "Huir" cuando la vio ella primero cierra sin combate,
    // gratis (decisión de Álvaro: la tirada de "quién ve a quién" ya decidió si hay elección). P27/P166
    // (revisión 2026-10-26): si el rival la vio antes, Huir cuesta lo que costaba cuando la emboscada abría
    // el combate sin preguntar: la tirada de huir de `/combat/flee` (`tiradaDeHuida`); si falla, empieza el
    // combate como emboscada. Cualquier otra respuesta se trata como huida — nunca se cuelga esperando
    // texto que este modal no ofrece.
    if (pending.combateForzado) {
      await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicMode: Prisma.JsonNull } });
      // P27/P166: huir de quien te vio antes no es gratis (ver arriba).
      let huidaFallida: Awaited<ReturnType<typeof prisma.logEntry.create>> | null = null;
      let rollHuida: RollResult | null = null;
      if (respuesta !== COMBATE_FORZADO_OPCION_COMBATIR && pending.emboscada === true) {
        const rival = await prisma.npc.findFirst({ where: { slug: pending.targetSlug, OR: [{ worldId: save.worldId, saveId: null }, { saveId: save.id }] }, select: { level: true } });
        const equipados = await prisma.inventoryItem.findMany({ where: { saveId: save.id, slot: { not: null } } });
        rollHuida = tiradaDeHuida(save, equipados, rival?.level ?? 1);
        if (!rollHuida.success) {
          const minutos = save.worldState?.fictionalMinutes ?? 480;
          huidaFallida = await prisma.logEntry.create({
            data: {
              saveId: save.id,
              channel: 'CHARACTER',
              text: `${save.characterName} intenta alejarse ${deNombre(nombreDeEncuentro(pending.targetName, pending.cantidad))}, pero no le dejan escapar: toca pelear.`,
              timeLabel: formatFictionalDate(minutos),
              fictionalMinutes: minutos,
              roll: rollHuida as unknown as Prisma.InputJsonValue,
              isPlayerAction: false,
              isSystemMessage: true,
            },
          });
        }
      }
      if (respuesta === COMBATE_FORZADO_OPCION_COMBATIR || huidaFallida) {
        const fictionalMinutesActuales = save.worldState?.fictionalMinutes ?? 480;
        const resultadoCombate = await abrirCombateForzadoDesdeInteractuar(
          save,
          pending.targetSlug,
          pending.targetName,
          fictionalMinutesActuales,
          pending.zonePointId,
          pending.cantidad,
          pending.emboscada === true,
        );
        if (!resultadoCombate) {
          // El agresor ya no está (muerto, retirado...) — la oferta se descarta: sin esto el jugador
          // quedaba atascado (no se puede ignorar ni moverse con un combate forzado pendiente).
          await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull, pendingDynamicMode: Prisma.JsonNull } });
          // Sin rival no hay huida fallida que contar.
          if (huidaFallida) await prisma.logEntry.delete({ where: { id: huidaFallida.id } });
          return reply.status(400).send({ error: 'Ese encuentro ya no está disponible aquí.' });
        }
        return {
          narration: '',
          opciones: [],
          cierra: true,
          vuelta: pending.vuelta + 1,
          timeLabel: formatFictionalDate(fictionalMinutesActuales),
          newQuestOfferInfo: null,
          ...(huidaFallida ? { huidaLogEntry: toFrontendLogEntry(huidaFallida) } : {}),
          ...resultadoCombate,
        };
      }
      const nuevoFictionalMinutes = advanceFictionalMinutes(save.worldState?.fictionalMinutes ?? 480, MINUTOS_POR_VUELTA_MODO_DINAMICO);
      const timeLabel = formatFictionalDate(nuevoFictionalMinutes);
      const text = `${save.characterName} logra alejarse ${deNombre(nombreDeEncuentro(pending.targetName, pending.cantidad))} sin que llegue a haber combate.`;
      // Huir vuelve a la ENTRADA de la zona, igual que las dos huidas de session.ts (antes el
      // jugador se quedaba pegado al agresor y el siguiente paso volvía a toparse con él).
      // P116: la misma función que las huidas de session.ts (entrada dentro del radio seguro, sin oferta); dentro de
      // la transacción, como en ellas, para que lea las entradas con el mismo cliente que escribe (revisión P116, leve).
      const entradaHuida = await prisma.$transaction(async (tx) => {
        const datosHuida = await datosDeHuidaDeZona(tx, save.id, save.currentLocationId, { x: save.zonaPosEntradaX, y: save.zonaPosEntradaY });
        await tx.worldState.update({ where: { saveId: save.id }, data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: timeLabel } });
        const entrada = await tx.logEntry.create({
          data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes: nuevoFictionalMinutes, ...(rollHuida ? { roll: rollHuida as unknown as Prisma.InputJsonValue } : {}), isPlayerAction: false, isSystemMessage: true },
        });
        await tx.save.update({ where: { id: save.id }, data: datosHuida });
        return entrada;
      });
      // La entrada guardada (con la tirada si la hubo), la misma que se ve tras recargar (QA-73).
      return { narration: text, opciones: [], cierra: true, vuelta: pending.vuelta + 1, timeLabel, newQuestOfferInfo: null, huidaLogEntry: toFrontendLogEntry(entradaHuida) };
    }

    const esGistera = pending.targetSlug === 'gistera-koh';
    const characterSummary = characterSummaryFor(save);
    // "Preguntar más antes de decidir" recicla la presentación (misma vuelta lógica, ver
    // `narrarVueltaGistera`) — no avanza el contador `vuelta` para que una recarga (F5) a mitad no
    // salte a un desenlace que nunca ocurrió. El resto de respuestas SÍ avanza como siempre.
    const respuestaGistera = esGistera ? respuestaGisteraDesdeOpcion(respuesta) : null;
    const siguienteVuelta = esGistera && respuestaGistera === 'preguntar' ? pending.vuelta : pending.vuelta + 1;
    // P243: desde la segunda vez, «Preguntar más» no repite el discurso ni avanza el reloj.
    const historialPrevio = pending.historialNarracion ?? [pending.narration];
    const preguntaRepetida = esGistera && respuestaGistera === 'preguntar' && gisteraYaLoContoAntes(historialPrevio);
    const turno = esGistera
      ? narrarVueltaGistera(siguienteVuelta, respuestaGistera, preguntaRepetida)
      : await narrarVueltaModoDinamico({
          tipo: pending.tipo,
          targetName: pending.targetName,
          vuelta: siguienteVuelta,
          maxVueltas: MAX_VUELTAS_MODO_DINAMICO,
          characterSummary,
          respuestaJugador: respuesta,
          reencuentro: pending.reencuentro,
          // Contexto real resuelto en la primera vuelta (2026-08-27, ver comentario de
          // PendingDynamicMode) — reutilizado tal cual, nunca re-consultado.
          targetBio: pending.targetBio,
          locationContext: pending.locationContext,
        });

    const fictionalMinutesActuales = save.worldState?.fictionalMinutes ?? 480;
    const nuevoFictionalMinutes = preguntaRepetida
      ? fictionalMinutesActuales
      : advanceFictionalMinutes(fictionalMinutesActuales, MINUTOS_POR_VUELTA_MODO_DINAMICO);
    const nuevaFictionalDateLabel = formatFictionalDate(nuevoFictionalMinutes);

    // Franja 0 (2026-09-08) — partidas ya en curso antes de esta migración pueden no tener
    // `historialNarracion` todavía (campo nuevo en un Json sin migración de esquema); se reconstruye
    // con la última vuelta conocida en vez de perder el historial anterior por completo.
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
      // B16 (pruebas 2026-09-28): con el `save` cargado al principio, la aceptación salía con la hora
      // de ANTES de esta vuelta (08:04) y el resumen de la conversación con la nueva (08:06) — horas
      // del log no monótonas. Se relee con el reloj ya avanzado por la transacción de arriba.
      const saveConRelojAvanzado = await prisma.save.findUniqueOrThrow({ where: { id: save.id }, include: { worldState: true } });
      questAceptada = await aceptarQuest(saveConRelojAvanzado, ORCO_ENFURECIDO_QUEST_TITLE, ORCO_ENFURECIDO_QUEST_DESCRIPTION);
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
  app.post<{ Params: { id: string }; Body: { targetSlug?: string } | undefined }>('/saves/:id/modo-dinamico/ignorar', async (request, reply) => {
    // P150 (QA-27): la oferta que se ignora. «Seguir mi camino» manda el ignorar y el paso siguiente a la
    // vez; si el paso pone otra oferta antes, ignorar la vieja no la puede borrar.
    const targetSlugIgnorado = typeof request.body?.targetSlug === 'string' ? request.body.targetSlug : null;
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
    // Un AGRESIVO/ENEMIGO que te corta el paso no se "ignora" (2026-09-28, bug real jugando en vivo:
    // "Ignorar" en la tarjeta "X te corta el paso" era una huida gratis y silenciosa de un combate
    // forzado) — hay que Interactuar (combatir o, si el jugador lo vio primero, huir).
    const ofertaSinAbrir = save.pendingDynamicModeOffer as { combateForzado?: boolean; targetName?: string } | null;
    if (!save.pendingDynamicMode && ofertaSinAbrir?.combateForzado) {
      return reply.status(409).send({ error: `${ofertaSinAbrir.targetName ?? 'Algo'} no te deja marcharte — tienes que reaccionar.` });
    }
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
        if (targetSlugIgnorado && !pending) {
          // Escritura condicional: solo si la oferta guardada sigue siendo esa (la nueva del paso no se toca).
          await tx.save.updateMany({
            where: { id: save.id, pendingDynamicModeOffer: { path: ['targetSlug'], equals: targetSlugIgnorado } },
            data: { pendingDynamicModeOffer: Prisma.JsonNull },
          });
        } else {
          await tx.save.update({
            where: { id: save.id },
            data: { pendingDynamicMode: Prisma.JsonNull, pendingDynamicModeOffer: Prisma.JsonNull },
          });
        }
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
