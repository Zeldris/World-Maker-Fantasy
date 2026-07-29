-- AlterTable
-- "Habilidades de profesión" en la ficha de combate se descartó (aplazado a otra sesión: resultó
-- ser un concepto distinto, recetas de crafteo desbloqueadas por nivel de oficio, no algo de
-- combate) — deshace el campo de la migración anterior.
ALTER TABLE "Npc" DROP COLUMN "profesion";
