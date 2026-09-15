import type { Venda } from "@/lib/utils";

export type ItemOcForm = {
  produtoId: string;
  quantidade: string;
};

export function numeroPedidoDaVenda(v: Pick<Venda, "id" | "numeroVenda">): string {
  return String(v.numeroVenda ?? v.id);
}

export function itensDaVendaParaForm(venda: Pick<Venda, "itens">): ItemOcForm[] {
  const linhas = (venda.itens || [])
    .filter((it) => it.produtoId)
    .map((it) => ({
      produtoId: String(it.produtoId),
      quantidade: String(it.quantidade ?? ""),
    }));
  return linhas.length ? linhas : [{ produtoId: "", quantidade: "" }];
}
