-- ASE Fiscal 5.2: CT-e, MDF-e, CIOT + EmitenteFiscal RNTRC/séries

ALTER TABLE "EmitenteFiscal" ADD COLUMN IF NOT EXISTS "rntrc" TEXT;
ALTER TABLE "EmitenteFiscal" ADD COLUMN IF NOT EXISTS "serieCte" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "EmitenteFiscal" ADD COLUMN IF NOT EXISTS "serieMdfe" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "ConhecimentoTransporte" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "modelo" TEXT NOT NULL DEFAULT '57',
    "serie" INTEGER,
    "numero" INTEGER,
    "chaveAcesso" TEXT,
    "protocolo" TEXT,
    "refProvedor" TEXT NOT NULL,
    "emitenteNome" TEXT,
    "emitenteDoc" TEXT,
    "remetenteNome" TEXT,
    "remetenteDoc" TEXT,
    "destinatarioNome" TEXT,
    "destinatarioDoc" TEXT,
    "tomadorNome" TEXT,
    "tomadorDoc" TEXT,
    "origemMunicipio" TEXT,
    "origemUf" TEXT,
    "origemCodigoMunicipio" TEXT,
    "destinoMunicipio" TEXT,
    "destinoUf" TEXT,
    "destinoCodigoMunicipio" TEXT,
    "valorServico" DECIMAL(12,2),
    "valorCarga" DECIMAL(12,2),
    "pesoKg" DECIMAL(12,3),
    "observacoes" TEXT,
    "xmlUrl" TEXT,
    "dacteUrl" TEXT,
    "motivoRejeicao" TEXT,
    "erroTecnico" TEXT,
    "payloadEnviado" JSONB,
    "payloadResposta" JSONB,
    "vendaId" INTEGER,
    "freteMovimentoId" INTEGER,
    "ordemCarregamentoId" INTEGER,
    "motoristaId" INTEGER,
    "emitidaEm" TIMESTAMP(3),
    "autorizadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConhecimentoTransporte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConhecimentoTransporte_tenantId_refProvedor_key"
  ON "ConhecimentoTransporte"("tenantId", "refProvedor");
CREATE INDEX IF NOT EXISTS "ConhecimentoTransporte_tenantId_status_idx"
  ON "ConhecimentoTransporte"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ConhecimentoTransporte_tenantId_emitidaEm_idx"
  ON "ConhecimentoTransporte"("tenantId", "emitidaEm");
CREATE INDEX IF NOT EXISTS "ConhecimentoTransporte_tenantId_autorizadaEm_idx"
  ON "ConhecimentoTransporte"("tenantId", "autorizadaEm");
CREATE INDEX IF NOT EXISTS "ConhecimentoTransporte_tenantId_serie_numero_idx"
  ON "ConhecimentoTransporte"("tenantId", "serie", "numero");
CREATE INDEX IF NOT EXISTS "ConhecimentoTransporte_vendaId_idx"
  ON "ConhecimentoTransporte"("vendaId");
CREATE INDEX IF NOT EXISTS "ConhecimentoTransporte_freteMovimentoId_idx"
  ON "ConhecimentoTransporte"("freteMovimentoId");
CREATE INDEX IF NOT EXISTS "ConhecimentoTransporte_ordemCarregamentoId_idx"
  ON "ConhecimentoTransporte"("ordemCarregamentoId");
CREATE INDEX IF NOT EXISTS "ConhecimentoTransporte_motoristaId_idx"
  ON "ConhecimentoTransporte"("motoristaId");

CREATE TABLE IF NOT EXISTS "ManifestoEletronico" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "serie" INTEGER,
    "numero" INTEGER,
    "chaveAcesso" TEXT,
    "protocolo" TEXT,
    "refProvedor" TEXT NOT NULL,
    "ufInicio" TEXT,
    "ufFim" TEXT,
    "veiculoPlaca" TEXT,
    "veiculoDescricao" TEXT,
    "motoristaNome" TEXT,
    "motoristaDoc" TEXT,
    "xmlUrl" TEXT,
    "damdfeUrl" TEXT,
    "motivoRejeicao" TEXT,
    "erroTecnico" TEXT,
    "ufEncerramento" TEXT,
    "municipioEncerramento" TEXT,
    "payloadEnviado" JSONB,
    "payloadResposta" JSONB,
    "vendaId" INTEGER,
    "freteMovimentoId" INTEGER,
    "ordemCarregamentoId" INTEGER,
    "motoristaId" INTEGER,
    "emitidaEm" TIMESTAMP(3),
    "autorizadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "encerradaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManifestoEletronico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ManifestoEletronico_tenantId_refProvedor_key"
  ON "ManifestoEletronico"("tenantId", "refProvedor");
CREATE INDEX IF NOT EXISTS "ManifestoEletronico_tenantId_status_idx"
  ON "ManifestoEletronico"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ManifestoEletronico_tenantId_emitidaEm_idx"
  ON "ManifestoEletronico"("tenantId", "emitidaEm");
CREATE INDEX IF NOT EXISTS "ManifestoEletronico_tenantId_autorizadaEm_idx"
  ON "ManifestoEletronico"("tenantId", "autorizadaEm");
CREATE INDEX IF NOT EXISTS "ManifestoEletronico_tenantId_serie_numero_idx"
  ON "ManifestoEletronico"("tenantId", "serie", "numero");
CREATE INDEX IF NOT EXISTS "ManifestoEletronico_vendaId_idx"
  ON "ManifestoEletronico"("vendaId");
CREATE INDEX IF NOT EXISTS "ManifestoEletronico_freteMovimentoId_idx"
  ON "ManifestoEletronico"("freteMovimentoId");
CREATE INDEX IF NOT EXISTS "ManifestoEletronico_ordemCarregamentoId_idx"
  ON "ManifestoEletronico"("ordemCarregamentoId");
CREATE INDEX IF NOT EXISTS "ManifestoEletronico_motoristaId_idx"
  ON "ManifestoEletronico"("motoristaId");

CREATE TABLE IF NOT EXISTS "ManifestoDocumento" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "mdfeId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "documentoId" INTEGER,
    "chaveAcesso" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManifestoDocumento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ManifestoDocumento_mdfeId_idx"
  ON "ManifestoDocumento"("mdfeId");
CREATE INDEX IF NOT EXISTS "ManifestoDocumento_tenantId_tipo_idx"
  ON "ManifestoDocumento"("tenantId", "tipo");
CREATE INDEX IF NOT EXISTS "ManifestoDocumento_chaveAcesso_idx"
  ON "ManifestoDocumento"("chaveAcesso");

CREATE TABLE IF NOT EXISTS "OperacaoCiot" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "codigoCiot" TEXT,
    "codigoVerificador" TEXT,
    "tipoOperacao" TEXT,
    "transportadorNome" TEXT,
    "transportadorDoc" TEXT,
    "contratanteNome" TEXT,
    "contratanteDoc" TEXT,
    "motoristaId" INTEGER,
    "motoristaNome" TEXT,
    "veiculoPlaca" TEXT,
    "veiculoDescricao" TEXT,
    "origemMunicipio" TEXT,
    "origemUf" TEXT,
    "destinoMunicipio" TEXT,
    "destinoUf" TEXT,
    "valorOperacao" DECIMAL(12,2),
    "observacoes" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'nao_implementado',
    "refProvedor" TEXT,
    "erroTecnico" TEXT,
    "payloadEnviado" JSONB,
    "payloadResposta" JSONB,
    "freteMovimentoId" INTEGER,
    "vendaId" INTEGER,
    "dataOperacao" TIMESTAMP(3),
    "registradaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "encerradaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperacaoCiot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OperacaoCiot_tenantId_refProvedor_key"
  ON "OperacaoCiot"("tenantId", "refProvedor");
CREATE INDEX IF NOT EXISTS "OperacaoCiot_tenantId_status_idx"
  ON "OperacaoCiot"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "OperacaoCiot_tenantId_dataOperacao_idx"
  ON "OperacaoCiot"("tenantId", "dataOperacao");
CREATE INDEX IF NOT EXISTS "OperacaoCiot_tenantId_codigoCiot_idx"
  ON "OperacaoCiot"("tenantId", "codigoCiot");
CREATE INDEX IF NOT EXISTS "OperacaoCiot_motoristaId_idx"
  ON "OperacaoCiot"("motoristaId");
CREATE INDEX IF NOT EXISTS "OperacaoCiot_freteMovimentoId_idx"
  ON "OperacaoCiot"("freteMovimentoId");
CREATE INDEX IF NOT EXISTS "OperacaoCiot_vendaId_idx"
  ON "OperacaoCiot"("vendaId");

DO $$ BEGIN
  ALTER TABLE "ConhecimentoTransporte" ADD CONSTRAINT "ConhecimentoTransporte_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ConhecimentoTransporte" ADD CONSTRAINT "ConhecimentoTransporte_vendaId_fkey"
    FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ConhecimentoTransporte" ADD CONSTRAINT "ConhecimentoTransporte_freteMovimentoId_fkey"
    FOREIGN KEY ("freteMovimentoId") REFERENCES "FreteMovimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ConhecimentoTransporte" ADD CONSTRAINT "ConhecimentoTransporte_ordemCarregamentoId_fkey"
    FOREIGN KEY ("ordemCarregamentoId") REFERENCES "OrdemCarregamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ConhecimentoTransporte" ADD CONSTRAINT "ConhecimentoTransporte_motoristaId_fkey"
    FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ManifestoEletronico" ADD CONSTRAINT "ManifestoEletronico_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ManifestoEletronico" ADD CONSTRAINT "ManifestoEletronico_vendaId_fkey"
    FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ManifestoEletronico" ADD CONSTRAINT "ManifestoEletronico_freteMovimentoId_fkey"
    FOREIGN KEY ("freteMovimentoId") REFERENCES "FreteMovimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ManifestoEletronico" ADD CONSTRAINT "ManifestoEletronico_ordemCarregamentoId_fkey"
    FOREIGN KEY ("ordemCarregamentoId") REFERENCES "OrdemCarregamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ManifestoEletronico" ADD CONSTRAINT "ManifestoEletronico_motoristaId_fkey"
    FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ManifestoDocumento" ADD CONSTRAINT "ManifestoDocumento_mdfeId_fkey"
    FOREIGN KEY ("mdfeId") REFERENCES "ManifestoEletronico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OperacaoCiot" ADD CONSTRAINT "OperacaoCiot_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OperacaoCiot" ADD CONSTRAINT "OperacaoCiot_motoristaId_fkey"
    FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OperacaoCiot" ADD CONSTRAINT "OperacaoCiot_freteMovimentoId_fkey"
    FOREIGN KEY ("freteMovimentoId") REFERENCES "FreteMovimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OperacaoCiot" ADD CONSTRAINT "OperacaoCiot_vendaId_fkey"
    FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
