-- Cooldown real de ofertas de modo dinámico (bug real jugando en vivo, 2026-08-27): sin esto la
-- oferta podía repetirse en casi cada turno con candidatos activos.
-- AlterTable
ALTER TABLE "Save" ADD COLUMN "lastDynamicModeOfferAtMinutes" INTEGER;
