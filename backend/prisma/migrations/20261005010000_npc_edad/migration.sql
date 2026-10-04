-- CR-13 13b (hito 0.2): nacimiento y atributos de adulto de los NPC nacidos en la partida.
ALTER TABLE "Npc" ADD COLUMN     "atributosPotenciales" JSONB,
ADD COLUMN     "nacidoEn" INTEGER;
