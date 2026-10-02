/** Badges e rótulos financeiros/fiscais compartilhados (glossário UX). */

export type StatusTituloUi = "aberto" | "parcial" | "quitado";

export function statusTituloFromSaldo(saldo: number, valorTotal: number): StatusTituloUi {
  if (saldo < 0.01) return "quitado";
  if (saldo + 0.01 < valorTotal) return "parcial";
  return "aberto";
}

/** Termo único: Quitado (não “Pago”, reservado a linhas de pagamento). */
export function labelStatusTituloUi(status: StatusTituloUi | string) {
  const s = String(status).toLowerCase();
  if (s === "quitado") return "Quitado";
  if (s === "parcial") return "Parcial";
  return "Aberto";
}

export function classStatusTituloUi(status: StatusTituloUi | string) {
  const s = String(status).toLowerCase();
  if (s === "quitado") return "bg-green-100 text-green-800";
  if (s === "parcial") return "bg-amber-100 text-amber-900";
  return "bg-red-50 text-red-700";
}

export function badgeTipoPagamento(tipo: string): { label: string; className: string } {
  const t = tipo.toLowerCase();
  if (t === "dinheiro") {
    return { label: "Dinheiro", className: "bg-emerald-50 text-emerald-800" };
  }
  if (t === "transferencia") {
    return { label: "PIX / transferência", className: "bg-sky-50 text-sky-800" };
  }
  if (t === "cheque") {
    return { label: "Cheque", className: "bg-violet-50 text-violet-800" };
  }
  if (t.startsWith("troco_dinheiro")) {
    return { label: "Troco (dinheiro)", className: "bg-amber-50 text-amber-900" };
  }
  if (t.startsWith("troco_transferencia")) {
    return { label: "Troco (PIX / transferência)", className: "bg-amber-50 text-amber-900" };
  }
  return { label: tipo, className: "bg-slate-100 text-slate-700" };
}
