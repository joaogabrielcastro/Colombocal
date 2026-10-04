-- Peso comercial de frete por cliente+produto (override do pesoKg do cadastro).
-- preco passa a aceitar null para permitir linha só com pesoKgFrete.
ALTER TABLE "PrecoClienteProduto" ALTER COLUMN "preco" DROP NOT NULL;
ALTER TABLE "PrecoClienteProduto" ADD COLUMN "pesoKgFrete" DECIMAL(10,3);
