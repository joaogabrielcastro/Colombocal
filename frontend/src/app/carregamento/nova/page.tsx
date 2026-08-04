"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { localDateInputValue } from "@/lib/utils";
import { quantidadeEmSacos } from "@/lib/frete";
import { reportApiError } from "@/lib/report-api-error";
import FreteFeatureGuard from "@/components/FreteFeatureGuard";
import SearchableSelect from "@/components/SearchableSelect";
import {
  openOrdemCarregamentoPrint,
  type OrdemCarregamentoPrintData,
} from "@/lib/ordem-carregamento-print";
import { toast } from "sonner";

type Cliente = {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
};
type Motorista = {
  id: number;
  nome: string;
  placa?: string | null;
};
type Produto = {
  id: number;
  nome: string;
  unidade: string;
  pesoKg?: number | null;
};
type ItemForm = {
  produtoId: string;
  quantidade: string;
};

function emptyItem(): ItemForm {
  return { produtoId: "", quantidade: "" };
}

function fmtSacos(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export default function NovaOcPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [pedido, setPedido] = useState("");
  const [dataEmissao, setDataEmissao] = useState(localDateInputValue());
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ clientes: Cliente[] }>("/clientes?ativo=true&take=500&skip=0"),
      api.get<Motorista[]>("/motoristas?take=500&skip=0"),
      api.get<Produto[]>("/produtos?ativo=true&take=500&skip=0"),
    ])
      .then(([c, m, p]) => {
        if (!active) return;
        setClientes(c.clientes || []);
        setMotoristas(Array.isArray(m) ? m : []);
        setProdutos(Array.isArray(p) ? p : []);
      })
      .catch((e) => {
        if (!active) return;
        reportApiError(e, {
          title: "Não foi possível carregar dados do formulário",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  const cliente = useMemo(
    () => clientes.find((c) => String(c.id) === clienteId) || null,
    [clientes, clienteId],
  );
  const motorista = useMemo(
    () => motoristas.find((m) => String(m.id) === motoristaId) || null,
    [motoristas, motoristaId],
  );

  const linhas = useMemo(
    () =>
      itens.map((it) => {
        const produto = produtos.find((p) => String(p.id) === it.produtoId);
        const qtdRaw = Number(String(it.quantidade).replace(",", ".")) || 0;
        const sacos =
          produto && qtdRaw > 0
            ? quantidadeEmSacos({
                quantidade: qtdRaw,
                unidade: produto.unidade,
                pesoKg: produto.pesoKg,
              })
            : 0;
        return { produto, qtdRaw, sacos };
      }),
    [itens, produtos],
  );
  const totalSacos = linhas.reduce((acc, l) => acc + l.sacos, 0);

  const loadClienteOptions = useCallback(
    async (q: string) =>
      clientes
        .filter((c) => {
          const nome = `${c.nomeFantasia || ""} ${c.razaoSocial || ""}`.toLowerCase();
          return nome.includes(q.toLowerCase());
        })
        .slice(0, 80)
        .map((c) => ({
          id: c.id,
          label: c.nomeFantasia?.trim() || c.razaoSocial,
        })),
    [clientes],
  );
  const loadClienteLabelById = useCallback(
    async (id: string) => {
      const c = clientes.find((x) => String(x.id) === id);
      return c ? c.nomeFantasia?.trim() || c.razaoSocial : null;
    },
    [clientes],
  );
  const loadMotoristaOptions = useCallback(
    async (q: string) =>
      motoristas
        .filter((m) => m.nome.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 80)
        .map((m) => ({
          id: m.id,
          label: m.placa ? `${m.nome} (${m.placa})` : m.nome,
        })),
    [motoristas],
  );
  const loadMotoristaLabelById = useCallback(
    async (id: string) => {
      const m = motoristas.find((x) => String(x.id) === id);
      return m ? (m.placa ? `${m.nome} (${m.placa})` : m.nome) : null;
    },
    [motoristas],
  );
  const loadProdutoOptions = useCallback(
    async (q: string) =>
      produtos
        .filter((p) =>
          `${p.nome} ${p.unidade}`.toLowerCase().includes(q.toLowerCase()),
        )
        .slice(0, 80)
        .map((p) => ({ id: p.id, label: `${p.nome} (${p.unidade})` })),
    [produtos],
  );
  const loadProdutoLabelById = useCallback(
    async (id: string) => {
      const p = produtos.find((x) => String(x.id) === id);
      return p ? `${p.nome} (${p.unidade})` : null;
    },
    [produtos],
  );

  const addItem = () => setItens((prev) => [...prev, emptyItem()]);
  const removeItem = (index: number) =>
    setItens((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const salvar = async (printAfter: boolean) => {
    if (!cliente) {
      toast.error("Selecione o cliente");
      return;
    }
    const itensValidos = linhas
      .map((l) => {
        if (!l.produto || !(l.sacos > 0)) return null;
        return {
          descricao: l.produto.nome,
          quantidade: l.sacos,
          unidade: "SAC",
        };
      })
      .filter(
        (x): x is { descricao: string; quantidade: number; unidade: string } =>
          !!x,
      );

    if (itensValidos.length === 0) {
      toast.error("Informe ao menos um produto com quantidade");
      return;
    }

    printAfter ? setImprimindo(true) : setSalvando(true);
    try {
      const ordem = await api.post<OrdemCarregamentoPrintData & { id: number }>(
        "/ordens-carregamento",
        {
          clienteId: cliente.id,
          clienteNome: cliente.nomeFantasia?.trim() || cliente.razaoSocial,
          clienteEndereco: cliente.endereco || null,
          clienteCidade: cliente.cidade || null,
          clienteUf: cliente.estado || null,
          motoristaId: motorista?.id || null,
          motoristaNome: motorista?.nome || null,
          motoristaPlaca: motorista?.placa || null,
          pedido: pedido.trim() || null,
          dataEmissao,
          observacoes: observacoes.trim() || null,
          itens: itensValidos,
        },
      );
      toast.success(`OC ${String(ordem.numeroOc).padStart(6, "0")} criada`);
      if (printAfter) openOrdemCarregamentoPrint(ordem);
      router.push("/carregamento");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível criar a OC" });
    } finally {
      setSalvando(false);
      setImprimindo(false);
    }
  };

  const clienteEndereco = cliente
    ? [cliente.endereco, [cliente.cidade, cliente.estado].filter(Boolean).join("/")]
        .filter(Boolean)
        .join(" — ")
    : "";

  const busy = salvando || imprimindo;

  return (
    <FreteFeatureGuard>
      <div className="p-6 w-full max-w-[90rem] mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/carregamento" className="btn-secondary py-1.5 px-2.5">
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Nova ordem de carregamento
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Documento do pátio — sem frete e sem financeiro.
            </p>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Dados</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SearchableSelect
              label="Cliente"
              value={clienteId}
              onChange={setClienteId}
              loadOptions={loadClienteOptions}
              loadLabelById={loadClienteLabelById}
              minChars={0}
              placeholder="Buscar cliente…"
            />
            <SearchableSelect
              label="Motorista"
              value={motoristaId}
              onChange={setMotoristaId}
              loadOptions={loadMotoristaOptions}
              loadLabelById={loadMotoristaLabelById}
              minChars={0}
              placeholder="Buscar motorista…"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pedido / nº venda
              </label>
              <input
                className="input-field"
                value={pedido}
                onChange={(e) => setPedido(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de emissão
              </label>
              <input
                type="date"
                className="input-field"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
              />
            </div>
          </div>
          {(clienteEndereco || motorista?.placa) && (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
              {clienteEndereco ? <span>Local: {clienteEndereco}</span> : null}
              {motorista?.placa ? <span>Placa: {motorista.placa}</span> : null}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Produtos</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                A quantidade é convertida para sacos na impressão.
              </p>
            </div>
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
                <th className="table-header w-36">Quantidade</th>
                <th className="table-header w-32 text-right">Em sacos</th>
                <th className="table-header w-10" />
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => {
                const linha = linhas[idx];
                return (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="py-2 pr-3 min-w-[14rem]">
                      <SearchableSelect
                        label="Produto"
                        hideLabel
                        value={item.produtoId}
                        onChange={(id) =>
                          setItens((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, produtoId: id } : it,
                            ),
                          )
                        }
                        loadOptions={loadProdutoOptions}
                        loadLabelById={loadProdutoLabelById}
                        minChars={0}
                        placeholder="Buscar produto…"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder={
                          linha?.produto ? `Qtd (${linha.produto.unidade})` : "0"
                        }
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
                    <td className="py-2 pr-3 text-right text-sm text-gray-700 tabular-nums">
                      {linha?.sacos > 0 ? fmtSacos(linha.sacos) : "—"}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="btn-secondary py-1.5 px-2 text-red-600"
                        disabled={itens.length === 1}
                        onClick={() => removeItem(idx)}
                        title="Remover"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <div className="flex-1 min-w-[12rem]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <input
                className="input-field"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Total da ordem
              </p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">
                {fmtSacos(totalSacos)}{" "}
                <span className="text-sm font-medium text-gray-500">SAC</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void salvar(true)}
          >
            {imprimindo ? "Salvando…" : "Salvar e imprimir"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void salvar(false)}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <Link href="/carregamento" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </div>
    </FreteFeatureGuard>
  );
}
