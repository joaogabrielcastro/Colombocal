import { formatQuantidade, type Venda } from "@/lib/utils";

export function formatVendaProdutos(v: Venda): string {
  const itens = v.itens ?? [];
  if (!itens.length) return "—";
  const nomes = itens.map((i) => i.produto?.nome).filter(Boolean);
  return nomes.length ? nomes.join(", ") : "—";
}

export function formatVendaQuantidades(v: Venda): string {
  const itens = v.itens ?? [];
  if (!itens.length) return "—";
  return itens
    .map((i) => formatQuantidade(i.quantidade, i.produto?.unidade || ""))
    .join(" + ");
}

export function textoObservacao(v: Venda): string {
  const obs = String(v.observacoes ?? "").trim();
  return obs || "—";
}
