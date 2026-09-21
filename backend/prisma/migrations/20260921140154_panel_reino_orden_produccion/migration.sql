-- Panel de Reino real (docs/rpgtarkor/mundo-vivo-x4.md § 4.4-ter, 2026-09-21)

-- AlterTable
ALTER TABLE "Companion" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "ProfessionProgress" ADD COLUMN     "companionId" TEXT,
ALTER COLUMN "saveId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OrdenProduccion" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "recipeKey" TEXT NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'reponer',
    "limite" INTEGER,
    "prioridad" INTEGER NOT NULL DEFAULT 5,
    "cantidadProducidaAcumulada" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenProduccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlmacenLimite" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "catalogSlug" TEXT NOT NULL,
    "limite" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlmacenLimite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrdenProduccion_buildingId_idx" ON "OrdenProduccion"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenProduccion_buildingId_recipeKey_key" ON "OrdenProduccion"("buildingId", "recipeKey");

-- CreateIndex
CREATE INDEX "AlmacenLimite_saveId_idx" ON "AlmacenLimite"("saveId");

-- CreateIndex
CREATE UNIQUE INDEX "AlmacenLimite_saveId_catalogSlug_key" ON "AlmacenLimite"("saveId", "catalogSlug");

-- CreateIndex
CREATE INDEX "Companion_buildingId_idx" ON "Companion"("buildingId");

-- CreateIndex
CREATE INDEX "ProfessionProgress_companionId_idx" ON "ProfessionProgress"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionProgress_companionId_professionId_key" ON "ProfessionProgress"("companionId", "professionId");

-- AddForeignKey
ALTER TABLE "Companion" ADD CONSTRAINT "Companion_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionProgress" ADD CONSTRAINT "ProfessionProgress_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenProduccion" ADD CONSTRAINT "OrdenProduccion_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmacenLimite" ADD CONSTRAINT "AlmacenLimite_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
