import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded } from './shared.js';
import { characterSummaryFor } from '../../services/characterSummary.js';
import { advanceFictionalMinutes, formatFictionalDate } from '../../services/worldClock.js';
import { MAX_VUELTAS_MODO_DINAMICO, MINUTOS_POR_VUELTA_MODO_DINAMICO, type PendingDynamicMode, type DynamicModeTipo } from '../../services/dynamicMode.js';
import { narrarVueltaModoDinamico } from '../../services/dynamicModeNarracion.js';

/// "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — mini-flujo acotado ofrecido
/// al final de un turno normal (`dynamicModeOffer`, turnResolution.ts), nunca lo interrumpe. Estas
/// 2 rutas son las ÚNICAS que avanzan/cierran la interacción — mismo espíritu que
/// `POST /saves/:id/quests/aceptar`: el motor ya decidió el candidato en el turno normal, esto solo
/// lo materializa, sin volver a pasar por el clasificador de intención de `/turn/narrate`.
export async function dynamicModeRoutes(app: FastifyInstance) {
  /// Primera vuelta — el jugador pulsó "Interactuar" sobre la oferta que ya vio en el `done` del
  /// turno anterior. `tipo`/`targetName` vienen del body (mismo criterio que `quests/aceptar`
  /// recibe `title`/`description`: el frontend reenvía lo que YA le devolvió el turno, sin que el
  /// backend tenga que recalcular el candidato aquí).
  app.post<{ Params: { id: string }; Body: { tipo: DynamicModeTipo; targetSlug: string; targetName: string } }>(
    '/saves/:id/modo-dinamico/interactuar',
    async (request, reply) => {
      const { tipo, targetSlug, targetName } = request.body;
      if (!tipo || !targetSlug || !targetName?.trim()) {
        return reply.status(400).send({ error: 'Faltan campos: tipo, targetSlug, targetName' });
      }
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (save.pendingDynamicMode) {
        return reply.status(409).send({ error: 'Ya hay un modo dinámico en curso' });
      }

      // Bug real jugando en vivo (2026-08-27, "hay que darle mucho más contenido determinista
      // para que no invente" — el LLM narraba lugares/hechos que no existen, ej. una "Isla
      // Cambiante" inventada de la nada): sin esto, narrarVueltaModoDinamico solo recibía el
      // resumen del PERSONAJE, nunca datos reales de con quién/dónde ocurre la interacción.
      const [targetNpc, currentLocation] = await Promise.all([
        prisma.npc.findFirst({ where: { worldId: save.worldId, slug: targetSlug }, select: { bio: true } }),
        save.currentLocationId
          ? prisma.location.findUnique({ where: { id: save.currentLocationId }, select: { name: true, description: true } })
          : null,
      ]);

      const characterSummary = characterSummaryFor(save);
      const turno = await narrarVueltaModoDinamico({
        tipo,
        targetName,
        vuelta: 1,
        maxVueltas: MAX_VUELTAS_MODO_DINAMICO,
        characterSummary,
        respuestaJugador: null,
        targetBio: targetNpc?.bio ?? null,
        locationContext: currentLocation,
      });

      const fictionalMinutesActuales = save.worldState?.fictionalMinutes ?? 480;
      const nuevoFictionalMinutes = advanceFictionalMinutes(fictionalMinutesActuales, MINUTOS_POR_VUELTA_MODO_DINAMICO);
      const nuevaFictionalDateLabel = formatFictionalDate(nuevoFictionalMinutes);

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
          };

      await prisma.$transaction([
        prisma.save.update({
          where: { id: save.id },
          // Bug real 2026-08-28 ("oferta de modo dinámico no sobrevive a una recarga") — al pulsar
          // "Interactuar" la oferta ya se resolvió, se limpia `pendingDynamicModeOffer` a la vez que
          // se escribe `pendingDynamicMode` (la conversación ya en curso).
          data: {
            pendingDynamicMode: pendingDynamicMode ? (pendingDynamicMode as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            pendingDynamicModeOffer: Prisma.JsonNull,
          },
        }),
        prisma.worldState.update({
          where: { saveId: save.id },
          data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: nuevaFictionalDateLabel },
        }),
      ]);

      return { narration: turno.narration, opciones: turno.opciones, cierra: turno.cierra, vuelta: 1, timeLabel: nuevaFictionalDateLabel };
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

    const pending = save.pendingDynamicMode as unknown as PendingDynamicMode | null;
    if (!pending) {
      return reply.status(409).send({ error: 'No hay ningún modo dinámico en curso' });
    }

    const characterSummary = characterSummaryFor(save);
    const siguienteVuelta = pending.vuelta + 1;
    const turno = await narrarVueltaModoDinamico({
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

    const pendingDynamicMode: PendingDynamicMode | null = turno.cierra
      ? null
      : { ...pending, vuelta: siguienteVuelta, narration: turno.narration, opciones: turno.opciones };

    await prisma.$transaction([
      prisma.save.update({
        where: { id: save.id },
        data: { pendingDynamicMode: pendingDynamicMode ? (pendingDynamicMode as unknown as Prisma.InputJsonValue) : Prisma.JsonNull },
      }),
      prisma.worldState.update({
        where: { saveId: save.id },
        data: { fictionalMinutes: nuevoFictionalMinutes, fictionalDateLabel: nuevaFictionalDateLabel },
      }),
    ]);

    return { narration: turno.narration, opciones: turno.opciones, cierra: turno.cierra, vuelta: siguienteVuelta, timeLabel: nuevaFictionalDateLabel };
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
      select: { id: true, endedAt: true, pendingDynamicMode: true, pendingDynamicModeOffer: true },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (save.pendingDynamicMode || save.pendingDynamicModeOffer) {
      await prisma.save.update({
        where: { id: save.id },
        data: { pendingDynamicMode: Prisma.JsonNull, pendingDynamicModeOffer: Prisma.JsonNull },
      });
    }
    return { ok: true };
  });
}
