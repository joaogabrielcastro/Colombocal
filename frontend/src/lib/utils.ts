export function formatMoney(value: number | string | null | undefined): string {
  const num = parseFloat(String(value ?? 0));
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

export function formatCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatQuantidade(value: number | string, unidade: string): string {
  const num = parseFloat(String(value));
  return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${unidade}`;
}

export type StatusCheque = 'recebido' | 'depositado' | 'compensado' | 'devolvido';

export const STATUS_CHEQUE_LABEL: Record<StatusCheque, string> = {
  recebido: 'Recebido',
  depositado: 'Depositado',
  compensado: 'Compensado',
  devolvido: 'Devolvido',
};

export const STATUS_CHEQUE_COLOR: Record<StatusCheque, string> = {
  recebido: 'bg-yellow-100 text-yellow-800',
  depositado: 'bg-blue-100 text-blue-800',
  compensado: 'bg-green-100 text-green-800',
  devolvido: 'bg-red-100 text-red-800',
};

export function toInputDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Tipos principais
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
  ativo: boolean;
  createdAt: string;
}

export interface Produto {
  id: number;
  nome: string;
  codigo: string;
  precoPadrao: number;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  ativo: boolean;
}

export interface Vendedor {
  id: number;
  nome: string;
  telefone?: string;
  comissaoPercentual: number;
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
  valorTotal: number;
  dataVenda: string;
  observacoes?: string;
  cliente: Cliente;
  vendedor: Vendedor;
  motorista?: Motorista;
  itens: ItemVenda[];
}

export interface Cheque {
  id: number;
  clienteId: number;
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
}

export interface Pagamento {
  id: number;
  clienteId: number;
  tipo: string;
  valor: number;
  data: string;
  observacoes?: string;
  cheque?: Cheque;
}
