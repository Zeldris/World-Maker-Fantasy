-- Motor de facciones estilo X4 (docs/rpgtarkor/mundo-vivo-x4.md § 4.2, 2026-09-21).
-- Generaliza Building/KingdomStats/Territory para que "de quién es este reino" pueda ser
-- una Save (jugador) O una Faction (NPC), mismo modelo exacto, sin tablas paralelas.
-- Retira FactionBuilding, migrando sus filas vigentes de catálogo a Building.factionId.

-- ============================================================================
-- 1. Añadir columnas nuevas, dejar saveId nullable
-- ============================================================================

-- AlterTable: Building
ALTER TABLE "Building"
  ADD COLUMN "factionId" TEXT,
  ALTER COLUMN "saveId" DROP NOT NULL;

-- AlterTable: Territory
ALTER TABLE "Territory"
  ADD COLUMN "factionId" TEXT,
  ALTER COLUMN "saveId" DROP NOT NULL;

-- AlterTable: KingdomStats
-- ownerKey se rellena con backfill antes de exigir NOT NULL (hoy no hay filas en el
-- sandbox, pero el patrón es correcto para cualquier entorno con datos reales).
ALTER TABLE "KingdomStats"
  ADD COLUMN "factionId" TEXT,
  ADD COLUMN "ownerKey" TEXT,
  ALTER COLUMN "saveId" DROP NOT NULL;

-- Drop del @unique viejo de saveId (se recrea como @unique nullable-friendly más abajo,
-- Postgres admite múltiples NULL en una columna UNIQUE sin problema)
DROP INDEX IF EXISTS "KingdomStats_saveId_key";

-- ============================================================================
-- 2. Backfill: ownerKey para filas existentes de KingdomStats (idempotente)
-- ============================================================================

UPDATE "KingdomStats" SET "ownerKey" = 'save:' || "saveId" WHERE "saveId" IS NOT NULL AND "ownerKey" IS NULL;
UPDATE "KingdomStats" SET "ownerKey" = 'faction:' || "factionId" WHERE "factionId" IS NOT NULL AND "ownerKey" IS NULL;

ALTER TABLE "KingdomStats" ALTER COLUMN "ownerKey" SET NOT NULL;

-- ============================================================================
-- 3. Migrar FactionBuilding vigente (12 filas de catálogo, 2026-09-21) a Building.factionId
--    Descartadas a propósito (residuo de rename, sin valor, mismo criterio que
--    "orco-rezagado" en 2026-09-09): karot-vekhad, ketg-lukar (duplicados exactos de
--    ketg-sedsar, ya migrado) — nunca se copian aquí.
--    saveId queda NULL (edificio de facción NPC, no del reino del jugador).
-- ============================================================================

INSERT INTO "Building" (
  "id", "factionId", "locationId", "recipeKey", "name", "kind", "status", "description",
  "createdAt", "updatedAt"
)
SELECT
  fb."id",
  f."id" AS "factionId",
  loc."id" AS "locationId",
  fb."slug" AS "recipeKey",
  fb."name",
  COALESCE(fb."profession", 'sede') AS "kind",
  'ACTIVO'::"BuildingStatus" AS "status",
  fb."description",
  now(),
  now()
FROM "FactionBuilding" fb
JOIN "Faction" f ON f."name" = fb."factionSlug" AND f."worldId" = fb."worldId" AND f."saveId" IS NULL
LEFT JOIN "Location" loc ON loc."slug" = fb."locationSlug" AND loc."worldId" = fb."worldId"
WHERE fb."slug" NOT IN ('karot-vekhad', 'ketg-lukar');

-- ============================================================================
-- 4. Índices y foreign keys nuevos
-- ============================================================================

CREATE INDEX "Building_factionId_idx" ON "Building"("factionId");
CREATE INDEX "Territory_factionId_idx" ON "Territory"("factionId");
CREATE UNIQUE INDEX "KingdomStats_ownerKey_key" ON "KingdomStats"("ownerKey");
CREATE UNIQUE INDEX "KingdomStats_saveId_key" ON "KingdomStats"("saveId");
CREATE UNIQUE INDEX "KingdomStats_factionId_key" ON "KingdomStats"("factionId");

ALTER TABLE "Building" ADD CONSTRAINT "Building_factionId_fkey"
  FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_factionId_fkey"
  FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KingdomStats" ADD CONSTRAINT "KingdomStats_factionId_fkey"
  FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 5. Retirar FactionBuilding (ya migrado su contenido vigente en el paso 3)
-- ============================================================================

ALTER TABLE "FactionBuilding" DROP CONSTRAINT "FactionBuilding_worldId_fkey";
DROP TABLE "FactionBuilding";
