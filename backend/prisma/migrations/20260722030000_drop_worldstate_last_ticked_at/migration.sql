-- Revisión técnica 2026-07-22: lastTickedAt se escribía en cada tick del worker (worldTick.ts)
-- pero nunca se leía en ningún sitio del código — era peso muerto que además costaba una consulta
-- N+1 (un UPDATE por partida, en serie) cada WORLD_TICK_INTERVAL_MINUTES sin ningún beneficio.
ALTER TABLE "WorldState" DROP COLUMN "lastTickedAt";
