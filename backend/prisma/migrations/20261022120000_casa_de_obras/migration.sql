-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "nivelConstructor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "xpConstructor" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ObraCola" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "recipeKey" TEXT,
    "buildingId" TEXT,
    "tier" INTEGER NOT NULL,
    "dias" INTEGER NOT NULL,
    "diasHechos" INTEGER NOT NULL DEFAULT 0,
    "gastados" INTEGER NOT NULL DEFAULT 0,
    "aviso" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraCola_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObraCola_saveId_orden_idx" ON "ObraCola"("saveId", "orden");

-- AddForeignKey
ALTER TABLE "ObraCola" ADD CONSTRAINT "ObraCola_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

