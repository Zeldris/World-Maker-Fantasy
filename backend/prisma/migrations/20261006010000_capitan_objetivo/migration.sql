-- CR-45 (hito 0.2): capitán del bando enemigo y el objetivo que señala esta ronda, para marcarlo en
-- el panel del combate de varios.
ALTER TABLE "CombatEncounter" ADD COLUMN "capitanId" TEXT;
ALTER TABLE "CombatEncounter" ADD COLUMN "objetivoCapitanId" TEXT;
