-- Viaje truncado por un evento de interrupción (2026-08-28) — guarda el Location.id ORIGINAL al
-- que iba el jugador antes de que pickTravelInterruption recortara el tránsito, para poder retomar
-- el viaje automáticamente en cuanto el evento se resuelva sin combate activo.
ALTER TABLE "Save" ADD COLUMN "pendingTravelResumeDestinationId" TEXT;
