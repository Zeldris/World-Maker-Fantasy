-- AlterTable
ALTER TABLE "NpcState" ADD COLUMN "lootedItemNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
