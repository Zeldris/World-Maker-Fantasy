-- P240: la misión de vida de Gorhorn lleva questSlug para que el narrador no la cierre. Sin cierre
-- determinista no puede fallar, así que un FALLIDA de antes solo pudo venir del narrador: vuelve a ACTIVA.
UPDATE "Quest"
SET "questSlug" = 'HONOR_MAKTOR',
    "status" = CASE WHEN "status" = 'FALLIDA' THEN 'ACTIVA'::"QuestStatus" ELSE "status" END
WHERE "title" = 'Recuperar el honor de los Maktor' AND "questSlug" IS NULL AND "tipoMision" IS NULL;
