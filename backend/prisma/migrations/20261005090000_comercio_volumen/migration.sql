-- CR-47 (hito 0.2): comercio de volumen — órdenes permanentes del Mercado del Reino y caravanas.
CREATE TABLE "OrdenComercio" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "catalogSlug" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "umbral" INTEGER NOT NULL,
    "lote" INTEGER NOT NULL,
    "factionSlug" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrdenComercio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrdenComercio_saveId_idx" ON "OrdenComercio"("saveId");
ALTER TABLE "OrdenComercio" ADD CONSTRAINT "OrdenComercio_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Caravana" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "ordenId" TEXT,
    "factionId" TEXT NOT NULL,
    "destinoLocationId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "catalogSlug" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL,
    "riqueza" INTEGER NOT NULL DEFAULT 0,
    "traidas" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'EN_CAMINO',
    "diaSalida" INTEGER NOT NULL,
    "diaLlegada" INTEGER NOT NULL,
    "diaRegreso" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Caravana_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Caravana_saveId_status_idx" ON "Caravana"("saveId", "status");
ALTER TABLE "Caravana" ADD CONSTRAINT "Caravana_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Caravana" ADD CONSTRAINT "Caravana_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenComercio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Caravana" ADD CONSTRAINT "Caravana_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Caravana" ADD CONSTRAINT "Caravana_destinoLocationId_fkey" FOREIGN KEY ("destinoLocationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
