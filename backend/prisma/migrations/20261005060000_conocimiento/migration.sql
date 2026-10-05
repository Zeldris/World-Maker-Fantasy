-- CR-18 (hito 0.2): lo que el personaje sabe de cada suceso (roadmap-cronista.md § 9).
-- CreateEnum
CREATE TYPE "ViaConocimiento" AS ENUM ('TESTIGO', 'OIDAS', 'NPC', 'BANDO', 'ALIADA');

-- CreateTable
CREATE TABLE "Conocimiento" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "sucesoId" TEXT NOT NULL,
    "desde" INTEGER NOT NULL,
    "via" "ViaConocimiento" NOT NULL,
    "confirmado" BOOLEAN NOT NULL,
    "confirmadoEn" INTEGER,
    "logEntryId" TEXT,

    CONSTRAINT "Conocimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conocimiento_saveId_desde_idx" ON "Conocimiento"("saveId", "desde");

-- CreateIndex
CREATE UNIQUE INDEX "Conocimiento_saveId_sucesoId_key" ON "Conocimiento"("saveId", "sucesoId");

-- AddForeignKey
ALTER TABLE "Conocimiento" ADD CONSTRAINT "Conocimiento_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conocimiento" ADD CONSTRAINT "Conocimiento_sucesoId_fkey" FOREIGN KEY ("sucesoId") REFERENCES "Suceso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

