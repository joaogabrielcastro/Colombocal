import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import type { ContaData } from "@/features/clientes/types";

export function ClienteResumoFinanceiro({
  conta, clienteId,
}: { conta: ContaData; clienteId: string }) {
  return (
    <div className={`card p-5 mb-6 border-l-4 ${conta.saldo > 0 ? "border-l-red-500" : "border-l-green-500"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Resumo financeiro do cliente</h2>
        <Link href={`/relatorios/titulos?clienteId=${clienteId}`} className="text-sm text-blue-600 hover:underline whitespace-nowrap">
          Relatório de contas a receber deste cliente →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-gray-50/80 p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total compras (vendas)</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatMoney(conta.totalDebitos)}</p>
        </div>
        <div className="rounded-lg bg-gray-50/80 p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total pago</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatMoney(conta.totalCreditos)}</p>
          <p className="text-[11px] text-gray-400 mt-1 text-left leading-snug">Soma dos pagamentos registrados (dinheiro, PIX, cheques etc.).</p>
        </div>
        <div className="rounded-lg bg-white border border-amber-100 p-3">
          <p className="text-xs text-amber-800/90 uppercase font-semibold">Conta a receber</p>
          <p className="text-xl font-bold text-amber-900 mt-1">{formatMoney(conta.totalTitulosEmAberto ?? 0)}</p>
          <p className="text-[11px] text-gray-400 mt-1 text-left leading-snug">{conta.resumoFinanceiro?.titulosReceber.ajuda ?? "Soma do saldo restante nos títulos a receber."}</p>
        </div>
      </div>
    </div>
  );
}
