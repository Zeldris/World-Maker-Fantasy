-- CreateEnum
CREATE TYPE "Lethality" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "LogChannel" AS ENUM ('CHARACTER', 'WORLD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "World" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "lethality" "Lethality" NOT NULL,
    "factions" TEXT[],
    "theme" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PregeneratedCharacter" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "portraitInitial" TEXT NOT NULL,

    CONSTRAINT "PregeneratedCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Save" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "pregeneratedCharacterId" TEXT,
    "characterName" TEXT NOT NULL,
    "characterArchetype" TEXT NOT NULL,
    "characterOrigin" TEXT NOT NULL,
    "characterMotivation" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "portraitInitial" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Save_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldState" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "fictionalDateLabel" TEXT NOT NULL DEFAULT 'Día 1, mañana',
    "facts" JSONB NOT NULL DEFAULT '[]',
    "agenda" JSONB NOT NULL DEFAULT '[]',
    "factionsStatus" JSONB NOT NULL DEFAULT '{}',
    "lastTickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "channel" "LogChannel" NOT NULL,
    "text" TEXT NOT NULL,
    "roll" JSONB,
    "isPlayerAction" BOOLEAN NOT NULL DEFAULT false,
    "timeLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterTransit" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "busyUntil" TIMESTAMP(3) NOT NULL,
    "zoneContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterTransit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionSummary" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "World_slug_key" ON "World"("slug");

-- CreateIndex
CREATE INDEX "Save_userId_idx" ON "Save"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldState_saveId_key" ON "WorldState"("saveId");

-- CreateIndex
CREATE INDEX "LogEntry_saveId_createdAt_idx" ON "LogEntry"("saveId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterTransit_saveId_key" ON "CharacterTransit"("saveId");

-- CreateIndex
CREATE INDEX "SessionSummary_saveId_chapterNumber_idx" ON "SessionSummary"("saveId", "chapterNumber");

-- AddForeignKey
ALTER TABLE "PregeneratedCharacter" ADD CONSTRAINT "PregeneratedCharacter_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Save" ADD CONSTRAINT "Save_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Save" ADD CONSTRAINT "Save_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldState" ADD CONSTRAINT "WorldState_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterTransit" ADD CONSTRAINT "CharacterTransit_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSummary" ADD CONSTRAINT "SessionSummary_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
