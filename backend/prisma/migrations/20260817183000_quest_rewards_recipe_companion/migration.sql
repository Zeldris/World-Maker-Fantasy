-- Recompensas de misión no-objeto (2026-08-17, petición explícita): recetas desbloqueables y
-- compañero de recompensa.
ALTER TABLE "Quest" ADD COLUMN "rewardRecipeKeys" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Quest" ADD COLUMN "rewardCompanion" JSONB;
ALTER TABLE "Save" ADD COLUMN "unlockedRecipeKeys" TEXT[] NOT NULL DEFAULT '{}';
