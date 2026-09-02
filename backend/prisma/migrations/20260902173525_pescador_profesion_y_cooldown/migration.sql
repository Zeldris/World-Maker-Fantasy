-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MetodoObtencion" ADD VALUE 'PESCA';
ALTER TYPE "MetodoObtencion" ADD VALUE 'BUSQUEDA';

-- DropIndex
DROP INDEX "Building_locationId_idx";

-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "pescaCooldownDesde" TIMESTAMP(3),
ADD COLUMN     "pescaUsosSeguidos" INTEGER NOT NULL DEFAULT 0;
