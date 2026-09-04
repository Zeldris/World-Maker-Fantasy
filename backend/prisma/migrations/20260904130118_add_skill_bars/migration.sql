-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "activeSkillBarId" TEXT;

-- CreateTable
CREATE TABLE "SkillBar" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Barra 1',
    "abilityNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillBar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillBar_saveId_idx" ON "SkillBar"("saveId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillBar_saveId_category_slotIndex_key" ON "SkillBar"("saveId", "category", "slotIndex");

-- AddForeignKey
ALTER TABLE "SkillBar" ADD CONSTRAINT "SkillBar_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
