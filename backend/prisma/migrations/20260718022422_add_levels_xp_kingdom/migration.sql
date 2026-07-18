-- CreateEnum
CREATE TYPE "TerritoryControl" AS ENUM ('RECLAMADO', 'DISPUTADO', 'CONSOLIDADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "BuildingStatus" AS ENUM ('EN_CONSTRUCCION', 'ACTIVO', 'DANADO', 'ABANDONADO');

-- AlterTable
ALTER TABLE "LogEntry" ADD COLUMN     "xpDelta" INTEGER;

-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "kingdomName" TEXT,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "pendingAttributePoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "description" TEXT NOT NULL,
    "control" "TerritoryControl" NOT NULL DEFAULT 'RECLAMADO',
    "population" INTEGER NOT NULL DEFAULT 0,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "territoryId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "BuildingStatus" NOT NULL DEFAULT 'EN_CONSTRUCCION',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "territoryId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Territory_saveId_idx" ON "Territory"("saveId");

-- CreateIndex
CREATE INDEX "Building_saveId_idx" ON "Building"("saveId");

-- CreateIndex
CREATE INDEX "Subject_saveId_idx" ON "Subject"("saveId");

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

