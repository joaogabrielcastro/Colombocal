"use client";

import { formatMoney } from "@/lib/utils";
import type { FiscalResumo } from "../types";

const CARDS: Array<{
  key: keyof FiscalResumo;
  label: string;
  money?: boolean;
  /** Campo sem status persistido — mostra — em vez de inventar contagem. */
  placeholderDash?: boolean;
}> = [
  { key: "total", label: "Total de NF-e" },
  { key: "autorizadas", label: "Autorizadas" },
  { key: "canceladas", label: "Canceladas" },
  { key: "rejeitadas", label: "Rejeitadas" },
  { key: "processando", label: "Processando" },
  { key: "emissaoIncerta", label: "Emissão incerta", placeholderDash: true },
  { key: "valorAutorizado", label: "Valor autorizado", money: true },
];

export function FiscalKpiCards({
  resumo,
  observacao,
}: {
  resumo: FiscalResumo | null;
  observacao?: string;
}) {
  if (!resumo) return null;
  return (
    <div className="mb-4 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {CARDS.map(({ key, label, money, placeholderDash }) => {
          const raw = resumo[key];
          let value: string;
          if (placeholderDash) {
            value = "—";
          } else if (money && typeof raw === "number") {
            value = formatMoney(raw);
          } else {
            value = String(raw ?? 0);
          }
          return (
            <div
              key={key}
              className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm"
              title={
                placeholderDash
                  ? "Não é status persistido; casos inconclusivos permanecem em Processando."
                  : undefined
              }
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {value}
              </p>
            </div>
          );
        })}
      </div>
      {observacao ? (
        <p className="text-xs text-slate-500">{observacao}</p>
      ) : null}
    </div>
  );
}
