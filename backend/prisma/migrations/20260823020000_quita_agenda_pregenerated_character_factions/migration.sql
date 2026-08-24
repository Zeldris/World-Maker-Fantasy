-- Auditoría de elementos desconectados (2026-08-23): los 3 quitados aquí eran mecánica/dato
-- desarrollado sin ningún efecto real en la partida, confirmado por grep en todo el repo — ver
-- memoria de sesión "tarkor_auditoria_elementos_desconectados_2026-08-23".

-- DropForeignKey
ALTER TABLE "PregeneratedCharacter" DROP CONSTRAINT "PregeneratedCharacter_worldId_fkey";

-- AlterTable
ALTER TABLE "World" DROP COLUMN "factions";

-- AlterTable
ALTER TABLE "WorldState" DROP COLUMN "agenda";

-- DropTable
DROP TABLE "PregeneratedCharacter";
