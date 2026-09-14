"use client";

import type { SituacaoFiltro } from "../types";

const OPCOES: { id: SituacaoFiltro; label: string }[] = [
  { id: "", label: "Todos em aberto" },
  { id: "vencidos", label: "Vencidos" },
  { id: "a_vencer", label: "A vencer" },
];

export function FiltrosRapidosSituacao({
  value,
  somenteEmAberto,
  onChange,
}: {
  value: SituacaoFiltro;
  somenteEmAberto: boolean;
  onChange: (next: SituacaoFiltro) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro rápido de vencimento">
      {OPCOES.map((op) => {
        const ativo = somenteEmAberto && value === op.id;
        return (
          <button
            key={op.id || "todos"}
            type="button"
            onClick={() => onChange(op.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              ativo
                ? op.id === "vencidos"
                  ? "bg-red-50 text-red-800 border-red-200"
                  : "bg-slate-900 text-white border-slate-900"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}
