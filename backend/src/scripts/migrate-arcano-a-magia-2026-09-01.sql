-- Migración puntual de datos: atributo `arcano` → `magia`, retirada de secundarios
-- `magia`/`poderSemilla` (decisión 2026-08-23, aplicada al motor 2026-09-01).
-- Ver docs/rpgtarkor/clases.md § Atributo Magia y docs/07-mundo-helek-sirik.md.
--
-- Alcance confirmado con \d antes de escribir nada:
--   - "Save".attributes (jsonb)          → renombrar clave 'arcano' a 'magia'
--   - "Save".secondaryAttributes (jsonb) → eliminar claves 'magia' y 'poderSemilla'
--   - "Npc".attributes (jsonb)           → renombrar clave 'arcano' a 'magia'
--   - "Npc" NO tiene columna secondaryAttributes — nada que migrar ahí.
--   - "NpcState" no tiene ni attributes ni secondaryAttributes — nada que migrar.
--
-- Ejecutar una sola vez contra la base de development local:
--   flatpak-spawn --host bash -c "podman exec tarkor-postgres psql -U tarkor -d tarkor -f <ruta>"
-- o pegando cada bloque vía psql -c. Idempotente: los WHERE ? 'arcano' hacen que una segunda
-- ejecución no afecte ninguna fila.

-- 1. Save.attributes: arcano -> magia
UPDATE "Save"
SET attributes = (attributes - 'arcano') || jsonb_build_object('magia', attributes->'arcano')
WHERE attributes ? 'arcano';

-- 2. Save.secondaryAttributes: quitar magia/poderSemilla
UPDATE "Save"
SET "secondaryAttributes" = "secondaryAttributes" - 'magia' - 'poderSemilla'
WHERE "secondaryAttributes" ? 'magia' OR "secondaryAttributes" ? 'poderSemilla';

-- 3. Npc.attributes: arcano -> magia
UPDATE "Npc"
SET attributes = (attributes - 'arcano') || jsonb_build_object('magia', attributes->'arcano')
WHERE attributes ? 'arcano';

-- Verificación (no modifica nada):
-- SELECT id, attributes FROM "Save" WHERE attributes ? 'magia' LIMIT 1;
-- SELECT count(*) FROM "Save" WHERE attributes ? 'arcano';
-- SELECT count(*) FROM "Save" WHERE "secondaryAttributes" ? 'magia' OR "secondaryAttributes" ? 'poderSemilla';
-- SELECT count(*) FROM "Npc" WHERE attributes ? 'arcano';
