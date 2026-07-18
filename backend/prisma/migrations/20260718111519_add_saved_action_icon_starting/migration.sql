-- AlterTable
ALTER TABLE "SavedAction" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "icon" TEXT NOT NULL DEFAULT '✨',
ADD COLUMN     "isStarting" BOOLEAN NOT NULL DEFAULT false;

