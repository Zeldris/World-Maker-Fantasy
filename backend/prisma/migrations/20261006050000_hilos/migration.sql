-- CR-17 (hito 0.3): hilos (historias que el motor reconoce en el Libro de Sucesos).
CREATE TABLE "Hilo" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "patron" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "tension" INTEGER NOT NULL,
    "actores" JSONB NOT NULL,
    "clave" TEXT NOT NULL,
    "sucesoIds" TEXT[],
    "resumen" TEXT NOT NULL,
    "abiertoEn" INTEGER NOT NULL,
    "cerradoEn" INTEGER,
    CONSTRAINT "Hilo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Hilo_saveId_clave_key" ON "Hilo"("saveId", "clave");
CREATE INDEX "Hilo_saveId_estado_idx" ON "Hilo"("saveId", "estado");
ALTER TABLE "Hilo" ADD CONSTRAINT "Hilo_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
