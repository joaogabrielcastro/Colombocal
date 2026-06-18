import { formatMoney } from "@/lib/utils";

const EPS = 0.009;

export function moneyDiffers(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) > EPS;
}

export type PrecoClienteDiff = {
  produtoId: number;
  produtoNome: string;
  anterior: number;
  novo: number;
};

export type FreteClienteDiff = {
  anterior: number;
  novo: number;
};

export type ClienteCadastroDiff = {
  precos: PrecoClienteDiff[];
  freteSaco?: FreteClienteDiff;
  freteTonelada?: FreteClienteDiff;
};

export function hasClienteCadastroDiff(diff: ClienteCadastroDiff | null): boolean {
  if (!diff) return false;
  return (
    diff.precos.length > 0 ||
    diff.freteSaco != null ||
    diff.freteTonelada != null
  );
}

export function buildClienteCadastroDiff(params: {
  itens: {
    produtoId: string;
    produtoNome: string;
    precoUnitario: string;
    precoReferencia: string;
  }[];
  fretePorSaco: string;
  fretePorTonelada: string;
  freteRefSaco: string;
  freteRefTonelada: string;
  clienteId: string;
}): ClienteCadastroDiff | null {
  if (!params.clienteId) return null;

  const precos: PrecoClienteDiff[] = [];
  for (const item of params.itens) {
    if (!item.produtoId || !item.precoUnitario) continue;
    const novo = parseFloat(item.precoUnitario);
    const anterior = parseFloat(item.precoReferencia || item.precoUnitario);
    if (!Number.isFinite(novo)) continue;
    if (!Number.isFinite(anterior)) {
      precos.push({
        produtoId: parseInt(item.produtoId, 10),
        produtoNome: item.produtoNome || `Produto #${item.produtoId}`,
        anterior: 0,
        novo,
      });
      continue;
    }
    if (moneyDiffers(novo, anterior)) {
      precos.push({
        produtoId: parseInt(item.produtoId, 10),
        produtoNome: item.produtoNome || `Produto #${item.produtoId}`,
        anterior,
        novo,
      });
    }
  }

  const freteSacoNovo = parseFloat(params.fretePorSaco || "0");
  const freteSacoAnt = parseFloat(params.freteRefSaco || "0");
  const freteTonNovo = parseFloat(params.fretePorTonelada || "0");
  const freteTonAnt = parseFloat(params.freteRefTonelada || "0");

  const diff: ClienteCadastroDiff = { precos };
  if (Number.isFinite(freteSacoNovo) && moneyDiffers(freteSacoNovo, freteSacoAnt)) {
    diff.freteSaco = { anterior: freteSacoAnt, novo: freteSacoNovo };
  }
  if (Number.isFinite(freteTonNovo) && moneyDiffers(freteTonNovo, freteTonAnt)) {
    diff.freteTonelada = { anterior: freteTonAnt, novo: freteTonNovo };
  }

  return hasClienteCadastroDiff(diff) ? diff : null;
}

export function formatClienteCadastroDiffMessage(diff: ClienteCadastroDiff): string {
  const lines: string[] = [
    "Alguns valores desta venda são diferentes do cadastro do cliente:",
    "",
  ];
  for (const p of diff.precos) {
    lines.push(
      `• ${p.produtoNome}: ${formatMoney(p.anterior)} → ${formatMoney(p.novo)}`,
    );
  }
  if (diff.freteSaco) {
    lines.push(
      `• Frete por saco: ${formatMoney(diff.freteSaco.anterior)} → ${formatMoney(diff.freteSaco.novo)}`,
    );
  }
  if (diff.freteTonelada) {
    lines.push(
      `• Frete por tonelada: ${formatMoney(diff.freteTonelada.anterior)} → ${formatMoney(diff.freteTonelada.novo)}`,
    );
  }
  lines.push("", "Deseja atualizar o cadastro do cliente com esses valores?");
  return lines.join("\n");
}

export function diffToAtualizarClientePayload(diff: ClienteCadastroDiff) {
  const payload: {
    precos: { produtoId: number; preco: number }[];
    fretePadraoSaco?: number;
    fretePadraoTonelada?: number;
  } = {
    precos: diff.precos.map((p) => ({ produtoId: p.produtoId, preco: p.novo })),
  };
  if (diff.freteSaco) payload.fretePadraoSaco = diff.freteSaco.novo;
  if (diff.freteTonelada) payload.fretePadraoTonelada = diff.freteTonelada.novo;
  return payload;
}
