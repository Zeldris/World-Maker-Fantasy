-- CR-53 53d: días seguidos sin agua.
ALTER TABLE "KingdomStats" ADD COLUMN "diasSed" INTEGER NOT NULL DEFAULT 0;
