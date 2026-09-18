-- ASE FINANCEIRO 5.3: condições de pagamento + cobrança bancária

-- CreateTable CondicaoPagamento
CREATE TABLE "CondicaoPagamento" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "diasParcelas" INTEGER[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CondicaoPagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CondicaoPagamento_tenantId_nome_key" ON "CondicaoPagamento"("tenantId", "nome");
CREATE INDEX "CondicaoPagamento_tenantId_ativo_idx" ON "CondicaoPagamento"("tenantId", "ativo");

ALTER TABLE "CondicaoPagamento" ADD CONSTRAINT "CondicaoPagamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ConfiguracaoBancaria
CREATE TABLE "ConfiguracaoBancaria" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "banco" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "status" TEXT NOT NULL DEFAULT 'NAO_CONFIGURADO',
    "agencia" TEXT,
    "conta" TEXT,
    "carteira" TEXT,
    "convenio" TEXT,
    "codigoBeneficiario" TEXT,
    "secretsCipher" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoBancaria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfiguracaoBancaria_tenantId_banco_key" ON "ConfiguracaoBancaria"("tenantId", "banco");
CREATE INDEX "ConfiguracaoBancaria_tenantId_ativo_idx" ON "ConfiguracaoBancaria"("tenantId", "ativo");

ALTER TABLE "ConfiguracaoBancaria" ADD CONSTRAINT "ConfiguracaoBancaria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Cliente
ALTER TABLE "Cliente" ADD COLUMN "condicaoPagamentoId" INTEGER;
ALTER TABLE "Cliente" ADD COLUMN "bancoCobrancaPadrao" TEXT;

CREATE INDEX "Cliente_condicaoPagamentoId_idx" ON "Cliente"("condicaoPagamentoId");

ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_condicaoPagamentoId_fkey" FOREIGN KEY ("condicaoPagamentoId") REFERENCES "CondicaoPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Venda
ALTER TABLE "Venda" ADD COLUMN "condicaoPagamentoId" INTEGER;
ALTER TABLE "Venda" ADD COLUMN "condicaoPagamentoNome" TEXT;
ALTER TABLE "Venda" ADD COLUMN "condicaoPagamentoDias" JSONB;
ALTER TABLE "Venda" ADD COLUMN "bancoCobranca" TEXT;

ALTER TABLE "Venda" ADD CONSTRAINT "Venda_condicaoPagamentoId_fkey" FOREIGN KEY ("condicaoPagamentoId") REFERENCES "CondicaoPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable TituloReceber
ALTER TABLE "TituloReceber" ADD COLUMN "parcelaNumero" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TituloReceber" ADD COLUMN "parcelaTotal" INTEGER NOT NULL DEFAULT 1;

-- CreateTable CobrancaBancaria
CREATE TABLE "CobrancaBancaria" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "tituloId" INTEGER NOT NULL,
    "vendaId" INTEGER,
    "clienteId" INTEGER NOT NULL,
    "configuracaoBancariaId" INTEGER,
    "banco" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "nossoNumero" TEXT,
    "linhaDigitavel" TEXT,
    "codigoBarras" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "refExterna" TEXT,
    "pdfRef" TEXT,
    "ultimoErro" TEXT,
    "registradaEm" TIMESTAMP(3),
    "payloadRetorno" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CobrancaBancaria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CobrancaBancaria_tituloId_key" ON "CobrancaBancaria"("tituloId");
CREATE UNIQUE INDEX "CobrancaBancaria_tenantId_idempotencyKey_key" ON "CobrancaBancaria"("tenantId", "idempotencyKey");
CREATE INDEX "CobrancaBancaria_tenantId_status_vencimento_idx" ON "CobrancaBancaria"("tenantId", "status", "vencimento");
CREATE INDEX "CobrancaBancaria_tenantId_banco_status_idx" ON "CobrancaBancaria"("tenantId", "banco", "status");
CREATE INDEX "CobrancaBancaria_tenantId_clienteId_idx" ON "CobrancaBancaria"("tenantId", "clienteId");
CREATE INDEX "CobrancaBancaria_vendaId_idx" ON "CobrancaBancaria"("vendaId");

ALTER TABLE "CobrancaBancaria" ADD CONSTRAINT "CobrancaBancaria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CobrancaBancaria" ADD CONSTRAINT "CobrancaBancaria_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "TituloReceber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CobrancaBancaria" ADD CONSTRAINT "CobrancaBancaria_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CobrancaBancaria" ADD CONSTRAINT "CobrancaBancaria_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CobrancaBancaria" ADD CONSTRAINT "CobrancaBancaria_configuracaoBancariaId_fkey" FOREIGN KEY ("configuracaoBancariaId") REFERENCES "ConfiguracaoBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
