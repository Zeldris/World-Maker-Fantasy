-- Deuda técnica encontrada de paso (2026-09-02, sesión "pescador"): schema.prisma ya tenía
-- `PROVOCACION` en vez de `ATENCION` en el enum AbilityEffect (renombre hecho en una sesión
-- anterior sin generar su propia migración), pero la base de datos seguía con el valor viejo —
-- drift real que bloqueaba CUALQUIER migración nueva (`prisma migrate dev` fallaba con "the values
-- [ATENCION] on the enum AbilityEffect will be removed"). Verificado que ninguna fila de
-- SavedAction.effects usa 'ATENCION' antes de aplicar esto (0 resultados) — renombrar el valor del
-- enum es seguro, no hay dato real que se pierda.
ALTER TYPE "AbilityEffect" RENAME VALUE 'ATENCION' TO 'PROVOCACION';
