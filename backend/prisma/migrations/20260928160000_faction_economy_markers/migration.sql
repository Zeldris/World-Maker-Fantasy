-- Fase 4 (plan oct-2026): marcadores de idempotencia de la economía de facción en worldTick.
ALTER TABLE "KingdomStats" ADD COLUMN "ultimoDiaProducido" INTEGER;
ALTER TABLE "FactionRelation" ADD COLUMN "ultimaSemanaDecaida" INTEGER;
