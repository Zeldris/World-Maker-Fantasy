-- Oferta de modo dinámico sin aceptar (2026-08-28) — persiste el botón "Interactuar"/"Ignorar"
-- antes de pulsarlo, para que sobreviva a una recarga (bug real: solo vivía en characterLog).
ALTER TABLE "Save" ADD COLUMN "pendingDynamicModeOffer" JSONB;
