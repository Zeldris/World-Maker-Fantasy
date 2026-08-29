-- Bug real de sessionFacts reintroduciendo NPCs "retirados para siempre" (2026-08-27, cerrado 2026-08-28)
ALTER TABLE "Save" ADD COLUMN "npcsRetiredForever" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
