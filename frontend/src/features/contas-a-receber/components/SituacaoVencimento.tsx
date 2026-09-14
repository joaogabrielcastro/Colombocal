"use client";

import { formatMoney } from "@/lib/utils";
import {
  rotuloSituacaoVencimento,
  situacaoVencimentoKind,
} from "../services/display";

export function SituacaoVencimento({
  aberto,
  diasAtraso,
  diasAteVencer,
  venceHoje,
}: {
  aberto: number;
  diasAtraso: number;
  diasAteVencer: number;
  venceHoje: boolean;
}) {
  const kind = situacaoVencimentoKind({ aberto, diasAtraso, venceHoje });
  const rotulo = rotuloSituacaoVencimento(
    kind,
    kind === "a_vencer" ? diasAteVencer : diasAtraso,
  );
  const valorClass =
    kind === "vencido"
      ? "text-red-700"
      : kind === "quitado"
        ? "text-gray-500"
        : "text-gray-900";
  const rotuloClass =
    kind === "vencido"
      ? "text-red-600"
      : kind === "vence_hoje"
        ? "text-amber-800"
        : "text-gray-500";

  return (
    <div className="text-right">
      <span className={`font-semibold tabular-nums ${valorClass}`}>
        {formatMoney(aberto)}
      </span>
      {rotulo ? (
        <div className={`text-xs font-normal ${rotuloClass}`}>{rotulo}</div>
      ) : null}
    </div>
  );
}
