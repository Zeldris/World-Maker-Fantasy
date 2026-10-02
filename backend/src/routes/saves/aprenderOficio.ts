import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { scopeFor } from '../../services/npcScene.js';
import { checkAprenderOficio, nextGoirnosTrasCobro, COSTE_GOIRNOS_APRENDER_OFICIO } from '../../services/learnProfession.js';
import { rejectIfEnded, rejectIfPendingDeath, toFrontendLogEntry, lockRowForUpdate } from './shared.js';
import { CONDICIONES_INTERACTUABLE } from '../../services/death.js';

const MOTIVO_MENSAJE: Record<string, string> = {
  reputacion_insuficiente: 'Todavía no confía lo bastante en ti para enseñarte su oficio.',
  ya_aprendido: 'Ya conoces ese oficio.',
  pago_insuficiente: `No llevas los ${COSTE_GOIRNOS_APRENDER_OFICIO} Goirnos que pide a cambio.`,
};

/// Señal interna para abortar la transacción sin que Prisma la trate como un error de escritura
/// real (hallazgo 51) — capturada justo después del `$transaction`, nunca se propaga.
class AprenderOficioRechazadoError extends Error {
  constructor(public readonly motivo: string) {
    super(motivo);
  }
}

/// "Aprender oficio de un Maestro" (2026-08-31, "Trabajador de Reino") — cierra el hueco real
/// confirmado en `crafting.ts`/`docs/registros/ampliar-lore-checklist.md`: hoy los oficios solo se siembran
/// al crear personaje, sin ningún mecanismo de aprenderlos en partida. Determinista, sin pasar por
/// Ollama — mismo patrón que `quests/aceptar`/`entrega.ts` (endpoint dedicado, sin detección de
/// texto libre: dos precondiciones a la vez — reputación Y pago — encajan mal con el matching de
/// `explicitTarget`).
export async function aprenderOficioRoutes(app: FastifyInstance) {
  /// Candidatos: Maestros (`teachesProfession` no null) cuyo `homeLocationSlug` coincide con la
  /// Location actual del jugador — mismo criterio estricto que el POST (exigir Location exacta,
  /// no solo región, porque el Maestro vive en un interior concreto).
  app.get<{ Params: { id: string } }>('/saves/:id/aprender-oficio', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        worldId: true,
        currentLocationId: true,
        goirnos: true,
        professionProgress: { select: { professionId: true } },
        worldState: { select: { factionsStatus: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (!save.currentLocationId) return { maestros: [] };

    const currentLocation = await prisma.location.findUnique({ where: { id: save.currentLocationId } });
    if (!currentLocation) return { maestros: [] };

    const maestros = await prisma.npc.findMany({
      where: { worldId: save.worldId, homeLocationSlug: currentLocation.slug, teachesProfession: { not: null } },
    });
    const knownProfessions = new Set(save.professionProgress.map((p) => p.professionId));
    const factionsStatus = (save.worldState?.factionsStatus as Record<string, number> | undefined) ?? {};

    return {
      maestros: maestros.map((npc) => {
        const yaAprendido = knownProfessions.has(npc.teachesProfession!);
        const check = npc.faction
          ? checkAprenderOficio(factionsStatus, npc.faction, yaAprendido, save.goirnos)
          : { permitido: false, motivo: 'reputacion_insuficiente' as const };
        return {
          npcSlug: npc.slug,
          name: npc.name,
          professionId: npc.teachesProfession,
          costeGoirnos: COSTE_GOIRNOS_APRENDER_OFICIO,
          yaAprendido,
          puedeAprender: check.permitido,
          motivoBloqueo: check.motivo ? (MOTIVO_MENSAJE[check.motivo] ?? null) : null,
        };
      }),
    };
  });

  app.post<{ Params: { id: string; npcSlug: string } }>(
    '/saves/:id/npc/:npcSlug/aprender-oficio',
    async (request, reply) => {
      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          worldId: true,
          currentLocationId: true,
          endedAt: true,
          pendingDeathResolution: true,
          characterName: true,
          goirnos: true,
          worldState: { select: { fictionalDateLabel: true, fictionalMinutes: true, factionsStatus: true } },
        },
      });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;
      if (!save.currentLocationId) return reply.status(400).send({ error: 'Sin ubicación actual' });

      const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, slug: request.params.npcSlug, saveId: null } });
      if (!npc || !npc.teachesProfession) return reply.status(404).send({ error: 'Ese NPC no enseña ningún oficio' });
      if (!npc.faction) return reply.status(400).send({ error: 'Ese NPC no tiene facción — no se le puede pedir reputación real' });

      // El Maestro tiene que estar realmente presente (mismo criterio que Entregar/Capturar) — un
      // `homeLocationSlug` no basta por sí solo, se comprueba contra su `NpcState` de verdad.
      const scope = scopeFor(npc.kind, save.currentLocationId);
      const state = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } } });
      const condicion = state?.condicionFisica ?? 'ILESO';
      if (!CONDICIONES_INTERACTUABLE.includes(condicion)) {
        return reply.status(400).send({ error: 'Ese Maestro no está en condiciones de enseñarte nada ahora mismo' });
      }
      const currentLocation = await prisma.location.findUnique({ where: { id: save.currentLocationId } });
      const enEscena = npc.homeLocationSlug === currentLocation?.slug;
      if (!enEscena) return reply.status(400).send({ error: 'Tienes que estar delante de él para que te enseñe' });

      const existing = await prisma.professionProgress.findUnique({
        where: { saveId_professionId: { saveId: save.id, professionId: npc.teachesProfession } },
      });
      const factionsStatus = (save.worldState?.factionsStatus as Record<string, number> | undefined) ?? {};
      const check = checkAprenderOficio(factionsStatus, npc.faction, !!existing, save.goirnos);
      if (!check.permitido) {
        return reply.status(400).send({ error: MOTIVO_MENSAJE[check.motivo!] ?? 'No puedes aprender ese oficio ahora mismo.' });
      }

      const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
      const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
      const text = `${save.characterName} paga ${COSTE_GOIRNOS_APRENDER_OFICIO} Goirnos y aprende el oficio de ${npc.name}.`;

      // Hallazgo 51 (revisar-partida-hallazgos.md, 2026-09-15) — dos frentes de carrera a la vez:
      // (a) el guard de arriba (`check.permitido`) y `save.goirnos` se leyeron ANTES de esta
      // transacción; sin re-chequear con datos frescos, dos peticiones concurrentes con Maestros
      // DISTINTOS podían pasar las dos el guard viendo el mismo saldo, y las dos cobrar el coste —
      // `nextGoirnosTrasCobro` topa en 0 (`Math.max`), así que no se ve como saldo negativo, pero
      // el jugador solo pagó una vez de las dos reales. Se repite `checkAprenderOficio` DENTRO de
      // la transacción, con `goirnos` fresco tras el lock — la segunda petición ve ya el saldo que
      // dejó la primera y falla limpio con `pago_insuficiente`, en vez de cobrar sin fondos.
      // (b) `ProfessionProgress` SÍ tiene `@@unique([saveId, professionId])` (protección real
      // contra doble aprendizaje del MISMO oficio con el MISMO Maestro), pero el choque nunca se
      // capturaba — 500 genérico en vez del mismo 400 claro que ya da el guard normal (mismo
      // patrón que `reino.ts` con `Faction.slug`).
      let logEntry;
      try {
        logEntry = await prisma.$transaction(async (tx) => {
          const freshSave = await lockRowForUpdate<{ goirnos: number }>(tx, 'Save', save.id, ['goirnos']);
          const freshCheck = checkAprenderOficio(factionsStatus, npc.faction!, !!existing, freshSave.goirnos);
          if (!freshCheck.permitido) {
            throw new AprenderOficioRechazadoError(freshCheck.motivo!);
          }
          await tx.save.update({
            where: { id: save.id },
            data: { goirnos: nextGoirnosTrasCobro(freshSave.goirnos, COSTE_GOIRNOS_APRENDER_OFICIO) },
          });
          await tx.professionProgress.create({
            data: { saveId: save.id, professionId: npc.teachesProfession! },
          });
          return tx.logEntry.create({
            data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes, isPlayerAction: true },
          });
        });
      } catch (err) {
        if (err instanceof AprenderOficioRechazadoError) {
          return reply.status(400).send({ error: MOTIVO_MENSAJE[err.motivo] ?? 'No puedes aprender ese oficio ahora mismo.' });
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply.status(400).send({ error: MOTIVO_MENSAJE.ya_aprendido });
        }
        throw err;
      }

      return { professionId: npc.teachesProfession, logEntry: toFrontendLogEntry(logEntry) };
    },
  );
}
