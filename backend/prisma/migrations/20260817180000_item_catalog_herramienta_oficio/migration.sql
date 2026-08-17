-- Sistema de herramienta requerida por oficio (2026-08-17, petición explícita) — un objeto puede
-- contar como herramienta para uno o varios oficios (prefijo sin raza/región).
ALTER TABLE "ItemCatalog" ADD COLUMN "herramientaParaOficio" TEXT[] NOT NULL DEFAULT '{}';
