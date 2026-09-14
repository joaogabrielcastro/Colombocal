export type StatusTitulo = "aberto" | "parcial" | "quitado";

export type FaixasAging = {
  vencidos: number;
  ate30: number;
  de31a60: number;
  de61a90: number;
  acima90: number;
};

export type ContaCliente = {
  cliente: {
    id: number;
    razaoSocial: string;
    nomeFantasia?: string | null;
    vendedor?: { id: number; nome: string } | null;
  };
  saldo: number;
  debito: number;
  credito: number;
  participacao?: number;
  titulosAbertos?: number;
  maiorAtrasoDias?: number;
};

export type FinanceiroData = {
  clientesDevedores: ContaCliente[];
  clientesDevedoresCount?: number;
  totalEmAberto: number;
  totalOriginal?: number;
  totalPago?: number;
  totalVencido?: number;
  totalAVencer?: number;
  pctVencido?: number;
  faixas?: FaixasAging;
};

export type TituloItem = {
  id: number;
  numero?: string | null;
  vencimento: string;
  valorOriginal: number;
  valorPago: number;
  status: StatusTitulo;
  diasAtraso?: number;
  diasAteVencer?: number;
  venceHoje?: boolean;
  cliente: {
    id: number;
    razaoSocial: string;
    nomeFantasia?: string | null;
    vendedor?: { id: number; nome: string } | null;
  };
  venda?: {
    id: number;
    numeroVenda?: number | null;
    dataVenda: string;
    valorTotal: number;
    vendedor?: { id: number; nome: string } | null;
  } | null;
};

export type TitulosResponse = {
  titulos: TituloItem[];
  resumo: {
    totalTitulos: number;
    valorOriginal: number;
    valorPago: number;
    valorEmAberto: number;
    totalVencido?: number;
    totalAVencer?: number;
    faixas: FaixasAging;
  };
};

export type SituacaoFiltro = "" | "vencidos" | "a_vencer";
export type OrdenarClientes = "saldo" | "atraso" | "titulos";
