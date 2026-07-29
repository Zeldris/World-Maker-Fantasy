-- AlterTable
ALTER TABLE "Save" ADD COLUMN "raza" TEXT;

-- AlterTable
ALTER TABLE "SavedAction" ADD COLUMN "isDynamic" BOOLEAN NOT NULL DEFAULT false;
