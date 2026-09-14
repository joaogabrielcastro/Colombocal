"use client";

import { formatMoney } from "@/lib/utils";
import { barrasAging } from "../services/agingFaixas";
import type { FaixasAging } from "../types";

export function ContasAgingFaixas({ faixas }: { faixas: FaixasAging }) {
  const barras = barrasAging(faixas);

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Aging por vencimento
        </h2>
        <p className="text-xs text-gray-500">
          Títulos em aberto/parcial. Vencimento hoje entra em Vencido.
        </p>
      </div>

      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex mb-4">
        {barras.map((b) =>
          b.pct > 0 ? (
            <div
              key={b.key}
              title={`${b.label}: ${formatMoney(b.valor)}`}
              className={`h-full ${b.tone === "danger" ? "bg-red-600" : "bg-slate-400"}`}
              style={{ width: `${b.pct}%` }}
            />
          ) : null,
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {barras.map((b) => (
          <div key={b.key} className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {b.label}
            </p>
            <p
              className={`text-base sm:text-lg font-semibold tabular-nums ${
                b.tone === "danger" && b.valor > 0.009 ? "text-red-700" : "text-gray-900"
              }`}
            >
              {formatMoney(b.valor)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
