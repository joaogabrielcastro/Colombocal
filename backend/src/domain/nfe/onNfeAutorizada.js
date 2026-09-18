const { STATUS } = require("./constants");
const {
  gerarCobrancasAposNfeAutorizada,
} = require("../../application/use-cases/cobrancaBancaria");

/**
 * Dispara side-effects apenas na transição para NF-e autorizada.
 * Falhas de cobrança NÃO invalidam a nota.
 */
async function onNfeAutorizada(prisma, {
  tenantId,
  vendaId,
  statusAnterior,
  statusNovo,
  auditReq = null,
  providerOverride = null,
}) {
  if (statusNovo !== STATUS.AUTORIZADA) {
    return { skipped: true, reason: "STATUS_NAO_AUTORIZADA" };
  }
  if (statusAnterior === STATUS.AUTORIZADA) {
    return { skipped: true, reason: "JA_AUTORIZADA" };
  }
  if (vendaId == null || tenantId == null) {
    return { skipped: true, reason: "IDS_AUSENTES" };
  }

  try {
    const result = await gerarCobrancasAposNfeAutorizada(prisma, {
      tenantId,
      vendaId,
      auditReq,
      providerOverride,
    });
    return { skipped: false, ...result };
  } catch (err) {
    // Isolado: NF-e permanece autorizada.
    return {
      skipped: false,
      ok: false,
      error: err?.message || "erro_cobranca",
      cobrancas: [],
    };
  }
}

module.exports = { onNfeAutorizada };
