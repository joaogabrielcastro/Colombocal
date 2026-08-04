-- Ordem de carregamento (pátio), sem financeiro
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrdemCarregamento_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrdemCarregamento_vendaId_fkey"
    FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OrdemCarregamento_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OrdemCarregamento_motoristaId_fkey"
    FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrdemCarregamento_tenantId_numeroOc_key"
  ON "OrdemCarregamento"("tenantId", "numeroOc");
CREATE INDEX IF NOT EXISTS "OrdemCarregamento_tenantId_dataEmissao_idx"
  ON "OrdemCarregamento"("tenantId", "dataEmissao");
CREATE INDEX IF NOT EXISTS "OrdemCarregamento_tenantId_clienteId_idx"
  ON "OrdemCarregamento"("tenantId", "clienteId");

CREATE TABLE IF NOT EXISTS "OrdemCarregamentoItem" (
  "id" SERIAL PRIMARY KEY,
  "ordemId" INTEGER NOT NULL,
  "descricao" TEXT NOT NULL,
  "quantidade" DECIMAL(12,3) NOT NULL,
  "unidade" TEXT NOT NULL DEFAULT 'SAC',
  CONSTRAINT "OrdemCarregamentoItem_ordemId_fkey"
    FOREIGN KEY ("ordemId") REFERENCES "OrdemCarregamento"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrdemCarregamentoItem_ordemId_idx"
  ON "OrdemCarregamentoItem"("ordemId");
