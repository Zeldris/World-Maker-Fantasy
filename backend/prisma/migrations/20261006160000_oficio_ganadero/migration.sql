-- CR-55 (55b): el oficio «domador-…» era el de ganadero con otro nombre (el Domador es una
-- especialización de combate). Se renombra en todo lo que guarda un id de oficio, conservando el
-- progreso de las partidas.
UPDATE "ProfessionProgress" SET "professionId" = 'ganadero-' || substr("professionId", 9) WHERE "professionId" LIKE 'domador-%';
UPDATE "NpcProfessionPotential" SET "professionId" = 'ganadero-' || substr("professionId", 9) WHERE "professionId" LIKE 'domador-%';
UPDATE "NpcProfessionProgress" SET "professionId" = 'ganadero-' || substr("professionId", 9) WHERE "professionId" LIKE 'domador-%';
UPDATE "Expedicion" SET "professionId" = 'ganadero-' || substr("professionId", 9) WHERE "professionId" LIKE 'domador-%';
UPDATE "Npc" SET "teachesProfession" = 'ganadero-' || substr("teachesProfession", 9) WHERE "teachesProfession" LIKE 'domador-%';
UPDATE "Building" SET "kind" = 'ganadero-' || substr("kind", 9) WHERE "kind" LIKE 'domador-%';
