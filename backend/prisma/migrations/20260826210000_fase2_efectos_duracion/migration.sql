-- Fase 2 de efectos de clase (2026-08-26, docs/21-roadmap.md) — AUMENTO/DEBILIDAD con duración
-- real por turnos. activeEffects: mismo patrón que NpcState.abilityUsesThisEncounter (JSON,
-- resetea a vacío cuando condicionFisica vuelve a ILESO). durationEffectMagnitude/Turns: mismo
-- patrón que SavedAction.attributeBonus, una cifra fija por habilidad.

-- AlterTable
ALTER TABLE "Save" ADD COLUMN "activeEffects" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "NpcState" ADD COLUMN "activeEffects" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "SavedAction" ADD COLUMN "durationEffectMagnitude" INTEGER;
ALTER TABLE "SavedAction" ADD COLUMN "durationEffectTurns" INTEGER;
