import type { RelVendas } from "../types";

export type SortRepKey = "nome" | "quantidade" | "participacao" | "total";
export type SortRepState = { key: SortRepKey; dir: "asc" | "desc" };

export type ResumoRepresentante = {
  nome: string;
  total: number;
  frete: number;
  quantidade: number;
  ticketMedio: number;
  participacao: number;
};

export type ResumoCliente = {
  nome: string;
  total: number;
  quantidade: number;
};

export type ResumoProduto = {
  nome: string;
  quantidade: number;
  total: number;
  unidade: string;
};

export type ResumoClienteProdutoLinha = {
  produtoNome: string;
  unidade: string;
  quantidade: number;
  total: number;
};

export type ResumoClienteProduto = {
  nome: string;
  produtos: ResumoClienteProdutoLinha[];
};

function agregarClienteProdutosDasVendas(
  data: RelVendas | null,
): ResumoClienteProduto[] {
  const porCliente = new Map<
    number,
    { nome: string; produtos: Map<number, ResumoClienteProdutoLinha> }
  >();
  data?.vendas.forEach((v) => {
    if (!porCliente.has(v.clienteId)) {
      porCliente.set(v.clienteId, {
        nome: v.cliente.nomeFantasia || v.cliente.razaoSocial,
        produtos: new Map(),
      });
    }
    const row = porCliente.get(v.clienteId)!;
    v.itens?.forEach((item) => {
      const atual = row.produtos.get(item.produtoId) || {
        produtoNome: item.produto.nome,
        unidade: item.produto.unidade,
        quantidade: 0,
        total: 0,
      };
      atual.quantidade += parseFloat(String(item.quantidade));
      atual.total += parseFloat(String(item.subtotal));
      row.produtos.set(item.produtoId, atual);
    });
  });
  return [...porCliente.values()]
    .map((c) => ({
      nome: c.nome,
      produtos: [...c.produtos.values()].sort((a, b) => b.quantidade - a.quantidade),
    }))
    .filter((c) => c.produtos.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function montarResumoRelatorioVendas(data: RelVendas | null) {
  const porCliente: Record<number, ResumoCliente> = {};
  const porVendedor: Record<number, { nome: string; total: number; quantidade: number }> = {};
  const porProduto: Record<number, ResumoProduto> = {};

  data?.vendas.forEach((v) => {
    if (!porCliente[v.clienteId]) {
      porCliente[v.clienteId] = {
        nome: v.cliente.nomeFantasia || v.cliente.razaoSocial,
        total: 0,
        quantidade: 0,
      };
    }
    porCliente[v.clienteId].total += parseFloat(String(v.valorTotal));
    porCliente[v.clienteId].quantidade++;

    if (!porVendedor[v.vendedorId]) {
      porVendedor[v.vendedorId] = {
        nome: v.vendedor.nome,
        total: 0,
        quantidade: 0,
      };
    }
    porVendedor[v.vendedorId].total += parseFloat(String(v.valorTotal));
    porVendedor[v.vendedorId].quantidade++;

    v.itens?.forEach((item) => {
      if (!porProduto[item.produtoId]) {
        porProduto[item.produtoId] = {
          nome: item.produto.nome,
          quantidade: 0,
          total: 0,
          unidade: item.produto.unidade,
        };
      }
      porProduto[item.produtoId].quantidade += parseFloat(String(item.quantidade));
      porProduto[item.produtoId].total += parseFloat(String(item.subtotal));
    });
  });

  const resumoRepresentantes: ResumoRepresentante[] =
    data?.resumoRepresentantes?.map((r) => ({
      nome: r.vendedorNome,
      total: r.faturamento,
      frete: r.frete,
      quantidade: r.quantidadeVendas,
      ticketMedio: r.ticketMedio,
      participacao: r.participacao,
    })) ??
    Object.values(porVendedor)
      .sort((a, b) => b.total - a.total)
      .map((x) => ({
        nome: x.nome,
        total: x.total,
        frete: 0,
        quantidade: x.quantidade,
        ticketMedio: x.quantidade > 0 ? x.total / x.quantidade : 0,
        participacao:
          data && data.totalFaturamento > 0 ? (x.total / data.totalFaturamento) * 100 : 0,
      }));

  const resumoClientes: ResumoCliente[] =
    data?.resumoClientes?.map((r) => ({
      nome: r.clienteNome,
      total: r.faturamento,
      quantidade: r.quantidadeVendas,
    })) ?? Object.values(porCliente).sort((a, b) => b.total - a.total);

  const resumoProdutos: ResumoProduto[] =
    data?.resumoProdutos?.map((r) => ({
      nome: r.produtoNome,
      quantidade: r.quantidade,
      total: r.faturamento,
      unidade: r.unidade || "",
    })) ?? Object.values(porProduto).sort((a, b) => b.total - a.total);

  const resumoClienteProdutos: ResumoClienteProduto[] =
    data?.resumoClienteProdutos?.map((r) => ({
      nome: r.clienteNome,
      produtos: r.produtos.map((p) => ({
        produtoNome: p.produtoNome,
        unidade: p.unidade || "",
        quantidade: p.quantidade,
        total: p.faturamento,
      })),
    })) ?? agregarClienteProdutosDasVendas(data);

  return { resumoRepresentantes, resumoClientes, resumoProdutos, resumoClienteProdutos };
}

export function ordenarResumoRepresentantes(
  resumoRepresentantes: ResumoRepresentante[],
  repSort: SortRepState,
) {
  return [...resumoRepresentantes].sort((a, b) => {
    const dir = repSort.dir === "asc" ? 1 : -1;
    if (repSort.key === "nome") return a.nome.localeCompare(b.nome, "pt-BR") * dir;
    if (repSort.key === "quantidade") return (a.quantidade - b.quantidade) * dir;
    if (repSort.key === "participacao") return (a.participacao - b.participacao) * dir;
    return (a.total - b.total) * dir;
  });
}
