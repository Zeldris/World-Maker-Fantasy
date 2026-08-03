-- AlterEnum
-- Paso 2 de 2: retira ABALORIO ahora que ninguna fila lo usa (ver migración anterior +
-- backend/src/scripts/worldCatalog.ts / startingInventory.ts ya actualizados a
-- COSMETICO_ESPALDA/COSMETICO_CINTURA). Postgres no soporta DROP VALUE en un enum, así que se
-- recrea el tipo sin ABALORIO y se re-castean las dos columnas que lo usan.
BEGIN;
ALTER TYPE "EquipSlot" RENAME TO "EquipSlot_old";
CREATE TYPE "EquipSlot" AS ENUM (
  'CASCO', 'CAMISA', 'ARMADURA_SUPERIOR', 'GUANTES', 'ARMADURA_INFERIOR', 'ACCESORIO', 'BOTAS',
  'ARMA_PRINCIPAL', 'ARMA_SECUNDARIA', 'ANILLO_1', 'ANILLO_2', 'CINTURON',
  'CONSUMIBLE_1', 'CONSUMIBLE_2', 'CONSUMIBLE_3', 'CONSUMIBLE_4', 'CONSUMIBLE_5', 'CONSUMIBLE_6',
  'COSMETICO_ESPALDA', 'COSMETICO_CABEZA', 'COSMETICO_CINTURA'
);
ALTER TABLE "InventoryItem" ALTER COLUMN "slot" TYPE "EquipSlot" USING ("slot"::text::"EquipSlot");
ALTER TABLE "ItemCatalog" ALTER COLUMN "equipSlot" TYPE "EquipSlot" USING ("equipSlot"::text::"EquipSlot");
DROP TYPE "EquipSlot_old";
COMMIT;
