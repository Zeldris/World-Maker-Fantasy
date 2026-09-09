-- AlterTable
ALTER TABLE "Companion" ADD COLUMN     "combatGroupSlotIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CombatGroup" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CombatGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CombatGroup_saveId_idx" ON "CombatGroup"("saveId");

-- CreateIndex
CREATE UNIQUE INDEX "CombatGroup_saveId_slotIndex_key" ON "CombatGroup"("saveId", "slotIndex");

-- CreateIndex
CREATE INDEX "Companion_saveId_combatGroupSlotIndex_idx" ON "Companion"("saveId", "combatGroupSlotIndex");

-- AddForeignKey
ALTER TABLE "CombatGroup" ADD CONSTRAINT "CombatGroup_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
