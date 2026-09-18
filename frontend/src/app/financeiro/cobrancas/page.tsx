"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { formatMoney, formatDate, type CobrancaBancaria } from "@/lib/utils";
import { ListPageSkeleton } from "@/components/ui/skeletons";
import { FilterBar } from "@/components/ui/filter-bar";
import { ListScaffold } from "@/components/ui/list-scaffold";
import { reportApiError } from "@/lib/report-api-error";
import { toast } from "sonner";

function statusLabel(s: string) {
  const map: Record<string, string> = {
    PENDENTE: "Pendente",
    PROCESSANDO: "Processando",
    REGISTRADA: "Registrada",
    DISPONIVEL: "Disponível",
    ERRO: "Erro",
    CANCELADA: "Cancelada",
  };
  return map[s] || s;
}

function CobrancasPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const pageSize = 30;
  const [page, setPage] = useState(1);
  const [dataInicio, setDataInicio] = useState(searchParams.get("dataInicio") || "");
  const [dataFim, setDataFim] = useState(searchParams.get("dataFim") || "");
  const [banco, setBanco] = useState(searchParams.get("banco") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [clienteId, setClienteId] = useState(searchParams.get("clienteId") || "");
  const [vendaId, setVendaId] = useState(searchParams.get("vendaId") || "");
  const [detalhe, setDetalhe] = useState<CobrancaBancaria | null>(null);
  const [registrando, setRegistrando] = useState<number | null>(null);

  const query = useQuery({
    queryKey: [
      "cobrancas",
      page,
      dataInicio,
      dataFim,
      banco,
      status,
      clienteId,
      vendaId,
    ],
    queryFn: async () => {
      const p = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (dataInicio) p.set("dataInicio", dataInicio);
      if (dataFim) p.set("dataFim", dataFim);
      if (banco) p.set("banco", banco);
      if (status) p.set("status", status);
      if (clienteId) p.set("clienteId", clienteId);
      if (vendaId) p.set("vendaId", vendaId);
      return api.get<CobrancaBancaria[]>(`/cobrancas?${p}`);
    },
  });

  const rows = query.data || [];

  const retry = async (id: number) => {
    setRegistrando(id);
    try {
      await api.post(`/cobrancas/${id}/registrar`, {});
      toast.success("Registro de cobrança solicitado");
      await queryClient.invalidateQueries({ queryKey: ["cobrancas"] });
    } catch (e) {
      reportApiError(e, { title: "Falha ao registrar cobrança" });
    } finally {
      setRegistrando(null);
    }
  };

  const abrirBoleto = async (id: number) => {
    try {
      const { blob } = await api.getBlob(`/cobrancas/${id}/boleto`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      reportApiError(e, { title: "Boleto indisponível" });
    }
  };

  return (
    <ListScaffold
      title="Cobranças / Boletos"
      description="Acompanhe boletos Bradesco e Sicredi vinculados aos títulos."
      actions={
        <Link href="/financeiro" className="btn-secondary">
          Voltar ao financeiro
        </Link>
      }
    >
      <FilterBar
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void query.refetch();
        }}
      >
        <input
          type="date"
          className="input-field"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          title="Vencimento de"
        />
        <input
          type="date"
          className="input-field"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          title="Vencimento até"
        />
        <select
          className="input-field"
          value={banco}
          onChange={(e) => setBanco(e.target.value)}
        >
          <option value="">Todos os bancos</option>
          <option value="BRADESCO">Bradesco</option>
          <option value="SICREDI">Sicredi</option>
        </select>
        <select
          className="input-field"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="PROCESSANDO">Processando</option>
          <option value="REGISTRADA">Registrada</option>
          <option value="DISPONIVEL">Disponível</option>
          <option value="ERRO">Erro</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <input
          className="input-field"
          placeholder="Cliente ID"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
        />
        <input
          className="input-field"
          placeholder="Venda ID"
          value={vendaId}
          onChange={(e) => setVendaId(e.target.value)}
        />
        <button type="submit" className="btn-primary inline-flex items-center gap-1">
          <MagnifyingGlassIcon className="w-4 h-4" />
          Filtrar
        </button>
      </FilterBar>

      {query.isLoading ? (
        <ListPageSkeleton />
      ) : (
        <div className="overflow-x-auto card">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Venda</th>
                <th className="px-3 py-2">Parcela</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Banco</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    {c.cliente?.razaoSocial || `#${c.clienteId}`}
                  </td>
                  <td className="px-3 py-2">
                    {c.vendaId ? (
                      <Link
                        href={`/vendas/${c.vendaId}`}
                        className="text-blue-600 hover:underline"
                      >
                        #{c.venda?.numeroVenda ?? c.vendaId}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.titulo?.parcelaNumero && c.titulo?.parcelaTotal
                      ? `${c.titulo.parcelaNumero}/${c.titulo.parcelaTotal}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{formatDate(c.vencimento)}</td>
                  <td className="px-3 py-2">{formatMoney(c.valor)}</td>
                  <td className="px-3 py-2">{c.banco}</td>
                  <td className="px-3 py-2">{statusLabel(c.status)}</td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => setDetalhe(c)}
                    >
                      Detalhe
                    </button>
                    {(c.status === "ERRO" || c.status === "PENDENTE") && (
                      <button
                        type="button"
                        className="text-amber-700 hover:underline"
                        disabled={registrando === c.id}
                        onClick={() => void retry(c.id)}
                      >
                        {registrando === c.id ? "…" : "Retry"}
                      </button>
                    )}
                    {(c.status === "DISPONIVEL" || c.status === "REGISTRADA") &&
                      c.temPdf && (
                        <button
                          type="button"
                          className="text-green-700 hover:underline"
                          onClick={() => abrirBoleto(c.id)}
                        >
                          Boleto
                        </button>
                      )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Nenhuma cobrança encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={rows.length < pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </div>

      {detalhe && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-2">
            <h2 className="text-lg font-semibold">Cobrança #{detalhe.id}</h2>
            <p>
              <span className="text-gray-500">Status:</span>{" "}
              {statusLabel(detalhe.status)}
            </p>
            <p>
              <span className="text-gray-500">Banco:</span> {detalhe.banco}
            </p>
            <p>
              <span className="text-gray-500">Nosso número:</span>{" "}
              {detalhe.nossoNumero || "—"}
            </p>
            <p className="break-all">
              <span className="text-gray-500">Linha digitável:</span>{" "}
              {detalhe.linhaDigitavel || "—"}
            </p>
            <p className="break-all">
              <span className="text-gray-500">Código de barras:</span>{" "}
              {detalhe.codigoBarras || "—"}
            </p>
            <p>
              <span className="text-gray-500">Ref. externa:</span>{" "}
              {detalhe.refExterna || "—"}
            </p>
            {detalhe.ultimoErro && (
              <p className="text-red-700 text-sm">{detalhe.ultimoErro}</p>
            )}
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDetalhe(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </ListScaffold>
  );
}

export default function CobrancasPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CobrancasPageContent />
    </Suspense>
  );
}
