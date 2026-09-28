-- H-9: FactionRelation.presion arrancaba en 0, que en la escala 0-100 es ALIANZA; el punto neutro es 50.
ALTER TABLE "FactionRelation" ALTER COLUMN "presion" SET DEFAULT 50;
