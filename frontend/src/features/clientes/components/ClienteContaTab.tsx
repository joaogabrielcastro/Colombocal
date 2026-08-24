import Link from "next/link";
import { VendaOrdem } from "@/components/VendaOrdem";
import { formatDate, formatMoney } from "@/lib/utils";
import type { ContaData } from "@/features/clientes/types";

type Props = {
  conta: ContaData;
  clienteId: string;
};

export function ClienteContaTab({ conta, clienteId }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Vendas ({conta.vendas.length})</h3>
          <Link
            href={`/vendas?clienteId=${clienteId}`}
            className="text-blue-600 text-xs hover:underline"
          >
            Ver todas
          </Link>
        </div>
        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {conta.vendas.length === 0 ? (
            <p className="p-4 text-gray-400 text-sm text-center">Nenhuma venda</p>
          ) : (
            conta.vendas.map((v) => (
              <div
                key={v.id}
                className="flex justify-between items-center px-5 py-3 hover:bg-gray-50"
              >
                <div>
                  <VendaOrdem venda={v} size="sm" prefix="Venda" />
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(v.dataVenda)}</p>
                </div>
                <span className="text-sm font-semibold text-red-600">
                  -{formatMoney(v.valorTotal)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="card">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">
            Pagamentos ({conta.pagamentos.length})
          </h3>
          <Link
            href={`/financeiro/novo?clienteId=${clienteId}`}
            className="text-blue-600 text-xs hover:underline"
          >
            + Receber
          </Link>
        </div>
        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {conta.pagamentos.length === 0 ? (
            <p className="p-4 text-gray-400 text-sm text-center">Nenhum pagamento</p>
          ) : (
            conta.pagamentos.map((p) => {
              const valorNum = parseFloat(String(p.valor ?? 0));
              const t = String(p.tipo || "").toLowerCase();
              const tipoLabel =
                t === "dinheiro"
                  ? "Dinheiro"
                  : t === "transferencia"
                    ? "PIX / transferência"
                    : t === "cheque"
                      ? "Cheque"
                      : t.startsWith("troco_dinheiro")
                        ? "Troco (dinheiro)"
                        : t.startsWith("troco_transferencia")
                          ? "Troco (PIX / transferência)"
                          : p.tipo;
              return (
                <div key={p.id} className="flex justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{tipoLabel}</p>
                    <p className="text-xs text-gray-400">{formatDate(p.data)}</p>
                    {p.vendaId && (
                      <VendaOrdem
                        venda={{ id: p.vendaId, numeroVenda: p.venda?.numeroVenda }}
                        size="xs"
                        prefix="Venda"
                        className="mt-0.5"
                      />
                    )}
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      valorNum >= 0 ? "text-green-600" : "text-amber-700"
                    }`}
                  >
                    {valorNum >= 0 ? "+" : ""}
                    {formatMoney(p.valor)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="card lg:col-span-2">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900">
            Títulos a receber ({conta.titulos?.length ?? 0})
          </h3>
          <Link
            href={`/relatorios/financeiro?visao=titulos&clienteId=${clienteId}`}
            className="text-blue-600 text-xs hover:underline"
          >
            Mesmos dados do relatório →
          </Link>
        </div>
        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
          {!conta.titulos?.length ? (
            <p className="p-4 text-gray-400 text-sm text-center">Nenhum título</p>
          ) : (
            conta.titulos.map((t) => {
              const aberto = Math.max(0, Number(t.valorOriginal) - Number(t.valorPago));
              return (
                <div key={t.id} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {t.status === "quitado"
                        ? "Quitado"
                        : t.status === "parcial"
                          ? "Parcial"
                          : "Aberto"}{" "}
                      · venc. {formatDate(t.vencimento)}
                    </p>
                    <p className="text-xs text-gray-400">Título #{t.id}</p>
                  </div>
                  <div className="text-right text-sm">
                    <span className="text-gray-600">
                      Aberto:{" "}
                      <span className="font-semibold text-amber-900">
                        {formatMoney(aberto)}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
