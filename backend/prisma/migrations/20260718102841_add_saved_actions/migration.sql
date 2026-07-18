-- CreateTable
CREATE TABLE "SavedAction" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedAction_saveId_idx" ON "SavedAction"("saveId");

-- AddForeignKey
ALTER TABLE "SavedAction" ADD CONSTRAINT "SavedAction_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

