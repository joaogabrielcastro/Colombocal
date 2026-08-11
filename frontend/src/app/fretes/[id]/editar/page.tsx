"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { formatMoney, localDateInputValue, toInputDate } from "@/lib/utils";
import { freteLinha } from "@/lib/frete";
import { reportApiError } from "@/lib/report-api-error";
import FreteFeatureGuard from "@/components/FreteFeatureGuard";
import SearchableSelect from "@/components/SearchableSelect";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";

type Cliente = {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  fretePadraoSaco?: number;
  fretePadraoTonelada?: number;
};
type Motorista = { id: number; nome: string };
type Produto = { id: number; nome: string; unidade: string; pesoKg?: number | null };
type FreteItemForm = { produtoId: string; quantidade: string };

type FreteDetail = {
  id: number;
  valor: number | string;
  data: string;
  observacao?: string | null;
  reciboEmitido: boolean;
  reciboData?: string | null;
  reciboNumero?: string | null;
  vendaId?: number | null;
  clienteId: number;
  cliente: Cliente;
  avulso?: {
    motoristaId?: number | null;
    motoristaNome?: string | null;
    precoSaco?: number | null;
    precoTonelada?: number | null;
    observacaoLivre?: string | null;
    itens?: {
      produtoId: number;
      quantidade: number;
      produtoNome?: string | null;
    }[];
  } | null;
};

export default function EditarFretePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [frete, setFrete] = useState<FreteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const skipTarifaFromCliente = useRef(true);

  const [form, setForm] = useState({
    clienteId: "",
    motoristaId: "",
    precoSaco: "",
    precoTonelada: "",
    valorTotal: "",
    dataMovimento: localDateInputValue(),
    observacao: "",
    pagoNoAto: false,
    pagamentoTipo: "dinheiro" as "dinheiro" | "transferencia",
    pagamentoData: localDateInputValue(),
    reciboNumero: "",
  });
  const [itens, setItens] = useState<FreteItemForm[]>([{ produtoId: "", quantidade: "" }]);

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
        reportApiError(e, { title: "Não foi possível carregar dados do formulário" });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    skipTarifaFromCliente.current = true;
    api
      .get<FreteDetail>(`/fretes/${id}`)
      .then((f) => {
        if (!alive) return;
        if (f.vendaId) {
          toast.message("Frete de venda — abrindo a venda para editar");
          router.replace(`/vendas/${f.vendaId}`);
          return;
        }
        setFrete(f);
        const av = f.avulso;
        const itensCarregados =
          av?.itens?.length && av.itens.some((i) => i.produtoId > 0)
            ? av.itens.map((i) => ({
                produtoId: String(i.produtoId),
                quantidade: String(i.quantidade ?? ""),
              }))
            : [{ produtoId: "", quantidade: "" }];
        setItens(itensCarregados);
        setForm({
          clienteId: String(f.clienteId || f.cliente?.id || ""),
          motoristaId: av?.motoristaId != null ? String(av.motoristaId) : "",
          precoSaco:
            av?.precoSaco != null
              ? String(av.precoSaco)
              : String(f.cliente?.fretePadraoSaco ?? 0),
          precoTonelada:
            av?.precoTonelada != null
              ? String(av.precoTonelada)
              : String(f.cliente?.fretePadraoTonelada ?? 0),
          valorTotal: String(f.valor ?? ""),
          dataMovimento: toInputDate(f.data) || localDateInputValue(),
          observacao: av?.observacaoLivre || "",
          pagoNoAto: !!f.reciboEmitido,
          pagamentoTipo: "dinheiro",
          pagamentoData:
            toInputDate(f.reciboData) || toInputDate(f.data) || localDateInputValue(),
          reciboNumero: f.reciboNumero || "",
        });
      })
      .catch((e) => {
        if (!alive) return;
        reportApiError(e, { title: "Não foi possível carregar o frete" });
        setFrete(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, router]);

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => String(c.id) === form.clienteId) || null,
    [clientes, form.clienteId],
  );

  useEffect(() => {
    if (!clienteSelecionado) return;
    if (skipTarifaFromCliente.current) {
      skipTarifaFromCliente.current = false;
      return;
    }
    setForm((s) => ({
      ...s,
      precoSaco: String(clienteSelecionado.fretePadraoSaco ?? 0),
      precoTonelada: String(clienteSelecionado.fretePadraoTonelada ?? 0),
    }));
  }, [clienteSelecionado]);

  const precoSaco = Number(String(form.precoSaco).replace(",", ".")) || 0;
  const precoTonelada = Number(String(form.precoTonelada).replace(",", ".")) || 0;
  const subtotais = itens.map((item) => {
    const produto = produtos.find((p) => String(p.id) === item.produtoId);
    const quantidade = Number(String(item.quantidade).replace(",", ".")) || 0;
    const subtotal = freteLinha({
      unidade: produto?.unidade,
      pesoKg: produto?.pesoKg,
      quantidade,
      fretePorSaco: precoSaco,
      fretePorTonelada: precoTonelada,
    });
    return { produto, quantidade, subtotal };
  });
  const valorCalculado = subtotais.reduce((acc, item) => acc + item.subtotal, 0);
  const valorOverrideRaw = String(form.valorTotal || "").trim();
  const valorOverride = valorOverrideRaw
    ? Number(valorOverrideRaw.replace(",", "."))
    : null;
  const valorFinal =
    valorOverride != null && Number.isFinite(valorOverride) && valorOverride > 0
      ? valorOverride
      : valorCalculado;

  const salvar = async () => {
    const clienteId = Number.parseInt(form.clienteId, 10);
    const motoristaId = Number.parseInt(form.motoristaId, 10);
    const itensValidos = itens
      .map((item) => ({
        produtoId: Number.parseInt(item.produtoId, 10),
        quantidade: Number(String(item.quantidade).replace(",", ".")),
      }))
      .filter(
        (item) =>
          item.produtoId > 0 && Number.isFinite(item.quantidade) && item.quantidade > 0,
      );
    if (!clienteId || !motoristaId || itensValidos.length === 0 || valorFinal <= 0) {
      toast.error(
        "Preencha cliente, motorista, pelo menos um item e confira as tarifas (total > 0).",
      );
      return;
    }
    setSalvando(true);
    try {
      const payload: Record<string, unknown> = {
        clienteId,
        motoristaId,
        itens: itensValidos,
        precoSaco,
        precoTonelada,
        dataMovimento: form.dataMovimento,
        observacaoLivre: form.observacao,
        pagoNoAto: form.pagoNoAto,
        pagamentoTipo: form.pagamentoTipo,
        pagamentoData: form.pagamentoData,
        reciboNumero: form.pagoNoAto ? form.reciboNumero.trim() || null : null,
      };
      if (valorOverride != null && Number.isFinite(valorOverride) && valorOverride > 0) {
        payload.valorTotal = valorOverride;
      }
      await api.patch(`/fretes/${id}`, payload);
      toast.success("Frete atualizado");
      router.push("/fretes");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível salvar o frete" });
    } finally {
      setSalvando(false);
    }
  };

  const adicionarItem = () => setItens((prev) => [...prev, { produtoId: "", quantidade: "" }]);
  const removerItem = (index: number) =>
    setItens((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

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
        .map((m) => ({ id: m.id, label: m.nome })),
    [motoristas],
  );
  const loadMotoristaLabelById = useCallback(
    async (idSel: string) => {
      const m = motoristas.find((x) => String(x.id) === idSel);
      return m ? m.nome : null;
    },
    [motoristas],
  );
  const loadProdutoOptions = useCallback(
    async (q: string) =>
      produtos
        .filter((p) => `${p.nome} ${p.unidade}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 80)
        .map((p) => ({ id: p.id, label: `${p.nome} (${p.unidade})` })),
    [produtos],
  );
  const loadProdutoLabelById = useCallback(
    async (idSel: string) => {
      const p = produtos.find((x) => String(x.id) === idSel);
      return p ? `${p.nome} (${p.unidade})` : null;
    },
    [produtos],
  );

  if (loading) return <DetailPageSkeleton />;
  if (!frete) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">Frete não encontrado.</div>
    );
  }

  return (
    <FreteFeatureGuard>
      <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/fretes" className="btn-secondary py-1.5 px-2.5">
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Editar frete avulso</h1>
            <p className="text-sm text-gray-500 mt-0.5">#{frete.id}</p>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SearchableSelect
              label="Cliente"
              value={form.clienteId}
              onChange={(cid) => setForm((s) => ({ ...s, clienteId: cid }))}
              loadOptions={loadClienteOptions}
              loadLabelById={loadClienteLabelById}
              minChars={0}
              placeholder="Buscar cliente..."
            />
            <SearchableSelect
              label="Motorista"
              value={form.motoristaId}
              onChange={(mid) => setForm((s) => ({ ...s, motoristaId: mid }))}
              loadOptions={loadMotoristaOptions}
              loadLabelById={loadMotoristaLabelById}
              minChars={0}
              placeholder="Buscar motorista..."
            />
            <div>
              <label className="block text-sm text-gray-600 mb-1">Preço por saco</label>
              <input
                className="input-field"
                value={form.precoSaco}
                onChange={(e) => setForm((s) => ({ ...s, precoSaco: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Preço por tonelada</label>
              <input
                className="input-field"
                value={form.precoTonelada}
                onChange={(e) => setForm((s) => ({ ...s, precoTonelada: e.target.value }))}
              />
            </div>
          </div>

          <div className="border rounded-lg border-gray-200 p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">Itens do frete</p>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5"
                onClick={adicionarItem}
              >
                + Adicionar item
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Cálculo: saco = qtd × preço/saco · com pesoKg = qtd × preço/saco × (peso/20) ·
              ton = qtd × preço/ton.
            </p>
            <div className="space-y-2">
              {itens.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
                >
                  <div className="md:col-span-6">
                    <SearchableSelect
                      hideLabel
                      label={`Produto item ${index + 1}`}
                      value={item.produtoId}
                      onChange={(pid) =>
                        setItens((prev) =>
                          prev.map((it, i) =>
                            i === index ? { ...it, produtoId: pid } : it,
                          ),
                        )
                      }
                      loadOptions={loadProdutoOptions}
                      loadLabelById={loadProdutoLabelById}
                      minChars={0}
                      placeholder="Buscar produto..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      className="input-field"
                      placeholder="Quantidade"
                      value={item.quantidade}
                      onChange={(e) =>
                        setItens((prev) =>
                          prev.map((it, i) =>
                            i === index ? { ...it, quantidade: e.target.value } : it,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="input-field bg-gray-50 text-sm tabular-nums">
                      {formatMoney(subtotais[index]?.subtotal ?? 0)}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      className="btn-secondary w-full"
                      onClick={() => removerItem(index)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Total calculado</label>
              <input
                className="input-field bg-gray-50"
                value={formatMoney(valorCalculado)}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Total final (editável)
              </label>
              <input
                className="input-field"
                value={form.valorTotal}
                onChange={(e) => setForm((s) => ({ ...s, valorTotal: e.target.value }))}
                placeholder={valorCalculado.toFixed(2)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Apague para usar o total calculado ({formatMoney(valorCalculado)}).
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Data do frete</label>
              <input
                type="date"
                className="input-field"
                value={form.dataMovimento}
                onChange={(e) =>
                  setForm((s) => ({ ...s, dataMovimento: e.target.value }))
                }
              />
            </div>
            <div className="lg:col-span-4">
              <label className="block text-sm text-gray-600 mb-1">Observação</label>
              <input
                className="input-field"
                value={form.observacao}
                onChange={(e) => setForm((s) => ({ ...s, observacao: e.target.value }))}
                placeholder="Observação livre (opcional)"
              />
            </div>
          </div>

          <div className="border-t pt-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pagoNoAto}
                onChange={(e) =>
                  setForm((s) => ({ ...s, pagoNoAto: e.target.checked }))
                }
              />
              Frete pago
            </label>
            {form.pagoNoAto ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Forma de pagamento
                  </label>
                  <select
                    className="input-field"
                    value={form.pagamentoTipo}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        pagamentoTipo: e.target.value as "dinheiro" | "transferencia",
                      }))
                    }
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência / Pix</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data pagamento</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.pagamentoData}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, pagamentoData: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nº recibo</label>
                  <input
                    className="input-field"
                    value={form.reciboNumero}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, reciboNumero: e.target.value }))
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={salvando}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <Link href="/fretes" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </div>
    </FreteFeatureGuard>
  );
}
