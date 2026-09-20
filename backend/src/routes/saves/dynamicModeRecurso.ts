import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { harvestAbilityForMetodo, matchesOficioPrefix } from '../../services/harvestAbilities.js';
import { estacionFor, climaFor } from '../../services/worldClock.js';
import { candidateSourcesFor, gatheringRollFor, applyGatheringRoll, resolverRecoleccion } from './recolectar.js';
import { sourceDisplayNameFor } from '../../scripts/worldCatalog.js';
import type { AttributeBlock } from '../../services/dice.js';

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

    const { candidates } = await candidateSourcesFor(worldId, yieldRow.metodoObtencion, region, currentLocationId, locationSlug, estacionActual, climaActual, save.professionProgress.find((p) => p.professionId === professionIdReal)?.nivel ?? 1);
    const candidato = candidates.find((c) => c.sourceSlug === targetSlug);
    if (!candidato) {
      await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
      return reply.status(400).send({ error: 'Ese recurso ya no está disponible aquí — puede que se te haya adelantado, o esté fuera de temporada.' });
    }

    const roll = gatheringRollFor(
      { attributes: save.attributes as AttributeBlock, secondaryAttributesJson: save.secondaryAttributes, inventoryItems: save.inventoryItems, professionProgress: save.professionProgress },
      professionIdReal,
    );
    const [filtrado] = applyGatheringRoll([candidato], roll);
    if (!filtrado) {
      // Tirada fallida — narración determinista de intento sin éxito, sin tocar Prisma más allá de
      // limpiar la oferta (mismo criterio que "caza limpia fallida" en cazar.ts: un intento real
      // puede no dar nada, no es un error).
      await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
      return {
        exito: false,
        narration: `${save.characterName} lo intenta con ${sourceDisplayNameFor(targetSlug)}, pero no consigue nada aprovechable esta vez.`,
      };
    }

    const selections = filtrado.yields.map((y) => ({ sourceSlug: targetSlug, itemSlug: y.itemSlug, cantidad: y.cantidadMaxima }));
    // `true` = limpia pendingDynamicModeOffer DENTRO de la misma transacción que la recolección
    // (hallazgo 44, revisar-partida-hallazgos.md 2026-09-15) — antes era una segunda escritura
    // suelta después de cerrar la transacción, vulnerable a dejar la oferta colgada sobre un
    // recurso ya recolectado si el proceso moría entre medias.
    const resultado = await resolverRecoleccion(save, selections, true);

    return {
      exito: resultado.logEntry !== null,
      narration: resultado.logEntry?.text ?? `${save.characterName} no consigue nada aprovechable de ${sourceDisplayNameFor(targetSlug)} esta vez.`,
      abilityName: ability.ability.name,
      items: resultado.items,
      updatedItems: resultado.updatedItems,
      logEntry: resultado.logEntry,
    };
  });
}
