"use client";
import { useCallback, useEffect, useState } from "react";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { type Vendedor } from "@/lib/utils";
import api from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { reportApiError } from "@/lib/report-api-error";

export default function VendedoresPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<null | Vendedor>(null);
  const [form, setForm] = useState<Partial<Vendedor>>({});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (termo: string) => {
    setLoading(true);
    const params = new URLSearchParams({ take: "500" });
    const t = termo.trim();
    if (t) params.set("busca", t);
    try {
      const data = await api.get<Vendedor[]>(`/vendedores?${params}`);
      setVendedores(data);
    } catch (e) {
      reportApiError(e, {
        title: "Não foi possível carregar vendedores",
        onRetry: () => void carregar(termo),
      });
      setVendedores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (buscaInput === "") {
      setBusca("");
      return;
    }
    const id = setTimeout(() => setBusca(buscaInput), 320);
    return () => clearTimeout(id);
  }, [buscaInput]);

  useEffect(() => {
    void carregar(busca);
  }, [busca, carregar]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (editando) {
        await api.put(`/vendedores/${editando.id}`, form);
      } else {
        await api.post("/vendedores", form);
      }
      setMostrarForm(false);
      setEditando(null);
      setForm({});
      void carregar(busca);
    } catch (e) {
      reportApiError(e, { title: "Erro ao salvar vendedor" });
      setErro(e instanceof Error ? e.message : "");
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (v: Vendedor) => {
    setEditando(v);
    setForm(v);
    setMostrarForm(true);
    setErro("");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendedores</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestão de vendedores e comissão padrão
          </p>
        </div>
        <button
          onClick={() => {
            setMostrarForm(true);
            setEditando(null);
            setForm({ comissaoPercentual: 0 });
            setErro("");
          }}
          className="btn-primary"
        >
          <PlusIcon className="w-4 h-4" /> Novo Vendedor
        </button>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[16rem] flex-1 max-w-md">
          <label className="block text-xs text-gray-500 mb-1">Buscar vendedor</label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              placeholder="Nome…"
              autoComplete="off"
              className="input-field pl-9"
            />
          </div>
        </div>
        <p className="text-sm text-gray-500 pb-2">
          {busca.trim()
            ? `${vendedores.length} resultado${vendedores.length === 1 ? "" : "s"}`
            : `${vendedores.length} vendedores ativos`}
        </p>
      </div>

      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold">
                {editando ? "Editar Vendedor" : "Novo Vendedor"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erro}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  required
                  value={form.nome || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nome: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  value={form.telefone || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, telefone: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comissão (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={
                    form.comissaoPercentual !== undefined &&
                    !isNaN(form.comissaoPercentual)
                      ? form.comissaoPercentual
                      : ""
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setForm((p) => ({
                      ...p,
                      comissaoPercentual: isNaN(val) ? 0 : val,
                    }));
                  }}
                  className="input-field"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={salvando}
                  className="btn-primary"
                >
                  {salvando ? "Salvando..." : "Salvar"}
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

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableListSkeleton rows={6} cols={4} />
          </div>
        ) : vendedores.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={busca.trim() ? "Nenhum vendedor encontrado" : "Nenhum vendedor cadastrado"}
              description={
                busca.trim()
                  ? "Tente outro termo ou limpe a busca."
                  : "Cadastre vendedores para registrar vendas e comissões."
              }
            />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Nome</th>
                <th className="table-header">Telefone</th>
                <th className="table-header">Comissão</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr key={v.id} className="table-row">
                  <td className="table-cell font-medium">{v.nome}</td>
                  <td className="table-cell">{v.telefone || "-"}</td>
                  <td className="table-cell">
                    {parseFloat(String(v.comissaoPercentual)).toFixed(2)}%
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => handleEditar(v)}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      Editar
                    </button>
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
