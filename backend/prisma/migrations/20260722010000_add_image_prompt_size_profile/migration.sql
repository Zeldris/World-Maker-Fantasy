-- AlterTable: añade sizeProfile, backfill de filas existentes como 'banner' (eran prompts de
-- escena completa, más cercanos al uso de detalle/banner que al de miniatura).
ALTER TABLE "ImagePrompt" ADD COLUMN "sizeProfile" TEXT NOT NULL DEFAULT 'banner';
ALTER TABLE "ImagePrompt" ALTER COLUMN "sizeProfile" DROP DEFAULT;

-- DropIndex
DROP INDEX "ImagePrompt_worldId_entityType_entitySlug_key";

-- CreateIndex
CREATE UNIQUE INDEX "ImagePrompt_worldId_entityType_entitySlug_sizeProfile_key" ON "ImagePrompt"("worldId", "entityType", "entitySlug", "sizeProfile");
