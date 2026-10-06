// CR-14 (hito 0.3, 14c): las etiquetas del personaje para su ficha — los títulos activos y los que
// perdió, con el suceso que los dio.
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export async function etiquetasRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/saves/:id/etiquetas', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    const filas = await prisma.etiqueta.findMany({
      where: { saveId: save.id, entidadTipo: 'PERSONAJE' },
      orderBy: [{ activa: 'desc' }, { desdeMinutes: 'desc' }],
    });
    // El porqué: el suceso que la causó (la causa de ETIQUETA_GANADA), o el propio suceso si no tiene.
    const sucesos = await prisma.suceso.findMany({
      where: { id: { in: filas.map((f) => f.sucesoId) } },
      select: { id: true, texto: true, causas: { select: { causa: { select: { texto: true } } } } },
    });
    const porque = new Map(sucesos.map((s) => [s.id, s.causas[0]?.causa.texto ?? s.texto]));
    return {
      etiquetas: filas.map((f) => ({ clave: f.clave, texto: f.texto, activa: f.activa, desdeMinutes: f.desdeMinutes, porque: porque.get(f.sucesoId) ?? null })),
    };
  });
}
