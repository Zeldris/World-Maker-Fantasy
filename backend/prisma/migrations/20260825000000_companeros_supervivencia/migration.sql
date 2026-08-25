-- Grupo 3 § Compañeros y supervivencia (2026-08-25, diseño completo en
-- docs/rpgtarkor/companeros-y-supervivencia.md) — captura+tameo/persuasión de fauna/NPC,
-- Hambre/Sed del propio personaje, equipo de compañeros/súbditos, Almacén de Reino + plantillas.
--
-- Nota: el diff generado por `prisma migrate diff` contra la DB real incluía además una
-- recreación del enum AbilityEffect y un DROP INDEX "Building_locationId_idx" — deriva ya
-- existente entre el schema y la DB real, anterior a esta pasada y sin relación con este cambio.
-- Excluida a propósito de esta migración, no se toca aquí.

-- CreateEnum
CREATE TYPE "CompanionTipo" AS ENUM ('FAUNA', 'NPC');

-- DropIndex (el @@unique([saveId, slot]) original ya no vale con companionId/subjectId — ver
-- comentario en InventoryItem, schema.prisma. Se sigue garantizando "un objeto por hueco" a nivel
-- de aplicación, mismo patrón que ya usaba PATCH /saves/:id/inventario/:itemId.)
DROP INDEX "InventoryItem_saveId_slot_key";

-- AlterTable
ALTER TABLE "Companion" ADD COLUMN     "esSlotDomador" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "felicidad" INTEGER,
ADD COLUMN     "lastFedAtMinutes" INTEGER,
ADD COLUMN     "lastWateredAtMinutes" INTEGER,
ADD COLUMN     "plantillaEquipoId" TEXT,
ADD COLUMN     "rolReino" TEXT,
ADD COLUMN     "sourceSlug" TEXT,
ADD COLUMN     "tipo" "CompanionTipo" NOT NULL DEFAULT 'NPC';

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "companionId" TEXT,
ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "Npc" ADD COLUMN     "atributoResistencia" TEXT;

-- AlterTable
ALTER TABLE "NpcState" ADD COLUMN     "capturaFelicidad" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "capturaJaulaBuildingId" TEXT,
ADD COLUMN     "capturado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "lastAteAtMinutes" INTEGER,
ADD COLUMN     "lastDrankAtMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "plantillaEquipoId" TEXT;

-- CreateTable
CREATE TABLE "AlmacenItem" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statBonuses" JSONB,
    "catalogSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlmacenItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaEquipo" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "personalizada" BOOLEAN NOT NULL DEFAULT true,
    "rol" TEXT NOT NULL,
    "slots" JSONB NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantillaEquipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlmacenItem_saveId_idx" ON "AlmacenItem"("saveId");

-- CreateIndex
CREATE INDEX "PlantillaEquipo_saveId_idx" ON "PlantillaEquipo"("saveId");

-- CreateIndex
CREATE INDEX "Companion_plantillaEquipoId_idx" ON "Companion"("plantillaEquipoId");

-- CreateIndex
CREATE INDEX "InventoryItem_companionId_idx" ON "InventoryItem"("companionId");

-- CreateIndex
CREATE INDEX "InventoryItem_subjectId_idx" ON "InventoryItem"("subjectId");

-- CreateIndex
CREATE INDEX "Subject_plantillaEquipoId_idx" ON "Subject"("plantillaEquipoId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Companion" ADD CONSTRAINT "Companion_plantillaEquipoId_fkey" FOREIGN KEY ("plantillaEquipoId") REFERENCES "PlantillaEquipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_plantillaEquipoId_fkey" FOREIGN KEY ("plantillaEquipoId") REFERENCES "PlantillaEquipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmacenItem" ADD CONSTRAINT "AlmacenItem_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaEquipo" ADD CONSTRAINT "PlantillaEquipo_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
