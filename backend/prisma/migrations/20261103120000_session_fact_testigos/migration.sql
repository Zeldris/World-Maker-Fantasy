-- QA-289 (fila 2, P266): quién presenció cada hecho. La réplica de un NPC recibe solo los hechos que vio
-- (`testigos`, los NPC en escena ese turno) o los públicos (sucesos del mundo). Los hechos de antes quedan
-- públicos, como hasta ahora; los nuevos, privados salvo que se diga.
ALTER TABLE "SessionFact" ADD COLUMN "testigos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "publico" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SessionFact" ALTER COLUMN "publico" SET DEFAULT false;
