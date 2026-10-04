-- CR-10 (hito 0.2, roadmap-cronista.md § 6.2): cola de reacciones del Libro de Sucesos.
ALTER TABLE "Suceso" ADD COLUMN     "nivelCascada" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reaccionesPendientes" BOOLEAN NOT NULL DEFAULT true;

-- Los sucesos que ya existían no reaccionan con efecto retroactivo.
UPDATE "Suceso" SET "reaccionesPendientes" = false;

CREATE INDEX "Suceso_saveId_reaccionesPendientes_idx" ON "Suceso"("saveId", "reaccionesPendientes");
