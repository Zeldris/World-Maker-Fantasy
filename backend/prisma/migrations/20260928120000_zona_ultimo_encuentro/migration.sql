-- Último encuentro de Zona ya ofrecido (2026-09-28) — ver `Save.zonaUltimoEncuentro` en
-- schema.prisma: evita que el mismo objetivo se vuelva a ofrecer en cada paso mientras el jugador
-- sigue dentro de su radio de 1 celda tras ignorarlo, cerrarlo o huir de él.
ALTER TABLE "Save" ADD COLUMN "zonaUltimoEncuentro" JSONB;
