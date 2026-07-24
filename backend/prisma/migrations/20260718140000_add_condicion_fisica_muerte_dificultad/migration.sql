-- CreateEnum
CREATE TYPE "CondicionFisica" AS ENUM ('ILESO', 'HERIDO', 'GRAVE', 'INCAPACITADO', 'MUERTO');

-- CreateEnum
CREATE TYPE "Dificultad" AS ENUM ('NOVATO', 'MEDIO', 'AVANZADO');

-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "condicionFisica" "CondicionFisica" NOT NULL DEFAULT 'ILESO',
ADD COLUMN     "deathCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dificultad" "Dificultad" NOT NULL DEFAULT 'MEDIO',
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "lastRestLocationId" TEXT;

-- AddForeignKey
ALTER TABLE "Save" ADD CONSTRAINT "Save_lastRestLocationId_fkey" FOREIGN KEY ("lastRestLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

