-- CreateEnum
CREATE TYPE "NpcInteractionType" AS ENUM ('MAESTRO_OFICIO', 'NPC_MISION', 'NPC_LORE');

-- AlterTable
ALTER TABLE "Npc" ADD COLUMN     "interactionTypes" "NpcInteractionType"[] DEFAULT ARRAY[]::"NpcInteractionType"[];

-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "pendingNpcInteractionOffer" JSONB;
