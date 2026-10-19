import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath, toFrontendLogEntry } from './shared.js';
import { nextMorning8am, formatFictionalDate } from '../../services/worldClock.js';
import { avanzarRelojConTick } from '../../services/dailyTick.js';
import { energiaMaxFor } from '../../services/energy.js';
import type { CondicionFisica } from '@prisma/client';

const CONDICION_ORDER: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO'];
const TECHO_CURACION_IDX = CONDICION_ORDER.indexOf('HERIDO');

/// Habilidad "Descansar en campamento" (2026-09-08, diseño explícito de Álvaro: "una habilidad que
/// solo aparecerá cuando tienes construido el campamento... despertarte en el siguiente día a las
/// 08:00 y guardas partida y estás descansado curándote la vida hasta Herido") — determinista de
/// punta a punta, sin narración LLM (mismo espíritu que `dynamicModeRecurso.ts`: el motor decide,
/// no hay nada que redactar). Reutiliza EXACTAMENTE el mismo criterio de "punto de guardado" que ya
/// usa el descanso normal en `turnResolution.ts` (~línea 6710-6717): un `Building` PROPIO
/// `status: 'ACTIVO'` en la MISMA `Location` donde está el jugador ahora mismo — nunca un
/// refugio/asentamiento ajeno, ni siquiera el campamento sembrado de catálogo de otra facción.
///
/// Excepción explícita a "Descansar ya NO cura condicionFisica" (hallazgo 11, 2026-09-06,
/// `turnResolution.ts` ~línea 5077): esta habilidad SÍ cura, hasta HERIDO como techo — dormir en TU
/// PROPIO campamento (construido, con recursos reales) es mecánicamente distinto de un descanso
/// improvisado en cualquier sitio, decisión explícita de Álvaro al pedirla.
export async function descansarCampamentoRoutes(app: FastifyInstance) {
  /// Visibilidad condicional del botón — GET barato, sin mutar nada. El frontend lo consulta al
  /// entrar en una Location nueva (o al abrir el panel) para decidir si mostrar la habilidad.
  app.get<{ Params: { id: string } }>('/saves/:id/descansar-campamento', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, currentLocationId: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (!save.currentLocationId) return { disponible: false };

    const ownBuildingHere = await prisma.building.findFirst({
      where: { saveId: save.id, locationId: save.currentLocationId, status: 'ACTIVO' },
      select: { id: true },
    });
    return { disponible: !!ownBuildingHere };
  });

  app.post<{ Params: { id: string } }>('/saves/:id/descansar-campamento', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        endedAt: true,
        pendingDeathResolution: true,
        currentLocationId: true,
        worldId: true,
        characterName: true,
        condicionFisica: true,
        attributes: true,
        worldState: { select: { fictionalMinutes: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (!save.currentLocationId) return reply.status(400).send({ error: 'Sin ubicación actual' });

    const ownBuildingHere = await prisma.building.findFirst({
      where: { saveId: save.id, locationId: save.currentLocationId, status: 'ACTIVO' },
      select: { id: true },
    });
    if (!ownBuildingHere) {
      return reply.status(400).send({ error: 'No tienes ningún campamento construido aquí.' });
    }

    const fictionalMinutesActuales = save.worldState?.fictionalMinutes ?? 480;
    const nuevoFictionalMinutes = nextMorning8am(fictionalMinutesActuales);
    const timeLabel = formatFictionalDate(nuevoFictionalMinutes);

    const currentIdx = CONDICION_ORDER.indexOf(save.condicionFisica);
    const nuevaCondicion = CONDICION_ORDER[Math.min(currentIdx, TECHO_CURACION_IDX)];

    // A diferencia del descanso normal de un turno (ENERGY_REST_RESTORE, delta fijo +30) — dormir
    // toda la noche en tu propio campamento restaura la energía COMPLETA, coherente con "estás
    // descansado" (criterio propio de esta habilidad, distinto del descanso improvisado de siempre).
    const energiaMax = energiaMaxFor((save.attributes as { constitucion: number }).constitucion);
    const text = `${save.characterName} descansa en su campamento hasta el amanecer — la partida queda guardada aquí.`;

    const logEntry = await prisma.$transaction(async (tx) => {
      await tx.save.update({
        where: { id: save.id },
        data: {
          condicionFisica: nuevaCondicion,
          energia: energiaMax,
          lastRestLocationId: save.currentLocationId,
          lastRestAtMinutes: nuevoFictionalMinutes,
        },
      });
      // Reloj + tick diario del Reino (P217): cruza la medianoche, así que corre `runDailyTick`.
      await avanzarRelojConTick(tx, { saveId: save.id, worldId: save.worldId, minutosAntes: fictionalMinutesActuales, minutosDespues: nuevoFictionalMinutes });
      return tx.logEntry.create({
        data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes: nuevoFictionalMinutes, isPlayerAction: true, isSystemMessage: true },
      });
      // El tick diario de un Reino grande pasa de los 5 s por defecto de Prisma: mismo margen que el turno.
    }, { maxWait: 10_000, timeout: 30_000 });

    return { condicionFisica: nuevaCondicion, timeLabel, logEntry: toFrontendLogEntry(logEntry) };
  });
}
