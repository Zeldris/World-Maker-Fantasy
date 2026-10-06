-- AlterTable
ALTER TABLE "KingdomStats" ADD COLUMN     "ganadoSembrado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GanadoFaccion" (
    "id" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "especie" TEXT NOT NULL,
    "sexo" TEXT NOT NULL,
    "nacidoEnDia" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "GanadoFaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GanadoFaccion_factionId_idx" ON "GanadoFaccion"("factionId");

-- AddForeignKey
ALTER TABLE "GanadoFaccion" ADD CONSTRAINT "GanadoFaccion_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

