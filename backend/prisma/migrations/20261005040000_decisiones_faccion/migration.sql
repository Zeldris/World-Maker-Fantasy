-- CreateEnum
CREATE TYPE "Disposicion" AS ENUM ('NEUTRAL', 'BELICOSA', 'MERCANTIL', 'RECELOSA');

-- AlterTable
ALTER TABLE "Faction" ADD COLUMN     "disposicion" "Disposicion" NOT NULL DEFAULT 'NEUTRAL';

-- AlterTable
ALTER TABLE "KingdomStats" ADD COLUMN     "ultimaRevision" INTEGER;

