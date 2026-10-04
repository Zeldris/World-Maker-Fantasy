-- CR-13 (hito 0.2): padre y madre de un NPC nacido o destacado en la partida (herencia).
ALTER TABLE "Npc" ADD COLUMN     "madreNpcId" TEXT,
ADD COLUMN     "padreNpcId" TEXT;
