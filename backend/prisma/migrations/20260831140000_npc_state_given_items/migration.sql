-- Mecánica real de "dar objeto a NPC" (2026-08-31) — objetos entregados a mano por el jugador a
-- una instancia concreta de NPC, disponibles para saquear si luego lo derrotas.
ALTER TABLE "NpcState" ADD COLUMN "givenItems" JSONB NOT NULL DEFAULT '[]';
