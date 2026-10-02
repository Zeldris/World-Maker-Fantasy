import type { FastifyInstance } from 'fastify';
import type { FamiliaSuceso, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { formatFictionalDate } from '../../services/worldClock.js';

const FAMILIAS: FamiliaSuceso[] = ['CLIMA', 'NATURAL', 'VIDA_MUERTE', 'DIPLOMACIA', 'FACCION', 'ECONOMIA', 'REINO', 'JUGADOR', 'LORE', 'SISTEMA'];
const LIMITE_MAX = 200;

/// Libro de Sucesos, vista de administración (CR-4, hito 0.2 — roadmap-cronista.md § 15): solo
/// lectura, lo más reciente primero. Filtros opcionales por familia, tipo e importancia mínima;
/// `antesDe` (id de suceso) pagina hacia atrás. Es para revisar a mano qué ha registrado el motor
/// (causas y efectos incluidos), no algo que vea el jugador.
export async function libroRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { familia?: string; tipo?: string; importanciaMin?: string; limite?: string; antesDe?: string } }>(
    '/saves/:id/libro',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, characterName: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

      const { familia, tipo, importanciaMin, limite, antesDe } = request.query;
      if (familia && !FAMILIAS.includes(familia as FamiliaSuceso)) return reply.status(400).send({ error: `Familia desconocida: ${familia}` });
      const take = Math.min(LIMITE_MAX, Math.max(1, Number(limite) || 50));
      const minimo = Number(importanciaMin);

      let cursor: Prisma.SucesoWhereInput = {};
      if (antesDe) {
        const ref = await prisma.suceso.findFirst({ where: { id: antesDe, saveId: save.id }, select: { createdAt: true } });
        if (ref) cursor = { createdAt: { lt: ref.createdAt } };
      }

      const filas = await prisma.suceso.findMany({
        where: {
          saveId: save.id,
          ...(familia ? { familia: familia as FamiliaSuceso } : {}),
          ...(tipo ? { tipo } : {}),
          ...(Number.isFinite(minimo) && minimo > 0 ? { importancia: { gte: minimo } } : {}),
          ...cursor,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        include: { actores: true, causas: { select: { causaId: true } }, efectos: { select: { efectoId: true } } },
      });
      const hayMas = filas.length > take;
      const sucesos = filas.slice(0, take).map((s) => ({
        id: s.id,
        tipo: s.tipo,
        familia: s.familia,
        fictionalMinutes: s.fictionalMinutes,
        fecha: formatFictionalDate(s.fictionalMinutes),
        regionSlug: s.regionSlug,
        importancia: s.importancia,
        origen: s.origen,
        texto: s.texto,
        textoNarrado: s.textoNarrado,
        datos: s.datos,
        actores: s.actores.map((a) => ({ entidadTipo: a.entidadTipo, entidadId: a.entidadId, papel: a.papel })),
        causaIds: s.causas.map((c) => c.causaId),
        efectoIds: s.efectos.map((e) => e.efectoId),
        logEntryId: s.logEntryId,
      }));
      const total = await prisma.suceso.count({ where: { saveId: save.id } });
      return { personaje: save.characterName, total, sucesos, hayMas };
    },
  );
}
