"use client";
import { useState } from "react";
import Link from "next/link";
import {
  PlusIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDocumentoCliente, type Cliente } from "@/lib/utils";
import api from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { ListScaffold } from "@/components/ui/list-scaffold";
import { Pagination } from "@/components/ui/pagination";
import { useClientesListaQuery } from "@/features/clientes/hooks/useClientesListaQuery";
import { reportApiError } from "@/lib/report-api-error";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

const PAGE_SIZE = 20;

export default function ClientesPage() {
  const { freteEnabled } = useTenantFeatures();
  const [busca, setBusca] = useState("");
  const [buscaInput, setBuscaInput] = useState("");
  const [page, setPage] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const {
    data,
    isLoading: loading,
    refetch,
  } = useClientesListaQuery({ busca, page, pageSize: PAGE_SIZE });
  const clientes = data?.clientes ?? [];
  const total = data?.total ?? 0;

  const handleBuscar = () => {
    setPage(0);
    setBusca(buscaInput);
  };
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const confirmarExclusao = async () => {
    if (!clienteToDelete) return;
    setDeletingId(clienteToDelete.id);
    try {
      await api.delete(`/clientes/${clienteToDelete.id}`);
      await refetch();
      setClienteToDelete(null);
    } catch (e) {
      reportApiError(e, { title: "Não foi possível excluir o cliente" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
    <ListScaffold
      title="Clientes"
      subtitle={`${total} clientes cadastrados`}
      actions={(
        <Link href="/clientes/novo" className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          Novo Cliente
        </Link>
      )}
      filters={(
        <FilterBar>
        <div className="p-4 flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, documento, cidade ou representante..."
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
              className="input-field pl-9"
            />
          </div>
          <button onClick={handleBuscar} className="btn-primary">
            Buscar
          </button>
          {busca && (
            <button
              onClick={() => {
                setBuscaInput("");
                setBusca("");
                setPage(0);
              }}
              className="btn-secondary"
            >
              Limpar
            </button>
          )}
        </div>
        </FilterBar>
      )}
      content={(
        <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableListSkeleton rows={10} cols={freteEnabled ? 6 : 5} />
          </div>
        ) : clientes.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              description={
                busca
                  ? "Tente outro termo (nome, documento, cidade ou representante) ou limpe a busca."
                  : "Cadastre o primeiro cliente para começar."
              }
              action={
                !busca ? (
                  <Link href="/clientes/novo" className="btn-primary">
                    Novo cliente
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="table-scroll">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Razão Social / Fantasia</th>
                <th className="table-header">Documento</th>
                <th className="table-header">Cidade / UF</th>
                <th className="table-header">Representante</th>
                {freteEnabled ? (
                <th className="table-header">Frete padrão (saco / ton)</th>
                ) : null}
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-medium">{c.razaoSocial}</p>
                    {c.nomeFantasia && c.nomeFantasia !== c.razaoSocial && (
                      <p className="text-xs text-gray-400">{c.nomeFantasia}</p>
                    )}
                  </td>
                  <td className="table-cell font-mono text-sm">
                    {formatDocumentoCliente(c)}
                  </td>
                  <td className="table-cell">
                    {c.cidade
                      ? `${c.cidade}${c.estado ? " - " + c.estado : ""}`
                      : "-"}
                  </td>
                  <td className="table-cell text-sm">
                    {c.vendedor?.nome || (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {freteEnabled ? (
                  <td className="table-cell">
                    {formatMoney(c.fretePadraoSaco ?? c.fretePadrao)} / {formatMoney(c.fretePadraoTonelada ?? 0)}
                  </td>
                  ) : null}
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        Ver
                      </Link>
                      <button
                        onClick={() => setClienteToDelete(c)}
                        disabled={deletingId === c.id}
                        className="text-red-600 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === c.id ? "Inativando..." : "Inativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
      )}
      footer={totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE}
          zeroBased noun="cliente" onPageChange={setPage} />
      ) : undefined}
    />
    <ConfirmDialog
        open={!!clienteToDelete}
        title="Inativar cliente"
        description={
          clienteToDelete
            ? `Deseja inativar "${clienteToDelete.nomeFantasia || clienteToDelete.razaoSocial}"?`
            : undefined
        }
        tone="danger"
        busy={deletingId != null}
        confirmText="Inativar"
        onCancel={() => setClienteToDelete(null)}
        onConfirm={() => void confirmarExclusao()}
      />
    </>
  );
}
