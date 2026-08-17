-- Renombra el valor del enum CondicionFisica de INCAPACITADO a CONVALECIENTE (2026-08-17,
-- petición explícita) — mismo valor semántico, solo cambia el nombre. Postgres soporta el rename
-- directo de un valor de enum sin tener que recrear el tipo entero (a diferencia de añadir/quitar
-- valores, ver la migración de AbilityEffect/WeaponCategory del 2026-08-17 anterior).
ALTER TYPE "CondicionFisica" RENAME VALUE 'INCAPACITADO' TO 'CONVALECIENTE';
