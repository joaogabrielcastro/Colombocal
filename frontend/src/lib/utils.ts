export function formatMoney(value: number | string | null | undefined): string {
  const num = parseFloat(String(value ?? 0));
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

/** Valor para input type="date" no calendário local (não usar toISOString(), que é UTC). */
export function localDateInputValue(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatDocumentoCliente(cliente: {
  tipoPessoa?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
}): string {
  if (cliente.tipoPessoa === "PF" && cliente.cpf) return formatCPF(cliente.cpf);
  if (cliente.cnpj) return formatCNPJ(cliente.cnpj);
  if (cliente.cpf) return formatCPF(cliente.cpf);
  return "—";
}

export function formatQuantidade(
  value: number | string,
  unidade: string,
): string {
  const num = parseFloat(String(value));
  return `${num.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${unidade}`;
}

/** Número exibido na lista e impressos (#). Sequencial por tenant; sem campo, usa o id. */
export function vendaNumeroPublico(v: {
  id: number;
  numeroVenda?: number | null;
}): number {
  const n = v.numeroVenda;
  return n != null && n > 0 ? n : v.id;
}

export type StatusCheque = "ativo";

export const STATUS_CHEQUE_LABEL: Record<StatusCheque, string> = {
  ativo: "Ativo",
};

export const STATUS_CHEQUE_COLOR: Record<StatusCheque, string> = {
  ativo: "bg-blue-100 text-blue-800",
};

export function toInputDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return localDateInputValue(d);
}

// Tipos principais
export interface Vendedor {
  id: number;
  nome: string;
  telefone?: string;
  comissaoPercentual: number;
  ativo: boolean;
}

export interface Cliente {
  id: number;
  tipoPessoa?: "PJ" | "PF" | string;
  cnpj?: string | null;
  cpf?: string | null;
  razaoSocial: string;
  nomeFantasia?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  observacoes?: string;
  fretePadrao: number; // legado
  fretePadraoSaco: number;
  fretePadraoTonelada: number;
  vendedorId?: number | null;
  comissaoFixaPercentual?: number | null;
  vendedor?: Vendedor | null;
  ativo: boolean;
  createdAt: string;
}

export interface Produto {
  id: number;
  nome: string;
  codigo: string;
  precoPadrao: number;
  unidade: string;
  ativo: boolean;
}

export interface Motorista {
  id: number;
  nome: string;
  telefone?: string;
  veiculo?: string;
  placa?: string;
  ativo: boolean;
}

export interface ItemVenda {
  id: number;
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  produto: Produto;
}

export interface Venda {
  id: number;
  /** Número amigável por tenant (# na lista); o `id` é usado na URL. */
  numeroVenda?: number;
  clienteId: number;
  vendedorId: number;
  motoristaId?: number;
  frete: number;
  freteTarifaSaco?: number;
  freteTarifaTonelada?: number;
  freteRecibo: boolean;
  freteReciboNum?: string;
  comissaoPercentualAplicado?: number;
  comissaoValor?: number;
  valorTotal: number; // apenas produtos, sem frete
  dataVenda: string;
  observacoes?: string;
  cliente: Cliente;
  vendedor: Vendedor;
  motorista?: Motorista;
  itens: ItemVenda[];
  pagamentos?: Pagamento[];
  titulos?: TituloReceber[];
  fretes?: FreteMovimento[];
  /** Soma do saldo em aberto nos títulos desta venda (API GET /vendas). */
  saldoEmAbertoTitulos?: number;
  podeEditar?: boolean;
  cheques?: { id: number }[];
}

export interface TituloReceber {
  id: number;
  clienteId: number;
  vendaId?: number | null;
  numero?: string | null;
  vencimento: string;
  valorOriginal: number;
  valorPago: number;
  status: "aberto" | "parcial" | "quitado";
  observacoes?: string;
}

export interface FreteMovimento {
  id: number;
  vendaId?: number | null;
  clienteId: number;
  valor: number;
  reciboEmitido: boolean;
  reciboNumero?: string | null;
  reciboData?: string | null;
  data: string;
  observacao?: string | null;
}

export interface Cheque {
  id: number;
  numeroOrdem: number;
  clienteId: number;
  vendaId?: number;
  valor: number;
  emitenteNome?: string;
  banco?: string;
  numero?: string;
  agencia?: string;
  conta?: string;
  dataRecebimento: string;
  dataCompensacao?: string;
  status: StatusCheque;
  observacoes?: string;
  cliente: Cliente;
  venda?: {
    id: number;
    numeroVenda?: number | null;
    dataVenda: string;
    valorTotal: number;
  } | null;
}

export interface Pagamento {
  id: number;
  clienteId: number;
  vendaId?: number | null;
  tipo: string;
  valor: number;
  data: string;
  observacoes?: string;
  cheque?: Cheque;
  venda?: {
    id: number;
    numeroVenda?: number | null;
    dataVenda: string;
    valorTotal: number;
  } | null;
}

/** Resumo do status de pagamento do frete (primeiro movimento ou flags na venda). */
export function formatFreteReciboLinha(v: {
  frete?: unknown;
  freteRecibo?: boolean;
  freteReciboNum?: string | null;
  fretes?: FreteMovimento[] | null | undefined;
}): string {
  const freteVal = parseFloat(String(v.frete ?? 0));
  const f = v.fretes?.[0];
  if (freteVal <= 0 && !f) return "—";
  const dataStr = f?.reciboData ? formatDate(f.reciboData) : "";
  const pago = f?.reciboEmitido || v.freteRecibo;
  if (!pago && freteVal > 0) return "Pagamento pendente";
  if (pago && dataStr) return `Pago em ${dataStr}`;
  if (pago) return "Pago";
  return "—";
}
