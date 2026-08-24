-- Grupo 3 § HarvestYield.condicion / Building.status (2026-08-23): gate de herramienta POR YIELD
-- (corrige el intento anterior, que bloqueaba el oficio de minero entero vía
-- OFICIOS_CON_HERRAMIENTA_REQUERIDA — bug real encontrado en recolectar.integration.test.ts).

-- AlterTable
ALTER TABLE "HarvestYield" ADD COLUMN "requiereHerramienta" BOOLEAN NOT NULL DEFAULT false;
