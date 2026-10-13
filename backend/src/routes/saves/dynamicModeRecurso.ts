import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { harvestAbilityForMetodo, matchesOficioPrefix } from '../../services/harvestAbilities.js';
import { estacionFor, climaFor, formatFictionalDate } from '../../services/worldClock.js';
import { atributoDeFuente, candidateSourcesFor, gatheringRollFor, applyGatheringRoll, resolverRecoleccion, type RecoleccionLogRoll } from './recolectar.js';
import { sourceDisplayNameFor } from '../../scripts/worldCatalog.js';
import type { AttributeBlock } from '../../services/dice.js';
import { ambitoPoblacion } from '../../services/mundoPartida.js';

/// "Interactuar" sobre un candidato RECURSO (2026-09-08, "Ver qué hay en la zona") — a diferencia
/// de NPC/FAUNA (conversación de vueltas, dynamicMode.ts), no hay diálogo real que tener con una
/// veta de mineral: esta ÚNICA ruta narra brevemente y resuelve la recolección de una sentada,
/// reutilizando EXACTAMENTE las mismas reglas que `/recolectar/confirmar` (cooldown, herramienta,
/// segunda tirada en tier alto, capacidad, misiones, Enciclopedia) vía `resolverRecoleccion` — cero
/// lógica nueva de recolección, solo un disparador distinto. Mismo patrón "el motor decide, nunca
/// el LLM" que el resto del proyecto: la narración de apertura es texto FIJO determinista (no hay
/// LLM de por medio, ni falta que hace para una sola frase de contexto).
export async function dynamicModeRecursoRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string; targetSlug: string } }>('/saves/:id/modo-dinamico/recurso/:targetSlug', async (request, reply) => {
    const { targetSlug } = request.params;
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: {
        worldState: true,
        currentLocation: true,
        inventoryItems: { where: { slot: { not: null } }, select: { statBonuses: true } },
        professionProgress: { select: { professionId: true, nivel: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const worldId = save.worldId;
    const region = save.currentLocation?.region ?? null;
    const locationSlug = save.currentLocation?.slug ?? null;
    const currentLocationId = save.currentLocation?.id ?? null;
    const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
    const estacionActual = estacionFor(fictionalMinutes);
    const climaActual = climaFor(fictionalMinutes, region);

    // El candidato ya lo decidió el motor determinista (ZonePoint + gate de proximidad/temperamento,
    // ver dynamicMode.ts) — aquí solo hace falta saber a qué MÉTODO pertenece esa fuente concreta,
    // para resolver el `oficio` real (y así el nivel/atributo correctos) del jugador.
    const yieldRow = await prisma.harvestYield.findFirst({ where: { worldId, sourceSlug: targetSlug }, select: { metodoObtencion: true } });
    if (!yieldRow) {
      await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
      return reply.status(400).send({ error: 'Ese recurso ya no está disponible aquí.' });
    }
    const ability = harvestAbilityForMetodo(yieldRow.metodoObtencion);
    if (!ability) {
      await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
      return reply.status(400).send({ error: 'Ese recurso no tiene ninguna profesión asociada.' });
    }

    // `professionId` REAL del jugador para este método, si lo tiene aprendido (mismo criterio que
    // la segunda tirada de /recolectar/confirmar, recolectar.ts línea ~884) — necesario porque
    // `ability.oficio` es solo el PREFIJO base ("minero"), nunca la variante regional exacta
    // ("minero-llanuras") que de verdad tiene el jugador en `professionProgress`. Sin ninguna fila
    // aprendida, se cae al prefijo base — `gatheringRollFor` ya trata eso como nivel 1 implícito.
    const professionIdReal = save.professionProgress.find((p) => matchesOficioPrefix(p.professionId, ability.oficio))?.professionId ?? ability.oficio;

    const nivelOficio = save.professionProgress.find((p) => p.professionId === professionIdReal)?.nivel ?? 1;
    const metodo = yieldRow.metodoObtencion;
    const poblacion = await ambitoPoblacion(prisma, save.id);
    const { candidates } = await candidateSourcesFor(worldId, metodo, region, currentLocationId, locationSlug, estacionActual, climaActual, nivelOficio, prisma, poblacion);
    const candidato = candidates.find((c) => c.sourceSlug === targetSlug);
    if (!candidato) {
      // Motivo REAL del rechazo (2026-09-28, bug real jugando en vivo con Playwright: el Yerreo de
      // La Hondonada del Eco — tier 4 — respondía siempre "puede que se te haya adelantado, o esté
      // fuera de temporada" a un minero de nivel 1, que no era ninguna de las dos cosas; el jugador
      // no tenía forma de saber que le faltaba nivel de oficio). Se re-evalúa sin tope de nivel: si
      // ENTONCES sí aparece como candidato, lo único que falla es el nivel.
      const nombre = sourceDisplayNameFor(targetSlug);
      const sinTopeDeNivel = await candidateSourcesFor(worldId, metodo, region, currentLocationId, locationSlug, estacionActual, climaActual, Number.MAX_SAFE_INTEGER, prisma, poblacion);
      const candidatoSinTope = sinTopeDeNivel.candidates.find((c) => c.sourceSlug === targetSlug);
      const error = candidatoSinTope
        ? `Todavía no sabes aprovechar ${nombre}: hace falta ${ability.ability.name} a nivel ${Math.min(...candidatoSinTope.yields.map((y) => y.tier ?? 1))} (tienes nivel ${nivelOficio}).`
        : `${nombre} no da nada aprovechable ahora mismo — puede que esté agotado, recuperándose de una recolección reciente o fuera de temporada.`;
      await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
      return reply.status(400).send({ error });
    }


    // F9-4 (2026-09-29): un fallo (tirada de Explorar fallida, o segundas tiradas de tier alto todas
    // falladas) antes no dejaba LogEntry y su dado solo se veía en vivo. Ahora queda como entrada de
    // sistema con la(s) tirada(s) en `roll` (mismo `kind: 'recoleccion'`). No avanza el reloj.
    // `limpiarOferta`: solo cuando `resolverRecoleccion` no llegó a limpiarla ya.
    async function registrarFallo(text: string, logRoll: RecoleccionLogRoll, limpiarOferta: boolean) {
      const timeLabel = formatFictionalDate(fictionalMinutes);
      const creada = await prisma.$transaction(async (tx) => {
        if (limpiarOferta) await tx.save.update({ where: { id: save!.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
        return tx.logEntry.create({
          data: { saveId: save!.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes, isPlayerAction: false, isSystemMessage: true, roll: logRoll as unknown as Prisma.InputJsonValue },
        });
      });
      return { id: creada.id, text, timeLabel, createdAt: creada.createdAt.toISOString(), fictionalMinutes, roll: logRoll };
    }

    const roll = gatheringRollFor(
      { attributes: save.attributes as AttributeBlock, secondaryAttributesJson: save.secondaryAttributes, inventoryItems: save.inventoryItems, professionProgress: save.professionProgress },
      professionIdReal,
      Math.random,
      atributoDeFuente(candidato.sourceCategory, metodo) ?? undefined,
    );
    const [filtrado] = applyGatheringRoll([candidato], roll);
    if (!filtrado) {
      // Tirada fallida — narración determinista de intento sin éxito, sin tocar Prisma más allá de
      // limpiar la oferta (mismo criterio que "caza limpia fallida" en cazar.ts: un intento real
      // puede no dar nada, no es un error).
      const narracionFallo = `${save.characterName} lo intenta con ${sourceDisplayNameFor(targetSlug)}, pero no consigue nada aprovechable esta vez.`;
      const logEntryFallo = await registrarFallo(narracionFallo, { kind: 'recoleccion', tirada: roll }, true);
      return {
        exito: false,
        narration: narracionFallo,
        logEntry: logEntryFallo,
        // Fase 10 (2026-09-29) — la tirada de Explorar también se ve en el fallo (dado visible).
        roll,
        abilityName: ability.ability.name,
      };
    }

    const selections = filtrado.yields.map((y) => ({ sourceSlug: targetSlug, itemSlug: y.itemSlug, cantidad: y.cantidadMaxima }));
    // `true` = limpia pendingDynamicModeOffer DENTRO de la misma transacción que la recolección
    // (hallazgo 44, revisar-partida-hallazgos.md 2026-09-15) — antes era una segunda escritura
    // suelta después de cerrar la transacción, vulnerable a dejar la oferta colgada sobre un
    // recurso ya recolectado si el proceso moría entre medias.
    const resultado = await resolverRecoleccion(save, selections, true, roll);

    const narracionSinLog = `${save.characterName} no consigue nada aprovechable de ${sourceDisplayNameFor(targetSlug)} esta vez.`;
    const logEntryFinal =
      resultado.logEntry ??
      (await registrarFallo(narracionSinLog, { kind: 'recoleccion', tirada: roll, ...(resultado.segundasTiradas.length > 0 ? { segundas: resultado.segundasTiradas } : {}) }, false));

    return {
      exito: resultado.logEntry !== null,
      narration: logEntryFinal.text,
      abilityName: ability.ability.name,
      // Fase 10 (2026-09-29, "todas las tiradas visibles") — tirada de Explorar + segundas tiradas
      // de tier alto (una por objeto afectado); ambas también quedan en `logEntry.roll`.
      roll,
      segundasTiradas: resultado.segundasTiradas,
      items: resultado.items,
      updatedItems: resultado.updatedItems,
      logEntry: logEntryFinal,
    };
  });
}
