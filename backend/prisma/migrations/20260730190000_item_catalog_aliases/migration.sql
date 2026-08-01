-- AlterTable
ALTER TABLE "ItemCatalog" ADD COLUMN "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
