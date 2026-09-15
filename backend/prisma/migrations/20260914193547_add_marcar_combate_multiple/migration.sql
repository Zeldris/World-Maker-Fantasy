-- AlterEnum
ALTER TYPE "AbilityEffect" ADD VALUE 'MARCAR';

-- AlterTable
ALTER TABLE "CombatParticipant" ADD COLUMN     "marcaObjetivoId" TEXT,
ADD COLUMN     "marcaObjetivoRondas" INTEGER;
