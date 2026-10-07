-- CreateTable
CREATE TABLE "Viajero" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "factionId" TEXT,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'IDA',
    "origenLocationId" TEXT NOT NULL,
    "destinoLocationId" TEXT NOT NULL,
    "ubicacionLocationId" TEXT NOT NULL,
    "ruta" TEXT[],
    "minutosEnTramo" INTEGER NOT NULL DEFAULT 0,
    "objetivo" TEXT,
    "carga" JSONB,
    "orden" JSONB,
    "diaSalida" INTEGER NOT NULL,
    "ultimoDia" INTEGER NOT NULL,
    "diario" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Viajero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViajeroMiembro" (
    "id" TEXT NOT NULL,
    "viajeroId" TEXT NOT NULL,
    "companionId" TEXT,
    "subjectId" TEXT,
    "genericos" INTEGER NOT NULL DEFAULT 0,
    "rol" TEXT NOT NULL,

    CONSTRAINT "ViajeroMiembro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Viajero_saveId_estado_idx" ON "Viajero"("saveId", "estado");

-- CreateIndex
CREATE INDEX "Viajero_factionId_idx" ON "Viajero"("factionId");

-- CreateIndex
CREATE INDEX "ViajeroMiembro_viajeroId_idx" ON "ViajeroMiembro"("viajeroId");

-- CreateIndex
CREATE INDEX "ViajeroMiembro_companionId_idx" ON "ViajeroMiembro"("companionId");

-- CreateIndex
CREATE INDEX "ViajeroMiembro_subjectId_idx" ON "ViajeroMiembro"("subjectId");

-- AddForeignKey
ALTER TABLE "Viajero" ADD CONSTRAINT "Viajero_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viajero" ADD CONSTRAINT "Viajero_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viajero" ADD CONSTRAINT "Viajero_origenLocationId_fkey" FOREIGN KEY ("origenLocationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viajero" ADD CONSTRAINT "Viajero_destinoLocationId_fkey" FOREIGN KEY ("destinoLocationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viajero" ADD CONSTRAINT "Viajero_ubicacionLocationId_fkey" FOREIGN KEY ("ubicacionLocationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajeroMiembro" ADD CONSTRAINT "ViajeroMiembro_viajeroId_fkey" FOREIGN KEY ("viajeroId") REFERENCES "Viajero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajeroMiembro" ADD CONSTRAINT "ViajeroMiembro_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajeroMiembro" ADD CONSTRAINT "ViajeroMiembro_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

