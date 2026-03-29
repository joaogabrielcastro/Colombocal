"use client";
import { Suspense, useEffect, useState } from "react";
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
  const preClienteId = searchParams.get("clienteId");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosCliente, setProdutosCliente] = useState<ProdutoPreco[]>([]);

  const [clienteId, setClienteId] = useState(preClienteId || "");
  const [vendedorId, setVendedorId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
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
    Promise.all([
      api.get<{ clientes: Cliente[] }>("/clientes?ativo=true"),
      api.get<Vendedor[]>("/vendedores"),
      api.get<Motorista[]>("/motoristas"),
      api.get<Produto[]>("/produtos?ativo=true"),
    ]).then(([c, v, m, p]) => {
      setClientes(c.clientes);
      setVendedores(v);
      setMotoristas(m);
      setProdutos(p);
      if (v.length > 0) setVendedorId(String(v[0].id));
    });
  }, []);

  // Quando o cliente muda, buscar os preços especiais e vendedor padrão
  useEffect(() => {
    if (!clienteId) {
      setProdutosCliente([]);
      return;
    }
    api.get<ProdutoPreco[]>(`/clientes/${clienteId}/precos`).then((data) => {
      setProdutosCliente(data);
      setItens((prev) =>
        prev.map((item) => {
          if (!item.produtoId) return item;
          const pc = data.find((p) => String(p.id) === item.produtoId);
          if (pc) return { ...item, precoUnitario: String(pc.precoAplicado) };
          return item;
        }),
      );
      const cliente = clientes.find((c) => String(c.id) === clienteId);
      if (cliente && !frete) setFrete(String(cliente.fretePadrao));
      if (cliente?.vendedorId) setVendedorId(String(cliente.vendedorId));
    });
  }, [clienteId]);

  const handleProdutoChange = (idx: number, produtoId: string) => {
    const pc = produtosCliente.find((p) => String(p.id) === produtoId);
    const preco = pc ? String(pc.precoAplicado) : "";
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
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  };

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
        {/* Dados da venda */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Dados da Venda</h2>
          {clienteId &&
            (() => {
              const cli = clientes.find((c) => String(c.id) === clienteId);
              const com =
                cli?.comissaoFixaPercentual != null
                  ? cli.comissaoFixaPercentual
                  : cli?.vendedor?.comissaoPercentual;
              return com != null ? (
                <p className="text-sm text-gray-600 mb-3">
                  Comissão aplicável neste cliente:{" "}
                  <span className="font-semibold text-gray-900">
                    {Number(com).toLocaleString("pt-BR")}%
                  </span>
                  {cli?.comissaoFixaPercentual == null &&
                    cli?.vendedor &&
                    " (padrão do vendedor)"}
                </p>
              ) : null;
            })()}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente *
              </label>
              <select
                required
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="input-field"
              >
                <option value="">Selecione o cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomeFantasia || c.razaoSocial}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendedor *
              </label>
              <select
                required
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
                className="input-field"
              >
                <option value="">Selecione</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motorista
              </label>
              <select
                value={motoristaId}
                onChange={(e) => setMotoristaId(e.target.value)}
                className="input-field"
              >
                <option value="">Sem motorista</option>
                {motoristas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
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

        {/* Produtos */}
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
                    <td className="py-2 pr-3">
                      <select
                        value={item.produtoId}
                        onChange={(e) =>
                          handleProdutoChange(idx, e.target.value)
                        }
                        className="input-field text-sm"
                      >
                        <option value="">Selecione o produto</option>
                        {(produtosCliente.length > 0
                          ? produtosCliente
                          : produtos
                        ).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} ({p.unidade})
                          </option>
                        ))}
                      </select>
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

        {/* Totais */}
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
