"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/utils";
import api, { apiFetchWithMeta } from "@/lib/api";
import type { FreteMovimento } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { reportApiError } from "@/lib/report-api-error";
import { ListPageSkeleton, TableListSkeleton } from "@/components/ui/skeletons";
import FreteFeatureGuard from "@/components/FreteFeatureGuard";
import {
  openFreteAvulsoPrint,
  type FreteAvulsoImpressao,
} from "@/lib/frete-avulso-print";
import { PrinterIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type FreteListRow = FreteMovimento & {
  cliente: {
    id: number;
    razaoSocial: string;
    nomeFantasia?: string | null;
  };
};

function FretesContent() {
  const searchParams = useSearchParams();
  const reciboQ = searchParams.get("reciboEmitido");
  const clienteQ = searchParams.get("cliente") || "";

  const [rows, setRows] = useState<FreteListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [imprimindoId, setImprimindoId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<FreteListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reciboEmitido, setReciboEmitido] = useState<string>(
    reciboQ === "true" ? "true" : reciboQ === "false" ? "false" : "",
  );
  const [clienteInput, setClienteInput] = useState(clienteQ);
  const [clienteFiltro, setClienteFiltro] = useState(clienteQ.trim());
  const pageSize = 50;

  const carregar = async () => {
    const params = new URLSearchParams();
    params.set("take", String(pageSize));
    params.set("skip", String((page - 1) * pageSize));
    params.set("avulso", "true");
    if (reciboEmitido === "true" || reciboEmitido === "false") {
      params.set("reciboEmitido", reciboEmitido);
    }
    if (clienteFiltro) params.set("cliente", clienteFiltro);
    setLoading(true);
    try {
      const { data, meta } = await apiFetchWithMeta<FreteListRow[]>(
        `/fretes?${params}`,
      );
      setRows(data);
      setTotal(meta.totalCount ?? data.length);
    } catch (e) {
      reportApiError(e, {
        title: "Não foi possível carregar os fretes avulsos",
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
  }, [page, reciboEmitido, clienteFiltro]);

  const reimprimirOrcamento = async (id: number) => {
    setImprimindoId(id);
    try {
      const resumo = await api.get<FreteAvulsoImpressao>(`/fretes/${id}/impressao`);
      openFreteAvulsoPrint(resumo);
      toast.success("Abrindo impressão");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível reimprimir o frete" });
    } finally {
      setImprimindoId(null);
    }
  };

  const confirmarExclusao = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/fretes/${toDelete.id}`);
      toast.success("Frete avulso excluído");
      setToDelete(null);
      void carregar();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível excluir o frete" });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const actionBtn =
    "inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  const actionBtnDanger =
    "inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";

  return (
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fretes avulsos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Orçamento e cadastro de frete sem venda. O frete da venda fica na
            própria ordem, com opção de PDF por lá.
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
              if (e.key === "Enter") {
                setClienteFiltro(clienteInput.trim());
                setPage(1);
              }
            }}
            className="input-field w-full"
            placeholder="Nome, fantasia ou documento"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pagamento</label>
          <select
            value={reciboEmitido}
            onChange={(e) => {
              setReciboEmitido(e.target.value);
              setPage(1);
            }}
            className="input-field min-w-44"
          >
            <option value="">Todos</option>
            <option value="true">Pago</option>
            <option value="false">Pendente</option>
          </select>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setClienteFiltro(clienteInput.trim());
            setPage(1);
          }}
        >
          Filtrar
        </button>
        </div>
        <Link href="/fretes/novo" className="btn-primary h-10">
          Novo frete avulso
        </Link>
      </FilterBar>

      {loading ? (
        <div className="card p-4">
          <TableListSkeleton rows={10} cols={5} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhum frete avulso encontrado"
          description="Cadastre um orçamento avulso ou imprima o frete direto na ordem de venda."
          action={
            <div className="flex flex-wrap gap-2 justify-center">
              <Link href="/fretes/novo" className="btn-primary text-sm">
                Novo frete avulso
              </Link>
              <Link href="/vendas" className="btn-secondary text-sm">
                Ir para vendas
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header">Data</th>
                  <th className="table-header">Cliente</th>
                  <th className="table-header text-right">Valor</th>
                  <th className="table-header">Frete pago</th>
                  <th className="table-header text-right min-w-[9rem]">Ações</th>
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
                    <td className="table-cell text-right font-medium">
                      {formatMoney(r.valor)}
                    </td>
                    <td className="table-cell">
                      <span
                        className={
                          r.reciboEmitido
                            ? "text-green-700"
                            : "text-amber-700"
                        }
                      >
                        {r.reciboEmitido
                          ? r.reciboData
                            ? `Pago em ${formatDate(r.reciboData)}`
                            : "Pago"
                          : "Pendente"}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          className={actionBtn}
                          title="Reimprimir orçamento de frete"
                          disabled={imprimindoId === r.id}
                          onClick={() => void reimprimirOrcamento(r.id)}
                        >
                          <PrinterIcon className="w-3.5 h-3.5 shrink-0" />
                          {imprimindoId === r.id ? "…" : "PDF"}
                        </button>
                        <Link
                          href={`/fretes/${r.id}/editar`}
                          className={actionBtn}
                          title="Editar"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          className={actionBtnDanger}
                          title="Excluir frete"
                          onClick={() => setToDelete(r)}
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

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir frete avulso?"
        description={
          toDelete
            ? `Frete de ${
                toDelete.cliente.nomeFantasia?.trim() ||
                toDelete.cliente.razaoSocial
              } (${formatMoney(toDelete.valor)}). Remove só o registro do frete (sem financeiro de cliente).`
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

export default function FretesPage() {
  return (
    <FreteFeatureGuard>
      <Suspense fallback={<ListPageSkeleton tableRows={10} showFilters />}>
        <FretesContent />
      </Suspense>
    </FreteFeatureGuard>
  );
}
