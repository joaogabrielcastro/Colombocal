function toNum(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Arredonda valor monetário (2 casas). */
function roundMoney(n) {
  return Math.round((toNum(n) + Number.EPSILON) * 100) / 100;
}

/** Peso de referência do saco “normal” na Colombocal (para ratear frete/saco). */
const PESO_SACO_PADRAO_KG = 20;

function pesoKgProduto(produto) {
  const n = toNum(produto?.pesoKg);
  return n > 0 ? n : 0;
}

function normalizarUnidade(unidadeRaw) {
  const u = String(unidadeRaw || "")
    .trim()
    .toLowerCase();
  if (["saco", "sacos", "sc", "sac"].includes(u)) return "saco";
  if (["ton", "tonelada", "toneladas", "t"].includes(u)) return "ton";
  if (["kg", "quilo", "quilos"].includes(u)) return "kg";
  return u;
}

/**
 * Produto ensacado (ex.: "DOLOMITA M-325 ENSACADA"): no pátio a quantidade
 * de carregamento é em sacos. Se o cadastro ficou em ton/kg por engano,
 * a OC não deve converter ton→sacos (isso inflava 416 → 20.800 SAC).
 */
function produtoEnsacado(produtoOrNome) {
  const nome =
    typeof produtoOrNome === "string"
      ? produtoOrNome
      : produtoOrNome?.nome || "";
  return /\bENSACAD[AO]S?\b/i.test(String(nome));
}

/**
 * Frete unitário quando o produto é contado por unidade (ex.: saco) e tem pesoKg.
 * Prioriza frete/saco (uso típico Colombocal): tarifaSaco × (pesoKg / 20).
 * Só usa frete/ton se frete/saco estiver zerado: pesoKg × (tarifaTon / 1000).
 * Não aplicar em produtos já vendidos por ton/kg — aí a quantidade já é massa.
 */
function freteUnitarioPorPeso(pesoKg, fretePorSaco, fretePorTonelada) {
  const tarifaTon = toNum(fretePorTonelada);
  const tarifaSaco = toNum(fretePorSaco);
  if (tarifaSaco > 0) return tarifaSaco * (pesoKg / PESO_SACO_PADRAO_KG);
  if (tarifaTon > 0) return pesoKg * (tarifaTon / 1000);
  return 0;
}

/**
 * Frete de uma linha:
 * - ton / kg: qtd já é massa → qtd × tarifa/ton (ou /1000 para kg).
 *   pesoKg do cadastro serve só para converter ton→sacos na OC, não no frete.
 * - saco (ou outra unidade contada) com pesoKg: rateia pelo peso.
 * - saco sem pesoKg: qtd × tarifa/saco.
 */
function freteLinha({ produto, quantidade, fretePorSaco, fretePorTonelada }) {
  const qtd = toNum(quantidade);
  if (qtd <= 0) return 0;
  const tarifaSaco = toNum(fretePorSaco);
  const tarifaTon = toNum(fretePorTonelada);
  const unidade = normalizarUnidade(produto?.unidade);
  const pesoKg = pesoKgProduto(produto);
  let bruto = 0;
  if (unidade === "ton") {
    bruto = qtd * tarifaTon;
  } else if (unidade === "kg") {
    bruto = qtd * (tarifaTon / 1000);
  } else if (pesoKg > 0) {
    bruto = qtd * freteUnitarioPorPeso(pesoKg, tarifaSaco, tarifaTon);
  } else if (unidade === "saco") {
    bruto = qtd * tarifaSaco;
  }
  return roundMoney(bruto);
}

function calcularFreteAutomatico(itens, produtosPorId, fretePorSaco, fretePorTonelada) {
  const total = itens.reduce((acc, item) => {
    const produto =
      produtosPorId.get(item.produtoId) ||
      produtosPorId.get(Number(item.produtoId));
    return (
      acc +
      freteLinha({
        produto,
        quantidade: item.quantidade,
        fretePorSaco,
        fretePorTonelada,
      })
    );
  }, 0);
  return roundMoney(total);
}

/**
 * Converte quantidade para sacos (ordem de carregamento).
 * Aceita produto+quantidade ou campos soltos.
 * Nome com ENSACADA/ENSACADO → quantidade já é em sacos (não converte).
 */
function quantidadeEmSacos(params) {
  const qtd = toNum(params.quantidade);
  if (qtd <= 0) return 0;
  const nome = params.nome ?? params.produto?.nome;
  if (produtoEnsacado(nome)) return qtd;
  const unidade = normalizarUnidade(params.unidade ?? params.produto?.unidade);
  if (unidade === "saco") return qtd;
  const pesoFromProduto = pesoKgProduto(params.produto);
  const pesoSaco = (() => {
    const p = toNum(params.pesoKg) || pesoFromProduto;
    return p > 0 ? p : PESO_SACO_PADRAO_KG;
  })();
  if (unidade === "ton") return (qtd * 1000) / pesoSaco;
  if (unidade === "kg") return qtd / pesoSaco;
  return qtd;
}

module.exports = {
  toNum,
  roundMoney,
  pesoKgProduto,
  normalizarUnidade,
  produtoEnsacado,
  freteUnitarioPorPeso,
  freteLinha,
  calcularFreteAutomatico,
  quantidadeEmSacos,
  PESO_SACO_PADRAO_KG,
};
