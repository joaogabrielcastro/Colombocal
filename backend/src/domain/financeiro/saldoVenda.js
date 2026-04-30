function toNumber(value) {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function calcularSaldoAbertoVenda(venda) {
  const totalTitulos = (venda?.titulos ?? []).reduce(
    (acc, t) => acc + toNumber(t.valorOriginal),
    0,
  );
  const totalPago = (venda?.pagamentos ?? []).reduce(
    (acc, p) => acc + toNumber(p.valor),
    0,
  );
  return Math.max(0, totalTitulos - totalPago);
}

function splitValorComTroco(valorInformado, saldoAberto) {
  const valor = toNumber(valorInformado);
  const saldo = Math.max(0, toNumber(saldoAberto));
  if (valor <= saldo) {
    return { valorPrincipal: valor, trocoValor: 0 };
  }
  return { valorPrincipal: saldo, trocoValor: valor - saldo };
}

module.exports = {
  calcularSaldoAbertoVenda,
  splitValorComTroco,
};
