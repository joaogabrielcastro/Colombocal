-- Cadastros fiscais (emitente, cliente, produto) e NF-e vinculada à venda

ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "inscricaoEstadual" TEXT,
  ADD COLUMN IF NOT EXISTS "indIEDest" INTEGER,
  ADD COLUMN IF NOT EXISTS "cep" TEXT,
  ADD COLUMN IF NOT EXISTS "bairro" TEXT,
  ADD COLUMN IF NOT EXISTS "numero" TEXT,
  ADD COLUMN IF NOT EXISTS "complemento" TEXT,
  ADD COLUMN IF NOT EXISTS "codigoMunicipio" TEXT;

ALTER TABLE "Produto"
  ADD COLUMN IF NOT EXISTS "ncm" TEXT,
  ADD COLUMN IF NOT EXISTS "cfopPadraoDentro" TEXT,
  ADD COLUMN IF NOT EXISTS "cfopPadraoFora" TEXT,
  ADD COLUMN IF NOT EXISTS "origem" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cst" TEXT,
  ADD COLUMN IF NOT EXISTS "csosn" TEXT;

CREATE TABLE IF NOT EXISTS "EmitenteFiscal" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  "cnpj" TEXT NOT NULL,
  "inscricaoEstadual" TEXT NOT NULL,
  "razaoSocial" TEXT NOT NULL,
  "nomeFantasia" TEXT,
  "crt" INTEGER NOT NULL DEFAULT 1,
  "logradouro" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "complemento" TEXT,
  "bairro" TEXT NOT NULL,
  "municipio" TEXT NOT NULL,
  "codigoMunicipio" TEXT NOT NULL,
  "uf" TEXT NOT NULL,
  "cep" TEXT NOT NULL,
  "telefone" TEXT,
  "serieNfe" INTEGER NOT NULL DEFAULT 1,
  "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
  "provedor" TEXT NOT NULL DEFAULT 'focusnfe',
  "provedorToken" TEXT,
  "naturezaOperacao" TEXT NOT NULL DEFAULT 'Venda de mercadoria',
  "modalidadeFrete" INTEGER NOT NULL DEFAULT 9,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmitenteFiscal_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmitenteFiscal_tenantId_key"
  ON "EmitenteFiscal"("tenantId");

CREATE TABLE IF NOT EXISTS "NotaFiscal" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  "vendaId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'rascunho',
  "serie" INTEGER,
  "numero" INTEGER,
  "chaveAcesso" TEXT,
  "protocolo" TEXT,
  "motivoRejeicao" TEXT,
  "xmlUrl" TEXT,
  "danfeUrl" TEXT,
  "refProvedor" TEXT NOT NULL,
  "payloadEnviado" JSONB,
  "payloadResposta" JSONB,
  "emitidaEm" TIMESTAMP(3),
  "autorizadaEm" TIMESTAMP(3),
  "canceladaEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotaFiscal_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotaFiscal_vendaId_fkey"
    FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotaFiscal_tenantId_refProvedor_key"
  ON "NotaFiscal"("tenantId", "refProvedor");
CREATE INDEX IF NOT EXISTS "NotaFiscal_tenantId_status_idx"
  ON "NotaFiscal"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "NotaFiscal_vendaId_idx"
  ON "NotaFiscal"("vendaId");
CREATE INDEX IF NOT EXISTS "NotaFiscal_tenantId_vendaId_createdAt_idx"
  ON "NotaFiscal"("tenantId", "vendaId", "createdAt");
