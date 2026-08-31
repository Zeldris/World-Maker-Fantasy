-- Muerte permanente (2026-08-31) — botón Aceptar/Reintentar: el turno que mata al jugador se
-- detiene aquí (condicionFisica ya MUERTO, susurro ya narrado), el respawn/reinicio real se
-- retiene hasta POST /saves/:id/death/resolve.
ALTER TABLE "Save" ADD COLUMN "pendingDeathResolution" BOOLEAN NOT NULL DEFAULT false;
