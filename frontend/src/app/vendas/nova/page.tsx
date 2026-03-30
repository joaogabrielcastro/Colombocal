"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  formatMoney,
  type Cliente,
  type Produto,
  type Vendedor,
  type Motorista,
} from "@/lib/utils";
import api from "@/lib/api";
import { FreteOrientacaoPainel } from "@/components/FreteOrientacao";
import { FormPageSkeleton } from "@/components/ui/skeletons";
import SearchableSelect from "@/components/SearchableSelect";

interface ItemForm {
  produtoId: string;
  quantidade: string;
  precoUnitario: string;
}

interface ProdutoPreco extends Produto {
  precoEspecial: number | null;
  precoAplicado: number;
}

export default function NovaVendaPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <NovaVendaForm />
    </Suspense>
  );
}

function NovaVendaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteIdFromQuery = searchParams.get("clienteId");

  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  const [vendedorId, setVendedorId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [clienteId, setClienteId] = useState(clienteIdFromQuery || "");
  const clienteIdRef = useRef(clienteId);
  clienteIdRef.current = clienteId;
  const [frete, setFrete] = useState("");
  const [dataVenda, setDataVenda] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([
    { produtoId: "", quantidade: "", precoUnitario: "" },
  ]);

  const [freteRecibo, setFreteRecibo] = useState(false);
  const [freteReciboNum, setFreteReciboNum] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api.get<Vendedor[]>("/vendedores?take=1").then((arr) => {
      if (arr.length > 0) {
        setVendedorId((v) => v || String(arr[0].id));
      }
    });
  }, []);

  useEffect(() => {
    if (clienteIdFromQuery) setClienteId(clienteIdFromQuery);
  }, [clienteIdFromQuery]);

  useEffect(() => {
    if (!clienteId) {
      setSelectedCliente(null);
      return;
    }
    let cancelled = false;
    api
      .get<Cliente>(`/clientes/${clienteId}`)
      .then((cli) => {
        if (cancelled) return;
        setSelectedCliente(cli);
        setFrete((prev) => (!prev ? String(cli.fretePadrao ?? 0) : prev));
        if (cli.vendedorId) setVendedorId(String(cli.vendedorId));
      })
      .catch(() => {
        if (!cancelled) setSelectedCliente(null);
      });
    setItens((prev) =>
      prev.map((i) => ({ ...i, produtoId: "", precoUnitario: "" })),
    );
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  const loadClienteOptions = useCallback(async (q: string) => {
    const p = new URLSearchParams({
      ativo: "true",
      busca: q,
      take: "40",
    });
    const r = await api.get<{ clientes: Cliente[] }>(`/clientes?${p}`);
    return r.clientes.map((c) => ({
      id: c.id,
      label: (c.nomeFantasia?.trim() || c.razaoSocial) as string,
    }));
  }, []);

  const loadClienteLabel = useCallback(async (id: string) => {
    const c = await api.get<Cliente>(`/clientes/${id}`);
    return (c.nomeFantasia?.trim() || c.razaoSocial) ?? null;
  }, []);

  const loadVendedorOptions = useCallback(async (q: string) => {
    const p = new URLSearchParams({ take: "80" });
    if (q.trim()) p.set("busca", q.trim());
    const r = await api.get<Vendedor[]>(`/vendedores?${p}`);
    return r.map((v) => ({ id: v.id, label: v.nome }));
  }, []);

  const loadVendedorLabel = useCallback(async (id: string) => {
    try {
      const v = await api.get<Vendedor>(`/vendedores/${id}`);
      return v.nome;
    } catch {
      return null;
    }
  }, []);

  const loadMotoristaOptions = useCallback(async (q: string) => {
    const p = new URLSearchParams({ take: "80" });
    if (q.trim()) p.set("busca", q.trim());
    const r = await api.get<Motorista[]>(`/motoristas?${p}`);
    return r.map((m) => ({ id: m.id, label: m.nome }));
  }, []);

  const loadProdutoOptions = useCallback(
    async (q: string) => {
      const p = new URLSearchParams({ ativo: "true", take: "40" });
      if (q.trim()) p.set("busca", q.trim());
      if (clienteId) {
        const list = await api.get<ProdutoPreco[]>(
          `/clientes/${clienteId}/precos?${p}`,
        );
        return list.map((pr) => ({
          id: pr.id,
          label: `${pr.nome} (${pr.unidade})`,
        }));
      }
      const list = await api.get<Produto[]>(`/produtos?${p}`);
      return list.map((pr) => ({
        id: pr.id,
        label: `${pr.nome} (${pr.unidade})`,
      }));
    },
    [clienteId],
  );

  const loadProdutoLabelById = useCallback(
    async (id: string) => {
      try {
        if (clienteId) {
          const rows = await api.get<ProdutoPreco[]>(
            `/clientes/${clienteId}/precos?produtoId=${id}`,
          );
          const pr = rows[0];
          return pr ? `${pr.nome} (${pr.unidade})` : null;
        }
        const pr = await api.get<Produto>(`/produtos/${id}`);
        return `${pr.nome} (${pr.unidade})`;
      } catch {
        return null;
      }
    },
    [clienteId],
  );

  const parsePrecoApi = (v: unknown) => {
    const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? String(n) : "";
  };

  const handleProdutoChange = async (idx: number, produtoId: string) => {
    const cidSnapshot = clienteIdRef.current;
    if (!produtoId) {
      setItens((prev) =>
        prev.map((item, i) =>
          i === idx ? { ...item, produtoId: "", precoUnitario: "" } : item,
        ),
      );
      return;
    }

    let preco = "";
    if (cidSnapshot) {
      try {
        const rows = await api.get<ProdutoPreco[]>(
          `/clientes/${cidSnapshot}/precos?produtoId=${encodeURIComponent(produtoId)}`,
        );
        if (clienteIdRef.current !== cidSnapshot) return;
        const pc = rows[0];
        if (pc) preco = parsePrecoApi(pc.precoAplicado);
      } catch {
        if (clienteIdRef.current !== cidSnapshot) return;
      }
    } else {
      try {
        const p = await api.get<Produto>(`/produtos/${produtoId}`);
        if (clienteIdRef.current !== "") return;
        preco = parsePrecoApi(p.precoPadrao);
      } catch {
        if (clienteIdRef.current !== "") return;
      }
    }

    if (cidSnapshot && clienteIdRef.current !== cidSnapshot) return;

    setItens((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, produtoId, precoUnitario: preco } : item,
      ),
    );
  };

  const addItem = () =>
    setItens((prev) => [
      ...prev,
      { produtoId: "", quantidade: "", precoUnitario: "" },
    ]);
  const removeItem = (idx: number) =>
    setItens((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = itens.reduce((acc, item) => {
    const q = parseFloat(item.quantidade || "0");
    const p = parseFloat(item.precoUnitario || "0");
    return acc + q * p;
  }, 0);
  const freteVal = parseFloat(frete || "0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !vendedorId) {
      setErro("Selecione cliente e vendedor");
      return;
    }
    const itensValidos = itens.filter(
      (i) => i.produtoId && i.quantidade && i.precoUnitario,
    );
    if (itensValidos.length === 0) {
      setErro("Adicione pelo menos um produto");
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      const venda = await api.post<{ id: number }>("/vendas", {
        clienteId,
        vendedorId,
        motoristaId: motoristaId || undefined,
        frete: freteVal,
        freteRecibo,
        freteReciboNum: freteRecibo ? freteReciboNum : undefined,
        dataVenda,
        observacoes,
        itens: itensValidos,
      });
      router.push(`/vendas/${venda.id}`);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar");
      setSalvando(false);
    }
  };

  const cli = selectedCliente;
  const com =
    cli?.comissaoFixaPercentual != null
      ? cli.comissaoFixaPercentual
      : cli?.vendedor?.comissaoPercentual;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/vendas" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nova Venda</h1>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Dados da Venda</h2>
          {cli != null && com != null && (
            <p className="text-sm text-gray-600 mb-3">
              Comissão aplicável neste cliente:{" "}
              <span className="font-semibold text-gray-900">
                {Number(com).toLocaleString("pt-BR")}%
              </span>
              {cli.comissaoFixaPercentual == null &&
                cli.vendedor &&
                " (padrão do vendedor)"}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SearchableSelect
              label="Cliente"
              value={clienteId}
              onChange={setClienteId}
              loadOptions={loadClienteOptions}
              loadLabelById={loadClienteLabel}
              minChars={2}
              placeholder="Nome, fantasia, CNPJ ou cidade…"
            />
            <SearchableSelect
              label="Vendedor"
              value={vendedorId}
              onChange={setVendedorId}
              loadOptions={loadVendedorOptions}
              loadLabelById={loadVendedorLabel}
              minChars={0}
              placeholder="Digite para buscar vendedor…"
            />
            <SearchableSelect
              label="Motorista"
              value={motoristaId}
              onChange={setMotoristaId}
              loadOptions={loadMotoristaOptions}
              minChars={0}
              placeholder="Nome do motorista (opcional)…"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data da Venda
              </label>
              <input
                type="date"
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frete (R$) — cobrado à parte
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                className="input-field"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recibo de Frete
              </label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freteRecibo}
                  onChange={(e) => setFreteRecibo(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700">
                  Emitir recibo de frete
                </span>
              </label>
              {freteRecibo && (
                <input
                  type="text"
                  placeholder="Número do recibo"
                  value={freteReciboNum}
                  onChange={(e) => setFreteReciboNum(e.target.value)}
                  className="input-field mt-2"
                />
              )}
            </div>
            <div className="col-span-full">
              <FreteOrientacaoPainel variant="compact" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Produtos</h2>
            <button
              type="button"
              onClick={addItem}
              className="btn-secondary text-xs py-1.5"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Adicionar produto
            </button>
          </div>
          {!clienteId && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              Selecione um cliente para aplicar tabela de preços do cliente; até
              lá, a busca usa preço padrão do produto.
            </p>
          )}

          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Produto</th>
                <th className="table-header w-32">Quantidade</th>
                <th className="table-header w-36">Preço Unit. (R$)</th>
                <th className="table-header w-32">Subtotal</th>
                <th className="table-header w-10"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => {
                const sub =
                  parseFloat(item.quantidade || "0") *
                  parseFloat(item.precoUnitario || "0");
                return (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="py-2 pr-3 min-w-[12rem]">
                      <SearchableSelect
                        label="Produto"
                        hideLabel
                        value={item.produtoId}
                        onChange={(id) => void handleProdutoChange(idx, id)}
                        loadOptions={loadProdutoOptions}
                        loadLabelById={loadProdutoLabelById}
                        minChars={2}
                        placeholder="Buscar produto…"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="0"
                        value={item.quantidade}
                        onChange={(e) =>
                          setItens((prev) =>
                            prev.map((it, i) =>
                              i === idx
                                ? { ...it, quantidade: e.target.value }
                                : it,
                            ),
                          )
                        }
                        className="input-field text-sm"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={item.precoUnitario}
                        onChange={(e) =>
                          setItens((prev) =>
                            prev.map((it, i) =>
                              i === idx
                                ? { ...it, precoUnitario: e.target.value }
                                : it,
                            ),
                          )
                        }
                        className="input-field text-sm"
                      />
                    </td>
                    <td className="py-2 pr-3 font-medium text-sm">
                      {formatMoney(sub)}
                    </td>
                    <td className="py-2">
                      {itens.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between font-bold text-gray-900 border-b pb-2 mb-1">
                <span>Total Produtos:</span>
                <span className="text-green-700 text-lg">
                  {formatMoney(subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Frete (cobrado à parte):</span>
                <span className="font-medium">{formatMoney(freteVal)}</span>
              </div>
              {freteRecibo && (
                <div className="text-xs text-blue-600 text-right">
                  Recibo de frete{freteReciboNum ? `: ${freteReciboNum}` : ""}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={salvando} className="btn-primary">
            {salvando ? "Registrando..." : "Registrar Venda"}
          </button>
          <Link href="/vendas" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
