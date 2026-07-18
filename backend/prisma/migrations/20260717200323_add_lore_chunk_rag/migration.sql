-- CreateEnum
CREATE TYPE "LoreChunkType" AS ENUM ('FAUNA', 'FLORA', 'NPC', 'CLAN', 'REGION', 'LOOT', 'CULTURA', 'PERSONAJE', 'CONTRATO');

-- CreateTable
CREATE TABLE "LoreChunk" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "type" "LoreChunkType" NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tags" TEXT[],
    "sourceDoc" TEXT NOT NULL,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoreChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoreChunk_worldId_idx" ON "LoreChunk"("worldId");

-- AddForeignKey
ALTER TABLE "LoreChunk" ADD CONSTRAINT "LoreChunk_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
