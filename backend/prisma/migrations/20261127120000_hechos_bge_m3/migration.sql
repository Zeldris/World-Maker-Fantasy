-- QA-523: los hechos del mundo pasan de nomic-embed-text (768) a bge-m3 (1024), como el lore. Un vector de un modelo no
-- se puede convertir al de otro: se vacía y el texto del hecho se conserva. Lo rehace el servidor al arrancar
-- (`reembeberHechos`, worldFacts.ts). `SessionFact` no tiene índice vectorial (búsqueda exacta).
ALTER TABLE "SessionFact" ALTER COLUMN "embedding" TYPE vector(1024) USING NULL;
