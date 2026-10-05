-- CR-44 (44c, hito 0.2): moral en el combate de varios. Quién huyó, quién ya tiró por caer a GRAVE
-- y qué bandos ya tiraron por quedar a la mitad.
ALTER TABLE "CombatParticipant" ADD COLUMN "huido" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CombatParticipant" ADD COLUMN "moralTirada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CombatEncounter" ADD COLUMN "moralMitadBandos" TEXT[] DEFAULT ARRAY[]::TEXT[];
