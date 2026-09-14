"use client";

import { formatMoney } from "@/lib/utils";

export type ContasKpi = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "muted";
};

export function ContasKpiCards({ items }: { items: ContasKpi[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4">
      {items.map((item) => (
        <div key={item.label} className="card p-4 sm:p-5 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
            {item.label}
          </p>
          <p
            className={`text-xl sm:text-2xl font-semibold tracking-tight tabular-nums break-words ${
              item.tone === "danger"
                ? "text-red-700"
                : item.tone === "muted"
                  ? "text-gray-700"
                  : "text-gray-900"
            }`}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-1 text-xs text-gray-500 leading-snug">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function kpisCarteiraClientes(opts: {
  totalEmAberto: number;
  clientes: number;
  totalVencido?: number;
  totalAVencer?: number;
  pctVencido?: number;
  filtrado?: boolean;
}): ContasKpi[] {
  const kpis: ContasKpi[] = [
    {
      label: opts.filtrado ? "Em aberto (filtro)" : "Total em aberto",
      value: formatMoney(opts.totalEmAberto),
    },
    {
      label: opts.filtrado ? "Clientes no filtro" : "Clientes devendo",
      value: String(opts.clientes),
    },
  ];
  if (opts.totalVencido != null) {
    kpis.push({
      label: "Vencido",
      value: formatMoney(opts.totalVencido),
      tone: "danger",
      hint: "Vencimento até hoje (mesma regra do aging)",
    });
  }
  if (opts.totalAVencer != null) {
    kpis.push({
      label: "A vencer",
      value: formatMoney(opts.totalAVencer),
      tone: "muted",
    });
  }
  if (opts.pctVencido != null) {
    kpis.push({
      label: "% vencido",
      value: `${opts.pctVencido.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`,
      hint: "Sobre o total em aberto do filtro",
    });
  }
  return kpis;
}
