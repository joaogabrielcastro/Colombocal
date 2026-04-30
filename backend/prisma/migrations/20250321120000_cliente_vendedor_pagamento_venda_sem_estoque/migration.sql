-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "vendedorId" INTEGER,
ADD COLUMN "comissaoFixaPercentual" DECIMAL(5,2);

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Pagamento" ADD COLUMN "vendaId" INTEGER;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable (call center: sem controle de estoque no cadastro de produto)
ALTER TABLE "Produto" DROP COLUMN IF EXISTS "estoqueAtual",
DROP COLUMN IF EXISTS "estoqueMinimo";
