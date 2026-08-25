-- Grupo 3 § Mundo determinista (docs/rpgtarkor/mundo-determinista.md, 2026-08-25) — Capa 1: zonas
-- navegables. ZonePoint = posición LOCAL real dentro del lienzo de una zona (fauna/recurso/NPC),
-- prototipo en una sola Location antes de repetir en el resto. No confundir con Location.x/y
-- (posición GLOBAL en km reales, solo para la Brújula).
--
-- Excluye a propósito (deriva preexistente sin relación, ya documentada en migraciones anteriores):
-- el reordenamiento de AbilityEffect y el DROP INDEX "Building_locationId_idx" que `prisma migrate
-- diff` sigue proponiendo desde antes de esta pasada.

-- CreateEnum
CREATE TYPE "ZonePointTipo" AS ENUM ('FAUNA', 'RECURSO', 'NPC');

-- CreateTable
CREATE TABLE "ZonePoint" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "tipo" "ZonePointTipo" NOT NULL,
    "targetSlug" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZonePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZonePoint_locationId_idx" ON "ZonePoint"("locationId");

-- AddForeignKey
ALTER TABLE "ZonePoint" ADD CONSTRAINT "ZonePoint_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
