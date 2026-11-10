-- P381 (2026-11-10): racha del aviso «quedan menos de 7 días de comida / bebida» (una vez por racha).
ALTER TABLE "KingdomStats" ADD COLUMN "avisoComidaBajo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "KingdomStats" ADD COLUMN "avisoBebidaBajo" BOOLEAN NOT NULL DEFAULT false;
