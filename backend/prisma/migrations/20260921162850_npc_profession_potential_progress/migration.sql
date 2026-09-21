-- § 4.5 Expediciones de facción (docs/rpgtarkor/mundo-vivo-x4.md, 2026-09-21) — potencial y
-- progreso real de oficio por Npc, grounding real Bannerlord (tope de habilidad distinto por
-- individuo). Sin código de expediciones todavía (diseño cerrado, pendiente de implementar), pero
-- estos dos modelos se aplican ya para dejar el schema listo.

-- CreateTable
CREATE TABLE "NpcProfessionPotential" (
    "id" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,
    "nivelMaximo" INTEGER NOT NULL,

    CONSTRAINT "NpcProfessionPotential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpcProfessionProgress" (
    "id" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NpcProfessionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NpcProfessionPotential_npcId_idx" ON "NpcProfessionPotential"("npcId");

-- CreateIndex
CREATE UNIQUE INDEX "NpcProfessionPotential_npcId_professionId_key" ON "NpcProfessionPotential"("npcId", "professionId");

-- CreateIndex
CREATE INDEX "NpcProfessionProgress_npcId_idx" ON "NpcProfessionProgress"("npcId");

-- CreateIndex
CREATE UNIQUE INDEX "NpcProfessionProgress_npcId_professionId_key" ON "NpcProfessionProgress"("npcId", "professionId");

-- AddForeignKey
ALTER TABLE "NpcProfessionPotential" ADD CONSTRAINT "NpcProfessionPotential_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpcProfessionProgress" ADD CONSTRAINT "NpcProfessionProgress_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
