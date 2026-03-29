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

export function formatCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatQuantidade(
  value: number | string,
  unidade: string,
): string {
  const num = parseFloat(String(value));
  return `${num.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${unidade}`;
}

export type StatusCheque = "a_receber" | "recebido" | "depositado" | "devolvido";

export const STATUS_CHEQUE_LABEL: Record<StatusCheque, string> = {
  a_receber: "A Receber",
  recebido: "Recebido",
  depositado: "Depositado",
  devolvido: "Devolvido",
};

export const STATUS_CHEQUE_COLOR: Record<StatusCheque, string> = {
  a_receber: "bg-orange-100 text-orange-800",
  recebido: "bg-yellow-100 text-yellow-800",
  depositado: "bg-green-100 text-green-800",
  devolvido: "bg-red-100 text-red-800",
};

export function toInputDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

export function classNames(
  ...classes: (string | undefined | null | false)[]
): string {
  return classes.filter(Boolean).join(" ");
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
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  observacoes?: string;
  fretePadrao: number;
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
  clienteId: number;
  vendedorId: number;
  motoristaId?: number;
  frete: number;
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
  banco?: string;
  numero?: string;
  agencia?: string;
  conta?: string;
  dataRecebimento: string;
  dataCompensacao?: string;
  status: StatusCheque;
  observacoes?: string;
  cliente: Cliente;
  venda?: { id: number; dataVenda: string; valorTotal: number } | null;
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
  venda?: { id: number; dataVenda: string; valorTotal: number } | null;
}

/** Resumo do recibo de frete (primeiro movimento ou flags na venda) para listagens e relatórios. */
export function formatFreteReciboLinha(v: {
  frete?: unknown;
  freteRecibo?: boolean;
  freteReciboNum?: string | null;
  fretes?: FreteMovimento[] | null | undefined;
}): string {
  const freteVal = parseFloat(String(v.frete ?? 0));
  const f = v.fretes?.[0];
  if (freteVal <= 0 && !f) return "—";
  const num = f?.reciboNumero || v.freteReciboNum || "";
  const dataStr = f?.reciboData ? formatDate(f.reciboData) : "";
  const ok = f?.reciboEmitido || v.freteRecibo || !!String(num).trim();
  if (!ok && freteVal > 0) return "Pendente";
  const parts: string[] = [];
  if (String(num).trim()) parts.push(`Nº ${num}`);
  if (dataStr) parts.push(dataStr);
  if (parts.length === 0 && ok) parts.push("Emitido");
  return parts.join(" · ") || "—";
}
