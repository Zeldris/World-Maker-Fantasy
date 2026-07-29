-- AlterTable
ALTER TABLE "Save" ADD COLUMN "energia" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "SavedAction" ADD COLUMN "energyCost" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ItemCatalog" ADD COLUMN "curaEnergia" INTEGER;
