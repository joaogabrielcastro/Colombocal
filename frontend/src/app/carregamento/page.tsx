"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PrinterIcon } from "@heroicons/react/24/outline";
import { formatDate } from "@/lib/utils";
import api, { apiFetchWithMeta } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { reportApiError } from "@/lib/report-api-error";
import { ListPageSkeleton, TableListSkeleton } from "@/components/ui/skeletons";
import FreteFeatureGuard from "@/components/FreteFeatureGuard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  openOrdemCarregamentoPrint,
  type OrdemCarregamentoPrintData,
} from "@/lib/ordem-carregamento-print";
import { toast } from "sonner";

type OcItem = {
  id: number;
  descricao: string;
  quantidade: string | number;
  unidade: string;
};

type OcRow = OrdemCarregamentoPrintData & {
  id: number;
  itens: OcItem[];
};

function padOc(n: number): string {
  return String(n).padStart(6, "0");
}

function CarregamentoContent() {
  const searchParams = useSearchParams();
  const clienteQ = searchParams.get("cliente") || "";
  const ocQ = searchParams.get("numeroOc") || "";
  const pedidoQ = searchParams.get("pedido") || "";

  const [rows, setRows] = useState<OcRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clienteInput, setClienteInput] = useState(clienteQ);
  const [clienteFiltro, setClienteFiltro] = useState(clienteQ.trim());
  const [ocInput, setOcInput] = useState(ocQ);
  const [ocFiltro, setOcFiltro] = useState(ocQ.replace(/\D/g, "").trim());
  const [pedidoInput, setPedidoInput] = useState(pedidoQ);
  const [pedidoFiltro, setPedidoFiltro] = useState(pedidoQ.trim());
  const [toDelete, setToDelete] = useState<OcRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pageSize = 50;

  const aplicarFiltro = () => {
    setClienteFiltro(clienteInput.trim());
    setOcFiltro(ocInput.replace(/\D/g, "").trim());
    setPedidoFiltro(pedidoInput.trim());
    setPage(1);
  };

  const carregar = async () => {
    const params = new URLSearchParams();
    params.set("take", String(pageSize));
    params.set("skip", String((page - 1) * pageSize));
    if (clienteFiltro) params.set("cliente", clienteFiltro);
    if (ocFiltro) params.set("numeroOc", ocFiltro);
    if (pedidoFiltro) params.set("pedido", pedidoFiltro);
    setLoading(true);
    try {
      const { data, meta } = await apiFetchWithMeta<OcRow[]>(
        `/ordens-carregamento?${params}`,
      );
      setRows(data);
      setTotal(meta.totalCount ?? data.length);
    } catch (e) {
      reportApiError(e, {
        title: "Não foi possível carregar as ordens",
        onRetry: () => void carregar(),
      });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [page, clienteFiltro, ocFiltro, pedidoFiltro]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const confirmarExclusao = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/ordens-carregamento/${toDelete.id}`);
      toast.success(`OC ${padOc(toDelete.numeroOc)} excluída`);
      setToDelete(null);
      void carregar();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível excluir a OC" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Ordens de carregamento
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Documento do pátio (sem valor financeiro). Separado de fretes.
          </p>
        </div>
      </div>

      <FilterBar className="p-4 flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end flex-1 min-w-0">
          <div className="flex-1 min-w-[16rem] max-w-md">
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <input
              type="text"
              value={clienteInput}
              onChange={(e) => setClienteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplicarFiltro();
              }}
              className="input-field w-full"
              placeholder="Nome do cliente"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">OC Nº</label>
            <input
              type="text"
              inputMode="numeric"
              value={ocInput}
              onChange={(e) => setOcInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplicarFiltro();
              }}
              className="input-field font-mono min-w-32"
              placeholder="ex: 12"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pedido</label>
            <input
              type="text"
              value={pedidoInput}
              onChange={(e) => setPedidoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplicarFiltro();
              }}
              className="input-field min-w-36"
              placeholder="Nº venda / pedido"
            />
          </div>
          <button type="button" className="btn-primary" onClick={aplicarFiltro}>
            Filtrar
          </button>
        </div>
        <Link href="/carregamento/nova" className="btn-primary h-10">
          Nova OC
        </Link>
      </FilterBar>

      {loading ? (
        <div className="card p-4">
          <TableListSkeleton rows={10} cols={6} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhuma ordem de carregamento"
          description="Ajuste os filtros ou crie uma OC avulsa / a partir de uma venda."
          action={
            <Link href="/carregamento/nova" className="btn-secondary text-sm">
              Nova OC
            </Link>
          }
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header">OC Nº</th>
                  <th className="table-header">Emissão</th>
                  <th className="table-header">Cliente</th>
                  <th className="table-header">Motorista</th>
                  <th className="table-header">Pedido</th>
                  <th className="table-header text-right min-w-[9rem]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="table-row">
                    <td className="table-cell font-semibold font-mono">
                      {padOc(row.numeroOc)}
                    </td>
                    <td className="table-cell whitespace-nowrap">
                      {formatDate(row.dataEmissao)}
                    </td>
                    <td className="table-cell">{row.clienteNome}</td>
                    <td className="table-cell">
                      {row.motoristaNome || "—"}
                      {row.motoristaPlaca ? (
                        <span className="text-gray-400 text-xs ml-1">
                          ({row.motoristaPlaca})
                        </span>
                      ) : null}
                    </td>
                    <td className="table-cell">{row.pedido || "—"}</td>
                    <td className="table-cell text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          title="Imprimir"
                          onClick={() => openOrdemCarregamentoPrint(row)}
                        >
                          <PrinterIcon className="w-3.5 h-3.5 shrink-0" />
                          Imprimir
                        </button>
                        <Link
                          href={`/carregamento/${row.id}/editar`}
                          className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          title="Editar"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          title="Excluir"
                          onClick={() => setToDelete(row)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                {total} ordem{total === 1 ? "" : "ns"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary py-1 px-2"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <span className="py-1">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary py-1 px-2"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir ordem de carregamento?"
        description={
          toDelete
            ? `OC ${padOc(toDelete.numeroOc)} — ${toDelete.clienteNome}. Esta ação não pode ser desfeita.`
            : ""
        }
        confirmText={deleting ? "Excluindo…" : "Excluir"}
        tone="danger"
        busy={deleting}
        onConfirm={() => void confirmarExclusao()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

export default function CarregamentoPage() {
  return (
    <FreteFeatureGuard>
      <Suspense fallback={<ListPageSkeleton />}>
        <CarregamentoContent />
      </Suspense>
    </FreteFeatureGuard>
  );
}
