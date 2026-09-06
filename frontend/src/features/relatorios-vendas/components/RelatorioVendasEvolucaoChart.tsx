"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/utils";
import type { EvolucaoPeriodo } from "../services/evolucao";

type Props = {
  evolucao: EvolucaoPeriodo;
};

function formatEixo(valor: number): string {
  if (valor >= 1_000_000) return `${(valor / 1_000_000).toFixed(1)} mi`;
  if (valor >= 1_000) return `${Math.round(valor / 1_000)} mil`;
  return String(Math.round(valor));
}

export function RelatorioVendasEvolucaoChart({ evolucao }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const pontos = evolucao.pontos;
  const maxFat = Math.max(...pontos.map((p) => p.faturamento), 1);
  const totalFat = pontos.reduce((acc, p) => acc + p.faturamento, 0);
  const totalQtd = pontos.reduce((acc, p) => acc + p.quantidade, 0);
  const temValor = pontos.some((p) => p.quantidade > 0);

  const path = useMemo(() => {
    if (pontos.length === 0) return "";
    const w = 100;
    const h = 100;
    const step = pontos.length > 1 ? w / (pontos.length - 1) : 0;
    const coords = pontos.map((p, i) => {
      const x = pontos.length === 1 ? w / 2 : i * step;
      const y = h - (p.faturamento / maxFat) * h;
      return { x, y };
    });
    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ");
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(2)} ${h} L ${coords[0].x.toFixed(2)} ${h} Z`;
    return { line, area, coords };
  }, [pontos, maxFat]);

  const rotuloGranularidade = evolucao.granularidade === "dia" ? "por dia" : "por mês";

  return (
    <div className="card overflow-hidden mb-5">
      <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">Desempenho no período</h3>
          <p className="text-xs text-gray-500 mt-0.5">Faturamento {rotuloGranularidade}</p>
        </div>
        <p className="text-xs text-gray-500">
          {totalQtd} venda(s) · <strong className="text-gray-800 tabular-nums">{formatMoney(totalFat)}</strong>
        </p>
      </div>

      {!temValor ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">
          Nenhuma venda encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="px-4 sm:px-5 py-4">
          <div className="flex gap-3">
            <div className="relative w-10 shrink-0 h-44 text-[10px] text-gray-400 tabular-nums">
              <span className="absolute right-0 top-0 pr-1">{formatEixo(maxFat)}</span>
              <span className="absolute right-0 top-1/2 -translate-y-1/2 pr-1">{formatEixo(maxFat / 2)}</span>
              <span className="absolute right-0 bottom-0 pr-1">0</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="relative h-44">
                <div className="absolute inset-0 border-t border-gray-100" />
                <div className="absolute inset-x-0 top-1/2 border-t border-gray-100" />
                <div className="absolute inset-x-0 bottom-0 border-t border-gray-100" />
                {path && typeof path !== "string" ? (
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full overflow-visible"
                    role="img"
                    aria-label={`Evolução do faturamento ${rotuloGranularidade}`}
                  >
                    <path d={path.area} fill="rgb(59 130 246 / 0.16)" />
                    <path d={path.line} fill="none" stroke="#2563eb" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                  </svg>
                ) : null}
                <div className="absolute inset-0 flex">
                  {pontos.map((p, i) => (
                    <button
                      key={p.periodo}
                      type="button"
                      className="relative flex-1 min-w-0 h-full group"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      title={`${p.label}: ${formatMoney(p.faturamento)} · ${p.quantidade} venda(s)`}
                    >
                      <span className="absolute inset-y-0 left-1/2 w-px bg-blue-600/0 group-hover:bg-blue-600/30" />
                    </button>
                  ))}
                </div>
                {hover != null && pontos[hover] ? (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm text-xs text-gray-700 whitespace-nowrap pointer-events-none">
                    <span className="font-medium">{pontos[hover].label}</span>
                    {" · "}
                    <span className="tabular-nums">{formatMoney(pontos[hover].faturamento)}</span>
                    {" · "}
                    <span className="tabular-nums">{pontos[hover].quantidade} venda(s)</span>
                  </div>
                ) : null}
              </div>
              <div className="flex mt-2">
                {pontos.map((p, i) => {
                  const mostrar =
                    pontos.length <= 12 || i === 0 || i === pontos.length - 1 || i % Math.ceil(pontos.length / 8) === 0;
                  return (
                    <div key={p.periodo} className="flex-1 min-w-0 text-center">
                      {mostrar ? (
                        <span className="text-[10px] sm:text-[11px] text-gray-500">{p.label}</span>
                      ) : (
                        <span className="text-[10px] text-transparent">.</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
