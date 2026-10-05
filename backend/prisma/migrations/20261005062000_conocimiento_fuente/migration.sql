-- CR-18 (18c, hito 0.2): quién le contó un suceso al personaje.
ALTER TABLE "Conocimiento" ADD COLUMN "fuente" TEXT;
