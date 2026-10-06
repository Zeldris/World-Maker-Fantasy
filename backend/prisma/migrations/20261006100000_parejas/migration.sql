-- REI-120: parejas y crías de los súbditos.
ALTER TABLE "Subject" ADD COLUMN "parejaId" TEXT;
ALTER TABLE "Subject" ADD COLUMN "crias" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KingdomStats" ADD COLUMN "ultimaRevisionFamilias" INTEGER;
