-- Grupo 3 § Eventos de clima puntuales (2026-08-24): gate real de clima por yield (umbral de
-- severidad mínima), ver docs/rpgtarkor/clima-tormentas.md. Null = sin restricción de clima.

-- CreateEnum
CREATE TYPE "EstadoClima" AS ENUM ('CLIMA_LLEVABLE', 'VIENTO_FUERTE', 'TORMENTA_GRANDE', 'TORMENTA_EXTREMA');

-- AlterTable
ALTER TABLE "HarvestYield" ADD COLUMN "climaRequerido" "EstadoClima";
