"use client";
import { useEffect, useState } from "react";
import { formatDate, formatMoney, type Cliente } from "@/lib/utils";
import api from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";

interface EventoFinanceiro {
  id: number;
  tipo: string;
  entidade: string;
  entidadeId?: number | null;
  clienteId?: number | null;
  vendaId?: number | null;
  chequeId?: number | null;
  pagamentoId?: number | null;
  tituloId?: number | null;
  valor?: number | null;
  payload?: any;
  createdAt: string;
}

interface ResumoTipo {
  tipo: string;
  quantidade: number;
  valorTotal: number;
}

interface EventosResponse {
  eventos: EventoFinanceiro[];
  resumoPorTipo: ResumoTipo[];
  total: number;
}

export default function AuditoriaFinanceiraPage() {
  const [dados, setDados] = useState<EventosResponse | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [tipo, setTipo] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [vendaId, setVendaId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const carregar = async () => {
    try {
      setLoading(true);
      setErro("");
      const params = new URLSearchParams();
      if (tipo) params.set("tipo", tipo);
      if (clienteId) params.set("clienteId", clienteId);
      if (vendaId) params.set("vendaId", vendaId);
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      params.set("take", String(pageSize));
      params.set("skip", String((page - 1) * pageSize));
      const res = await api.get<EventosResponse>(
        `/relatorios/eventos-financeiros?${params.toString()}`,
      );
      setDados(res);
    } catch (e: any) {
      setErro(e.message);
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .get<{ clientes: Cliente[] }>("/clientes?ativo=true&take=500")
      .then((r) => setClientes(r.clientes))
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregar();
  }, [tipo, clienteId, vendaId, dataInicio, dataFim, page]);

  const total = dados?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Auditoria Financeira</h1>
        <p className="text-gray-500 text-sm mt-1">
          Histórico de eventos de venda, cheque, pagamento e recebíveis
        </p>
      </div>

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <input
              value={tipo}
              onChange={(e) => {
                setPage(1);
                setTipo(e.target.value);
              }}
              className="input-field"
              placeholder="Ex.: VENDA_CRIADA"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => {
                setPage(1);
                setClienteId(e.target.value);
              }}
              className="input-field"
            >
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia || c.razaoSocial}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Venda #</label>
            <input
              value={vendaId}
              onChange={(e) => {
                setPage(1);
                setVendaId(e.target.value);
              }}
              className="input-field"
              placeholder="ID da venda"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">De</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setPage(1);
                setDataInicio(e.target.value);
              }}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Até</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setPage(1);
                setDataFim(e.target.value);
              }}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {erro && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{erro}</div>}

      {dados && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">Eventos</p>
            <p className="font-bold">{dados.total}</p>
          </div>
          {dados.resumoPorTipo.slice(0, 3).map((r) => (
            <div key={r.tipo} className="card p-3 text-center">
              <p className="text-xs text-gray-500">{r.tipo}</p>
              <p className="font-bold">{r.quantidade}</p>
              <p className="text-xs text-gray-500">{formatMoney(r.valorTotal)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableListSkeleton rows={12} cols={5} />
          </div>
        ) : !dados || dados.eventos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum evento encontrado</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Quando</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Entidade</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Venda</th>
                <th className="table-header text-right">Valor</th>
                <th className="table-header">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {dados.eventos.map((e) => (
                <tr key={e.id} className="table-row">
                  <td className="table-cell">{formatDate(e.createdAt)}</td>
                  <td className="table-cell font-mono text-xs">{e.tipo}</td>
                  <td className="table-cell">
                    {e.entidade} {e.entidadeId ? `#${e.entidadeId}` : ""}
                  </td>
                  <td className="table-cell">{e.clienteId || "-"}</td>
                  <td className="table-cell">{e.vendaId ? `#${e.vendaId}` : "-"}</td>
                  <td className="table-cell text-right">
                    {e.valor != null ? formatMoney(e.valor) : "-"}
                  </td>
                  <td className="table-cell text-xs text-gray-500">
                    {e.payload ? JSON.stringify(e.payload).slice(0, 140) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <p>Total de registros: {total}</p>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
