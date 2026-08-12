import type { Venda } from "@/lib/utils";

export interface RelVendas {
  vendas: Venda[];
  totalFaturamento: number;
  totalFrete?: number;
  totalQuantidade: number;
  quantidade: number;
  totalRegistros?: number;
  resumoRepresentantes?: Array<{
    vendedorId: number;
    vendedorNome: string;
    comissaoPercentual: number;
    faturamento: number;
    frete: number;
    quantidadeVendas: number;
    ticketMedio: number;
    participacao: number;
  }>;
  resumoClientes?: Array<{
    clienteId: number;
    clienteNome: string;
    faturamento: number;
    quantidadeVendas: number;
    ticketMedio: number;
  }>;
  resumoProdutos?: Array<{
    produtoId: number;
    produtoNome: string;
    unidade: string;
    quantidade: number;
    faturamento: number;
    quantidadeItens: number;
  }>;
}

export type RelatorioVendasParams = {
  dataInicio: string;
  dataFim: string;
  busca: string;
  vendedorId: string;
  motoristaId: string;
  clienteId: string;
  produtoId: string;
};
