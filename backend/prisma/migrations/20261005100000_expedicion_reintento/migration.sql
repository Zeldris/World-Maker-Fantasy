-- CR-48 (hito 0.2): espera de reintento tras no poder lanzar una expedición de facción.
ALTER TABLE "KingdomStats" ADD COLUMN "expedicionReintentoDia" INTEGER;
