-- CR-47 (47e): caravana que comercia con una de fondo en la región del Mercado.
ALTER TABLE "Caravana" ADD COLUMN "local" BOOLEAN NOT NULL DEFAULT false;
