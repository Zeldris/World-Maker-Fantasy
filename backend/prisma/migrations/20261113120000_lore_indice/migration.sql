-- QA-330: configuración con la que se construyó el índice del lore (modelo, trozo, solapamiento, prefijos, plantilla).
ALTER TABLE "World" ADD COLUMN "loreIndice" JSONB;
