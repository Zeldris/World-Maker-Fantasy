-- Dinamismo del mundo, Pieza 4 (2026-08-27) — "modo dinámico": mini-flujo acotado ofrecido al
-- final de un turno normal.
-- AlterTable
ALTER TABLE "Save" ADD COLUMN "pendingDynamicMode" JSONB;
