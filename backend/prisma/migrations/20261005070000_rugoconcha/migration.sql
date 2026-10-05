-- CR-43 (hito 0.2): el caracol «Bulco de Arena» pasa a llamarse «Rugoconcha» (A-35 aprobada en
-- `propuestas-aprobadas.md`; se confundía con el Bolco, hoy Holdo). Renombra en sitio el slug del
-- animal (`bulco-de-arena` → `rugoconcha`) y el de su marisco (`bulco-arena-marisco` →
-- `rugoconcha-marisco`) en el catálogo y en todas las partidas, para no dejar referencias huérfanas.
-- Solo si el slug nuevo no existe ya (un seed nuevo lo habría creado aparte).

-- El animal (Npc de catálogo y copias de partida).
UPDATE "Npc" n SET "slug" = 'rugoconcha', "name" = 'Rugoconcha', "aliases" = ARRAY['rugoconcha', 'caracol de mar']
WHERE n."slug" = 'bulco-de-arena'
  AND NOT EXISTS (
    SELECT 1 FROM "Npc" o WHERE o."slug" = 'rugoconcha'
      AND o."worldId" = n."worldId" AND o."saveId" IS NOT DISTINCT FROM n."saveId"
  );
UPDATE "ZonePoint" SET "targetSlug" = 'rugoconcha', "label" = 'Rugoconcha enterrada' WHERE "targetSlug" = 'bulco-de-arena';
UPDATE "DiscoveredEntity" SET "entitySlug" = 'rugoconcha' WHERE "entitySlug" = 'bulco-de-arena';
UPDATE "WorldPopulation" SET "targetSlug" = 'rugoconcha', "label" = 'Rugoconcha' WHERE "targetSlug" = 'bulco-de-arena';
UPDATE "HarvestYield" SET "sourceSlug" = 'rugoconcha' WHERE "sourceSlug" = 'bulco-de-arena';
UPDATE "ImagePrompt" SET "entitySlug" = 'rugoconcha' WHERE "entitySlug" = 'bulco-de-arena';
UPDATE "Companion" SET "sourceSlug" = 'rugoconcha' WHERE "sourceSlug" = 'bulco-de-arena';
UPDATE "LogEntry" SET "entityBannerSlug" = 'rugoconcha' WHERE "entityBannerSlug" = 'bulco-de-arena';

-- Su marisco.
UPDATE "ItemCatalog" i SET "slug" = 'rugoconcha-marisco', "name" = 'Rugoconcha'
WHERE i."slug" = 'bulco-arena-marisco'
  AND NOT EXISTS (SELECT 1 FROM "ItemCatalog" o WHERE o."slug" = 'rugoconcha-marisco' AND o."worldId" = i."worldId");
UPDATE "InventoryItem" SET "catalogSlug" = 'rugoconcha-marisco', "name" = 'Rugoconcha' WHERE "catalogSlug" = 'bulco-arena-marisco';
UPDATE "DroppedItem" SET "catalogSlug" = 'rugoconcha-marisco' WHERE "catalogSlug" = 'bulco-arena-marisco';
UPDATE "AlmacenItem" SET "catalogSlug" = 'rugoconcha-marisco' WHERE "catalogSlug" = 'bulco-arena-marisco';
UPDATE "AlmacenLimite" SET "catalogSlug" = 'rugoconcha-marisco' WHERE "catalogSlug" = 'bulco-arena-marisco';
