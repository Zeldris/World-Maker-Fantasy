-- UX-38 (hito 0.2): metadatos de las noticias de «El mundo» (categoría, oportunidad, resumen).
ALTER TABLE "LogEntry" ADD COLUMN     "noticia" JSONB;
