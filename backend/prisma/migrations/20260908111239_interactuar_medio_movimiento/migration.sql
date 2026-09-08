-- CreateEnum
CREATE TYPE "MedioMovimiento" AS ENUM ('TERRESTRE', 'AEREO', 'ACUATICO');

-- AlterTable
ALTER TABLE "Npc" ADD COLUMN     "medio" "MedioMovimiento" NOT NULL DEFAULT 'TERRESTRE';
