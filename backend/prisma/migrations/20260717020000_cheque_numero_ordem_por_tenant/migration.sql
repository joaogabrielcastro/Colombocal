-- numeroOrdem do cheque é por tenant, não global.
-- Índice legado só em numeroOrdem fazia Requinte colidir com Colombocal.

DROP INDEX IF EXISTS "Cheque_numeroOrdem_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Cheque_tenantId_numeroOrdem_key"
  ON "Cheque"("tenantId", "numeroOrdem");
