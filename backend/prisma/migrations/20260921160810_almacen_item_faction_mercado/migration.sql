-- Mercado regulado (docs/rpgtarkor/mundo-vivo-x4.md § 4.4, 2026-09-21) — AlmacenItem generalizado
-- a facciones NPC, mismo patrón XOR que KingdomStats/Building, reforzado con CHECK real
-- (§ 5-bis punto 2: criterio aplicado también a un modelo existente que se generaliza en esta
-- sesión, no solo a los recién creados).

-- AlterTable
ALTER TABLE "AlmacenItem" ADD COLUMN     "factionId" TEXT,
ALTER COLUMN "saveId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AlmacenItem_factionId_idx" ON "AlmacenItem"("factionId");

-- AddForeignKey
ALTER TABLE "AlmacenItem" ADD CONSTRAINT "AlmacenItem_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraint XOR real (saveId/factionId) — todas las filas existentes ya tienen saveId
-- relleno y factionId null, cumplen el CHECK sin necesidad de backfill.
ALTER TABLE "AlmacenItem"
  ADD CONSTRAINT "AlmacenItem_saveId_factionId_xor"
  CHECK (
    (("saveId" IS NOT NULL)::int + ("factionId" IS NOT NULL)::int) = 1
  );
