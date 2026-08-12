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
 * Conta corrente em aberto: vendas − pagamentos, nunca negativo.
 * Regra de negócio atual: não trabalhamos com saldo positivo para o cliente.
 */
function saldoContaCorrente(totalDebitos, totalCreditos) {
  return Math.max(0, totalDebitos - totalCreditos);
}

/**
 * Resumo único para API e telas: mesma regra em todo lugar.
 * @param {{
 *   totalDebitos: number,
 *   totalCreditos: number,
 *   titulos: Array<{ valorOriginal: unknown, valorPago: unknown }>,
 * }} p
 */
/**
 * Resumo para API/telas.
 * SSOT de cobrança = carteira de títulos (titulosReceber).
 * Conta corrente (vendas − pagamentos) é visão auxiliar de reconciliação.
 */
function resumoFinanceiroCliente({ totalDebitos, totalCreditos, titulos }) {
  const saldo = saldoContaCorrente(totalDebitos, totalCreditos);
  const emAbertoTitulos = totalTitulosEmAberto(titulos);
  return {
    contaCorrente: {
      totalDebitos,
      totalCreditos,
      saldo,
      rotulo: "Conta corrente (auxiliar)",
      ajuda:
        "Compara Σ vendas.valorTotal com Σ pagamentos. Visão auxiliar para reconciliar; a cobrança oficial é a carteira de títulos.",
    },
    titulosReceber: {
      emAberto: emAbertoTitulos,
      rotulo: "Em aberto (títulos)",
      ajuda:
        "Fonte da verdade da cobrança: soma do que falta quitar nos títulos a receber (aberto/parcial).",
    },
  };
}

module.exports = {
  saldoAbertoNoTitulo,
  totalTitulosEmAberto,
  saldoContaCorrente,
  resumoFinanceiroCliente,
};
