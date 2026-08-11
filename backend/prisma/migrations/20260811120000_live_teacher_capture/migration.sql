-- CreateTable
CREATE TABLE "LiveTeacherCapture" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userContent" TEXT NOT NULL,
    "cloudRawText" TEXT NOT NULL,
    "cloudProvider" TEXT NOT NULL,
    "cloudValid" BOOLEAN NOT NULL,
    "cloudRejectReason" TEXT,
    "localNarrationJson" JSONB NOT NULL,
    "localModel" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveTeacherCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveTeacherCapture_saveId_idx" ON "LiveTeacherCapture"("saveId");

-- CreateIndex
CREATE INDEX "LiveTeacherCapture_cloudValid_exportedAt_idx" ON "LiveTeacherCapture"("cloudValid", "exportedAt");
