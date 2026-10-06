-- CR-14 (hito 0.3): etiquetas ganadas por el personaje.
CREATE TABLE "Etiqueta" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "sucesoId" TEXT NOT NULL,
    "desdeMinutes" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Etiqueta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Etiqueta_saveId_entidadTipo_entidadId_clave_key" ON "Etiqueta"("saveId", "entidadTipo", "entidadId", "clave");
CREATE INDEX "Etiqueta_saveId_activa_idx" ON "Etiqueta"("saveId", "activa");
ALTER TABLE "Etiqueta" ADD CONSTRAINT "Etiqueta_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
