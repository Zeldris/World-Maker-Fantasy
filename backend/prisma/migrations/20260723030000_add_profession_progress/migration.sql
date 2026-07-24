CREATE TABLE "ProfessionProgress" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionProgress_saveId_professionId_key" ON "ProfessionProgress"("saveId", "professionId");

ALTER TABLE "ProfessionProgress" ADD CONSTRAINT "ProfessionProgress_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
