-- Fase 3 § 3a de efectos de clase (2026-08-27, docs/21-roadmap.md) — cierra el hueco de Fase 2
-- (Companion no tenía activeEffects todavía) y añade CONTROL real (multi-objetivo).

-- AlterTable
ALTER TABLE "Companion" ADD COLUMN "activeEffects" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "CombatParticipant" ADD COLUMN "controladoPorRondas" INTEGER;
