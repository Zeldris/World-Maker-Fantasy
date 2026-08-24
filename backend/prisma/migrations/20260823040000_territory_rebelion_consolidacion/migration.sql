-- Grupo 3 § Territory.control/population (2026-08-23): conecta la felicidad diaria del reino
-- (KingdomStats, calculada pero sin efecto hasta ahora) con la consolidación/rebelión de
-- territorios y el estado de sus edificios, tal como ya lo diseñaba docs/10-niveles-xp-reino.md.

-- AlterTable
ALTER TABLE "KingdomStats" ADD COLUMN "diasFelicidadAlta" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KingdomStats" ADD COLUMN "diasFelicidadBaja" INTEGER NOT NULL DEFAULT 0;
