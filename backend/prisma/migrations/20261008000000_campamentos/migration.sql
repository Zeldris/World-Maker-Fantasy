-- CreateTable
CREATE TABLE "Campamento" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "ocupante" TEXT NOT NULL,
    "cabecilla" TEXT NOT NULL,
    "gente" INTEGER NOT NULL,
    "tope" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "creadoDia" INTEGER NOT NULL,
    "caidoDia" INTEGER,
    "ultimoRefuerzoDia" INTEGER NOT NULL,
    "ultimoAsaltoReinoDia" INTEGER,
    "botinComida" INTEGER NOT NULL DEFAULT 0,
    "botinGoirnos" INTEGER NOT NULL DEFAULT 0,
    "conocido" BOOLEAN NOT NULL DEFAULT false,
    "zonePointId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campamento_saveId_estado_idx" ON "Campamento"("saveId", "estado");

-- AddForeignKey
ALTER TABLE "Campamento" ADD CONSTRAINT "Campamento_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campamento" ADD CONSTRAINT "Campamento_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

