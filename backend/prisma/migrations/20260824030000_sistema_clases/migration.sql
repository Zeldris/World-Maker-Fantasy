-- Grupo 3 § Sistema de clases (2026-08-24, diseño completo en docs/rpgtarkor/clases.md) — clase/
-- especialización real de combate para Save (personaje jugable) y Npc, bonus de atributo fijo por
-- habilidad en SavedAction.

-- CreateEnum
CREATE TYPE "Clase" AS ENUM ('GUERRERO', 'CAZADOR', 'CHAMAN', 'ARQUERO', 'CABALLERO', 'MAGO', 'SEGADOR', 'ASESINO', 'DRUIDA');

-- CreateEnum
CREATE TYPE "Especializacion" AS ENUM (
  'BERSERKER', 'GUARDIAN', 'LANCERO', 'ESPECIALISTA',
  'DOMADOR', 'SUPERVIVENCIA', 'TIRADOR', 'INSTINTIVO',
  'TOTEMICO', 'RUNICO', 'CONVOCADOR', 'OPRESOR',
  'MAESTRO_ARQUERO', 'MAESTRO_BALLESTERO',
  'CABALLERO_DEL_ORDEN', 'CABALLERO_DEL_VALOR', 'CABALLERO_DEL_DOLOR',
  'PODER_MAGIA', 'PODER_SEMILLA',
  'PARCA', 'MALDITO', 'ILUSTRADO', 'TRANSMUTADOR',
  'MAESTRO_ASESINO', 'ASESINO_TOXICO', 'ASESINO_DANZANTE', 'ASESINO_SELECTO',
  'CAMBIAFORMAS', 'AULLADOR', 'SALVAJE', 'ADAPTADO'
);

-- AlterTable Save: clase/especializacion nuevos, nullable — sin flujo in-game para elegirlos
-- todavía, ver comentario del campo en schema.prisma.
ALTER TABLE "Save" ADD COLUMN "clase" "Clase";
ALTER TABLE "Save" ADD COLUMN "especializacion" "Especializacion";

-- AlterTable Npc: `clase` pasa de String? libre a enum real — valores ya sembrados hoy son solo
-- 'Guerrero'/'Cazador'/'Cazadora' (typo de género, ya corregido en worldCatalog.ts). Cualquier
-- valor no reconocido cae a NULL — el próximo `npm run seed-catalog` resiembra todos los NPC
-- humanoides con su clase/especialización real desde worldCatalog.ts, así que este mapeo solo
-- necesita ser seguro, no exhaustivo.
ALTER TABLE "Npc" ALTER COLUMN "clase" TYPE "Clase" USING (
  CASE "clase"
    WHEN 'Guerrero' THEN 'GUERRERO'
    WHEN 'Cazador' THEN 'CAZADOR'
    WHEN 'Cazadora' THEN 'CAZADOR'
    ELSE NULL
  END
)::"Clase";
ALTER TABLE "Npc" ADD COLUMN "especializacion" "Especializacion";

-- AlterTable SavedAction: bonus de atributo fijo por habilidad (clases.md § "Habilidad de daño vs
-- ataque básico") — se suma al valor crudo del atributo antes del multiplicador de tipo al
-- resolver el intercambio (ExchangeParticipant.attributeBonus, combatExchange.ts).
ALTER TABLE "SavedAction" ADD COLUMN "attributeBonus" INTEGER;
