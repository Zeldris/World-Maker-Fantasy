-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "caida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "equiposMilicia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "golpesDefensa" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "asentamientoId" TEXT;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_asentamientoId_fkey" FOREIGN KEY ("asentamientoId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

