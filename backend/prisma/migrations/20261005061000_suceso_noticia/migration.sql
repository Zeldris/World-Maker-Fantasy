-- CR-18 (hito 0.2): la noticia de un suceso, para quien se entere después.
ALTER TABLE "Suceso" ADD COLUMN "noticia" JSONB;
