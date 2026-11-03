-- P391 (2026-11-03): «Matar» sobre un combatiente convaleciente de un combate múltiple se guarda en su participante.
ALTER TABLE "CombatParticipant" ADD COLUMN "marcadoParaMatar" BOOLEAN NOT NULL DEFAULT false;
