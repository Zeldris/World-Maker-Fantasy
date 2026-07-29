-- CreateEnum
CREATE TYPE "WeaponCategory" AS ENUM ('HACHA', 'MAZA', 'GARROTE', 'PICA', 'LANZA', 'CUCHILLO', 'DAGA', 'ESPADA', 'ESCUDO');

-- AlterTable
ALTER TABLE "ItemCatalog" ADD COLUMN "tipoArma" "WeaponCategory";
