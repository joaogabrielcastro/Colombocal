CREATE TABLE "FinanceiroOperacaoIdempotente" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "vendaId" INTEGER,
    "resposta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceiroOperacaoIdempotente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceiroOperacaoIdempotente_tenantId_chave_key"
ON "FinanceiroOperacaoIdempotente"("tenantId", "chave");

CREATE INDEX "FinanceiroOperacaoIdempotente_tenantId_vendaId_createdAt_idx"
ON "FinanceiroOperacaoIdempotente"("tenantId", "vendaId", "createdAt");

CREATE INDEX "FinanceiroOperacaoIdempotente_tenantId_clienteId_createdAt_idx"
ON "FinanceiroOperacaoIdempotente"("tenantId", "clienteId", "createdAt");

ALTER TABLE "FinanceiroOperacaoIdempotente"
ADD CONSTRAINT "FinanceiroOperacaoIdempotente_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
