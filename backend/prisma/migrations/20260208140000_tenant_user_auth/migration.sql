-- Multi-tenant + User (auth). Dados existentes vão para o tenant padrão (id 1).

CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

INSERT INTO "Tenant" ("name", "slug") VALUES ('Organização padrão', 'default');

CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- Cliente
ALTER TABLE "Cliente" ADD COLUMN "tenantId" INTEGER;

UPDATE "Cliente" SET "tenantId" = (SELECT "id" FROM "Tenant" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "Cliente" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Cliente" DROP CONSTRAINT IF EXISTS "Cliente_cnpj_key";

CREATE UNIQUE INDEX "Cliente_tenantId_cnpj_key" ON "Cliente"("tenantId", "cnpj");

ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Cliente_ativo_razaoSocial_idx";

CREATE INDEX "Cliente_tenantId_ativo_razaoSocial_idx" ON "Cliente"("tenantId", "ativo", "razaoSocial");

-- Produto
ALTER TABLE "Produto" ADD COLUMN "tenantId" INTEGER;

UPDATE "Produto" SET "tenantId" = (SELECT "id" FROM "Tenant" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "Produto" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Produto" DROP CONSTRAINT IF EXISTS "Produto_codigo_key";

CREATE UNIQUE INDEX "Produto_tenantId_codigo_key" ON "Produto"("tenantId", "codigo");

ALTER TABLE "Produto" ADD CONSTRAINT "Produto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Motorista
ALTER TABLE "Motorista" ADD COLUMN "tenantId" INTEGER;

UPDATE "Motorista" SET "tenantId" = (SELECT "id" FROM "Tenant" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "Motorista" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Motorista_tenantId_idx" ON "Motorista"("tenantId");

-- Vendedor
ALTER TABLE "Vendedor" ADD COLUMN "tenantId" INTEGER;

UPDATE "Vendedor" SET "tenantId" = (SELECT "id" FROM "Tenant" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "Vendedor" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Vendedor" ADD CONSTRAINT "Vendedor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Vendedor_tenantId_idx" ON "Vendedor"("tenantId");

-- Venda
ALTER TABLE "Venda" ADD COLUMN "tenantId" INTEGER;

UPDATE "Venda" v SET "tenantId" = c."tenantId" FROM "Cliente" c WHERE v."clienteId" = c."id";

ALTER TABLE "Venda" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Venda" ADD CONSTRAINT "Venda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Venda_clienteId_dataVenda_idx";

DROP INDEX IF EXISTS "Venda_vendedorId_dataVenda_idx";

CREATE INDEX "Venda_tenantId_clienteId_dataVenda_idx" ON "Venda"("tenantId", "clienteId", "dataVenda");

CREATE INDEX "Venda_tenantId_vendedorId_dataVenda_idx" ON "Venda"("tenantId", "vendedorId", "dataVenda");

-- Cheque: tenant + unique composto em numeroOrdem
ALTER TABLE "Cheque" ADD COLUMN "tenantId" INTEGER;

UPDATE "Cheque" ch SET "tenantId" = c."tenantId" FROM "Cliente" c WHERE ch."clienteId" = c."id";

ALTER TABLE "Cheque" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Cheque" DROP CONSTRAINT IF EXISTS "Cheque_numeroOrdem_key";

ALTER TABLE "Cheque" ALTER COLUMN "numeroOrdem" DROP DEFAULT;

ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Cheque_tenantId_numeroOrdem_key" ON "Cheque"("tenantId", "numeroOrdem");

DROP INDEX IF EXISTS "Cheque_clienteId_status_dataRecebimento_idx";

CREATE INDEX "Cheque_tenantId_clienteId_status_dataRecebimento_idx" ON "Cheque"("tenantId", "clienteId", "status", "dataRecebimento");

-- Pagamento
ALTER TABLE "Pagamento" ADD COLUMN "tenantId" INTEGER;

UPDATE "Pagamento" p SET "tenantId" = c."tenantId" FROM "Cliente" c WHERE p."clienteId" = c."id";

ALTER TABLE "Pagamento" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Pagamento_clienteId_data_idx";

DROP INDEX IF EXISTS "Pagamento_vendaId_data_idx";

CREATE INDEX "Pagamento_tenantId_clienteId_data_idx" ON "Pagamento"("tenantId", "clienteId", "data");

CREATE INDEX "Pagamento_tenantId_vendaId_data_idx" ON "Pagamento"("tenantId", "vendaId", "data");

-- TituloReceber
ALTER TABLE "TituloReceber" ADD COLUMN "tenantId" INTEGER;

UPDATE "TituloReceber" t SET "tenantId" = c."tenantId" FROM "Cliente" c WHERE t."clienteId" = c."id";

ALTER TABLE "TituloReceber" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "TituloReceber" ADD CONSTRAINT "TituloReceber_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "TituloReceber_clienteId_status_vencimento_idx";

DROP INDEX IF EXISTS "TituloReceber_vendaId_idx";

CREATE INDEX "TituloReceber_tenantId_clienteId_status_vencimento_idx" ON "TituloReceber"("tenantId", "clienteId", "status", "vencimento");

CREATE INDEX "TituloReceber_tenantId_vendaId_idx" ON "TituloReceber"("tenantId", "vendaId");

-- FreteMovimento
ALTER TABLE "FreteMovimento" ADD COLUMN "tenantId" INTEGER;

UPDATE "FreteMovimento" f SET "tenantId" = c."tenantId" FROM "Cliente" c WHERE f."clienteId" = c."id";

ALTER TABLE "FreteMovimento" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "FreteMovimento" ADD CONSTRAINT "FreteMovimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "FreteMovimento_clienteId_data_idx";

DROP INDEX IF EXISTS "FreteMovimento_vendaId_idx";

CREATE INDEX "FreteMovimento_tenantId_clienteId_data_idx" ON "FreteMovimento"("tenantId", "clienteId", "data");

CREATE INDEX "FreteMovimento_tenantId_vendaId_idx" ON "FreteMovimento"("tenantId", "vendaId");

-- MovimentacaoEstoque
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "tenantId" INTEGER;

UPDATE "MovimentacaoEstoque" m SET "tenantId" = p."tenantId" FROM "Produto" p WHERE m."produtoId" = p."id";

UPDATE "MovimentacaoEstoque" m SET "tenantId" = v."tenantId" FROM "Venda" v WHERE m."tenantId" IS NULL AND m."vendaId" = v."id";

UPDATE "MovimentacaoEstoque" SET "tenantId" = (SELECT "id" FROM "Tenant" ORDER BY "id" ASC LIMIT 1) WHERE "tenantId" IS NULL;

ALTER TABLE "MovimentacaoEstoque" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "MovimentacaoEstoque_produtoId_data_idx";

CREATE INDEX "MovimentacaoEstoque_tenantId_produtoId_data_idx" ON "MovimentacaoEstoque"("tenantId", "produtoId", "data");

-- ConfigSistema
ALTER TABLE "ConfigSistema" ADD COLUMN "tenantId" INTEGER;

UPDATE "ConfigSistema" SET "tenantId" = (SELECT "id" FROM "Tenant" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "ConfigSistema" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "ConfigSistema" DROP CONSTRAINT IF EXISTS "ConfigSistema_chave_key";

CREATE UNIQUE INDEX "ConfigSistema_tenantId_chave_key" ON "ConfigSistema"("tenantId", "chave");

ALTER TABLE "ConfigSistema" ADD CONSTRAINT "ConfigSistema_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ComissaoAjusteVenda
ALTER TABLE "ComissaoAjusteVenda" ADD COLUMN "tenantId" INTEGER;

UPDATE "ComissaoAjusteVenda" ca SET "tenantId" = v."tenantId" FROM "Venda" v WHERE ca."vendaId" = v."id";

ALTER TABLE "ComissaoAjusteVenda" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "ComissaoAjusteVenda" ADD CONSTRAINT "ComissaoAjusteVenda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FinanceiroEvento
ALTER TABLE "FinanceiroEvento" ADD COLUMN "tenantId" INTEGER;

UPDATE "FinanceiroEvento" SET "tenantId" = (SELECT "id" FROM "Tenant" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "FinanceiroEvento" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "FinanceiroEvento" ADD CONSTRAINT "FinanceiroEvento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "FinanceiroEvento_tipo_createdAt_idx";

DROP INDEX IF EXISTS "FinanceiroEvento_clienteId_createdAt_idx";

DROP INDEX IF EXISTS "FinanceiroEvento_vendaId_createdAt_idx";

DROP INDEX IF EXISTS "FinanceiroEvento_chequeId_createdAt_idx";

CREATE INDEX "FinanceiroEvento_tenantId_tipo_createdAt_idx" ON "FinanceiroEvento"("tenantId", "tipo", "createdAt");

CREATE INDEX "FinanceiroEvento_tenantId_clienteId_createdAt_idx" ON "FinanceiroEvento"("tenantId", "clienteId", "createdAt");

CREATE INDEX "FinanceiroEvento_tenantId_vendaId_createdAt_idx" ON "FinanceiroEvento"("tenantId", "vendaId", "createdAt");

CREATE INDEX "FinanceiroEvento_tenantId_chequeId_createdAt_idx" ON "FinanceiroEvento"("tenantId", "chequeId", "createdAt");
