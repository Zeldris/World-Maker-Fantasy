-- REI-118: los súbditos como personas (pueblo, edad, padres, felicidad, estado).
ALTER TABLE "Subject" ADD COLUMN "pueblo" TEXT;
ALTER TABLE "Subject" ADD COLUMN "genero" TEXT;
ALTER TABLE "Subject" ADD COLUMN "nacidoEn" INTEGER;
ALTER TABLE "Subject" ADD COLUMN "padreId" TEXT;
ALTER TABLE "Subject" ADD COLUMN "madreId" TEXT;
ALTER TABLE "Subject" ADD COLUMN "felicidad" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Subject" ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'ACTIVO';
ALTER TABLE "Subject" ADD COLUMN "origen" TEXT NOT NULL DEFAULT 'NARRADO';
ALTER TABLE "Subject" ADD COLUMN "desdeMinutes" INTEGER;
ALTER TABLE "Subject" ADD COLUMN "hastaMinutes" INTEGER;
CREATE INDEX "Subject_saveId_estado_idx" ON "Subject"("saveId", "estado");
