-- Indexes for monthly fiscal closing / listing (non-destructive).
CREATE INDEX IF NOT EXISTS "NotaFiscal_tenantId_autorizadaEm_idx" ON "NotaFiscal"("tenantId", "autorizadaEm");
CREATE INDEX IF NOT EXISTS "NotaFiscal_tenantId_emitidaEm_idx" ON "NotaFiscal"("tenantId", "emitidaEm");
CREATE INDEX IF NOT EXISTS "NotaFiscal_tenantId_serie_numero_idx" ON "NotaFiscal"("tenantId", "serie", "numero");
