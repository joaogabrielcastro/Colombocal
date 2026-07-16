const EPS = 0.009;
const { AppError } = require("../shared/errors/appError");
const { assertClienteDoTenant, assertProdutosDoTenant } = require("../utils/tenantOwnership");

function moneyDiffers(a, b) {
  const na = parseFloat(String(a ?? 0));
  const nb = parseFloat(String(b ?? 0));
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) > EPS;
}

/**
 * Atualiza preços especiais e tarifas de frete do cliente após uma venda.
 */
async function syncClienteFromVenda(
  tx,
  {
    tenantId,
    clienteId,
    precos = [],
    fretePadraoSaco,
    fretePadraoTonelada,
  },
) {
  if (tenantId == null) {
    throw new AppError("tenantId ausente", { code: "TENANT_REQUIRED", httpStatus: 500 });
  }
  await assertClienteDoTenant(tx, clienteId, tenantId);
  await assertProdutosDoTenant(
    tx,
    precos.map((row) => Number(row.produtoId)),
    tenantId,
  );

  for (const row of precos) {
    const produtoId = Number(row.produtoId);
    const preco = parseFloat(String(row.preco));
    if (!Number.isFinite(produtoId) || produtoId < 1) continue;
    if (!Number.isFinite(preco) || preco < 0) continue;

    await tx.precoClienteProduto.upsert({
      where: {
        clienteId_produtoId: { clienteId, produtoId },
      },
      update: { preco, tenantId },
      create: { tenantId, clienteId, produtoId, preco },
    });
  }

  const clienteData = {};
  if (fretePadraoSaco != null && Number.isFinite(Number(fretePadraoSaco))) {
    clienteData.fretePadraoSaco = Number(fretePadraoSaco);
    clienteData.fretePadrao = Number(fretePadraoSaco);
  }
  if (fretePadraoTonelada != null && Number.isFinite(Number(fretePadraoTonelada))) {
    clienteData.fretePadraoTonelada = Number(fretePadraoTonelada);
  }

  if (Object.keys(clienteData).length > 0) {
    await tx.cliente.update({
      where: { id: clienteId },
      data: clienteData,
    });
  }
}

function parseAtualizarCliente(body) {
  const raw = body?.atualizarCliente;
  if (!raw || typeof raw !== "object") return null;

  const precos = Array.isArray(raw.precos)
    ? raw.precos
        .map((p) => ({
          produtoId: parseInt(String(p?.produtoId), 10),
          preco: parseFloat(String(p?.preco)),
        }))
        .filter(
          (p) =>
            Number.isFinite(p.produtoId) &&
            p.produtoId > 0 &&
            Number.isFinite(p.preco) &&
            p.preco >= 0,
        )
    : [];

  const fretePadraoSaco =
    raw.fretePadraoSaco != null && raw.fretePadraoSaco !== ""
      ? parseFloat(String(raw.fretePadraoSaco))
      : null;
  const fretePadraoTonelada =
    raw.fretePadraoTonelada != null && raw.fretePadraoTonelada !== ""
      ? parseFloat(String(raw.fretePadraoTonelada))
      : null;

  const hasFreteSaco = fretePadraoSaco != null && Number.isFinite(fretePadraoSaco);
  const hasFreteTon =
    fretePadraoTonelada != null && Number.isFinite(fretePadraoTonelada);

  if (!precos.length && !hasFreteSaco && !hasFreteTon) return null;

  return {
    precos,
    fretePadraoSaco: hasFreteSaco ? fretePadraoSaco : undefined,
    fretePadraoTonelada: hasFreteTon ? fretePadraoTonelada : undefined,
  };
}

module.exports = {
  EPS,
  moneyDiffers,
  syncClienteFromVenda,
  parseAtualizarCliente,
};
