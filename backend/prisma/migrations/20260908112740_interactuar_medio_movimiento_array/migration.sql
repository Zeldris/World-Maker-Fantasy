/*
  Warnings:

  - Changed the column `medio` on the `Npc` table from a scalar field to a list field.

  Migración manual (2026-09-08, "Interactuar" motor unificado de eventos de escena): Prisma no
  puede generar esto automáticamente porque hay 71 valores existentes no nulos — cada valor
  escalar se envuelve en un array de un elemento (ARRAY[medio]) en vez de perderse.
*/
-- AlterTable
ALTER TABLE "Npc"
  ALTER COLUMN "medio" DROP DEFAULT,
  ALTER COLUMN "medio" TYPE "MedioMovimiento"[] USING ARRAY["medio"]::"MedioMovimiento"[],
  ALTER COLUMN "medio" SET DEFAULT ARRAY['TERRESTRE']::"MedioMovimiento"[];
