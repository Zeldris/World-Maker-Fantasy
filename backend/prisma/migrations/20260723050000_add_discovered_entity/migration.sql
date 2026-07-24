CREATE TABLE "DiscoveredEntity" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entitySlug" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveredEntity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscoveredEntity_saveId_idx" ON "DiscoveredEntity"("saveId");

CREATE UNIQUE INDEX "DiscoveredEntity_saveId_entityType_entitySlug_key" ON "DiscoveredEntity"("saveId", "entityType", "entitySlug");

ALTER TABLE "DiscoveredEntity" ADD CONSTRAINT "DiscoveredEntity_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
