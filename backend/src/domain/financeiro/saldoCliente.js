/**
 * Saldo em aberto de um título (valor original − pago), nunca negativo.
 * @param {{ valorOriginal: unknown, valorPago: unknown }} titulo
 */
function saldoAbertoNoTitulo(titulo) {
  const vo = parseFloat(String(titulo.valorOriginal));
  const vp = parseFloat(String(titulo.valorPago));
  if (Number.isNaN(vo) || Number.isNaN(vp)) return 0;
  return Math.max(0, vo - vp);
}

/**
 * Soma dos saldos em aberto na carteira de títulos do cliente.
 * @param {Array<{ valorOriginal: unknown, valorPago: unknown }>} titulos
 */
function totalTitulosEmAberto(titulos) {
  return titulos.reduce((acc, t) => acc + saldoAbertoNoTitulo(t), 0);
}

/**
 * Conta corrente: pagamentos − vendas (positivo = crédito a favor do cliente).
 */
function saldoContaCorrente(totalDebitos, totalCreditos) {
  return totalCreditos - totalDebitos;
}

/**
 * Resumo único para API e telas: mesma regra em todo lugar.
 * @param {{
 *   totalDebitos: number,
 *   totalCreditos: number,
 *   titulos: Array<{ valorOriginal: unknown, valorPago: unknown }>,
 * }} p
 */
function resumoFinanceiroCliente({ totalDebitos, totalCreditos, titulos }) {
  const saldo = saldoContaCorrente(totalDebitos, totalCreditos);
  const emAbertoTitulos = totalTitulosEmAberto(titulos);
  return {
    contaCorrente: {
      totalDebitos,
      totalCreditos,
      saldo,
      rotulo: "Conta corrente",
      ajuda:
        "Compara todas as vendas com todos os pagamentos registrados. Negativo = cliente deve; positivo = crédito a favor.",
    },
    titulosReceber: {
      emAberto: emAbertoTitulos,
      rotulo: "Títulos em aberto",
      ajuda:
        "Soma do que falta quitar nos títulos a receber. Deve alinhar com os pagamentos após reconciliar; diferenças costumam ser histórico antes do recálculo.",
    },
  };
}

module.exports = {
  saldoAbertoNoTitulo,
  totalTitulosEmAberto,
  saldoContaCorrente,
  resumoFinanceiroCliente,
};
