-- AlterEnum
-- Grupo 3 § Sistema de clases (2026-08-24, ver docs/rpgtarkor/clases.md) — aplicada en su propio
-- archivo, antes de la migración que da de alta las clases/especializaciones y demás columnas
-- nuevas: Postgres no permite usar un valor de enum recién añadido en la misma transacción en la
-- que se añade (mismo criterio que 20260810120000_ability_effect_analisis).
ALTER TYPE "AbilityEffect" ADD VALUE 'CONVERSION';

-- Nuevo (VARA, arma física de golpear — Domador/Supervivencia de Cazador, ver
-- docs/rpgtarkor/clases.md § Restricción de armas por clase). No confundir con BACULO/BASTON
-- (focos MÁGICOS ya existentes).
ALTER TYPE "WeaponCategory" ADD VALUE 'VARA';
