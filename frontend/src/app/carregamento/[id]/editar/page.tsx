"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { localDateInputValue, toInputDate } from "@/lib/utils";
import { reportApiError } from "@/lib/report-api-error";
import FreteFeatureGuard from "@/components/FreteFeatureGuard";
import SearchableSelect from "@/components/SearchableSelect";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
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
type Motorista = { id: number; nome: string; placa?: string | null };
type ItemForm = { descricao: string; quantidade: string };

type OcDetail = OrdemCarregamentoPrintData & {
  id: number;
  clienteId?: number | null;
  motoristaId?: number | null;
  itens: {
    id?: number;
    descricao: string;
    quantidade: number | string;
    unidade?: string | null;
  }[];
};

function emptyItem(): ItemForm {
  return { descricao: "", quantidade: "" };
}

function fmtSacos(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export default function EditarOcPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [ordem, setOrdem] = useState<OcDetail | null>(null);
  const [loading, setLoading] = useState(true);
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
      api.get<OcDetail>(`/ordens-carregamento/${id}`),
    ])
      .then(([c, m, oc]) => {
        if (!active) return;
        setClientes(c.clientes || []);
        setMotoristas(Array.isArray(m) ? m : []);
        setOrdem(oc);
        setClienteId(oc.clienteId ? String(oc.clienteId) : "");
        setMotoristaId(oc.motoristaId ? String(oc.motoristaId) : "");
        setPedido(oc.pedido || "");
        setDataEmissao(toInputDate(oc.dataEmissao) || localDateInputValue());
        setObservacoes(oc.observacoes || "");
        setItens(
          (oc.itens || []).length
            ? oc.itens.map((it) => ({
                descricao: it.descricao,
                quantidade: String(it.quantidade ?? ""),
              }))
            : [emptyItem()],
        );
      })
      .catch((e) => {
        if (!active) return;
        reportApiError(e, { title: "Não foi possível carregar a OC" });
        setOrdem(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const cliente = useMemo(
    () => clientes.find((c) => String(c.id) === clienteId) || null,
    [clientes, clienteId],
  );
  const motorista = useMemo(
    () => motoristas.find((m) => String(m.id) === motoristaId) || null,
    [motoristas, motoristaId],
  );

  const totalSacos = itens.reduce((acc, it) => {
    const n = Number(String(it.quantidade).replace(",", ".")) || 0;
    return acc + (n > 0 ? n : 0);
  }, 0);

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
    async (idSel: string) => {
      const c = clientes.find((x) => String(x.id) === idSel);
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
    async (idSel: string) => {
      const m = motoristas.find((x) => String(x.id) === idSel);
      return m ? (m.placa ? `${m.nome} (${m.placa})` : m.nome) : null;
    },
    [motoristas],
  );

  const salvar = async (printAfter: boolean) => {
    const clienteNome =
      (cliente
        ? cliente.nomeFantasia?.trim() || cliente.razaoSocial
        : ordem?.clienteNome) || "";
    if (!clienteNome.trim()) {
      toast.error("Informe o cliente");
      return;
    }
    const itensValidos = itens
      .map((it) => {
        const descricao = it.descricao.trim();
        const quantidade = Number(String(it.quantidade).replace(",", "."));
        if (!descricao || !(quantidade > 0)) return null;
        return { descricao, quantidade, unidade: "SAC" };
      })
      .filter(
        (x): x is { descricao: string; quantidade: number; unidade: string } =>
          !!x,
      );
    if (!itensValidos.length) {
      toast.error("Informe ao menos um item com quantidade");
      return;
    }

    printAfter ? setImprimindo(true) : setSalvando(true);
    try {
      const updated = await api.put<OrdemCarregamentoPrintData & { id: number }>(
        `/ordens-carregamento/${id}`,
        {
          clienteId: cliente?.id || null,
          clienteNome,
          clienteEndereco: cliente?.endereco || ordem?.clienteEndereco || null,
          clienteCidade: cliente?.cidade || ordem?.clienteCidade || null,
          clienteUf: cliente?.estado || ordem?.clienteUf || null,
          motoristaId: motorista?.id || null,
          motoristaNome: motorista?.nome || ordem?.motoristaNome || null,
          motoristaPlaca: motorista?.placa || ordem?.motoristaPlaca || null,
          pedido: pedido.trim() || null,
          dataEmissao,
          observacoes: observacoes.trim() || null,
          itens: itensValidos,
        },
      );
      toast.success(`OC ${String(updated.numeroOc).padStart(6, "0")} atualizada`);
      if (printAfter) openOrdemCarregamentoPrint(updated);
      router.push("/carregamento");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível salvar a OC" });
    } finally {
      setSalvando(false);
      setImprimindo(false);
    }
  };

  if (loading) return <DetailPageSkeleton />;
  if (!ordem) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        Ordem não encontrada.
      </div>
    );
  }

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
              Editar OC {String(ordem.numeroOc).padStart(6, "0")}
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
              selectedLabel={
                !clienteId ? ordem.clienteNome : undefined
              }
              minChars={0}
              placeholder="Buscar cliente…"
            />
            <SearchableSelect
              label="Motorista"
              value={motoristaId}
              onChange={setMotoristaId}
              loadOptions={loadMotoristaOptions}
              loadLabelById={loadMotoristaLabelById}
              selectedLabel={
                !motoristaId ? ordem.motoristaNome || undefined : undefined
              }
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
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Itens (sacos)</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Quantidades já convertidas para a impressão.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setItens((prev) => [...prev, emptyItem()])}
              className="btn-secondary text-xs py-1.5"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Adicionar item
            </button>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Descrição</th>
                <th className="table-header w-40">Quantidade (SAC)</th>
                <th className="table-header w-10" />
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-2 pr-3">
                    <input
                      className="input-field text-sm"
                      value={item.descricao}
                      onChange={(e) =>
                        setItens((prev) =>
                          prev.map((it, i) =>
                            i === idx
                              ? { ...it, descricao: e.target.value }
                              : it,
                          ),
                        )
                      }
                      placeholder="Produto / descrição"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      className="input-field text-sm"
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
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="btn-secondary py-1.5 px-2 text-red-600"
                      disabled={itens.length === 1}
                      onClick={() =>
                        setItens((prev) =>
                          prev.length === 1
                            ? prev
                            : prev.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
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
