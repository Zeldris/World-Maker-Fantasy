-- CR-53 53c: sueldos semanales del Reino.
ALTER TABLE "KingdomStats" ADD COLUMN "ultimoPagoSueldos" INTEGER;
ALTER TABLE "KingdomStats" ADD COLUMN "diasSinCobrar" INTEGER NOT NULL DEFAULT 0;
