-- CreateEnum
CREATE TYPE "AbilityRol" AS ENUM ('ataque', 'defensa', 'utilidad');

-- AlterTable
ALTER TABLE "SavedAction" ADD COLUMN "rol" "AbilityRol";

-- AlterTable
ALTER TABLE "NpcState" ADD COLUMN "analizado" BOOLEAN NOT NULL DEFAULT false;
