-- CreateEnum
CREATE TYPE "EntityDiscoveryFase" AS ENUM ('CITADO', 'DESCUBIERTO');

-- AlterTable
ALTER TABLE "DiscoveredEntity" ADD COLUMN     "fase" "EntityDiscoveryFase" NOT NULL DEFAULT 'CITADO';
