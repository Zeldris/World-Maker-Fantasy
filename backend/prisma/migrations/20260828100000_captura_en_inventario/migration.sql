-- Rediseño de captura (2026-08-28, docs/rpgtarkor/captura-rediseno-2026-08-28.md)
-- La captura se materializa como InventoryItem en tránsito, en vez de vivir in-situ en NpcState.
ALTER TABLE "InventoryItem" ADD COLUMN "capturaNpcId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "capturaScope" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "capturaExpiraAtMinutes" INTEGER;
