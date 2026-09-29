-- CreateEnum
CREATE TYPE "ExpedicionStatus" AS ENUM ('EN_TRANSITO', 'RECOLECTANDO', 'RETORNANDO', 'COMPLETADA', 'INTERCEPTADA');

-- AlterTable
ALTER TABLE "KingdomStats" ADD COLUMN     "ultimoDiaExpedicion" INTEGER;

-- CreateTable
CREATE TABLE "Expedicion" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "destinoLocationId" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,
    "status" "ExpedicionStatus" NOT NULL DEFAULT 'EN_TRANSITO',
    "diaSalida" INTEGER NOT NULL,
    "diaRegreso" INTEGER NOT NULL,
    "riesgo" INTEGER NOT NULL DEFAULT 0,
    "tiradaRiesgo" DOUBLE PRECISION,
    "botin" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expedicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpedicionMember" (
    "id" TEXT NOT NULL,
    "expedicionId" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,

    CONSTRAINT "ExpedicionMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expedicion_factionId_status_idx" ON "Expedicion"("factionId", "status");

-- CreateIndex
CREATE INDEX "Expedicion_worldId_status_idx" ON "Expedicion"("worldId", "status");

-- CreateIndex
CREATE INDEX "ExpedicionMember_expedicionId_idx" ON "ExpedicionMember"("expedicionId");

-- CreateIndex
CREATE INDEX "ExpedicionMember_npcId_idx" ON "ExpedicionMember"("npcId");

-- AddForeignKey
ALTER TABLE "Expedicion" ADD CONSTRAINT "Expedicion_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedicion" ADD CONSTRAINT "Expedicion_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedicion" ADD CONSTRAINT "Expedicion_destinoLocationId_fkey" FOREIGN KEY ("destinoLocationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpedicionMember" ADD CONSTRAINT "ExpedicionMember_expedicionId_fkey" FOREIGN KEY ("expedicionId") REFERENCES "Expedicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpedicionMember" ADD CONSTRAINT "ExpedicionMember_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

