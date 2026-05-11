-- Base legada: "Venda" existe mas sem colunas do schema atual (ex.: numeroVenda).
-- Não apaga linhas. numeroVenda = ordem 1,2,3… por tenant (por dataVenda/createdAt).
-- Idempotente.
--
-- npm run db:ensure-venda-legacy-columns

-- numeroVenda (obrigatório no Prisma) ---------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'numeroVenda' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "numeroVenda" INTEGER;
    UPDATE "Venda" v SET "numeroVenda" = s.rn FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY id) AS rn
      FROM "Venda"
    ) s WHERE v.id = s.id;
    ALTER TABLE "Venda" ALTER COLUMN "numeroVenda" SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX "Venda_tenantId_numeroVenda_key" ON "Venda" ("tenantId", "numeroVenda");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Colunas do init que muitas bases antigas não têm ---------------------------

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'motoristaId' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "motoristaId" INTEGER;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'frete' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "frete" DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'freteTarifaSaco' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "freteTarifaSaco" DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'freteTarifaTonelada' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "freteTarifaTonelada" DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'freteRecibo' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "freteRecibo" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'freteReciboNum' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "freteReciboNum" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'comissaoPercentualAplicado' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "comissaoPercentualAplicado" DECIMAL(5,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'comissaoValor' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "comissaoValor" DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'observacoes' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "observacoes" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'Venda')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Venda' AND a.attname = 'createdAt' AND NOT a.attisdropped AND a.attnum > 0) THEN
    ALTER TABLE "Venda" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
