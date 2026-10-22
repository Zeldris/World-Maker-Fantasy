-- Casa de obras (usuaria, 2026-10-22): el nivel del constructor da velocidad, así que el avance de
-- una obra puede ir por fracciones de día.
ALTER TABLE "ObraCola" ALTER COLUMN "diasHechos" SET DATA TYPE DOUBLE PRECISION;
