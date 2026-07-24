-- CreateEnum
CREATE TYPE "EquipSlot" AS ENUM ('CASCO', 'ABALORIO', 'CAMISA', 'ARMADURA_SUPERIOR', 'GUANTES', 'ARMADURA_INFERIOR', 'ACCESORIO', 'BOTAS', 'ARMA_PRINCIPAL', 'ARMA_SECUNDARIA', 'ANILLO_1', 'ANILLO_2', 'CINTURON');

-- AlterTable
ALTER TABLE "InventoryItem" DROP COLUMN "equipped",
ADD COLUMN     "slot" "EquipSlot";

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_saveId_slot_key" ON "InventoryItem"("saveId", "slot");

