-- Objetivo individual real (2026-08-26, docs/21-roadmap.md § Fase 3) — marca si la ronda ACTUAL
-- de un CombatEncounter todavía no tiene el enganche (duelo/golpe gratis) decidido del todo
-- porque falta saber a quién quiere atacar la jugadora.

-- AlterTable
ALTER TABLE "CombatEncounter" ADD COLUMN "esperandoEleccionJugadora" BOOLEAN NOT NULL DEFAULT false;
