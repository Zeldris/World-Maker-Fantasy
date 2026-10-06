-- CR-16 (hito 0.3): recuerdos de NPC y supervivientes (estilo Némesis).
ALTER TABLE "NpcState" ADD COLUMN "nivelesGanados" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "NpcState" ADD COLUMN "titulo" TEXT;
CREATE TABLE "Recuerdo" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "sobreTipo" TEXT NOT NULL,
    "sobreId" TEXT NOT NULL,
    "sucesoId" TEXT NOT NULL,
    "sentimiento" INTEGER NOT NULL,
    "importancia" INTEGER NOT NULL,
    "desdeMinutes" INTEGER NOT NULL,
    CONSTRAINT "Recuerdo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Recuerdo_saveId_npcId_idx" ON "Recuerdo"("saveId", "npcId");
ALTER TABLE "Recuerdo" ADD CONSTRAINT "Recuerdo_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
