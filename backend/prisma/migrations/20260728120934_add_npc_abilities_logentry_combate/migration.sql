-- AlterTable
ALTER TABLE "Npc" ADD COLUMN     "abilities" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "LogEntry" ADD COLUMN     "combate" BOOLEAN NOT NULL DEFAULT false;
