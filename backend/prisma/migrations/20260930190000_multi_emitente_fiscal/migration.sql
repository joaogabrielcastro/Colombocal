-- Múltiplas empresas emissoras por tenant, preservando o cadastro legado.
DROP INDEX IF EXISTS "EmitenteFiscal_tenantId_key";

ALTER TABLE "EmitenteFiscal"
  ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "padrao" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "habilitaNfe" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "habilitaCte" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "habilitaMdfe" BOOLEAN NOT NULL DEFAULT true;

-- O único emitente legado de cada tenant passa a ser o padrão.
UPDATE "EmitenteFiscal" e
SET "padrao" = true,
    "habilitaCte" = true,
    "habilitaMdfe" = true
WHERE e."id" = (
  SELECT e2."id"
  FROM "EmitenteFiscal" e2
  WHERE e2."tenantId" = e."tenantId"
  ORDER BY e2."id"
  LIMIT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmitenteFiscal_tenantId_cnpj_key"
  ON "EmitenteFiscal"("tenantId", "cnpj");
CREATE INDEX IF NOT EXISTS "EmitenteFiscal_tenantId_ativo_padrao_idx"
  ON "EmitenteFiscal"("tenantId", "ativo", "padrao");

ALTER TABLE "NotaFiscal"
  ADD COLUMN IF NOT EXISTS "emitenteFiscalId" INTEGER,
  ADD COLUMN IF NOT EXISTS "emitenteNome" TEXT,
  ADD COLUMN IF NOT EXISTS "emitenteCnpj" TEXT;

UPDATE "NotaFiscal" n
SET "emitenteFiscalId" = e."id",
    "emitenteNome" = e."razaoSocial",
    "emitenteCnpj" = e."cnpj"
FROM "EmitenteFiscal" e
WHERE n."tenantId" = e."tenantId"
  AND e."padrao" = true
  AND n."emitenteFiscalId" IS NULL;

DO $$ BEGIN
  ALTER TABLE "NotaFiscal"
    ADD CONSTRAINT "NotaFiscal_emitenteFiscalId_fkey"
    FOREIGN KEY ("emitenteFiscalId") REFERENCES "EmitenteFiscal"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "NotaFiscal_tenantId_emitenteFiscalId_createdAt_idx"
  ON "NotaFiscal"("tenantId", "emitenteFiscalId", "createdAt");
