-- § 5-bis punto 2 (docs/rpgtarkor/mundo-vivo-x4.md, 2026-09-21) — decisión explícita de Álvaro:
-- CHECK constraint real en Postgres para el par XOR saveId/companionId de ProfessionProgress
-- (modelo NUEVO de esta sesión), reforzando la validación de servicio ya existente
-- (assertExactlyOneOwner no cubre este par, solo saveId/factionId — se añade el CHECK aquí en su
-- lugar). Los pares XOR ya existentes antes de esta sesión (KingdomStats.saveId/factionId,
-- Building.saveId/factionId, ZonePoint, Npc.faction) se quedan deliberadamente en el criterio
-- solo-servicio de siempre — no se tocan, dos convenciones conviven a propósito.
ALTER TABLE "ProfessionProgress"
  ADD CONSTRAINT "ProfessionProgress_saveId_companionId_xor"
  CHECK (
    (("saveId" IS NOT NULL)::int + ("companionId" IS NOT NULL)::int) = 1
  );
