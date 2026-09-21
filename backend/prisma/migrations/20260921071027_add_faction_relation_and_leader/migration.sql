-- Motor de disputas genérico estilo X4 (docs/rpgtarkor/mundo-vivo-x4.md § 4.3, 2026-09-21):
-- Faction.liderNpcId (Inteligencia real de la que depende su autonomía) + FactionRelation
-- (dirigida, sustituye el único conflicto hardcodeado de worldAgenda.ts).

-- CreateEnum
CREATE TYPE "FactionRelationType" AS ENUM ('NEUTRAL', 'TENSION', 'GUERRA', 'ALIANZA', 'TRATADO_COMERCIAL');

-- AlterTable
ALTER TABLE "Faction" ADD COLUMN     "liderNpcId" TEXT;

-- CreateTable
CREATE TABLE "FactionRelation" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "sourceFactionId" TEXT NOT NULL,
    "targetFactionId" TEXT NOT NULL,
    "type" "FactionRelationType" NOT NULL DEFAULT 'NEUTRAL',
    "presion" INTEGER NOT NULL DEFAULT 0,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "maxStage" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactionRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactionRelation_worldId_idx" ON "FactionRelation"("worldId");

-- CreateIndex
CREATE UNIQUE INDEX "FactionRelation_sourceFactionId_targetFactionId_key" ON "FactionRelation"("sourceFactionId", "targetFactionId");

-- AddForeignKey
ALTER TABLE "Faction" ADD CONSTRAINT "Faction_liderNpcId_fkey" FOREIGN KEY ("liderNpcId") REFERENCES "Npc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionRelation" ADD CONSTRAINT "FactionRelation_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionRelation" ADD CONSTRAINT "FactionRelation_sourceFactionId_fkey" FOREIGN KEY ("sourceFactionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionRelation" ADD CONSTRAINT "FactionRelation_targetFactionId_fkey" FOREIGN KEY ("targetFactionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
