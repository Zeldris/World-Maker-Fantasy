-- DropIndex
DROP INDEX "Faction_worldId_slug_key";

-- DropIndex
DROP INDEX "Npc_worldId_slug_key";

-- DropIndex
DROP INDEX "WorldPopulation_worldId_targetType_targetSlug_key";

-- AlterTable
ALTER TABLE "Companion" ADD COLUMN     "aprobacion" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "valores" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Expedicion" ADD COLUMN     "saveId" TEXT;

-- AlterTable
ALTER TABLE "Faction" ADD COLUMN     "cohesion" INTEGER NOT NULL DEFAULT 70,
ADD COLUMN     "disueltaEn" INTEGER,
ADD COLUMN     "fundadaEn" INTEGER,
ADD COLUMN     "origenSlug" TEXT;

-- AlterTable
ALTER TABLE "FactionRelation" ADD COLUMN     "saveId" TEXT;

-- AlterTable
ALTER TABLE "Npc" ADD COLUMN     "saveId" TEXT;

-- AlterTable
ALTER TABLE "NpcState" ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "lealtadFaccionId" TEXT,
ADD COLUMN     "muerto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muertoEn" INTEGER;

-- AlterTable
ALTER TABLE "WorldPopulation" ADD COLUMN     "saveId" TEXT;

-- AlterTable
ALTER TABLE "WorldState" ADD COLUMN     "estiloNarrador" TEXT NOT NULL DEFAULT 'EQUILIBRADO',
ADD COLUMN     "mundoClonadoEn" TIMESTAMP(3),
ADD COLUMN     "presupuestoTension" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimoDiaSimulado" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Expedicion_saveId_idx" ON "Expedicion"("saveId");

-- CreateIndex
CREATE INDEX "Faction_worldId_slug_idx" ON "Faction"("worldId", "slug");

-- CreateIndex
CREATE INDEX "Faction_saveId_idx" ON "Faction"("saveId");

-- CreateIndex
CREATE INDEX "FactionRelation_saveId_idx" ON "FactionRelation"("saveId");

-- CreateIndex
CREATE INDEX "Npc_worldId_slug_idx" ON "Npc"("worldId", "slug");

-- CreateIndex
CREATE INDEX "Npc_saveId_idx" ON "Npc"("saveId");

-- CreateIndex
CREATE INDEX "WorldPopulation_worldId_targetType_targetSlug_idx" ON "WorldPopulation"("worldId", "targetType", "targetSlug");

-- CreateIndex
CREATE INDEX "WorldPopulation_saveId_idx" ON "WorldPopulation"("saveId");

-- AddForeignKey
ALTER TABLE "Npc" ADD CONSTRAINT "Npc_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldPopulation" ADD CONSTRAINT "WorldPopulation_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedicion" ADD CONSTRAINT "Expedicion_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CR-5 (hito 0.2, roadmap-cronista.md § 5.2) — unicidad parcial: las filas de catálogo
-- (saveId IS NULL) siguen siendo únicas por mundo y slug; las de partida, por partida y slug.
-- Prisma no expresa índices parciales: viven solo aquí. OJO al generar migraciones futuras con
-- `prisma migrate diff`: las propondrá borrar (no están en schema.prisma); quitar esas líneas.
CREATE UNIQUE INDEX "Faction_catalogo_worldId_slug_key" ON "Faction"("worldId", "slug") WHERE "saveId" IS NULL;
CREATE UNIQUE INDEX "Faction_partida_saveId_slug_key" ON "Faction"("saveId", "slug") WHERE "saveId" IS NOT NULL;
CREATE UNIQUE INDEX "Npc_catalogo_worldId_slug_key" ON "Npc"("worldId", "slug") WHERE "saveId" IS NULL;
CREATE UNIQUE INDEX "Npc_partida_saveId_slug_key" ON "Npc"("saveId", "slug") WHERE "saveId" IS NOT NULL;
CREATE UNIQUE INDEX "WorldPopulation_catalogo_key" ON "WorldPopulation"("worldId", "targetType", "targetSlug") WHERE "saveId" IS NULL;
CREATE UNIQUE INDEX "WorldPopulation_partida_key" ON "WorldPopulation"("saveId", "targetType", "targetSlug") WHERE "saveId" IS NOT NULL;
