-- AlterEnum
ALTER TYPE "QuestStatus" ADD VALUE 'ABANDONADA';

-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "cantidad" INTEGER,
ADD COLUMN     "encargaFaccionId" TEXT,
ADD COLUMN     "encargaNpcId" TEXT,
ADD COLUMN     "huecos" JSONB,
ADD COLUMN     "progreso" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recompensa" JSONB,
ADD COLUMN     "tipoMision" TEXT,
ADD COLUMN     "venceEn" INTEGER;

-- CreateTable
CREATE TABLE "MisionOfrecida" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "buildingId" TEXT,
    "npcId" TEXT,
    "factionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "huecos" JSONB NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "recompensa" JSONB NOT NULL,
    "creadaEn" INTEGER NOT NULL,
    "retiraEn" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "questId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MisionOfrecida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MisionOfrecida_saveId_estado_idx" ON "MisionOfrecida"("saveId", "estado");

-- CreateIndex
CREATE INDEX "MisionOfrecida_buildingId_idx" ON "MisionOfrecida"("buildingId");

-- AddForeignKey
ALTER TABLE "MisionOfrecida" ADD CONSTRAINT "MisionOfrecida_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

