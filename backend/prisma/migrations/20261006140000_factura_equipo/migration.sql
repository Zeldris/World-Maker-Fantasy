-- CR-58: equipo que falta en el Reino y en las facciones.
ALTER TABLE "KingdomStats" ADD COLUMN "sinHerramienta" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KingdomStats" ADD COLUMN "sinArma" INTEGER NOT NULL DEFAULT 0;
