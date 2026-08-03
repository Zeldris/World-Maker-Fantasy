-- AlterEnum: nuevo tipo de objeto ESPECIAL (2026-08-03, "los items de tipo Especial... tendrán
-- un efecto que será más complejo o útil para la narración") — solo se AÑADE un valor, no se
-- retira ninguno, así que no hace falta la recreación de tipo (a diferencia de EquipSlot/ABALORIO).
ALTER TYPE "ItemTipo" ADD VALUE 'ESPECIAL';

-- AlterTable: clave + descripción del efecto — null en el resto del catálogo.
ALTER TABLE "ItemCatalog" ADD COLUMN "effectKey" TEXT;
ALTER TABLE "ItemCatalog" ADD COLUMN "effectDescription" TEXT;
