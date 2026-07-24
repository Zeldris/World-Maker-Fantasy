-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('ACTIVA', 'COMPLETADA', 'FALLIDA');

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'ACTIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quest_saveId_idx" ON "Quest"("saveId");

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

