ALTER TABLE "ConhecimentoTransporte"
  ADD COLUMN "emitenteFiscalId" INTEGER;

ALTER TABLE "ManifestoEletronico"
  ADD COLUMN "emitenteFiscalId" INTEGER;

ALTER TABLE "NotaFiscal"
  ADD COLUMN "claimEmissao" TEXT;

ALTER TABLE "ConhecimentoTransporte"
  ADD CONSTRAINT "ConhecimentoTransporte_emitenteFiscalId_fkey"
  FOREIGN KEY ("emitenteFiscalId") REFERENCES "EmitenteFiscal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ManifestoEletronico"
  ADD CONSTRAINT "ManifestoEletronico_emitenteFiscalId_fkey"
  FOREIGN KEY ("emitenteFiscalId") REFERENCES "EmitenteFiscal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ConhecimentoTransporte_tenantId_emitenteFiscalId_createdAt_idx"
  ON "ConhecimentoTransporte"("tenantId", "emitenteFiscalId", "createdAt");

CREATE INDEX "ManifestoEletronico_tenantId_emitenteFiscalId_createdAt_idx"
  ON "ManifestoEletronico"("tenantId", "emitenteFiscalId", "createdAt");

-- Falha com mensagem clara se houver duplicatas (evita migrate opaco em produção).
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT 1
    FROM "NotaFiscal"
    WHERE "status" IN ('rascunho', 'processando', 'autorizada')
    GROUP BY "tenantId", "vendaId"
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Pré-check: % venda(s) com mais de uma NF-e ativa (rascunho/processando/autorizada). Sanitize antes do migrate.',
      dup_count;
  END IF;
END $$;

-- Somente uma NF-e ativa pode existir para uma venda, mesmo sob concorrencia.
CREATE UNIQUE INDEX "NotaFiscal_uma_ativa_por_venda_idx"
  ON "NotaFiscal"("tenantId", "vendaId")
  WHERE "status" IN ('rascunho', 'processando', 'autorizada');

CREATE UNIQUE INDEX "NotaFiscal_claimEmissao_key"
  ON "NotaFiscal"("claimEmissao");
