-- CR-12 (12c, hito 0.2): días seguidos de hambre de un reino (HAMBRUNA cada 3).
ALTER TABLE "KingdomStats" ADD COLUMN     "diasHambre" INTEGER NOT NULL DEFAULT 0;
