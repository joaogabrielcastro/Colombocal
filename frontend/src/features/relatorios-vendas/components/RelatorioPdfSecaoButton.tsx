"use client";

import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

type Props = {
  onClick: () => void;
  label?: string;
};

/** Botão compacto para PDF de uma seção do relatório (impressão do navegador). */
export function RelatorioPdfSecaoButton({ onClick, label = "PDF" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline print:hidden"
      title="Abre só esta parte; no navegador use Salvar como PDF"
    >
      <ArrowDownTrayIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
