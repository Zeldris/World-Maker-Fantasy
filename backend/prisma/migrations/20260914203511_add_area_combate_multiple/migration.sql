-- AlterEnum
ALTER TYPE "AbilityEffect" ADD VALUE 'AREA';

-- AlterTable
ALTER TABLE "CombatParticipant" ADD COLUMN     "areaDefensaPorRondas" INTEGER,
ADD COLUMN     "areaTrampaPorRondas" INTEGER;
