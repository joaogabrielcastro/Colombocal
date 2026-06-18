"use client";

import { formatMoney } from "@/lib/utils";

type MesFaturamento = { mes: string; total: number };

function formatValorEixo(valor: number): string {
  if (valor >= 1_000_000) return `${(valor / 1_000_000).toFixed(1)} mi`;
  if (valor >= 1_000) return `${Math.round(valor / 1_000)} mil`;
  return String(Math.round(valor));
}

function formatValorBarra(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)} mi`;
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)} mil`;
  return formatMoney(valor);
}

export function DashboardFaturamentoChart({ dados }: { dados: MesFaturamento[] }) {
  const maxVal = Math.max(...dados.map((m) => m.total), 1);
  const totalPeriodo = dados.reduce((acc, m) => acc + m.total, 0);
  const melhorMes = dados.reduce(
    (best, m) => (m.total > best.total ? m : best),
    dados[0] ?? { mes: "", total: 0 },
  );

  const ticks = [1, 0.75, 0.5, 0.25, 0].map((pct) => ({
    pct,
    valor: maxVal * pct,
    top: `${(1 - pct) * 100}%`,
  }));

  const temAlgumValor = dados.some((m) => m.total > 0.009);

  return (
    <div>
      <div className="px-5 py-3 border-b border-gray-50 flex flex-wrap items-baseline justify-between gap-2 text-xs text-gray-500">
        <span>
          Total no período:{" "}
          <strong className="text-gray-800">{formatMoney(totalPeriodo)}</strong>
        </span>
        {melhorMes.total > 0 ? (
          <span>
            Melhor mês:{" "}
            <strong className="text-gray-800">
              {melhorMes.mes} ({formatMoney(melhorMes.total)})
            </strong>
          </span>
        ) : null}
      </div>

      {!temAlgumValor ? (
        <div className="px-5 py-12 text-center text-sm text-gray-400">
          Nenhuma venda registrada nos últimos 6 meses.
        </div>
      ) : (
        <div className="px-5 py-4">
          <div className="flex gap-3">
            {/* Eixo Y */}
            <div className="relative w-10 shrink-0 h-48 text-[10px] text-gray-400 tabular-nums">
              {ticks.slice(0, -1).map((t) => (
                <span
                  key={t.pct}
                  className="absolute right-0 -translate-y-1/2 pr-1"
                  style={{ top: t.top }}
                >
                  {formatValorEixo(t.valor)}
                </span>
              ))}
              <span className="absolute right-0 bottom-0 pr-1">0</span>
            </div>

            {/* Área do gráfico */}
            <div className="flex-1 min-w-0">
              <div className="relative h-48">
                {/* Linhas de grade */}
                {ticks.map((t) => (
                  <div
                    key={t.pct}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: t.top }}
                  />
                ))}

                {/* Barras */}
                <div className="absolute inset-0 flex items-end gap-2 sm:gap-3">
                  {dados.map((m) => {
                    const pct = maxVal > 0 ? (m.total / maxVal) * 100 : 0;
                    const altura = m.total > 0 ? Math.max(pct, 2) : 0;
                    return (
                      <div
                        key={m.mes}
                        className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group"
                      >
                        <span
                          className={`text-[10px] font-semibold leading-tight text-center mb-1 px-0.5 ${
                            m.total > 0 ? "text-gray-700" : "text-transparent"
                          }`}
                          title={formatMoney(m.total)}
                        >
                          {m.total > 0 ? formatValorBarra(m.total) : "—"}
                        </span>
                        <div
                          className={`w-full max-w-[3.5rem] mx-auto rounded-t-md transition-colors ${
                            m.total > 0
                              ? "bg-blue-500 group-hover:bg-blue-600"
                              : "bg-gray-200"
                          }`}
                          style={{ height: `${altura}%`, minHeight: m.total > 0 ? 4 : 2 }}
                          title={`${m.mes}: ${formatMoney(m.total)}`}
                          role="img"
                          aria-label={`${m.mes}: ${formatMoney(m.total)}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rótulos do eixo X */}
              <div className="flex gap-2 sm:gap-3 mt-2">
                {dados.map((m) => (
                  <div key={m.mes} className="flex-1 min-w-0 text-center">
                    <span className="text-[11px] text-gray-500 font-medium">
                      {m.mes}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
