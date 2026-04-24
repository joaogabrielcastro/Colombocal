ALTER TABLE "Cliente"
ADD COLUMN "fretePadraoSaco" DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN "fretePadraoTonelada" DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE "Cliente"
SET "fretePadraoSaco" = COALESCE("fretePadrao", 0)
WHERE "fretePadraoSaco" = 0;
