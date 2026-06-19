-- Comissão por produto/cliente + snapshot por item de venda

CREATE TABLE "ComissaoClienteProduto" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "comissaoPercentual" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "ComissaoClienteProduto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComissaoClienteProduto_clienteId_produtoId_key"
ON "ComissaoClienteProduto"("clienteId", "produtoId");

ALTER TABLE "ComissaoClienteProduto"
ADD CONSTRAINT "ComissaoClienteProduto_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComissaoClienteProduto"
ADD CONSTRAINT "ComissaoClienteProduto_produtoId_fkey"
FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ItemVenda"
ADD COLUMN "comissaoPercentualAplicado" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "comissaoValor" DECIMAL(10,2) NOT NULL DEFAULT 0;
