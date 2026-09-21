-- Índice único que hace idempotente el seed de edificios de facción (ex-FactionBuilding) sobre
-- el Building generalizado (docs/rpgtarkor/mundo-vivo-x4.md § 4.2). NULL nunca choca con NULL en
-- Postgres, así que las filas del jugador (factionId siempre NULL) no se ven afectadas.

CREATE UNIQUE INDEX "Building_factionId_recipeKey_key" ON "Building"("factionId", "recipeKey");
