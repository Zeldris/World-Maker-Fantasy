-- AlterTable: nivel del Ayuntamiento (1/2/3 = pequeño/mediano/grande). Null para el resto de
-- construcciones, que no tienen tiers (docs/17-reglas-construcciones-reino.md).
ALTER TABLE "Building" ADD COLUMN "tier" INTEGER;
