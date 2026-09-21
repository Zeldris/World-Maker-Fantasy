-- Concepto de "parcela" estilo Travian/Tribal Wars (docs/rpgtarkor/mundo-vivo-x4.md § 7.4,
-- 2026-09-21) — hueco de construcción marcado a priori en el PNG de una zona-interior, distinto
-- de ZonePoint (entidad viva que se mueve/agota).

-- CreateEnum
CREATE TYPE "ParcelaTipo" AS ENUM ('BASICA', 'AVANZADA');

-- CreateTable
CREATE TABLE "Parcela" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "tipo" "ParcelaTipo" NOT NULL,
    "recipeKeyFijo" TEXT,
    "buildingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parcela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parcela_buildingId_key" ON "Parcela"("buildingId");

-- CreateIndex
CREATE INDEX "Parcela_locationId_idx" ON "Parcela"("locationId");

-- AddForeignKey
ALTER TABLE "Parcela" ADD CONSTRAINT "Parcela_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcela" ADD CONSTRAINT "Parcela_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
