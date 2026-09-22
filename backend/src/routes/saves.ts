import type { FastifyInstance } from 'fastify';
import { creationRoutes } from './saves/creation.js';
import { detailRoutes } from './saves/detail.js';
import { sessionRoutes } from './saves/session.js';
import { progressionRoutes } from './saves/progression.js';
import { habilidadesRoutes } from './saves/habilidades.js';
import { skillBarsRoutes } from './saves/skillBars.js';
import { inventarioRoutes } from './saves/inventario.js';
import { logRoutes } from './saves/log.js';
import { listRoutes } from './saves/list.js';
import { reinoRoutes } from './saves/reino.js';
import { recolectarRoutes } from './saves/recolectar.js';
import { cazarRoutes } from './saves/cazar.js';
import { recipesStatusRoutes } from './saves/recipesStatus.js';
import { parcelasRoutes } from './saves/parcelas.js';
import { almacenLimiteRoutes } from './saves/almacenLimite.js';
import { ordenesProduccionRoutes } from './saves/ordenesProduccion.js';
import { suggestionsRoutes } from './saves/suggestions.js';
import { panelsRoutes } from './saves/panels.js';
import { companerosRoutes } from './saves/companeros.js';
import { combatGroupsRoutes } from './saves/combatGroups.js';
import { descansarCampamentoRoutes } from './saves/descansarCampamento.js';
import { zonaRoutes } from './saves/zona.js';
import { questsRoutes } from './saves/quests.js';
import { dynamicModeRoutes } from './saves/dynamicMode.js';
import { dynamicModeRecursoRoutes } from './saves/dynamicModeRecurso.js';
import { deathRoutes } from './saves/death.js';
import { entregaRoutes } from './saves/entrega.js';
import { aprenderOficioRoutes } from './saves/aprenderOficio.js';
import { npcInteractionRoutes } from './saves/npcInteraction.js';

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
  await app.register(skillBarsRoutes);
  await app.register(inventarioRoutes);
  await app.register(logRoutes);
  await app.register(listRoutes);
  await app.register(reinoRoutes);
  await app.register(recolectarRoutes);
  await app.register(cazarRoutes);
  await app.register(recipesStatusRoutes);
  await app.register(parcelasRoutes);
  await app.register(almacenLimiteRoutes);
  await app.register(ordenesProduccionRoutes);
  await app.register(suggestionsRoutes);
  await app.register(panelsRoutes);
  await app.register(companerosRoutes);
  await app.register(combatGroupsRoutes);
  await app.register(descansarCampamentoRoutes);
  await app.register(zonaRoutes);
  await app.register(questsRoutes);
  await app.register(dynamicModeRoutes);
  await app.register(dynamicModeRecursoRoutes);
  await app.register(deathRoutes);
  await app.register(entregaRoutes);
  await app.register(aprenderOficioRoutes);
  await app.register(npcInteractionRoutes);
}
