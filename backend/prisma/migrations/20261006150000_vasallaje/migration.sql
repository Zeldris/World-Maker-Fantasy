-- CR-59: vasallaje entre facciones (Serhu bajo la Concordia de Hierro).
CREATE TABLE "Vasallaje" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "vasalloSlug" TEXT NOT NULL,
    "senorSlug" TEXT NOT NULL,
    "deuda" INTEGER NOT NULL DEFAULT 0,
    "desdeMinutes" INTEGER NOT NULL,
    "ultimaSemana" INTEGER,
    "rotoEn" INTEGER,
    "motivoRuptura" TEXT,
    CONSTRAINT "Vasallaje_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vasallaje_saveId_vasalloSlug_key" ON "Vasallaje"("saveId", "vasalloSlug");
CREATE INDEX "Vasallaje_saveId_idx" ON "Vasallaje"("saveId");
ALTER TABLE "Vasallaje" ADD CONSTRAINT "Vasallaje_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
