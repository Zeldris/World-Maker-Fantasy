-- Fase 5 (plan oct-2026, B1): ZonePoint por partida. saveId null = plantilla de catálogo.
ALTER TABLE "ZonePoint" ADD COLUMN "saveId" TEXT;
CREATE INDEX "ZonePoint_saveId_locationId_idx" ON "ZonePoint"("saveId", "locationId");
ALTER TABLE "ZonePoint" ADD CONSTRAINT "ZonePoint_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
