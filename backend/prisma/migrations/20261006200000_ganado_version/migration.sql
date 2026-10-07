-- CR-56 (56c): el rebaño inicial de las facciones se siembra por versiones (1 = CR-55, 2 = guardias).
ALTER TABLE "KingdomStats" ADD COLUMN "ganadoVersion" INTEGER NOT NULL DEFAULT 0;
UPDATE "KingdomStats" SET "ganadoVersion" = 1 WHERE "ganadoSembrado" = true;
ALTER TABLE "KingdomStats" DROP COLUMN "ganadoSembrado";
