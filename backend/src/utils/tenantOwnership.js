const { AppError } = require("../shared/errors/appError");

async function assertClienteDoTenant(tx, clienteId, tenantId) {
  if (clienteId == null) {
    throw new AppError("Cliente obrigatório", {
      code: "CLIENTE_REQUIRED",
      httpStatus: 400,
    });
  }
  const cliente = await tx.cliente.findFirst({
    where: { id: clienteId, tenantId },
    select: { id: true },
  });
  if (!cliente) {
    throw new AppError("Cliente não encontrado", {
      code: "CLIENTE_NAO_ENCONTRADO",
      httpStatus: 404,
    });
  }
}

async function assertVendaDoTenant(tx, vendaId, tenantId, { clienteId } = {}) {
  if (vendaId == null) return;
  const venda = await tx.venda.findFirst({
    where: { id: vendaId, tenantId },
    select: { id: true, clienteId: true },
  });
  if (!venda) {
    throw new AppError("Venda não encontrada", {
      code: "VENDA_NAO_ENCONTRADA",
      httpStatus: 404,
    });
  }
  if (clienteId != null && venda.clienteId !== clienteId) {
    throw new AppError("A venda informada não pertence ao cliente selecionado", {
      code: "VENDA_CLIENTE_INVALIDO",
      httpStatus: 400,
    });
  }
}

async function assertProdutosDoTenant(tx, produtoIds, tenantId) {
  const unique = [...new Set(produtoIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return;
  const count = await tx.produto.count({
    where: { id: { in: unique }, tenantId },
  });
  if (count !== unique.length) {
    throw new AppError("Produto não encontrado", {
      code: "PRODUTO_NAO_ENCONTRADO",
      httpStatus: 404,
    });
  }
}

module.exports = {
  assertClienteDoTenant,
  assertVendaDoTenant,
  assertProdutosDoTenant,
};
