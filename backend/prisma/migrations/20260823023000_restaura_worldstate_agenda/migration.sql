-- Revierte parcialmente la migración anterior (20260823020000): la usuaria confirmó que
-- WorldState.agenda sí tiene valor real (feature de agenda de mundo pendiente de diseñar), a
-- diferencia de PregeneratedCharacter y World.factions, que se quedan fuera.

-- AlterTable
ALTER TABLE "WorldState" ADD COLUMN "agenda" JSONB NOT NULL DEFAULT '[]';
