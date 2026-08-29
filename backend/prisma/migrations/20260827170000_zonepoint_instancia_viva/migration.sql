-- Dinamismo del mundo, Pieza 3 (2026-08-27) — ZonePoint pasa de catálogo estático a instancia viva.

-- AlterEnum
ALTER TYPE "ZonePointTipo" ADD VALUE 'EDIFICIO';

-- AlterTable
ALTER TABLE "ZonePoint" ADD COLUMN "cantidad" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "factionSlug" TEXT,
ADD COLUMN "lastUpdatedAtMinutes" INTEGER;
