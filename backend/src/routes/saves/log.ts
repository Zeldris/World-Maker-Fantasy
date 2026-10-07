import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { calendarioFor } from '../../services/worldClock.js';
import { toFrontendLogEntry } from './shared.js';
import { responderPropuesta } from '../../services/cronista/decisionesFaccion.js';
import { esperarSegundoPlano } from '../../services/avanceDiario.js';
import { expedicionesVisibles } from '../../services/expedicionesMapa.js';
import { alcancesDeTorres } from '../../services/defensaReino.js';
import { campamentosConocidos } from '../../services/campamentos.js';

/// UX-29: lo más que espera «lo nuevo del mundo» a que acabe el avance de fondo de la partida.
const ESPERA_FONDO_MS = 20_000;

/// Registro de la partida (deuda técnica 2026-07-30, split de saves.ts): guardar qué entidad se
/// mostró como banner bajo una narración, y el Diario completo agrupado por día — a diferencia de
/// GET /saves/:id (detail.ts, ventana de 24h con banners ya resueltos), este es el histórico
/// entero, pedido bajo demanda al abrir la pestaña.
export async function logRoutes(app: FastifyInstance) {
  // CR-46 (hito 0.2): expediciones que el personaje puede ver en el mapa de Berig.
  app.get<{ Params: { id: string } }>('/saves/:id/expediciones/mapa', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    return {
      expediciones: await expedicionesVisibles(prisma, save.id),
      // CR-65 (Q9) y CR-50 (Q7): el alcance de las Torres y los campamentos que conoce, en una lectura.
      ...(await prisma.$transaction(async (tx) => ({ alcances: await alcancesDeTorres(tx, save.id), campamentos: await campamentosConocidos(tx, save.id) }))),
    };
  });

  // Persiste qué entidad se mostró como banner bajo una narración (rework 2026-07-24) — el
  // frontend ya decidió cuál mostrar (mentionedEntityBanner.ts, con su propia deduplicación);
  // esto solo guarda esa decisión para que GET /saves/:id la devuelva igual tras una recarga
  // dentro de la ventana de 24h. Nunca se guarda la URL de la imagen, solo la referencia.
  app.patch<{ Params: { id: string; entryId: string }; Body: { entityType: string; entitySlug: string } }>(
    '/saves/:id/log/:entryId/entity-banner',
    async (request, reply) => {
      const { entityType, entitySlug } = request.body;
      if (!entityType || !entitySlug) {
        return reply.status(400).send({ error: 'Faltan campos: entityType, entitySlug' });
      }
      const entry = await prisma.logEntry.findFirst({ where: { id: request.params.entryId, saveId: request.params.id } });
      if (!entry) {
        return reply.status(404).send({ error: 'Entrada de registro no encontrada' });
      }
      await prisma.logEntry.update({
        where: { id: entry.id },
        data: { entityBannerType: entityType, entityBannerSlug: entitySlug },
      });
      return reply.status(204).send();
    },
  );

  // Fase D del hito 0.1 («El mundo vivo, visible») — noticias del mundo que el tick de fondo escribe
  // en el canal WORLD mientras la partida está abierta (expediciones de facción, `noticiasMundo.ts`;
  // etapas de la agenda, `worldAgenda.ts`). Antes solo aparecían al recargar. El cliente pide lo
  // posterior a la última entrada WORLD que ya tiene (`desde` = su id); sin `desde`, nada (no
  // reenvía el registro entero, eso ya lo hace GET /saves/:id). Mismo formato que `worldLog` allí.
  app.get<{ Params: { id: string }; Querystring: { desde?: string } }>('/saves/:id/mundo/nuevas', async (request, reply) => {
    const { id } = request.params;
    const save = await prisma.save.findUnique({ where: { id }, select: { id: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    const desde = request.query.desde;
    if (!desde) return { entradas: [] };
    // UX-29/UX-35: tras un turno que cruzó el día, las noticias del día salen cuando el avance de
    // fondo acaba (el front enciende «El mundo avanza» mientras espera); con un tope.
    await Promise.race([esperarSegundoPlano(id), new Promise((r) => setTimeout(r, ESPERA_FONDO_MS))]);
    const referencia = await prisma.logEntry.findFirst({ where: { id: desde, saveId: id }, select: { createdAt: true } });
    if (!referencia) return { entradas: [] };
    const nuevas = await prisma.logEntry.findMany({
      where: { saveId: id, channel: 'WORLD', createdAt: { gt: referencia.createdAt } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return { entradas: nuevas.map(toFrontendLogEntry) };
  });

  // CR-34 (34e, Q15): la jugadora acepta o rechaza la propuesta de tratado o alianza de una facción
  // (noticia de «El mundo» con plazo). 404 si no existe o ya se respondió o caducó.
  app.post<{ Params: { id: string; propuestaId: string }; Body: { acepta?: unknown } }>('/saves/:id/mundo/propuestas/:propuestaId', async (request, reply) => {
    const { id, propuestaId } = request.params;
    if (typeof request.body?.acepta !== 'boolean') return reply.status(400).send({ error: 'Falta "acepta" (true o false)' });
    const r = await responderPropuesta(prisma, id, propuestaId, request.body.acepta);
    if (!r) return reply.status(404).send({ error: 'La propuesta ya no está pendiente' });
    return r;
  });

  // Registro completo de la partida, agrupado por día de ficción (rework 2026-07-24: "el log de
  // personaje solo muestre 24h... si quieres verlo todo vendrá clasificado por días en el diario").
  // A diferencia de GET /saves/:id, aquí no hay ventana de tiempo ni banner de entidad — el Diario
  // es solo texto por diseño, y se pide bajo demanda (al abrir la pestaña), no en cada carga.
  //
  // Diario en pestañas jerárquicas Año → Estación → Día (2026-09-04) — cada `LogEntry` gana
  // `year`/`estacion`/`diaRelativo` (`calendarioFor`, worldClock.ts) además del `day` absoluto de
  // siempre, para que el frontend agrupe en 3 niveles sin recalcular nada. Los capítulos
  // (`SessionSummary`, "Resumen por capítulos") se fusionan aquí mismo — antes vivían aparte, sin
  // fecha, cargados por `GET /saves/:id` (`chapters`, ahora eliminado de ahí): con `fictionalMinutes`
  // ya persistido (ver chapterSummary.ts) se ubican en su día real e intercalan con `kind: 'chapter'`;
  // los capítulos viejos sin esa fecha (`fictionalMinutes: null`) van aparte en `unplacedChapters`,
  // sin inventarles una fecha falsa.
  app.get<{ Params: { id: string } }>('/saves/:id/diario', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    const [logEntries, summaries] = await Promise.all([
      prisma.logEntry.findMany({ where: { saveId: save.id }, orderBy: { createdAt: 'asc' } }),
      prisma.sessionSummary.findMany({ where: { saveId: save.id }, orderBy: { chapterNumber: 'asc' } }),
    ]);
    const entries = logEntries.map((e) => {
      const { diaAbsoluto, ...calendario } = calendarioFor(e.fictionalMinutes);
      return { ...toFrontendLogEntry(e), kind: 'entry' as const, day: diaAbsoluto, ...calendario };
    });
    const placedChapters = summaries
      .filter((s) => s.fictionalMinutes !== null)
      .map((s) => {
        const { diaAbsoluto: _diaAbsoluto, ...calendario } = calendarioFor(s.fictionalMinutes!);
        return { kind: 'chapter' as const, chapterNumber: s.chapterNumber, summary: s.summary, createdAt: s.createdAt.toISOString(), ...calendario };
      });
    const unplacedChapters = summaries
      .filter((s) => s.fictionalMinutes === null)
      .map((s) => ({ chapterNumber: s.chapterNumber, summary: s.summary }));
    return { entries: [...entries, ...placedChapters], unplacedChapters };
  });
}
