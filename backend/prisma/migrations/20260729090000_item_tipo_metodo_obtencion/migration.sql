-- CreateEnum
CREATE TYPE "ItemTipo" AS ENUM ('RECURSO', 'MATERIAL', 'EQUIPABLE', 'CONSUMIBLE', 'NARRATIVO');

-- CreateEnum
CREATE TYPE "MetodoObtencion" AS ENUM ('PASIVO', 'CAZA', 'TALA', 'MINERIA', 'EXTRACCION');

-- AlterTable: ItemCatalog.tipo (nullable primero, backfill por regla, luego NOT NULL)
ALTER TABLE "ItemCatalog" ADD COLUMN "tipo" "ItemTipo";

-- Todo lo que aparece como resultado de un HarvestYield es, por definición, un recurso de la naturaleza.
UPDATE "ItemCatalog" SET "tipo" = 'RECURSO'
WHERE "id" IN (SELECT DISTINCT "itemId" FROM "HarvestYield");

UPDATE "ItemCatalog" SET "tipo" = 'EQUIPABLE'
WHERE "tipo" IS NULL AND "category" IN ('arma', 'herramienta', 'ropa');

UPDATE "ItemCatalog" SET "tipo" = 'CONSUMIBLE'
WHERE "tipo" IS NULL AND "category" IN ('consumible', 'medicinal');

UPDATE "ItemCatalog" SET "tipo" = 'NARRATIVO'
WHERE "tipo" IS NULL AND "category" IN ('documento', 'valor');

-- Resto (p.ej. lingote-aleacion-goirntes, hoy category='valor' pero ya cubierto arriba; cualquier
-- otra fila category='material' huérfana de HarvestYield) cae en MATERIAL como default seguro —
-- el re-seed de worldCatalog.ts corrige cualquier caso fino que haga falta.
UPDATE "ItemCatalog" SET "tipo" = 'MATERIAL' WHERE "tipo" IS NULL;

ALTER TABLE "ItemCatalog" ALTER COLUMN "tipo" SET NOT NULL;

-- AlterTable: HarvestYield.metodoObtencion (PASIVO = comportamiento actual, sin regresión; el
-- re-seed de worldCatalog.ts recrea estas filas con el método real por sourceSlug).
ALTER TABLE "HarvestYield" ADD COLUMN "metodoObtencion" "MetodoObtencion" NOT NULL DEFAULT 'PASIVO';
ALTER TABLE "HarvestYield" ALTER COLUMN "metodoObtencion" DROP DEFAULT;
