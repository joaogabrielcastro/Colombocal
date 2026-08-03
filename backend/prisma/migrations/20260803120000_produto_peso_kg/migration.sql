-- Peso unitário (kg) para frete proporcional à tonelada (ex.: cal de pintura 8 kg)
ALTER TABLE "Produto"
ADD COLUMN IF NOT EXISTS "pesoKg" DECIMAL(10,3);
