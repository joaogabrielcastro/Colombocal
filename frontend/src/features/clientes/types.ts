import type { Cliente, Produto, Cheque, FreteMovimento } from "@/lib/utils";

export type ClienteAba = "conta" | "cheques" | "precos" | "comissoes" | "editar";

export interface ResumoFinanceiro {
  contaCorrente: {
    totalDebitos: number;
    totalCreditos: number;
    saldo: number;
    rotulo: string;
    ajuda: string;
  };
  titulosReceber: {
    emAberto: number;
    rotulo: string;
    ajuda: string;
  };
}

export interface ContaData {
  cliente: Cliente;
  saldo: number;
  totalDebitos: number;
  totalCreditos: number;
  totalTitulosEmAberto: number;
  resumoFinanceiro?: ResumoFinanceiro;
  vendas: Array<{
    id: number;
    numeroVenda?: number | null;
    dataVenda: string;
    valorTotal: number | string;
  }>;
  pagamentos: Array<{
    id: number;
    tipo: string;
    data: string;
    valor: number | string;
    vendaId?: number | null;
    venda?: { numeroVenda?: number | null };
  }>;
  titulos?: Array<{
    id: number;
    vencimento: string;
    valorOriginal: number;
    valorPago: number;
    status: string;
  }>;
}

export interface ProdutoPreco extends Produto {
  precoEspecial: number | null;
  precoAplicado: number;
}

export interface ProdutoComissao extends Produto {
  comissaoEspecial: number | null;
  comissaoPadrao: number;
  comissaoAplicada: number;
}

export interface ComissoesData {
  comissaoPadrao: number;
  comissaoFixaPercentual: number | null;
  vendedor: { id: number; nome: string; comissaoPercentual: number } | null;
  produtos: ProdutoComissao[];
}

export type { Cliente, Cheque, FreteMovimento };
