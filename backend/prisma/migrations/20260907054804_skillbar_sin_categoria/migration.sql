-- Rediseño de barras de habilidades (2026-09-06, hallazgo 10) — sin migración de datos (decisión
-- explícita de la usuaria: "empezar de cero"). Se vacía la tabla antes de quitar `category` porque
-- el esquema viejo (3 barras por categoría, slotIndex reiniciado en cada una) violaría el nuevo
-- índice único `[saveId, slotIndex]` si se conservaran las filas.
TRUNCATE TABLE "SkillBar";

-- DropIndex
DROP INDEX "SkillBar_saveId_category_slotIndex_key";

-- AlterTable
ALTER TABLE "SkillBar" DROP COLUMN "category";

-- CreateIndex
CREATE UNIQUE INDEX "SkillBar_saveId_slotIndex_key" ON "SkillBar"("saveId", "slotIndex");
