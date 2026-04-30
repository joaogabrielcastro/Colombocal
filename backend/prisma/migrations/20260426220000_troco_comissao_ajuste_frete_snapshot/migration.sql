ALTER TABLE "Venda"
ADD COLUMN "freteTarifaSaco" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "freteTarifaTonelada" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "Venda"
SET "freteTarifaSaco" = 0,
    "freteTarifaTonelada" = 0
WHERE "freteTarifaSaco" IS NULL
   OR "freteTarifaTonelada" IS NULL;

CREATE TABLE "ComissaoAjusteVenda" (
  "id" SERIAL PRIMARY KEY,
  "vendaId" INTEGER NOT NULL UNIQUE,
  "ajusteValor" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "motivo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "ComissaoAjusteVenda"
ADD CONSTRAINT "ComissaoAjusteVenda_vendaId_fkey"
FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
