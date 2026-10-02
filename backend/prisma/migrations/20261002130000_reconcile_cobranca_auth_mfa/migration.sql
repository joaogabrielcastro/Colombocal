-- Reconcilia bancos que registraram 20260720120000_cobranca_auth_mfa como
-- aplicada sem conservar todos os objetos. Todas as operações são idempotentes.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaSecretEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "mfaBackupCodesHash" JSONB;

CREATE TABLE IF NOT EXISTS "CobrancaLembrete" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "tituloId" INTEGER NOT NULL,
  "clienteId" INTEGER NOT NULL,
  "userId" INTEGER,
  "canal" TEXT NOT NULL DEFAULT 'whatsapp',
  "mensagem" TEXT,
  "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'sent',
  CONSTRAINT "CobrancaLembrete_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CobrancaLembrete_tenantId_tituloId_enviadoEm_idx"
  ON "CobrancaLembrete"("tenantId", "tituloId", "enviadoEm");
CREATE INDEX IF NOT EXISTS "CobrancaLembrete_tenantId_clienteId_enviadoEm_idx"
  ON "CobrancaLembrete"("tenantId", "clienteId", "enviadoEm");
CREATE INDEX IF NOT EXISTS "CobrancaLembrete_tenantId_status_enviadoEm_idx"
  ON "CobrancaLembrete"("tenantId", "status", "enviadoEm");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CobrancaLembrete_tenantId_fkey') THEN
    ALTER TABLE "CobrancaLembrete" ADD CONSTRAINT "CobrancaLembrete_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CobrancaLembrete_tituloId_fkey') THEN
    ALTER TABLE "CobrancaLembrete" ADD CONSTRAINT "CobrancaLembrete_tituloId_fkey"
      FOREIGN KEY ("tituloId") REFERENCES "TituloReceber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CobrancaLembrete_userId_fkey') THEN
    ALTER TABLE "CobrancaLembrete" ADD CONSTRAINT "CobrancaLembrete_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
