-- Grupo 3 § Sistema de estaciones (2026-08-24): gate real de estación por yield, ver
-- docs/rpgtarkor/estaciones.md. Null = disponible todo el año (comportamiento de siempre).

-- CreateEnum
CREATE TYPE "Estacion" AS ENUM ('PRIMAVERA', 'VERANO', 'OTONO', 'INVIERNO');

-- AlterTable
ALTER TABLE "HarvestYield" ADD COLUMN "estacionRequerida" "Estacion";
