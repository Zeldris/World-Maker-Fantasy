-- CreateTable
CREATE TABLE "Faction" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "raza" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriaEntry" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "era" TEXT NOT NULL,
    "year" INTEGER,
    "text" TEXT NOT NULL,
    "requiresTranslation" BOOLEAN NOT NULL DEFAULT false,
    "documentoItemSlug" TEXT NOT NULL,
    "translatorNpcSlug" TEXT,

    CONSTRAINT "HistoriaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Faction_worldId_slug_key" ON "Faction"("worldId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "HistoriaEntry_worldId_slug_key" ON "HistoriaEntry"("worldId", "slug");

-- AddForeignKey
ALTER TABLE "Faction" ADD CONSTRAINT "Faction_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriaEntry" ADD CONSTRAINT "HistoriaEntry_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
