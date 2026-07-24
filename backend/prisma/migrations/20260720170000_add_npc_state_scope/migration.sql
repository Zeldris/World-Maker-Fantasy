-- DropIndex
DROP INDEX "NpcState_saveId_npcId_key";

-- AlterTable
ALTER TABLE "NpcState" ADD COLUMN "scope" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "NpcState_saveId_npcId_scope_key" ON "NpcState"("saveId", "npcId", "scope");
