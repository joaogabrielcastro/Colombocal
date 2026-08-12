"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { formatMoney, type Produto } from "@/lib/utils";
import api from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListScaffold } from "@/components/ui/list-scaffold";
import { FilterBar } from "@/components/ui/filter-bar";
import { reportApiError } from "@/lib/report-api-error";

function ProdutosPageContent() {
  const searchParams = useSearchParams();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscaInput, setBuscaInput] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"true" | "false" | "all">("true");
  const [editando, setEditando] = useState<null | Produto>(null);
  const [form, setForm] = useState<Partial<Produto>>({});
  const [salvando, setSalvando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [produtoToDelete, setProdutoToDelete] = useState<Produto | null>(null);

  const carregar = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroAtivo === "true" || filtroAtivo === "false") {
      params.set("ativo", filtroAtivo);
    }
    if (busca.trim()) params.set("busca", busca.trim());
    api
      .get<Produto[]>(`/produtos?${params.toString()}`)
      .then(setProdutos)
      .catch((e) => {
        reportApiError(e, {
          title: "Não foi possível carregar os produtos",
          onRetry: () => void carregar(),
        });
        setProdutos([]);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega quando busca/filtro mudam
  }, [busca, filtroAtivo]);

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setMostrarForm(true);
      setEditando(null);
      setForm({ unidade: "ton" });
      setErro("");
    }
  }, [searchParams]);

  const handleBuscar = () => setBusca(buscaInput.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const pesoRaw = form.pesoKg;
      const pesoNum =
        pesoRaw === null || pesoRaw === undefined || String(pesoRaw).trim() === ""
          ? null
          : Number(String(pesoRaw).replace(",", "."));
      const payload = {
        ...form,
        pesoKg: Number.isFinite(pesoNum as number) && (pesoNum as number) > 0 ? pesoNum : null,
      };
      if (editando) {
        await api.put(`/produtos/${editando.id}`, payload);
      } else {
        await api.post("/produtos", payload);
      }
      setMostrarForm(false);
      setEditando(null);
      setForm({});
      carregar();
    } catch (e) {
      reportApiError(e, { title: "Erro ao salvar produto" });
      setErro(e instanceof Error ? e.message : "");
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (p: Produto) => {
    setEditando(p);
    setForm(p);
    setMostrarForm(true);
    setErro("");
  };

  const confirmarExclusao = async () => {
    if (!produtoToDelete) return;
    setDeletingId(produtoToDelete.id);
    try {
      await api.delete(`/produtos/${produtoToDelete.id}`);
      carregar();
      setProdutoToDelete(null);
    } catch (e) {
      reportApiError(e, { title: "Não foi possível excluir o produto" });
    } finally {
      setDeletingId(null);
    }
  };

  const reativarProduto = async (p: Produto) => {
    setDeletingId(p.id);
    try {
      await api.put(`/produtos/${p.id}`, { ...p, ativo: true });
      carregar();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível reativar o produto" });
    } finally {
      setDeletingId(null);
    }
  };

  const set =
    (field: keyof Produto) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <>
      <ListScaffold
        title="Produtos"
        subtitle={`${produtos.length} produto${produtos.length === 1 ? "" : "s"}${busca ? " encontrados" : ""}${
          filtroAtivo === "false" ? " inativos" : filtroAtivo === "all" ? " (todos)" : " ativos"
        } • sem controle de estoque no cadastro`}
        actions={(
          <button
          onClick={() => {
            setMostrarForm(true);
            setEditando(null);
            setForm({ unidade: "ton" });
            setErro("");
          }}
          className="btn-primary"
        >
          <PlusIcon className="w-4 h-4" />
          Novo Produto
          </button>
        )}
        filters={(
          <FilterBar>
            <div className="p-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou código..."
                  value={buscaInput}
                  onChange={(e) => setBuscaInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                  className="input-field pl-9"
                />
              </div>
              <select
                className="input-field sm:w-40"
                value={filtroAtivo}
                onChange={(e) =>
                  setFiltroAtivo(e.target.value as "true" | "false" | "all")
                }
                aria-label="Filtrar por situação"
              >
                <option value="true">Ativos</option>
                <option value="false">Inativos</option>
                <option value="all">Todos</option>
              </select>
              <button type="button" onClick={handleBuscar} className="btn-primary">
                Buscar
              </button>
              {busca ? (
                <button
                  type="button"
                  onClick={() => {
                    setBuscaInput("");
                    setBusca("");
                  }}
                  className="btn-secondary"
                >
                  Limpar
                </button>
              ) : null}
            </div>
          </FilterBar>
        )}
        content={(
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-4">
                <TableListSkeleton rows={8} cols={4} />
              </div>
            ) : produtos.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={
                    busca
                      ? "Nenhum produto encontrado"
                      : filtroAtivo === "false"
                        ? "Nenhum produto inativo"
                        : "Nenhum produto ativo"
                  }
                  description={
                    busca
                      ? "Tente outro nome ou código, ou limpe a busca."
                      : "Cadastre produtos para usar nas vendas."
                  }
                  action={
                    !busca && filtroAtivo === "true" ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          setMostrarForm(true);
                          setEditando(null);
                          setForm({ unidade: "ton" });
                        }}
                      >
                        Novo produto
                      </button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="table-header">Produto</th>
                    <th className="table-header">Unidade</th>
                    <th className="table-header">Preço Padrão</th>
                    <th className="table-header">Situação</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => (
                    <tr key={p.id} className="table-row">
                      <td className="table-cell font-medium">{p.nome}</td>
                      <td className="table-cell">{p.unidade}</td>
                      <td className="table-cell">{formatMoney(p.precoPadrao)}</td>
                      <td className="table-cell">
                        {p.ativo === false ? (
                          <span className="text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                            Inativo
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-green-800 bg-green-50 px-2 py-0.5 rounded">
                            Ativo
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEditar(p)}
                            className="text-blue-600 hover:underline text-sm font-medium"
                          >
                            Editar
                          </button>
                          {p.ativo === false ? (
                            <button
                              onClick={() => void reativarProduto(p)}
                              disabled={deletingId === p.id}
                              className="text-green-700 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingId === p.id ? "Reativando..." : "Reativar"}
                            </button>
                          ) : (
                            <button
                              onClick={() => setProdutoToDelete(p)}
                              disabled={deletingId === p.id}
                              className="text-red-600 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingId === p.id ? "Inativando..." : "Inativar"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      />

      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                {editando ? "Editar Produto" : "Novo Produto"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5">
              {erro && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erro}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome *
                  </label>
                  <input
                    required
                    value={form.nome || ""}
                    onChange={set("nome")}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidade
                  </label>
                  <select
                    value={form.unidade || "ton"}
                    onChange={set("unidade")}
                    className="input-field"
                  >
                    <option value="ton">Tonelada (ton)</option>
                    <option value="saco">Saco</option>
                    <option value="kg">Kg</option>
                    <option value="m3">M³</option>
                    <option value="un">Unidade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Peso por unidade (kg)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.pesoKg ?? ""}
                    onChange={set("pesoKg")}
                    className="input-field"
                    placeholder="Ex.: 8 (cal de pintura)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se preenchido, o frete usa quantidade × peso × tarifa/ton.
                    Deixe vazio para frete normal (saco/ton/kg).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço Padrão (R$) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precoPadrao || ""}
                    onChange={set("precoPadrao")}
                    className="input-field"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button type="submit" disabled={salvando} className="btn-primary">
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

      <ConfirmDialog
        open={!!produtoToDelete}
        title="Inativar produto"
        description={
          produtoToDelete
            ? `Inativar "${produtoToDelete.nome}"? Ele deixará de aparecer nas vendas.`
            : undefined
        }
        tone="danger"
        busy={deletingId != null}
        confirmText="Inativar"
        onCancel={() => setProdutoToDelete(null)}
        onConfirm={() => void confirmarExclusao()}
      />
    </>
  );
}

export default function ProdutosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <TableListSkeleton rows={8} cols={4} />
        </div>
      }
    >
      <ProdutosPageContent />
    </Suspense>
  );
}
