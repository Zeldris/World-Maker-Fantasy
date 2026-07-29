-- CreateEnum
CREATE TYPE "PopulationTargetType" AS ENUM ('RAZA', 'FAUNA');

-- CreateTable
CREATE TABLE "WorldPopulation" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "targetType" "PopulationTargetType" NOT NULL,
    "targetSlug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "poblacion" INTEGER NOT NULL,
    "poblacionMax" INTEGER NOT NULL,
    "distribucion" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldPopulation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorldPopulation_worldId_targetType_targetSlug_key" ON "WorldPopulation"("worldId", "targetType", "targetSlug");

-- AddForeignKey
ALTER TABLE "WorldPopulation" ADD CONSTRAINT "WorldPopulation_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
