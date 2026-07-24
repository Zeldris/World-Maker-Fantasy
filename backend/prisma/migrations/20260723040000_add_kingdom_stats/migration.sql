CREATE TABLE "KingdomStats" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "poblacion" INTEGER NOT NULL DEFAULT 0,
    "felicidad" INTEGER NOT NULL DEFAULT 50,
    "comida" INTEGER NOT NULL DEFAULT 0,
    "bebida" INTEGER NOT NULL DEFAULT 0,
    "riqueza" INTEGER NOT NULL DEFAULT 0,
    "soldados" INTEGER NOT NULL DEFAULT 0,
    "trabajadores" INTEGER NOT NULL DEFAULT 0,
    "visitantes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KingdomStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KingdomStats_saveId_key" ON "KingdomStats"("saveId");

ALTER TABLE "KingdomStats" ADD CONSTRAINT "KingdomStats_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
