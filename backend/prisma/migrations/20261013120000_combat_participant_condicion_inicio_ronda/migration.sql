-- P129 (QA-27): condición de la jugadora al empezar cada ronda del combate de grupo.
ALTER TABLE "CombatParticipant" ADD COLUMN "condicionInicioRonda" "CondicionFisica";
