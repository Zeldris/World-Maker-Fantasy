-- AlterEnum
-- LogChannel.KINGDOM tenía sintaxis inválida en el schema (KINGDOM: 'KINGDOM') — nunca llegó a
-- aplicarse a la base de datos real, se añade aquí ya con la sintaxis válida.
ALTER TYPE "LogChannel" ADD VALUE IF NOT EXISTS 'KINGDOM';

-- AlterEnum
ALTER TYPE "AbilityRol" ADD VALUE IF NOT EXISTS 'pasiva';

-- AlterEnum
ALTER TYPE "PopulationTargetType" ADD VALUE IF NOT EXISTS 'FLORA';
ALTER TYPE "PopulationTargetType" ADD VALUE IF NOT EXISTS 'FACCION';

-- AbilityEffect: se reescribe entero porque REMATE se retira (fusionado en LETAL) — Postgres no
-- permite quitar valores de un enum con ALTER TYPE, hace falta recrear el tipo.
ALTER TYPE "AbilityEffect" RENAME TO "AbilityEffect_old";

CREATE TYPE "AbilityEffect" AS ENUM (
  'ATAQUE', 'ATURDIMIENTO', 'INTIMIDACION', 'AGUANTE', 'ANALISIS',
  'INVOCACION', 'DEBILIDAD', 'AUMENTO', 'RETIRAR', 'CANALIZAR', 'CURAZION',
  'REFLEJAR', 'EXPULSAR', 'CONTROL', 'MULTIPLE', 'LETAL', 'DESVIAR',
  'ATENCION', 'OCULTACION', 'CONTRA', 'REFRACTAR', 'RECUPERACION',
  'PURIFICAR', 'COMPANERO', 'LIMITADA'
);

-- SavedAction.effect (valor único) -> SavedAction.effects (lista) — se añade la columna nueva
-- primero, se rellena a partir de la vieja (REMATE -> LETAL, todo lo demás igual por nombre), y
-- se borra la columna vieja.
ALTER TABLE "SavedAction" ADD COLUMN "effects" "AbilityEffect"[] NOT NULL DEFAULT '{}';

UPDATE "SavedAction" SET "effects" =
  CASE
    WHEN "effect" IS NULL THEN '{}'::"AbilityEffect"[]
    WHEN "effect"::text = 'REMATE' THEN ARRAY['LETAL']::"AbilityEffect"[]
    ELSE ARRAY["effect"::text]::"AbilityEffect"[]
  END;

ALTER TABLE "SavedAction" ADD COLUMN "maxUsesPerCombat" INTEGER;

ALTER TABLE "SavedAction" DROP COLUMN "effect";

DROP TYPE "AbilityEffect_old";

-- WeaponCategory: HACHA/MAZA/GARROTE/ESPADA se dividen en variantes _1_MANO/_2_MANO, más varias
-- categorías nuevas (arcos, honda, ballesta, báculo, bastón, grimorio, guantes, red) — mismo
-- motivo que arriba, hace falta recrear el tipo porque los 4 valores viejos desaparecen.
ALTER TYPE "WeaponCategory" RENAME TO "WeaponCategory_old";

CREATE TYPE "WeaponCategory" AS ENUM (
  'HACHA_1_MANO', 'HACHA_2_MANO', 'MAZA_1_MANO', 'MAZA_2_MANO',
  'GARROTE_1_MANO', 'GARROTE_2_MANO', 'PICA', 'LANZA', 'CUCHILLO', 'DAGA',
  'ESPADA_1_MANO', 'ESPADA_2_MANO', 'ESCUDO', 'ARCO_CORTO', 'ARCO_LARGO',
  'HONDA', 'BALLESTA', 'BACULO', 'BASTON', 'GRIMORIO', 'GUANTES', 'RED'
);

ALTER TABLE "ItemCatalog" ALTER COLUMN "tipoArma" TYPE "WeaponCategory" USING (
  CASE "tipoArma"::text
    WHEN 'HACHA' THEN 'HACHA_1_MANO'
    WHEN 'MAZA' THEN 'MAZA_1_MANO'
    WHEN 'GARROTE' THEN 'GARROTE_1_MANO'
    WHEN 'ESPADA' THEN 'ESPADA_1_MANO'
    ELSE "tipoArma"::text
  END
)::"WeaponCategory";

DROP TYPE "WeaponCategory_old";

-- AlterTable
-- Tope de usos por combate (2026-08-15) — contador real por NpcState, ver comentario del campo
-- en schema.prisma.
ALTER TABLE "NpcState" ADD COLUMN "abilityUsesThisEncounter" JSONB NOT NULL DEFAULT '{}';
