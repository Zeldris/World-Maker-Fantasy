-- QA-351 (R7): el vector del lore admite cualquier dimensión (bge-m3 da 1024). `LoreChunk` no tiene índice vectorial
-- (búsqueda exacta, ver retrieval.ts), así que no hay índice que dependa de la dimensión. Las filas de 768 se quedan
-- como están. `SessionFact.embedding` sigue en vector(768).
ALTER TABLE "LoreChunk" ALTER COLUMN "embedding" TYPE vector;

-- QA-351 (R5): texto completo de cada trozo (título + trozo, configuración `spanish`), lo llena reindex-lore.
ALTER TABLE "LoreChunk" ADD COLUMN "busqueda" tsvector;
CREATE INDEX "LoreChunk_busqueda_idx" ON "LoreChunk" USING GIN ("busqueda");
