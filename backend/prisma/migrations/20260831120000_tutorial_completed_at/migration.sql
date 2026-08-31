-- Muerte permanente (2026-08-31) — marca cuándo el jugador derrotó de verdad (mató) al Orco
-- Enfurecido del tutorial. Null = tutorial no superado todavía, primer punto de guardado
-- implícito pendiente.
ALTER TABLE "Save" ADD COLUMN "tutorialCompletedAt" TIMESTAMP(3);
