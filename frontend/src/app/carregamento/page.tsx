"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PlusIcon, PrinterIcon, TrashIcon } from "@heroicons/react/24/outline";
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

  const [rows, setRows] = useState<OcRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clienteInput, setClienteInput] = useState(clienteQ);
  const [clienteFiltro, setClienteFiltro] = useState(clienteQ.trim());
  const [toDelete, setToDelete] = useState<OcRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pageSize = 50;

  const carregar = async () => {
    const params = new URLSearchParams();
    params.set("take", String(pageSize));
    params.set("skip", String((page - 1) * pageSize));
    if (clienteFiltro) params.set("cliente", clienteFiltro);
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
  }, [page, clienteFiltro]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const aplicarFiltro = () => {
    setPage(1);
    setClienteFiltro(clienteInput.trim());
  };

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
    <div className="p-6 w-full max-w-[90rem] mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Ordens de carregamento
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Documento do pátio (sem valor financeiro). Separado de fretes.
          </p>
        </div>
        <Link href="/carregamento/nova" className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          Nova OC
        </Link>
      </div>

      <FilterBar className="p-4 flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end flex-1 min-w-0">
          <div className="flex-1 min-w-[16rem] max-w-md">
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <input
              className="input"
              value={clienteInput}
              onChange={(e) => setClienteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplicarFiltro();
              }}
              placeholder="Nome do cliente"
            />
          </div>
          <button type="button" className="btn-secondary" onClick={aplicarFiltro}>
            Filtrar
          </button>
        </div>
      </FilterBar>

      <div className="card overflow-hidden mt-4">
        {loading ? (
          <div className="p-4">
            <TableListSkeleton rows={8} cols={6} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Nenhuma ordem de carregamento"
              description="Crie uma OC avulsa ou gere a partir de uma venda."
            />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">OC Nº</th>
                <th className="table-header">Emissão</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Motorista</th>
                <th className="table-header">Pedido</th>
                <th className="table-header text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="table-cell font-semibold">
                    {padOc(row.numeroOc)}
                  </td>
                  <td className="table-cell">{formatDate(row.dataEmissao)}</td>
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
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="btn-secondary py-1 px-2"
                        title="Imprimir"
                        onClick={() => openOrdemCarregamentoPrint(row)}
                      >
                        <PrinterIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-secondary py-1 px-2 text-red-600"
                        title="Excluir"
                        onClick={() => setToDelete(row)}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
