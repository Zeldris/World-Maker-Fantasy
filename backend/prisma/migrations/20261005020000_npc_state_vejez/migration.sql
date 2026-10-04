-- CR-13 13c (hito 0.2): años de vejez por partida de los NPC del catálogo.
ALTER TABLE "NpcState" ADD COLUMN     "vejez" INTEGER NOT NULL DEFAULT 0;
