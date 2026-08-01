-- AlterTable
ALTER TABLE "WorldState" DROP COLUMN "facts";

-- CreateTable
CREATE TABLE "SessionFact" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionFact_saveId_createdAt_idx" ON "SessionFact"("saveId", "createdAt");

-- AddForeignKey
ALTER TABLE "SessionFact" ADD CONSTRAINT "SessionFact_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
