-- AlterTable: Building gana dónde se plantó (locationId, reutiliza los nodos que ya dibuja el
-- mapa) y qué receta fija la generó (recipeKey, para icono/enlace de Enciclopedia). Ambas
-- nullable: null = construcción libre del modelo (newBuilding) sin receta ni Location conocida.
ALTER TABLE "Building" ADD COLUMN "locationId" TEXT;
ALTER TABLE "Building" ADD COLUMN "recipeKey" TEXT;

ALTER TABLE "Building" ADD CONSTRAINT "Building_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Building_locationId_idx" ON "Building"("locationId");
