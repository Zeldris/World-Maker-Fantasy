-- CR-54 (Q20): re-siembra única del reparto de facciones en cada partida.
ALTER TABLE "WorldState" ADD COLUMN "repartoFacciones" INTEGER NOT NULL DEFAULT 0;
