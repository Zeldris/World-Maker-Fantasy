-- Fase 3 § 3c de efectos de clase (2026-08-27, docs/21-roadmap.md) — OCULTACION real (DESVIAR no
-- necesita columna nueva, se resuelve dentro del mismo intercambio).

-- AlterTable
ALTER TABLE "CombatParticipant" ADD COLUMN "ocultoPorRondas" INTEGER;
