-- CR-36 (36a, Q38): edificios de facción con cantidad («Pozo ×N» en una fila) y la obra que levanta cada facción.
ALTER TABLE "Building" ADD COLUMN "cantidad" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "ObraFaccion" (
    "id" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "recipeKey" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "dias" INTEGER NOT NULL,
    "diasHechos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gastados" INTEGER NOT NULL DEFAULT 0,
    "empezada" BOOLEAN NOT NULL DEFAULT false,
    "mejoraDe" TEXT,
    "aviso" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraFaccion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObraFaccion_factionId_key" ON "ObraFaccion"("factionId");
CREATE INDEX "ObraFaccion_saveId_idx" ON "ObraFaccion"("saveId");

ALTER TABLE "ObraFaccion" ADD CONSTRAINT "ObraFaccion_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
