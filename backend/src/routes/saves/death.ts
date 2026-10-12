import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { registrarSuceso, minutosDeFiccion } from '../../services/cronista/sucesos.js';
import { initialLocationSlugFor } from '../../services/travel.js';
import { awakensText } from '../../services/death.js';
import { restartSaveTransactionBody } from './shared.js';

/// Muerte permanente, botón Aceptar/Reintentar (2026-08-31, petición explícita: "te pondra un
/// boton tipo Aceptar o Reintentar en la narracion, si le das vuelve al punto de guardado, si no
/// hay punto de guardado volvera al inicio de la partida") — el turno que mata al jugador ya
/// narró el susurro de la Entidad y dejó `Save.pendingDeathResolution: true` (ver comentario en
/// schema.prisma y en turnResolution.ts § `proposedCondicion === 'MUERTO'`), bloqueando cualquier
/// turno nuevo. Esta ruta es la ÚNICA que consume ese estado — mismo espíritu que
/// POST /saves/:id/quests/aceptar: el jugador pulsa un botón, el motor decide de forma
/// determinista, sin pasar por el modelo grande.
///
/// Decide con el estado REAL de la partida EN ESTE MOMENTO (nunca datos guardados al morir, que
/// podrían quedar obsoletos si algo cambió entre medias — p.ej. el propio campamento fue
/// desmantelado):
/// - `lastRestLocationId` real → reaparece ahí, con el resto del progreso intacto (mismo
///   comportamiento que el respawn "blando" de siempre).
/// - Sin `lastRestLocationId` PERO `tutorialCompletedAt` ya fijado (mató al Orco Enfurecido en
///   algún momento) → misma reaparición, pero en el `Location` inicial del personaje — el
///   tutorial superado ya es la red de seguridad, no hace falta punto de guardado propio.
/// - Sin ninguno de los dos → reinicio TOTAL de la partida (decisión explícita de la usuaria:
///   "como que te despiertas de una pesadilla" — un jugador que nunca llegó a superar el
///   tutorial ni a descansar en construcción propia no tiene todavía nada real que preservar).
export async function deathRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/saves/:id/death/resolve', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { world: true, worldState: true },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (!save.pendingDeathResolution) {
      return reply.status(409).send({ error: 'No hay ninguna muerte pendiente de resolver en esta partida' });
    }

    if (save.lastRestLocationId || save.tutorialCompletedAt) {
      const respawnLocationId =
        save.lastRestLocationId ??
        (await (async () => {
          const slug = initialLocationSlugFor(save.characterName);
          if (!slug) return null;
          const location = await prisma.location.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug } } });
          return location?.id ?? null;
        })());
      const respawnLocation = respawnLocationId ? await prisma.location.findUnique({ where: { id: respawnLocationId } }) : null;

      await prisma.$transaction(async (tx) => {
        // Recupera la construcción propia (mismo criterio que el respawn "blando" de siempre,
        // ver comentario original en turnResolution.ts) — si era tu punto de guardado y quedó
        // DANADO/ABANDONADO mientras tanto, reaparecer aquí la devuelve a ACTIVO.
        if (respawnLocationId) {
          await tx.building.updateMany({
            where: { saveId: save.id, locationId: respawnLocationId, status: { in: ['DANADO', 'ABANDONADO'] } },
            data: { status: 'ACTIVO' },
          });
        }
        // isSystemMessage (ver comentario completo en schema.prisma) — awakensText es una función
        // pura, texto fijo determinista, nunca pasa por el LLM.
        const despertar = await tx.logEntry.create({
          data: {
            saveId: save.id,
            channel: 'CHARACTER',
            text: awakensText(save.characterName, respawnLocation?.name ?? 'un lugar que reconoce', false),
            timeLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
            isSystemMessage: true,
          },
        });
        // Libro de Sucesos (CR-3, hito 0.2). El reinicio total de abajo no lo registra: «todo fue
        // un sueño» vacía el Libro y la historia empieza de cero.
        await registrarSuceso(tx, {
          saveId: save.id,
          tipo: 'RENACER',
          fictionalMinutes: await minutosDeFiccion(tx, save.id),
          locationId: respawnLocationId,
          origen: 'JUGADOR',
          logEntryId: despertar.id,
          actores: [{ entidadTipo: 'PERSONAJE', entidadId: save.id, papel: 'AFECTADO' }],
          datos: { personaje: save.characterName, lugar: respawnLocation?.name ?? 'un lugar que reconoce' },
        });
        await tx.save.update({
          where: { id: save.id },
          data: {
            condicionFisica: 'ILESO',
            salud: 100,
            currentLocationId: respawnLocationId,
            pendingDeathResolution: false,
            // QA-27 P82: el encuentro que mató no sigue pendiente al reaparecer (era la muerte
            // siguiente, sin opción). La gracia tras reaparecer está en `zona.ts`.
            pendingDynamicModeOffer: Prisma.JsonNull,
            zonaUltimoEncuentro: Prisma.JsonNull,
          },
        });
      });

      return { restartedTotal: false, respawnLocationId };
    }

    // Sin punto de guardado ni tutorial superado — reinicio total, mismo cuerpo que
    // POST /saves/:id/restart (shared.ts), con el matiz narrativo de "todo era un sueño"
    // (awakensText con esReinicioTotal, mismo texto que la rama de arriba usaría si SÍ hubiera
    // punto de guardado, para que las dos ramas narren con la misma voz).
    const initialLocationSlug = initialLocationSlugFor(save.characterName);
    const initialLocationName = initialLocationSlug
      ? (await prisma.location.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: initialLocationSlug } } }))?.name
      : null;
    const introCharacterText = awakensText(save.characterName, initialLocationName ?? 'un lugar que reconoce', true);
    const introWorldText = `El mundo de ${save.world.name} sigue su curso, ajeno por ahora a la llegada de un nuevo actor en la historia.`;
    await prisma.$transaction(async (tx) => restartSaveTransactionBody(tx, save, introCharacterText, introWorldText), {
      maxWait: 10_000,
      timeout: 20_000,
    });

    return { restartedTotal: true };
  });
}
