"use client";

import { formatMoney } from "@/lib/utils";
import type { FiscalResumo } from "../types";

const CARDS: Array<{
  key: keyof FiscalResumo;
  label: string;
  money?: boolean;
  /** Campo sem status persistido — mostra — em vez de inventar contagem. */
  placeholderDash?: boolean;
  accent?: "green" | "red" | "amber" | "slate" | "sky";
}> = [
  { key: "total", label: "Total de NF-e", accent: "slate" },
  { key: "autorizadas", label: "Autorizadas", accent: "green" },
  { key: "canceladas", label: "Canceladas", accent: "slate" },
  { key: "rejeitadas", label: "Rejeitadas", accent: "red" },
  { key: "processando", label: "Processando", accent: "amber" },
  { key: "emissaoIncerta", label: "Emissão incerta", placeholderDash: true, accent: "amber" },
  { key: "valorAutorizado", label: "Valor autorizado", money: true, accent: "sky" },
];

const accentBorder: Record<string, string> = {
  green: "border-l-green-500",
  red: "border-l-red-400",
  amber: "border-l-amber-400",
  slate: "border-l-slate-300",
  sky: "border-l-sky-500",
};

export function FiscalKpiCards({
  resumo,
  observacao,
}: {
  resumo: FiscalResumo | null;
  observacao?: string;
}) {
  if (!resumo) return null;
  return (
    <div className="mb-5 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 lg:gap-4">
        {CARDS.map(({ key, label, money, placeholderDash, accent }) => {
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
              className={`rounded-lg border border-slate-200 border-l-4 bg-white px-4 py-4 shadow-sm min-h-[5.5rem] flex flex-col justify-between ${accentBorder[accent || "slate"]}`}
              title={
                placeholderDash
                  ? "Não é status persistido; casos inconclusivos permanecem em Processando."
                  : undefined
              }
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                {label}
              </p>
              <p
                className={`mt-2 font-semibold text-slate-900 tabular-nums ${
                  money ? "text-xl lg:text-2xl" : "text-2xl lg:text-3xl"
                }`}
              >
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
