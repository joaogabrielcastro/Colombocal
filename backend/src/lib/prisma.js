const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

/** Uma instância compartilhada evita esgotar conexões em dev (hot reload) e em produção. */
const prisma =
  globalForPrisma.__prismaColombocal ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prismaColombocal = prisma;
}

async function ensureDatabaseCompat() {
  // Backward-compatible guard for environments that are behind migrations.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Venda"
    ADD COLUMN IF NOT EXISTS "freteTarifaSaco" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "freteTarifaTonelada" DECIMAL(10,2) NOT NULL DEFAULT 0
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Cheque"
    ADD COLUMN IF NOT EXISTS "emitenteNome" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "navPermissions" JSONB
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "FinanceiroEvento"
    ADD COLUMN IF NOT EXISTS "userId" INTEGER,
    ADD COLUMN IF NOT EXISTS "userLabel" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FinanceiroEvento_tenantId_userId_createdAt_idx"
      ON "FinanceiroEvento"("tenantId", "userId", "createdAt")
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Produto"
    ADD COLUMN IF NOT EXISTS "pesoKg" DECIMAL(10,3)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OrdemCarregamento" (
      "id" SERIAL PRIMARY KEY,
      "tenantId" INTEGER NOT NULL,
      "numeroOc" INTEGER NOT NULL,
      "dataEmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "doct" TEXT,
      "pedido" TEXT,
      "vendaId" INTEGER,
      "clienteId" INTEGER,
      "clienteNome" TEXT NOT NULL,
      "clienteEndereco" TEXT,
      "clienteCidade" TEXT,
      "clienteUf" TEXT,
      "motoristaId" INTEGER,
      "motoristaNome" TEXT,
      "motoristaPlaca" TEXT,
      "motoristaCidade" TEXT,
      "motoristaUf" TEXT,
      "observacoes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "OrdemCarregamento_tenantId_numeroOc_key"
      ON "OrdemCarregamento"("tenantId", "numeroOc")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OrdemCarregamento_tenantId_dataEmissao_idx"
      ON "OrdemCarregamento"("tenantId", "dataEmissao")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OrdemCarregamentoItem" (
      "id" SERIAL PRIMARY KEY,
      "ordemId" INTEGER NOT NULL,
      "descricao" TEXT NOT NULL,
      "quantidade" DECIMAL(12,3) NOT NULL,
      "unidade" TEXT NOT NULL DEFAULT 'SAC'
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OrdemCarregamentoItem_ordemId_idx"
      ON "OrdemCarregamentoItem"("ordemId")
  `);

  // Cheque.numeroOrdem é único por tenant — remove índice global legado se existir
  await prisma.$executeRawUnsafe(`
    DROP INDEX IF EXISTS "Cheque_numeroOrdem_key"
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Cheque_tenantId_numeroOrdem_key"
      ON "Cheque"("tenantId", "numeroOrdem")
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Cliente"
    ADD COLUMN IF NOT EXISTS "inscricaoEstadual" TEXT,
    ADD COLUMN IF NOT EXISTS "indIEDest" INTEGER,
    ADD COLUMN IF NOT EXISTS "cep" TEXT,
    ADD COLUMN IF NOT EXISTS "bairro" TEXT,
    ADD COLUMN IF NOT EXISTS "numero" TEXT,
    ADD COLUMN IF NOT EXISTS "complemento" TEXT,
    ADD COLUMN IF NOT EXISTS "codigoMunicipio" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Produto"
    ADD COLUMN IF NOT EXISTS "ncm" TEXT,
    ADD COLUMN IF NOT EXISTS "cfopPadraoDentro" TEXT,
    ADD COLUMN IF NOT EXISTS "cfopPadraoFora" TEXT,
    ADD COLUMN IF NOT EXISTS "origem" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "cst" TEXT,
    ADD COLUMN IF NOT EXISTS "csosn" TEXT
  `);

  // Parâmetros por tenant — upsert exige índice único; bases legadas às vezes não o têm.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConfigSistema" (
      "id" SERIAL PRIMARY KEY,
      "tenantId" INTEGER NOT NULL,
      "chave" TEXT NOT NULL,
      "valor" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Remove duplicatas (mantém o id mais alto) antes de criar o índice único.
  await prisma.$executeRawUnsafe(`
    DELETE FROM "ConfigSistema" a
    USING "ConfigSistema" b
    WHERE a."tenantId" = b."tenantId"
      AND a."chave" = b."chave"
      AND a."id" < b."id"
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ConfigSistema_tenantId_chave_key"
      ON "ConfigSistema"("tenantId", "chave")
  `);

  await prisma.$executeRawUnsafe(`
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "EmitenteFiscal_tenantId_key"
      ON "EmitenteFiscal"("tenantId")
  `);

  await prisma.$executeRawUnsafe(`
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "NotaFiscal_tenantId_refProvedor_key"
      ON "NotaFiscal"("tenantId", "refProvedor")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotaFiscal_tenantId_status_idx"
      ON "NotaFiscal"("tenantId", "status")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotaFiscal_vendaId_idx"
      ON "NotaFiscal"("vendaId")
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "EmitenteFiscal" ADD COLUMN IF NOT EXISTS "rntrc" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "EmitenteFiscal" ADD COLUMN IF NOT EXISTS "serieCte" INTEGER NOT NULL DEFAULT 1
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "EmitenteFiscal" ADD COLUMN IF NOT EXISTS "serieMdfe" INTEGER NOT NULL DEFAULT 1
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConhecimentoTransporte" (
      "id" SERIAL PRIMARY KEY,
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ConhecimentoTransporte_tenantId_refProvedor_key"
      ON "ConhecimentoTransporte"("tenantId", "refProvedor")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ManifestoEletronico" (
      "id" SERIAL PRIMARY KEY,
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ManifestoEletronico_tenantId_refProvedor_key"
      ON "ManifestoEletronico"("tenantId", "refProvedor")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ManifestoDocumento" (
      "id" SERIAL PRIMARY KEY,
      "tenantId" INTEGER NOT NULL,
      "mdfeId" INTEGER NOT NULL,
      "tipo" TEXT NOT NULL,
      "documentoId" INTEGER,
      "chaveAcesso" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OperacaoCiot" (
      "id" SERIAL PRIMARY KEY,
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "OperacaoCiot_tenantId_refProvedor_key"
      ON "OperacaoCiot"("tenantId", "refProvedor")
  `);
}

module.exports = { prisma, ensureDatabaseCompat };
