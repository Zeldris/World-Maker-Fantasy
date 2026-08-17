-- AlterTable
-- sourceName -> sourceCategory + sourceCategoryName (2026-08-15): sourceSlug se estaba usando
-- para enlazar el material con su objeto/fauna/flora extraíble, y sourceName ya no hacía falta
-- como tal — sourceCategory agrupa varias fuentes bajo la misma categoría (mineral/planta/
-- fauna/objeto...) y sourceCategoryName es la etiqueta que se muestra en el front.
ALTER TABLE "HarvestYield" DROP COLUMN "sourceName";
ALTER TABLE "HarvestYield" ADD COLUMN "sourceCategory" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HarvestYield" ADD COLUMN "sourceCategoryName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HarvestYield" ALTER COLUMN "sourceCategory" DROP DEFAULT;
ALTER TABLE "HarvestYield" ALTER COLUMN "sourceCategoryName" DROP DEFAULT;
