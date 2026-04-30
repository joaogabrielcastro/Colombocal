-- Estado unico dos cheques + novo campo de emitente
ALTER TABLE "Cheque"
ADD COLUMN "emitenteNome" TEXT;

UPDATE "Cheque"
SET "status" = 'ativo'
WHERE "status" IS NULL
   OR "status" <> 'ativo';

ALTER TABLE "Cheque"
ALTER COLUMN "status" SET DEFAULT 'ativo';
