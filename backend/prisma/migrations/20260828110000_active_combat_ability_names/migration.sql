-- "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3)
ALTER TABLE "Save" ADD COLUMN "activeCombatAbilityNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Save" ADD COLUMN "activeCombatAbilityNamesConfigured" BOOLEAN NOT NULL DEFAULT false;
