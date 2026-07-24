-- CreateTable
CREATE TABLE "NpcState" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "condicionFisica" "CondicionFisica" NOT NULL DEFAULT 'ILESO',
    "saqueado" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NpcState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NpcState_saveId_npcId_key" ON "NpcState"("saveId", "npcId");

-- AddForeignKey
ALTER TABLE "NpcState" ADD CONSTRAINT "NpcState_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpcState" ADD CONSTRAINT "NpcState_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

