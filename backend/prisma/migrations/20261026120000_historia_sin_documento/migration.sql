-- QA-244 (usuaria, 2026-10-26): una entrada de historia puede no tener documento. Se descubre al visitar su lugar
-- (`lugarSlug`) o, sin documento ni lugar, es saber común y está abierta desde el principio.
ALTER TABLE "HistoriaEntry" ALTER COLUMN "documentoItemSlug" DROP NOT NULL,
ADD COLUMN "lugarSlug" TEXT;
