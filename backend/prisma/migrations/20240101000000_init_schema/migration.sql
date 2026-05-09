-- CreateTable
CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "telefone" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "endereco" TEXT,
    "observacoes" TEXT,
    "fretePadrao" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fretePadraoSaco" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fretePadraoTonelada" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vendedorId" INTEGER,
    "comissaoFixaPercentual" DECIMAL(5,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "precoPadrao" DECIMAL(10,2) NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'ton',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoClienteProduto" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PrecoClienteProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motorista" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "veiculo" TEXT,
    "placa" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Motorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendedor" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "comissaoPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "numeroVenda" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "vendedorId" INTEGER NOT NULL,
    "motoristaId" INTEGER,
    "frete" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "freteTarifaSaco" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "freteTarifaTonelada" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "freteRecibo" BOOLEAN NOT NULL DEFAULT false,
    "freteReciboNum" TEXT,
    "comissaoPercentualAplicado" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "comissaoValor" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "dataVenda" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVenda" (
    "id" SERIAL NOT NULL,
    "vendaId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ItemVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,
    "vendaId" INTEGER,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheque" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "numeroOrdem" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "vendaId" INTEGER,
    "valor" DECIMAL(10,2) NOT NULL,
    "emitenteNome" TEXT,
    "banco" TEXT,
    "numero" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "dataRecebimento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataCompensacao" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "vendaId" INTEGER,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chequeId" INTEGER,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TituloReceber" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "vendaId" INTEGER,
    "numero" TEXT,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "valorOriginal" DECIMAL(10,2) NOT NULL,
    "valorPago" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TituloReceber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreteMovimento" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "vendaId" INTEGER,
    "clienteId" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "reciboEmitido" BOOLEAN NOT NULL DEFAULT false,
    "reciboNumero" TEXT,
    "reciboData" TIMESTAMP(3),
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreteMovimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigSistema" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComissaoAjusteVenda" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "vendaId" INTEGER NOT NULL,
    "ajusteValor" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComissaoAjusteVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceiroEvento" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" INTEGER,
    "clienteId" INTEGER,
    "vendaId" INTEGER,
    "chequeId" INTEGER,
    "pagamentoId" INTEGER,
    "tituloId" INTEGER,
    "valor" DECIMAL(10,2),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceiroEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "Cliente_tenantId_ativo_razaoSocial_idx" ON "Cliente"("tenantId", "ativo", "razaoSocial");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tenantId_cnpj_key" ON "Cliente"("tenantId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_tenantId_codigo_key" ON "Produto"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoClienteProduto_clienteId_produtoId_key" ON "PrecoClienteProduto"("clienteId", "produtoId");

-- CreateIndex
CREATE INDEX "Motorista_tenantId_idx" ON "Motorista"("tenantId");

-- CreateIndex
CREATE INDEX "Vendedor_tenantId_idx" ON "Vendedor"("tenantId");

-- CreateIndex
CREATE INDEX "Venda_tenantId_clienteId_dataVenda_idx" ON "Venda"("tenantId", "clienteId", "dataVenda");

-- CreateIndex
CREATE INDEX "Venda_tenantId_vendedorId_dataVenda_idx" ON "Venda"("tenantId", "vendedorId", "dataVenda");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_tenantId_numeroVenda_key" ON "Venda"("tenantId", "numeroVenda");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_tenantId_produtoId_data_idx" ON "MovimentacaoEstoque"("tenantId", "produtoId", "data");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_vendaId_idx" ON "MovimentacaoEstoque"("vendaId");

-- CreateIndex
CREATE INDEX "Cheque_tenantId_clienteId_status_dataRecebimento_idx" ON "Cheque"("tenantId", "clienteId", "status", "dataRecebimento");

-- CreateIndex
CREATE INDEX "Cheque_vendaId_idx" ON "Cheque"("vendaId");

-- CreateIndex
CREATE UNIQUE INDEX "Cheque_tenantId_numeroOrdem_key" ON "Cheque"("tenantId", "numeroOrdem");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_chequeId_key" ON "Pagamento"("chequeId");

-- CreateIndex
CREATE INDEX "Pagamento_tenantId_clienteId_data_idx" ON "Pagamento"("tenantId", "clienteId", "data");

-- CreateIndex
CREATE INDEX "Pagamento_vendaId_data_idx" ON "Pagamento"("vendaId", "data");

-- CreateIndex
CREATE INDEX "TituloReceber_tenantId_clienteId_status_vencimento_idx" ON "TituloReceber"("tenantId", "clienteId", "status", "vencimento");

-- CreateIndex
CREATE INDEX "TituloReceber_vendaId_idx" ON "TituloReceber"("vendaId");

-- CreateIndex
CREATE INDEX "FreteMovimento_tenantId_clienteId_data_idx" ON "FreteMovimento"("tenantId", "clienteId", "data");

-- CreateIndex
CREATE INDEX "FreteMovimento_vendaId_idx" ON "FreteMovimento"("vendaId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigSistema_tenantId_chave_key" ON "ConfigSistema"("tenantId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "ComissaoAjusteVenda_vendaId_key" ON "ComissaoAjusteVenda"("vendaId");

-- CreateIndex
CREATE INDEX "FinanceiroEvento_tenantId_tipo_createdAt_idx" ON "FinanceiroEvento"("tenantId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceiroEvento_tenantId_clienteId_createdAt_idx" ON "FinanceiroEvento"("tenantId", "clienteId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceiroEvento_tenantId_vendaId_createdAt_idx" ON "FinanceiroEvento"("tenantId", "vendaId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceiroEvento_tenantId_chequeId_createdAt_idx" ON "FinanceiroEvento"("tenantId", "chequeId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoClienteProduto" ADD CONSTRAINT "PrecoClienteProduto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoClienteProduto" ADD CONSTRAINT "PrecoClienteProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendedor" ADD CONSTRAINT "Vendedor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "Cheque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TituloReceber" ADD CONSTRAINT "TituloReceber_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TituloReceber" ADD CONSTRAINT "TituloReceber_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TituloReceber" ADD CONSTRAINT "TituloReceber_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreteMovimento" ADD CONSTRAINT "FreteMovimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreteMovimento" ADD CONSTRAINT "FreteMovimento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreteMovimento" ADD CONSTRAINT "FreteMovimento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigSistema" ADD CONSTRAINT "ConfigSistema_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComissaoAjusteVenda" ADD CONSTRAINT "ComissaoAjusteVenda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComissaoAjusteVenda" ADD CONSTRAINT "ComissaoAjusteVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceiroEvento" ADD CONSTRAINT "FinanceiroEvento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

