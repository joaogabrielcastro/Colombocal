import type { FiscalFiltros } from "../types";

export function qsFiscal(filtros: Partial<FiscalFiltros>): string {
  const p = new URLSearchParams();
  if (filtros.dataInicio) p.set("dataInicio", filtros.dataInicio);
  if (filtros.dataFim) p.set("dataFim", filtros.dataFim);
  if (filtros.status) p.set("status", filtros.status);
  if (filtros.numero) p.set("numero", filtros.numero);
  if (filtros.serie) p.set("serie", filtros.serie);
  if (filtros.clienteId) p.set("clienteId", filtros.clienteId);
  if (filtros.documento) p.set("documento", filtros.documento);
  if (filtros.venda) p.set("venda", filtros.venda);
  if (filtros.chave) p.set("chave", filtros.chave);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function formatChave(chave?: string | null) {
  if (!chave) return "—";
  const d = String(chave).replace(/\D/g, "");
  if (d.length !== 44) return chave;
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function mesParaPeriodo(anoMes: string): { dataInicio: string; dataFim: string } {
  const [y, m] = anoMes.split("-").map(Number);
  const ini = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const fim = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { dataInicio: ini, dataFim: fim };
}

export function periodoParaMes(dataInicio: string): string {
  return String(dataInicio || "").slice(0, 7);
}
