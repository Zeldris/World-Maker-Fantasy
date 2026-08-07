-- AlterTable
ALTER TABLE "Faction" ADD COLUMN "saveId" TEXT;

-- AddForeignKey
ALTER TABLE "Faction" ADD CONSTRAINT "Faction_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
