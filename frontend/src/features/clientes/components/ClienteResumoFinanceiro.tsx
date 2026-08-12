import Link from "next/link";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { formatMoney } from "@/lib/utils";
import type { ContaData } from "@/features/clientes/types";

type Props = {
  conta: ContaData;
  clienteId: string;
  reconciliando?: boolean;
  onReconciliar?: () => void;
};

export function ClienteResumoFinanceiro({
  conta,
  clienteId,
  reconciliando = false,
  onReconciliar,
}: Props) {
  const emAbertoTitulos = conta.totalTitulosEmAberto ?? 0;

  return (
    <div
      className={`card p-5 mb-6 border-l-4 ${
        emAbertoTitulos > 0.009 ? "border-l-red-500" : "border-l-green-500"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Resumo financeiro do cliente
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Cobrança oficial = carteira de títulos. Compras/pagamentos abaixo são
            visão auxiliar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onReconciliar ? (
            <button
              type="button"
              className="btn-secondary text-sm flex items-center gap-1.5"
              disabled={reconciliando}
              onClick={onReconciliar}
              title="Reaplica todos os pagamentos nos títulos deste cliente"
            >
              <ArrowPathIcon
                className={`w-4 h-4 ${reconciliando ? "animate-spin" : ""}`}
              />
              {reconciliando ? "Recalculando…" : "Recalcular títulos"}
            </button>
          ) : null}
          <Link
            href={`/relatorios/financeiro?visao=titulos&clienteId=${clienteId}`}
            className="text-sm text-blue-600 hover:underline whitespace-nowrap"
          >
            Contas a receber deste cliente →
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-gray-50/80 p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">
            Total compras (vendas)
          </p>
          <p className="text-xl font-bold text-red-600 mt-1">
            {formatMoney(conta.totalDebitos)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1 text-left leading-snug">
            Auxiliar: Σ valor das vendas (sem frete no título).
          </p>
        </div>
        <div className="rounded-lg bg-gray-50/80 p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total pago</p>
          <p className="text-xl font-bold text-green-600 mt-1">
            {formatMoney(conta.totalCreditos)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1 text-left leading-snug">
            Auxiliar: soma dos pagamentos (dinheiro, PIX, cheques etc.).
          </p>
        </div>
        <div className="rounded-lg bg-white border border-amber-100 p-3">
          <p className="text-xs text-amber-800/90 uppercase font-semibold">
            Em aberto (títulos)
          </p>
          <p className="text-xl font-bold text-amber-900 mt-1">
            {formatMoney(emAbertoTitulos)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1 text-left leading-snug">
            {conta.resumoFinanceiro?.titulosReceber.ajuda ??
              "Fonte da verdade da cobrança: saldo restante nos títulos."}
          </p>
        </div>
      </div>
    </div>
  );
}
