-- CR-11 (hito 0.2, roadmap-cronista.md § 7.2): consecuencias aplazadas.
-- CreateEnum
CREATE TYPE "EstadoConsecuencia" AS ENUM ('PENDIENTE', 'DISPARADA', 'CADUCADA', 'ANULADA');

-- CreateTable
CREATE TABLE "Consecuencia" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "regla" TEXT NOT NULL,
    "estado" "EstadoConsecuencia" NOT NULL DEFAULT 'PENDIENTE',
    "tipoDisparo" TEXT NOT NULL,
    "disparo" JSONB NOT NULL,
    "desdeDia" INTEGER NOT NULL DEFAULT 0,
    "regionSlug" TEXT,
    "npcId" TEXT,
    "caducaEn" INTEGER,
    "datos" JSONB NOT NULL,
    "origenSucesoId" TEXT,
    "creadaEn" INTEGER NOT NULL,
    "resueltaEn" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consecuencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consecuencia_saveId_estado_tipoDisparo_idx" ON "Consecuencia"("saveId", "estado", "tipoDisparo");

-- AddForeignKey
ALTER TABLE "Consecuencia" ADD CONSTRAINT "Consecuencia_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

