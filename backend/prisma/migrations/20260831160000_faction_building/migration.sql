-- CreateTable
CREATE TABLE "FactionBuilding" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "factionSlug" TEXT NOT NULL,
    "locationSlug" TEXT NOT NULL,
    "profession" TEXT,
    "tier" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "FactionBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactionBuilding_locationSlug_idx" ON "FactionBuilding"("locationSlug");

-- CreateIndex
CREATE UNIQUE INDEX "FactionBuilding_worldId_slug_key" ON "FactionBuilding"("worldId", "slug");

-- AddForeignKey
ALTER TABLE "FactionBuilding" ADD CONSTRAINT "FactionBuilding_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
