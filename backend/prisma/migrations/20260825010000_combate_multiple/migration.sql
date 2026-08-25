-- Grupo 3 § Combate múltiple (2026-08-25, diseño completo en
-- docs/rpgtarkor/combate-multiple.md) — sesión de combate persistida (CombatEncounter +
-- CombatParticipant), Companion gana atributos/condición física propios para poder participar.
--
-- Nota: el diff generado por `prisma migrate diff` contra la DB real incluía además una
-- recreación del enum AbilityEffect y un DROP INDEX "Building_locationId_idx" — deriva ya
-- existente entre el schema y la DB real, anterior a esta pasada y sin relación con este cambio.
-- Excluida a propósito de esta migración, no se toca aquí (mismo criterio que las 2 migraciones
-- anteriores de esta misma sesión).

-- CreateEnum
CREATE TYPE "CombatEncounterEstado" AS ENUM ('EN_CURSO', 'RESUELTO');

-- CreateEnum
CREATE TYPE "CombatBando" AS ENUM ('JUGADOR', 'ENEMIGO');

-- CreateEnum
CREATE TYPE "CombatParticipantTipo" AS ENUM ('JUGADOR', 'COMPANION', 'NPC');

-- AlterTable
ALTER TABLE "Companion" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "condicionFisica" "CondicionFisica" NOT NULL DEFAULT 'ILESO';

-- CreateTable
CREATE TABLE "CombatEncounter" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "estado" "CombatEncounterEstado" NOT NULL DEFAULT 'EN_CURSO',
    "ronda" INTEGER NOT NULL DEFAULT 1,
    "turnoActual" INTEGER NOT NULL DEFAULT 0,
    "ordenIniciativa" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jugable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CombatEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombatParticipant" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "bando" "CombatBando" NOT NULL,
    "tipo" "CombatParticipantTipo" NOT NULL,
    "companionId" TEXT,
    "npcId" TEXT,
    "npcScope" TEXT NOT NULL DEFAULT '',
    "objetivoActualId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CombatParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CombatEncounter_saveId_idx" ON "CombatEncounter"("saveId");

-- CreateIndex
CREATE INDEX "CombatParticipant_encounterId_idx" ON "CombatParticipant"("encounterId");

-- AddForeignKey
ALTER TABLE "CombatEncounter" ADD CONSTRAINT "CombatEncounter_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombatParticipant" ADD CONSTRAINT "CombatParticipant_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "CombatEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombatParticipant" ADD CONSTRAINT "CombatParticipant_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombatParticipant" ADD CONSTRAINT "CombatParticipant_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
