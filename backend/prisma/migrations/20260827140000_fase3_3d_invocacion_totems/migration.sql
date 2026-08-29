-- Fase 3 § 3d de efectos de clase (2026-08-27, docs/21-roadmap.md) — INVOCACION real (tótems).

-- AlterEnum
ALTER TYPE "CombatParticipantTipo" ADD VALUE 'INVOCACION';

-- AlterTable
ALTER TABLE "CombatParticipant" ADD COLUMN "invocacionVidaRestante" INTEGER,
ADD COLUMN "invocacionRondasRestantes" INTEGER,
ADD COLUMN "invocacionInvocadorId" TEXT;
