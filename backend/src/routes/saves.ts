import type { FastifyInstance } from 'fastify';
import { creationRoutes } from './saves/creation.js';
import { detailRoutes } from './saves/detail.js';
import { sessionRoutes } from './saves/session.js';
import { progressionRoutes } from './saves/progression.js';
import { habilidadesRoutes } from './saves/habilidades.js';
import { inventarioRoutes } from './saves/inventario.js';
import { logRoutes } from './saves/log.js';
import { listRoutes } from './saves/list.js';

/// Rutas de persistencia real de partidas (decisión 2026-07-17: /turn y /entorno dejan de ser
/// stateless — el frontend crea una partida una vez y a partir de ahí solo manda `saveId`).
///
/// Deuda técnica (2026-07-30, "control de deuda técnica" — evaluación de god-files): este archivo
/// llegó a tener ~1060 líneas y 16 endpoints sin ninguna cohesión propia más allá de "todos tocan
/// Save". Dividido por CONCERN real (`saves/`), no por tamaño arbitrario — cada submódulo es un
/// plugin de Fastify independiente, y este archivo queda como la única lista de qué existe.
export async function savesRoutes(app: FastifyInstance) {
  await app.register(creationRoutes);
  await app.register(detailRoutes);
  await app.register(sessionRoutes);
  await app.register(progressionRoutes);
  await app.register(habilidadesRoutes);
  await app.register(inventarioRoutes);
  await app.register(logRoutes);
  await app.register(listRoutes);
}
