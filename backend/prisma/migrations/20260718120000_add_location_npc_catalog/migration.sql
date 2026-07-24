-- CreateEnum
CREATE TYPE "NpcKind" AS ENUM ('PRINCIPAL', 'PLANTILLA');

-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "currentLocationId" TEXT;

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "aliases" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationLink" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "minutosBase" INTEGER NOT NULL,
    "terreno" TEXT NOT NULL,
    "riesgo" TEXT,

    CONSTRAINT "LocationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationVisit" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Npc" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "kind" "NpcKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "faction" TEXT,
    "role" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "levelMax" INTEGER,
    "attributes" JSONB NOT NULL,
    "bio" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "homeLocationSlug" TEXT,

    CONSTRAINT "Npc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCatalog" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpcItem" (
    "id" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "notas" TEXT,

    CONSTRAINT "NpcItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarvestYield" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "condicion" TEXT,

    CONSTRAINT "HarvestYield_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_worldId_slug_key" ON "Location"("worldId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "LocationLink_fromId_toId_key" ON "LocationLink"("fromId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationVisit_saveId_locationId_key" ON "LocationVisit"("saveId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Npc_worldId_slug_key" ON "Npc"("worldId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCatalog_worldId_slug_key" ON "ItemCatalog"("worldId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "NpcItem_npcId_itemId_key" ON "NpcItem"("npcId", "itemId");

-- CreateIndex
CREATE INDEX "HarvestYield_worldId_sourceSlug_idx" ON "HarvestYield"("worldId", "sourceSlug");

-- AddForeignKey
ALTER TABLE "Save" ADD CONSTRAINT "Save_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationLink" ADD CONSTRAINT "LocationLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationLink" ADD CONSTRAINT "LocationLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationVisit" ADD CONSTRAINT "LocationVisit_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationVisit" ADD CONSTRAINT "LocationVisit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Npc" ADD CONSTRAINT "Npc_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCatalog" ADD CONSTRAINT "ItemCatalog_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpcItem" ADD CONSTRAINT "NpcItem_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpcItem" ADD CONSTRAINT "NpcItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestYield" ADD CONSTRAINT "HarvestYield_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestYield" ADD CONSTRAINT "HarvestYield_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

