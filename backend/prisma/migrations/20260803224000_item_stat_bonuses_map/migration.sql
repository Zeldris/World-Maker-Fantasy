-- AlterTable: bonificadores múltiples por objeto (2026-08-03, petición explícita: "que los items
-- equipables en general ofrezcan... la posibilidad de ofrecer múltiples attrs de bonus... que se
-- puedan meter múltiples attr y valor por tipo de attr") — sustituye el par escalar
-- statBonusAttribute/statBonusAmount por un mapa JSON, mismo patrón que ItemCatalog.requisitos.

-- 1) Columnas nuevas
ALTER TABLE "ItemCatalog" ADD COLUMN "statBonuses" JSONB;
ALTER TABLE "InventoryItem" ADD COLUMN "statBonuses" JSONB;

-- 2) Migrar los datos existentes (un solo par -> mapa de una clave)
UPDATE "ItemCatalog"
SET "statBonuses" = jsonb_build_object("statBonusAttribute", "statBonusAmount")
WHERE "statBonusAttribute" IS NOT NULL AND "statBonusAmount" IS NOT NULL;

UPDATE "InventoryItem"
SET "statBonuses" = jsonb_build_object("statBonusAttribute", "statBonusAmount")
WHERE "statBonusAttribute" IS NOT NULL AND "statBonusAmount" IS NOT NULL;

-- 3) Retirar las columnas viejas
ALTER TABLE "ItemCatalog" DROP COLUMN "statBonusAttribute";
ALTER TABLE "ItemCatalog" DROP COLUMN "statBonusAmount";
ALTER TABLE "InventoryItem" DROP COLUMN "statBonusAttribute";
ALTER TABLE "InventoryItem" DROP COLUMN "statBonusAmount";
