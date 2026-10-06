-- REI-119: de qué población salió quien llega (vuelve a ella si no se queda).
ALTER TABLE "Subject" ADD COLUMN "poblacionOrigenId" TEXT;
ALTER TABLE "KingdomStats" ADD COLUMN "ultimaLlegada" INTEGER;
