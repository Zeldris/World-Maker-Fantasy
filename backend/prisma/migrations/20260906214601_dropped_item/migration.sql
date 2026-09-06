-- CreateTable
CREATE TABLE "DroppedItem" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "catalogSlug" TEXT,
    "statBonuses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DroppedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DroppedItem_saveId_locationId_idx" ON "DroppedItem"("saveId", "locationId");

-- AddForeignKey
ALTER TABLE "DroppedItem" ADD CONSTRAINT "DroppedItem_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroppedItem" ADD CONSTRAINT "DroppedItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
