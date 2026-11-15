-- QA-339 (2026-11-15): prefijo estable del último prompt del narrador, para calentarlo al abrir la partida.
CREATE TABLE "PrefijoNarrador" (
    "saveId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrefijoNarrador_pkey" PRIMARY KEY ("saveId")
);

ALTER TABLE "PrefijoNarrador" ADD CONSTRAINT "PrefijoNarrador_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
