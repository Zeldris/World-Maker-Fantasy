-- AlterEnum
-- Aplicada en su propio archivo, antes de la migración que añade AbilityRol/rol/analizado —
-- Postgres no permite usar un valor de enum recién añadido en la misma transacción en la que se
-- añade.
ALTER TYPE "AbilityEffect" ADD VALUE 'ANALISIS';
