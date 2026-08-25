-- Grupo 3 § Combate múltiple (2026-08-25, integración real con la caza en grupo) —
-- CombatParticipant.condicionFisicaGrupo, única excepción al criterio de "nunca duplica
-- condición/atributos": varios individuos reales de un grupo cazado comparten el mismo
-- (npcId, npcScope) de NpcState (1 fila por especie+ubicación), así que necesitan un sitio propio
-- donde guardar SU condición individual real.

-- AlterTable
ALTER TABLE "CombatParticipant" ADD COLUMN "condicionFisicaGrupo" "CondicionFisica";
