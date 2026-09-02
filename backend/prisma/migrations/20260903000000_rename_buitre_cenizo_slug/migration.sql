-- Renombrado de fauna (2026-09-02/03): "Buitre Cenizo" -> "Zense Ceniza" (nombres de fauna sin
-- palabras que referencien la realidad, ver worldCatalog.ts). El nombre ya cambió antes; esta
-- migración cambia también el slug ("buitre-cenizo" -> "zense-ceniza") en las dos tablas que lo
-- guardan como texto en vez de FK: Npc.slug y WorldPopulation.targetSlug.
UPDATE "Npc" SET slug = 'zense-ceniza' WHERE slug = 'buitre-cenizo';
UPDATE "WorldPopulation" SET "targetSlug" = 'zense-ceniza' WHERE "targetSlug" = 'buitre-cenizo' AND "targetType" = 'FAUNA';
