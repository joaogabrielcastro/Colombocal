async function auditarSemFalhar(audit, payload) {
  if (typeof audit !== "function") return;
  try {
    await audit(payload);
  } catch (error) {
    // O documento pode jÃ¡ ter sido autorizado no provedor. Nunca responder como
    // falha de emissÃ£o por causa de uma falha secundÃ¡ria de auditoria.
    console.error(
      JSON.stringify({
        level: "error",
        type: "fiscal_audit_failed",
        evento: payload?.tipo,
        entidade: payload?.entidade,
        entidadeId: payload?.entidadeId,
        message: error?.message,
      }),
    );
  }
}

module.exports = { auditarSemFalhar };
