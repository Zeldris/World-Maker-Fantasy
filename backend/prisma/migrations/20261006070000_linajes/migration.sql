-- CR-52 (hito 0.3): linajes (y rastros faerus) y sus miembros.
CREATE TABLE "Linaje" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pueblo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "casta" TEXT,
    "origen" TEXT NOT NULL,
    "desdeMinutes" INTEGER NOT NULL,
    CONSTRAINT "Linaje_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Linaje_saveId_pueblo_nombre_key" ON "Linaje"("saveId", "pueblo", "nombre");
ALTER TABLE "Linaje" ADD CONSTRAINT "Linaje_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "LinajeMiembro" (
    "saveId" TEXT NOT NULL,
    "linajeId" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "desdeMinutes" INTEGER NOT NULL,
    CONSTRAINT "LinajeMiembro_pkey" PRIMARY KEY ("linajeId", "entidadTipo", "entidadId")
);
CREATE INDEX "LinajeMiembro_saveId_entidadTipo_entidadId_idx" ON "LinajeMiembro"("saveId", "entidadTipo", "entidadId");
ALTER TABLE "LinajeMiembro" ADD CONSTRAINT "LinajeMiembro_linajeId_fkey" FOREIGN KEY ("linajeId") REFERENCES "Linaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;
