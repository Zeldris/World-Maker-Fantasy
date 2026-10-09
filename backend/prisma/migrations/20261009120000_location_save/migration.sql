-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "saveId" TEXT;

-- CreateIndex
CREATE INDEX "Location_saveId_idx" ON "Location"("saveId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- QA-27 (P44): dueña de los interiores ya creados en partida.
-- Capital: el slug lleva el id de la partida.
UPDATE "Location" l SET "saveId" = s."id"
FROM "Save" s
WHERE l."slug" = 'ayuntamiento-interior-' || s."id";

-- Cuartel Avanzado: el slug lleva el id del edificio, que es de la partida.
UPDATE "Location" l SET "saveId" = b."saveId"
FROM "Building" b
WHERE l."slug" = 'cuartel-avanzado-interior-' || b."id" AND b."saveId" IS NOT NULL;

-- Si no, la partida que está o descansa ahí.
UPDATE "Location" l SET "saveId" = s."id"
FROM "Save" s
WHERE l."saveId" IS NULL
  AND (l."slug" LIKE 'ayuntamiento-interior-%' OR l."slug" LIKE 'cuartel-avanzado-interior-%')
  AND (s."currentLocationId" = l."id" OR s."lastRestLocationId" = l."id");

-- Interiores de partida que ya no tienen dueña (su edificio o su partida ya no existen): fuera.
DELETE FROM "Location" l
WHERE l."saveId" IS NULL
  AND (l."slug" LIKE 'ayuntamiento-interior-%' OR l."slug" LIKE 'cuartel-avanzado-interior-%')
  AND NOT EXISTS (SELECT 1 FROM "Save" s WHERE s."currentLocationId" = l."id" OR s."lastRestLocationId" = l."id");
