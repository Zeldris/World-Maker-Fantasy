-- AlterTable
-- Deshace el campo suelto "abilities" de la migración anterior (iteración de diseño descartada,
-- ver comentario de Npc en schema.prisma) y añade los campos de referencia a los catálogos reales
-- de habilidades (clase/raza/profesión) más los de fauna (racial propia + ataque natural).
ALTER TABLE "Npc" DROP COLUMN "abilities",
ADD COLUMN     "raza" TEXT,
ADD COLUMN     "clase" TEXT,
ADD COLUMN     "profesion" TEXT,
ADD COLUMN     "habilidadesRaciales" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "ataqueNatural" TEXT;
