-- CFG-38 (usuaria, 2026-10-24): prompt de imagen editado a mano, el exacto con el que se generó la imagen.
ALTER TABLE "ImagePrompt" ADD COLUMN "promptUsado" TEXT,
ADD COLUMN "promptUsadoAt" TIMESTAMP(3);
