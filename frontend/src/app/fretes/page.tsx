"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/utils";
import api, { apiFetchWithMeta } from "@/lib/api";
import type { FreteMovimento } from "@/lib/utils";
import { FreteOrientacaoPainel } from "@/components/FreteOrientacao";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { reportApiError } from "@/lib/report-api-error";
import { ListPageSkeleton } from "@/components/ui/skeletons";

type FreteListRow = FreteMovimento & {
  cliente: {
    id: number;
    razaoSocial: string;
    nomeFantasia?: string | null;
  };
  venda?: {
    id: number;
    dataVenda: string;
    valorTotal: unknown;
    freteRecibo?: boolean;
    freteReciboNum?: string | null;
  } | null;
};

function FretesContent() {
  const searchParams = useSearchParams();
  const reciboQ = searchParams.get("reciboEmitido");
  const vendaQ = searchParams.get("vendaId") || "";

  const [rows, setRows] = useState<FreteListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reciboEmitido, setReciboEmitido] = useState<string>(
    reciboQ === "true" ? "true" : reciboQ === "false" ? "false" : "",
  );
  const [vendaInput, setVendaInput] = useState(vendaQ);
  const [vendaFiltro, setVendaFiltro] = useState(vendaQ.replace(/^#/, "").trim());
  const pageSize = 50;

  const carregar = async () => {
    const params = new URLSearchParams();
    params.set("take", String(pageSize));
    params.set("skip", String((page - 1) * pageSize));
    if (reciboEmitido === "true" || reciboEmitido === "false") {
      params.set("reciboEmitido", reciboEmitido);
    }
    if (vendaFiltro) params.set("vendaId", vendaFiltro);
    setLoading(true);
    try {
      const { data, meta } = await apiFetchWithMeta<FreteListRow[]>(
        `/fretes?${params}`,
      );
      setRows(data);
      setTotal(meta.totalCount ?? data.length);
    } catch (e) {
      reportApiError(e, {
        title: "Não foi possível carregar os fretes",
        onRetry: () => void carregar(),
      });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [page, reciboEmitido, vendaFiltro]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fretes</h1>
          <p className="text-gray-500 text-sm mt-1">
            Movimentações com recibo (emitido, número e data) conforme cadastro
            na venda ou edição aqui.
          </p>
        </div>
        <Link href="/cobranca" className="btn-secondary text-sm">
          Painel de cobrança
        </Link>
      </div>

      <div className="mb-4">
        <FreteOrientacaoPainel variant="default" />
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nº venda</label>
          <input
            type="text"
            inputMode="numeric"
            value={vendaInput}
            onChange={(e) => setVendaInput(e.target.value)}
            className="input-field font-mono min-w-32"
            placeholder="ex: 1840"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Recibo</label>
          <select
            value={reciboEmitido}
            onChange={(e) => {
              setReciboEmitido(e.target.value);
              setPage(1);
            }}
            className="input-field min-w-44"
          >
            <option value="">Todos</option>
            <option value="true">Com recibo</option>
            <option value="false">Sem recibo / pendente</option>
          </select>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setVendaFiltro(vendaInput.replace(/^#/, "").trim());
            setPage(1);
          }}
        >
          Filtrar
        </button>
      </div>

      {loading ? (
        <div className="card p-4">
          <TableListSkeleton rows={10} cols={5} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhum frete encontrado"
          description="Ajuste os filtros ou registre frete na venda correspondente."
          action={
            <Link href="/vendas" className="btn-secondary text-sm">
              Ir para vendas
            </Link>
          }
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header">Data mov.</th>
                  <th className="table-header">Cliente</th>
                  <th className="table-header">Venda</th>
                  <th className="table-header text-right">Valor</th>
                  <th className="table-header">Recibo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell whitespace-nowrap">
                      {formatDate(r.data)}
                    </td>
                    <td className="table-cell">
                      <Link
                        href={`/clientes/${r.clienteId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {r.cliente.nomeFantasia?.trim() ||
                          r.cliente.razaoSocial}
                      </Link>
                    </td>
                    <td className="table-cell">
                      {r.venda ? (
                        <Link
                          href={`/vendas/${r.venda.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          #{r.venda.id}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right font-medium">
                      {formatMoney(r.valor)}
                    </td>
                    <td className="table-cell">
                      <span
                        className={
                          r.reciboEmitido || r.reciboNumero
                            ? "text-green-700"
                            : "text-amber-700"
                        }
                      >
                        {r.reciboEmitido || r.reciboNumero
                          ? [
                              r.reciboNumero
                                ? `Nº ${r.reciboNumero}`
                                : "Emitido",
                              r.reciboData
                                ? formatDate(r.reciboData)
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : "Pendente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
            <span>Total: {total}</span>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function FretesPage() {
  return (
    <Suspense fallback={<ListPageSkeleton tableRows={10} showFilters />}>
      <FretesContent />
    </Suspense>
  );
}
