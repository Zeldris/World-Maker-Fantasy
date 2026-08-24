-- Grupo 3 § HarvestYield.condicion (2026-08-23): bypass real de la tirada de recolección para
-- recursos de reconocimiento trivial ("no requiere tirada" en la propia condición narrativa).

-- AlterTable
ALTER TABLE "HarvestYield" ADD COLUMN "sinTirada" BOOLEAN NOT NULL DEFAULT false;
