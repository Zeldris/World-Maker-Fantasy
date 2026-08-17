-- AlterTable
-- sourceCategoryName ya no se guarda por fila (2026-08-15): se resuelve a partir de
-- sourceCategory vía SOURCE_CATEGORY_NAMES/sourceCategoryNameFor (worldCatalog.ts) — evita
-- tener el mismo nombre de categoría duplicado en decenas de filas.
ALTER TABLE "HarvestYield" DROP COLUMN "sourceCategoryName";
