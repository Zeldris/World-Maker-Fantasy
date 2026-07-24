-- CreateEnum
CREATE TYPE "AbilityEffect" AS ENUM ('ATAQUE', 'ATURDIMIENTO', 'REMATE', 'INTIMIDACION', 'AGUANTE');

-- AlterTable
ALTER TABLE "SavedAction" ADD COLUMN "effect" "AbilityEffect";
ALTER TABLE "SavedAction" ADD COLUMN "preferredAttribute" TEXT;
