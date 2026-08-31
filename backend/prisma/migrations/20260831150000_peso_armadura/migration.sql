-- Restricción de armadura por peso (2026-08-31, Grupo 3 § Sistema de clases) — mismo espíritu
-- que la restricción de armas por clase, cubre las 9 clases de una vez.
CREATE TYPE "PesoArmadura" AS ENUM ('LIGERO', 'MEDIO', 'PESADO');
ALTER TABLE "ItemCatalog" ADD COLUMN "pesoArmadura" "PesoArmadura";
