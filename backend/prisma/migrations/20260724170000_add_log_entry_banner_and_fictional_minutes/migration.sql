ALTER TABLE "LogEntry" ADD COLUMN "fictionalMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LogEntry" ADD COLUMN "entityBannerType" TEXT;
ALTER TABLE "LogEntry" ADD COLUMN "entityBannerSlug" TEXT;

CREATE INDEX "LogEntry_saveId_fictionalMinutes_idx" ON "LogEntry"("saveId", "fictionalMinutes");
