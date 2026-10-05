-- CR-43 (hito 0.2): disposición aprobada de cada facción de catálogo (`propuestas-aprobadas.md`,
-- A-04/A-05). El seed la pone en el catálogo; aquí se lleva a las copias de las partidas ya creadas
-- que aún tienen la neutral por defecto (una que ya cambió por sucesión se respeta).
UPDATE "Faction" f SET "disposicion" = v.d::"Disposicion"
FROM (VALUES
  ('clan-serhu', 'BELICOSA'),
  ('concordia-de-hierro', 'BELICOSA'),
  ('los-del-obelisco', 'MERCANTIL'),
  ('clan-helsig', 'MERCANTIL'),
  ('clan-goshg', 'MERCANTIL'),
  ('keseg-sael', 'RECELOSA'),
  ('feg-tusha', 'RECELOSA'),
  ('feg-ger', 'MERCANTIL')
) AS v(slug, d)
WHERE f."disposicion" = 'NEUTRAL' AND (f."slug" = v.slug OR f."origenSlug" = v.slug);
