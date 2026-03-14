"use client";
import { useEffect, useState } from "react";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { formatDate, type Produto } from "@/lib/utils";
import api from "@/lib/api";

interface Movimentacao {
  id: number;
  produtoId: number;
  tipo: string;
  quantidade: number;
  data: string;
  observacao?: string;
  produto: Produto;
  venda?: {
    id: number;
    cliente: { razaoSocial: string; nomeFantasia?: string };
  };
}

const TIPO_COLOR: Record<string, string> = {
  entrada: "bg-green-100 text-green-800",
  saida: "bg-red-100 text-red-800",
  ajuste: "bg-blue-100 text-blue-800",
  devolucao: "bg-yellow-100 text-yellow-800",
};
const TIPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  devolucao: "Devolução",
};

export default function EstoquePage() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [produtoFiltro, setProdutoFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [form, setForm] = useState({
    produtoId: "",
    tipo: "entrada",
    quantidade: "",
    observacao: "",
    data: new Date().toISOString().split("T")[0],
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = () => {
    const params = new URLSearchParams();
    if (produtoFiltro) params.set("produtoId", produtoFiltro);
    if (tipoFiltro) params.set("tipo", tipoFiltro);
    setLoading(true);
    api
      .get<Movimentacao[]>(`/estoque?${params}`)
      .then(setMovimentacoes)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
    api.get<Produto[]>("/produtos?ativo=true").then(setProdutos);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await api.post("/estoque", form);
      setMostrarForm(false);
      setForm({
        produtoId: "",
        tipo: "entrada",
        quantidade: "",
        observacao: "",
        data: new Date().toISOString().split("T")[0],
      });
      carregar();
      // Recarregar produtos para estoques atualizados
      api.get<Produto[]>("/produtos?ativo=true").then(setProdutos);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">
            Movimentações e saldos de produtos
          </p>
        </div>
        <button
          onClick={() => {
            setMostrarForm(true);
            setErro("");
          }}
          className="btn-primary"
        >
          <PlusIcon className="w-4 h-4" /> Registrar Movimentação
        </button>
      </div>

      {/* Saldo produtos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {produtos.map((p) => {
          const baixo =
            parseFloat(String(p.estoqueAtual)) <=
            parseFloat(String(p.estoqueMinimo));
          return (
            <div
              key={p.id}
              className={`card p-3 border-l-4 ${baixo ? "border-l-red-500" : "border-l-green-500"}`}
            >
              <p className="text-xs text-gray-500 font-medium truncate">
                {p.nome}
              </p>
              <p
                className={`text-lg font-bold mt-1 ${baixo ? "text-red-600" : "text-green-700"}`}
              >
                {parseFloat(String(p.estoqueAtual)).toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-gray-400">
                {p.unidade} • mín:{" "}
                {parseFloat(String(p.estoqueMinimo)).toLocaleString("pt-BR")}
              </p>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold">Registrar Movimentação</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erro}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produto *
                </label>
                <select
                  required
                  value={form.produtoId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, produtoId: e.target.value }))
                  }
                  className="input-field"
                >
                  <option value="">Selecione</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                {form.produtoId &&
                  form.tipo === "saida" &&
                  (() => {
                    const prod = produtos.find(
                      (p) => String(p.id) === form.produtoId,
                    );
                    if (!prod) return null;
                    const insuf =
                      parseFloat(form.quantidade || "0") >
                      parseFloat(String(prod.estoqueAtual));
                    return (
                      <p
                        className={`text-xs mt-1 ${insuf ? "text-red-600 font-medium" : "text-gray-400"}`}
                      >
                        Disponível:{" "}
                        {parseFloat(String(prod.estoqueAtual)).toLocaleString(
                          "pt-BR",
                        )}{" "}
                        {prod.unidade}
                      </p>
                    );
                  })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo: e.target.value }))
                  }
                  className="input-field"
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída manual</option>
                  <option value="ajuste">Ajuste (novo total)</option>
                  <option value="devolucao">Devolução</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.tipo === "ajuste"
                      ? "Novo Estoque Total"
                      : "Quantidade"}
                  </label>
                  <input
                    required
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.quantidade}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, quantidade: e.target.value }))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, data: e.target.value }))
                    }
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observação
                </label>
                <input
                  value={form.observacao}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, observacao: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={salvando}
                  className="btn-primary"
                >
                  {salvando ? "Salvando..." : "Registrar"}
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Produto</label>
            <select
              value={produtoFiltro}
              onChange={(e) => setProdutoFiltro(e.target.value)}
              className="input-field w-52"
            >
              <option value="">Todos</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="input-field w-36"
            >
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste</option>
              <option value="devolucao">Devolução</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={carregar} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" /> Filtrar
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : movimentacoes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nenhuma movimentação encontrada
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Data</th>
                <th className="table-header">Produto</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Quantidade</th>
                <th className="table-header">Referência</th>
                <th className="table-header">Observação</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((m) => (
                <tr key={m.id} className="table-row">
                  <td className="table-cell">{formatDate(m.data)}</td>
                  <td className="table-cell font-medium">{m.produto.nome}</td>
                  <td className="table-cell">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${TIPO_COLOR[m.tipo]}`}
                    >
                      {TIPO_LABEL[m.tipo]}
                    </span>
                  </td>
                  <td className="table-cell font-medium">
                    {["saida"].includes(m.tipo) ? "-" : "+"}
                    {parseFloat(String(m.quantidade)).toLocaleString(
                      "pt-BR",
                    )}{" "}
                    {m.produto.unidade}
                  </td>
                  <td className="table-cell">
                    {m.venda ? (
                      <span className="text-blue-600 text-sm">
                        Venda #{m.venda.id} -{" "}
                        {m.venda.cliente.nomeFantasia ||
                          m.venda.cliente.razaoSocial}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="table-cell text-gray-500">
                    {m.observacao || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
