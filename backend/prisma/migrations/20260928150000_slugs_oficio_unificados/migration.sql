-- H-10: slugs de oficio unificados (`<oficio>-<raza plural>-<región>`, fuente única backend/src/data/professions.ts).
-- Renombres: herrero-/cocinero-orco-* -> orcos-*, *-nabierus-* -> *-nabieus-*, minero-orcos-cristal -> minero-cristal,
-- y pescador-pescar -> pescador (la receta del Cebo guardaba la clave de ruta como oficio; el professionId real es 'pescador').
CREATE FUNCTION pg_temp.slug_oficio_nuevo(s text) RETURNS text AS $$
  SELECT CASE
    WHEN s = 'minero-orcos-cristal' THEN 'minero-cristal'
    WHEN s = 'pescador-pescar' THEN 'pescador'
    ELSE regexp_replace(regexp_replace(s, '^(herrero|cocinero)-orco-', '\1-orcos-'), '-nabierus-', '-nabieus-')
  END
$$ LANGUAGE sql IMMUTABLE;

-- ProfessionProgress: únicos (saveId, professionId) y (companionId, professionId). Si ya existe una fila con el
-- slug nuevo para el mismo dueño, se fusiona sumando XP y quedándose con el mayor nivel; si no, se renombra.
UPDATE "ProfessionProgress" n
SET "xp" = n."xp" + o."xp", "nivel" = GREATEST(n."nivel", o."nivel")
FROM "ProfessionProgress" o
WHERE o."professionId" <> pg_temp.slug_oficio_nuevo(o."professionId")
  AND n."professionId" = pg_temp.slug_oficio_nuevo(o."professionId")
  AND n."saveId" IS NOT DISTINCT FROM o."saveId"
  AND n."companionId" IS NOT DISTINCT FROM o."companionId";
DELETE FROM "ProfessionProgress" o
WHERE o."professionId" <> pg_temp.slug_oficio_nuevo(o."professionId")
  AND EXISTS (
    SELECT 1 FROM "ProfessionProgress" n
    WHERE n."professionId" = pg_temp.slug_oficio_nuevo(o."professionId")
      AND n."saveId" IS NOT DISTINCT FROM o."saveId"
      AND n."companionId" IS NOT DISTINCT FROM o."companionId"
  );
UPDATE "ProfessionProgress" SET "professionId" = pg_temp.slug_oficio_nuevo("professionId")
WHERE "professionId" <> pg_temp.slug_oficio_nuevo("professionId");

-- NpcProfessionPotential / NpcProfessionProgress: únicos (npcId, professionId), mismo tratamiento (descartar el viejo si choca).
DELETE FROM "NpcProfessionPotential" o
WHERE o."professionId" <> pg_temp.slug_oficio_nuevo(o."professionId")
  AND EXISTS (SELECT 1 FROM "NpcProfessionPotential" n WHERE n."npcId" = o."npcId" AND n."professionId" = pg_temp.slug_oficio_nuevo(o."professionId"));
UPDATE "NpcProfessionPotential" SET "professionId" = pg_temp.slug_oficio_nuevo("professionId")
WHERE "professionId" <> pg_temp.slug_oficio_nuevo("professionId");

DELETE FROM "NpcProfessionProgress" o
WHERE o."professionId" <> pg_temp.slug_oficio_nuevo(o."professionId")
  AND EXISTS (SELECT 1 FROM "NpcProfessionProgress" n WHERE n."npcId" = o."npcId" AND n."professionId" = pg_temp.slug_oficio_nuevo(o."professionId"));
UPDATE "NpcProfessionProgress" SET "professionId" = pg_temp.slug_oficio_nuevo("professionId")
WHERE "professionId" <> pg_temp.slug_oficio_nuevo("professionId");

-- Maestros y edificios de facción (Building.kind = profession del catálogo). El seed vuelve a escribirlos igual.
UPDATE "Npc" SET "teachesProfession" = pg_temp.slug_oficio_nuevo("teachesProfession")
WHERE "teachesProfession" IS NOT NULL AND "teachesProfession" <> pg_temp.slug_oficio_nuevo("teachesProfession");
UPDATE "Building" SET "kind" = pg_temp.slug_oficio_nuevo("kind")
WHERE "factionId" IS NOT NULL AND "kind" <> pg_temp.slug_oficio_nuevo("kind");
