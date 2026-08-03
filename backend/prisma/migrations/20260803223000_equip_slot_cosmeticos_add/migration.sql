-- AlterEnum
-- Nuevas ranuras de cosmético puro (Espalda/Cabeza/Cintura) — paso 1 de 2: añadir los valores
-- nuevos antes de retirar ABALORIO (Postgres no permite añadir y quitar un valor de enum en la
-- misma transacción si hay filas usando el valor viejo; ver migración siguiente).
ALTER TYPE "EquipSlot" ADD VALUE 'COSMETICO_ESPALDA';
ALTER TYPE "EquipSlot" ADD VALUE 'COSMETICO_CABEZA';
ALTER TYPE "EquipSlot" ADD VALUE 'COSMETICO_CINTURA';
