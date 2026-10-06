-- AlterTable
ALTER TABLE "KingdomStats" ADD COLUMN     "forraje" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ganadoDiasSinBeber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ganadoDiasSinComer" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Ganado" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "especie" TEXT NOT NULL,
    "sexo" TEXT NOT NULL,
    "nacidoEn" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ganado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ganado_saveId_idx" ON "Ganado"("saveId");

-- CreateIndex
CREATE INDEX "Ganado_buildingId_idx" ON "Ganado"("buildingId");

-- AddForeignKey
ALTER TABLE "Ganado" ADD CONSTRAINT "Ganado_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ganado" ADD CONSTRAINT "Ganado_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

