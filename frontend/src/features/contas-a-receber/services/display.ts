import type { StatusTitulo, TituloItem } from "../types";

export function saldoAbertoTitulo(t: {
  valorOriginal: unknown;
  valorPago: unknown;
}) {
  return Math.max(
    0,
    parseFloat(String(t.valorOriginal)) - parseFloat(String(t.valorPago)),
  );
}

export function formatPct(n: number) {
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function labelStatusTitulo(status: StatusTitulo) {
  if (status === "quitado") return "Pago";
  if (status === "parcial") return "Parcial";
  return "Aberto";
}

export function classStatusTitulo(status: StatusTitulo) {
  if (status === "quitado") return "bg-green-100 text-green-800";
  if (status === "parcial") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export function atrasoDoTitulo(t: TituloItem, aberto: number) {
  if (typeof t.diasAtraso === "number") return t.diasAtraso;
  if (aberto <= 0.009) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(t.vencimento);
  venc.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
}

export function diasAteVencerDoTitulo(t: TituloItem, aberto: number) {
  if (typeof t.diasAteVencer === "number") return t.diasAteVencer;
  if (aberto <= 0.009) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(t.vencimento);
  venc.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
}

export function venceHojeDoTitulo(t: TituloItem, aberto: number) {
  if (typeof t.venceHoje === "boolean") return t.venceHoje;
  return aberto > 0.009 && atrasoDoTitulo(t, aberto) === 0 && diasAteVencerDoTitulo(t, aberto) === 0;
}

export type SituacaoVencimentoKind = "quitado" | "vence_hoje" | "vencido" | "a_vencer";

export function situacaoVencimentoKind(opts: {
  aberto: number;
  diasAtraso: number;
  venceHoje: boolean;
}): SituacaoVencimentoKind {
  if (opts.aberto <= 0.009) return "quitado";
  if (opts.venceHoje) return "vence_hoje";
  if (opts.diasAtraso > 0) return "vencido";
  return "a_vencer";
}

export function rotuloSituacaoVencimento(kind: SituacaoVencimentoKind, dias: number) {
  if (kind === "vence_hoje") return "vence hoje";
  if (kind === "vencido") {
    return dias === 1 ? "1 dia em atraso" : `${dias} dias em atraso`;
  }
  if (kind === "a_vencer") {
    if (dias <= 0) return "";
    return dias === 1 ? "vence em 1 dia" : `vence em ${dias} dias`;
  }
  return "";
}

export function labelMaiorAtraso(dias: number) {
  if (dias <= 0) return "Em dia";
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

export function labelOrdenarClientes(ordenar: string) {
  if (ordenar === "atraso") return "Maior atraso";
  if (ordenar === "titulos") return "Mais títulos";
  return "Maior valor em aberto";
}
