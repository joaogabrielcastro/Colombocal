-- Mantém default Focus para não surpreender emitentes novos em produção.
-- Nôtaas continua disponível quando o admin escolher explicitamente no cadastro.
ALTER TABLE "EmitenteFiscal"
  ALTER COLUMN "provedor" SET DEFAULT 'focusnfe';
