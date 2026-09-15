-- Renombra RETIRAR a LIMPIAR en el enum AbilityEffect (2026-09-15) — el nombre original inducía a
-- pensar en "huir del combate", pero el efecto real siempre fue "limpiarte un DEBILIDAD activo"
-- (ver comentario del enum en schema.prisma). Verificado que ninguna fila de SavedAction.effects/
-- StartingAbility usa 'RETIRAR' antes de aplicar esto — nunca se sembró ninguna ficha real con este
-- valor, así que renombrar el valor del enum es seguro, no hay dato real que se pierda.
ALTER TYPE "AbilityEffect" RENAME VALUE 'RETIRAR' TO 'LIMPIAR';
