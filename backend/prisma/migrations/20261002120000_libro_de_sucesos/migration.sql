-- CreateEnum
CREATE TYPE "FamiliaSuceso" AS ENUM ('CLIMA', 'NATURAL', 'VIDA_MUERTE', 'DIPLOMACIA', 'FACCION', 'ECONOMIA', 'REINO', 'JUGADOR', 'LORE', 'SISTEMA');

-- CreateEnum
CREATE TYPE "OrigenSuceso" AS ENUM ('JUGADOR', 'MUNDO', 'MOTOR', 'IA_PROPUESTA');

-- CreateTable
CREATE TABLE "Suceso" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "familia" "FamiliaSuceso" NOT NULL,
    "fictionalMinutes" INTEGER NOT NULL,
    "regionSlug" TEXT,
    "locationId" TEXT,
    "importancia" INTEGER NOT NULL,
    "origen" "OrigenSuceso" NOT NULL,
    "datos" JSONB NOT NULL,
    "texto" TEXT NOT NULL,
    "textoNarrado" TEXT,
    "logEntryId" TEXT,
    "semilla" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SucesoCausa" (
    "causaId" TEXT NOT NULL,
    "efectoId" TEXT NOT NULL,

    CONSTRAINT "SucesoCausa_pkey" PRIMARY KEY ("causaId","efectoId")
);

-- CreateTable
CREATE TABLE "SucesoActor" (
    "sucesoId" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,

    CONSTRAINT "SucesoActor_pkey" PRIMARY KEY ("sucesoId","entidadTipo","entidadId","papel")
);

-- CreateIndex
CREATE INDEX "Suceso_saveId_fictionalMinutes_idx" ON "Suceso"("saveId", "fictionalMinutes");

-- CreateIndex
CREATE INDEX "Suceso_saveId_tipo_idx" ON "Suceso"("saveId", "tipo");

-- CreateIndex
CREATE INDEX "Suceso_saveId_importancia_idx" ON "Suceso"("saveId", "importancia");

-- CreateIndex
CREATE INDEX "SucesoActor_entidadTipo_entidadId_idx" ON "SucesoActor"("entidadTipo", "entidadId");

-- AddForeignKey
ALTER TABLE "Suceso" ADD CONSTRAINT "Suceso_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SucesoCausa" ADD CONSTRAINT "SucesoCausa_causaId_fkey" FOREIGN KEY ("causaId") REFERENCES "Suceso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SucesoCausa" ADD CONSTRAINT "SucesoCausa_efectoId_fkey" FOREIGN KEY ("efectoId") REFERENCES "Suceso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SucesoActor" ADD CONSTRAINT "SucesoActor_sucesoId_fkey" FOREIGN KEY ("sucesoId") REFERENCES "Suceso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

