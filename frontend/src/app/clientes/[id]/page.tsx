"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PencilIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import {
  formatMoney,
  formatDocumentoCliente,
  formatDate,
  localDateInputValue,
  type Cliente,
  type Produto,
  type Cheque,
  type FreteMovimento,
} from "@/lib/utils";
import { VendaOrdem } from "@/components/VendaOrdem";
import { toast } from "sonner";
import api from "@/lib/api";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { reportApiError } from "@/lib/report-api-error";
import SearchableSelect from "@/components/SearchableSelect";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

interface ResumoFinanceiro {
  contaCorrente: {
    totalDebitos: number;
    totalCreditos: number;
    saldo: number;
    rotulo: string;
    ajuda: string;
  };
  titulosReceber: {
    emAberto: number;
    rotulo: string;
    ajuda: string;
  };
}

interface ContaData {
  cliente: Cliente;
  saldo: number;
  totalDebitos: number;
  totalCreditos: number;
  totalTitulosEmAberto: number;
  resumoFinanceiro?: ResumoFinanceiro;
  vendas: any[];
  pagamentos: any[];
  titulos?: Array<{
    id: number;
    vencimento: string;
    valorOriginal: number;
    valorPago: number;
    status: string;
  }>;
}

interface ProdutoPreco extends Produto {
  precoEspecial: number | null;
  precoAplicado: number;
}

interface ProdutoComissao extends Produto {
  comissaoEspecial: number | null;
  comissaoPadrao: number;
  comissaoAplicada: number;
}

interface ComissoesData {
  comissaoPadrao: number;
  comissaoFixaPercentual: number | null;
  vendedor: { id: number; nome: string; comissaoPercentual: number } | null;
  produtos: ProdutoComissao[];
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { freteEnabled } = useTenantFeatures();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conta, setConta] = useState<ContaData | null>(null);
  const [produtos, setProdutos] = useState<ProdutoPreco[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [aba, setAba] = useState<
    "conta" | "cheques" | "precos" | "comissoes" | "editar"
  >("conta");
  const [loading, setLoading] = useState(true);
  const [precosEdit, setPrecosEdit] = useState<Record<number, string>>({});
  const [salvandoPrecos, setSalvandoPrecos] = useState(false);
  const [comissoesData, setComissoesData] = useState<ComissoesData | null>(
    null,
  );
  const [comissoesEdit, setComissoesEdit] = useState<Record<number, string>>(
    {},
  );
  const [salvandoComissoes, setSalvandoComissoes] = useState(false);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [salvandoForm, setSalvandoForm] = useState(false);
  const [erro, setErro] = useState("");
  const [filtroChqIni, setFiltroChqIni] = useState("");
  const [filtroChqFim, setFiltroChqFim] = useState("");
  const [buscaChq, setBuscaChq] = useState("");
  const [reconciliando, setReconciliando] = useState(false);
  const [fretesPendentes, setFretesPendentes] = useState<FreteMovimento[]>([]);
  const [pagandoFreteId, setPagandoFreteId] = useState<number | null>(null);
  const [pgFreteTipo, setPgFreteTipo] = useState<"dinheiro" | "transferencia">("dinheiro");
  const [pgFreteData, setPgFreteData] = useState(localDateInputValue());

  useEffect(() => {
    const abaUrl = searchParams.get("aba");
    if (
      abaUrl === "conta" ||
      abaUrl === "cheques" ||
      abaUrl === "precos" ||
      abaUrl === "comissoes" ||
      abaUrl === "editar"
    ) {
      setAba(abaUrl);
    }
  }, [searchParams]);

  const carregarComissoes = useCallback(() => {
    return api.get<ComissoesData>(`/clientes/${id}/comissoes`).then((data) => {
      setComissoesData(data);
      const mapa: Record<number, string> = {};
      data.produtos.forEach((p) => {
        if (p.comissaoEspecial != null) mapa[p.id] = String(p.comissaoEspecial);
      });
      setComissoesEdit(mapa);
    });
  }, [id]);

  const carregarCheques = () => {
    const params = new URLSearchParams();
    params.set("clienteId", String(id));
    if (filtroChqIni) params.set("dataInicio", filtroChqIni);
    if (filtroChqFim) params.set("dataFim", filtroChqFim);
    api.get<Cheque[]>(`/cheques?${params}`).then(setCheques);
  };

  const carregarPrincipal = useCallback(() => {
    setLoading(true);
    return Promise.all([
      api.get<ContaData>(`/clientes/${id}/conta`),
      api.get<ProdutoPreco[]>(`/clientes/${id}/precos`),
    ])
      .then(([contaData, prodData]) => {
        setConta(contaData);
        setForm({
          ...contaData.cliente,
          vendedorId: contaData.cliente.vendedorId ?? undefined,
          comissaoFixaPercentual:
            contaData.cliente.comissaoFixaPercentual ?? undefined,
        });
        setProdutos(prodData);
        const mapa: Record<number, string> = {};
        prodData.forEach((p) => {
          if (p.precoEspecial) mapa[p.id] = String(p.precoEspecial);
        });
        setPrecosEdit(mapa);
      })
      .catch((e) => {
        setConta(null);
        reportApiError(e, {
          title: "Não foi possível carregar o cliente",
          onRetry: () => void carregarPrincipal(),
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const carregarFretesPendentes = useCallback(() => {
    return api
      .get<FreteMovimento[]>(`/fretes?clienteId=${id}&reciboEmitido=false&take=300&skip=0`)
      .then((rows) => {
        setFretesPendentes((rows || []).filter((f) => !f.vendaId));
      })
      .catch(() => {
        setFretesPendentes([]);
      });
  }, [id]);

  const loadVendedorOptions = useCallback(async (q: string) => {
    const p = new URLSearchParams({ take: "80" });
    if (q.trim()) p.set("busca", q.trim());
    const r = await api.get<{ id: number; nome: string }[]>(`/vendedores?${p}`);
    return r.map((v) => ({ id: v.id, label: v.nome }));
  }, []);

  const loadVendedorLabelById = useCallback(async (vid: string) => {
    const v = await api.get<{ nome: string }>(`/vendedores/${vid}`);
    return v.nome;
  }, []);

  useEffect(() => {
    void carregarPrincipal();
    if (freteEnabled) void carregarFretesPendentes();
  }, [carregarPrincipal, carregarFretesPendentes, freteEnabled]);

  useEffect(() => {
    carregarCheques();
  }, [id]);

  useEffect(() => {
    if (aba === "comissoes" && !comissoesData) {
      void carregarComissoes().catch((e) =>
        reportApiError(e, { title: "Erro ao carregar comissões" }),
      );
    }
  }, [aba, comissoesData, carregarComissoes]);

  const handlePagarFrete = async (frete: FreteMovimento) => {
    setPagandoFreteId(frete.id);
    try {
      await api.post("/pagamentos", {
        clienteId: Number(id),
        vendaId: null,
        tipo: pgFreteTipo,
        valor: Number(frete.valor),
        data: pgFreteData,
        observacoes: `Pagamento de frete avulso #${frete.id}`,
      });
      await api.patch(`/fretes/${frete.id}`, {
        reciboEmitido: true,
        reciboData: pgFreteData,
      });
      toast.success("Frete avulso pago com sucesso.");
      await Promise.all([carregarPrincipal(), carregarFretesPendentes()]);
    } catch (e) {
      reportApiError(e, { title: "Não foi possível pagar o frete avulso" });
    } finally {
      setPagandoFreteId(null);
    }
  };

  const handleReconciliarRecebiveis = async () => {
    setReconciliando(true);
    try {
      await api.post(`/clientes/${id}/reconciliar-recebiveis`, {});
      toast.success("Títulos alinhados com os pagamentos.");
      await carregarPrincipal();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível recalcular títulos" });
    } finally {
      setReconciliando(false);
    }
  };

  const handleSalvarPrecos = async () => {
    setSalvandoPrecos(true);
    try {
      const precos = produtos.map((p) => ({
        produtoId: p.id,
        preco: precosEdit[p.id] ? parseFloat(precosEdit[p.id]) : null,
      }));
      await api.put(`/clientes/${id}/precos`, { precos });
      const prodData = await api.get<ProdutoPreco[]>(`/clientes/${id}/precos`);
      setProdutos(prodData);
      toast.success("Preços salvos");
    } catch (e) {
      reportApiError(e, { title: "Erro ao salvar preços" });
    } finally {
      setSalvandoPrecos(false);
    }
  };

  const handleSalvarComissoes = async () => {
    if (!comissoesData) return;
    setSalvandoComissoes(true);
    try {
      const comissoes = comissoesData.produtos.map((p) => ({
        produtoId: p.id,
        comissaoPercentual: comissoesEdit[p.id]
          ? parseFloat(comissoesEdit[p.id].replace(",", "."))
          : null,
      }));
      await api.put(`/clientes/${id}/comissoes`, { comissoes });
      await carregarComissoes();
      toast.success("Comissões salvas");
    } catch (e) {
      reportApiError(e, { title: "Erro ao salvar comissões" });
    } finally {
      setSalvandoComissoes(false);
    }
  };

  const handleSalvarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoForm(true);
    setErro("");
    try {
      await api.put(`/clientes/${id}`, {
        ...form,
        vendedorId: form.vendedorId == null ? null : Number(form.vendedorId),
        comissaoFixaPercentual:
          form.comissaoFixaPercentual === undefined ||
          form.comissaoFixaPercentual === null
            ? null
            : parseFloat(String(form.comissaoFixaPercentual).replace(",", ".")),
      });
      const contaData = await api.get<ContaData>(`/clientes/${id}/conta`);
      setConta(contaData);
      setForm({
        ...contaData.cliente,
        vendedorId: contaData.cliente.vendedorId ?? undefined,
        comissaoFixaPercentual:
          contaData.cliente.comissaoFixaPercentual ?? undefined,
      });
      setAba("conta");
    } catch (e) {
      reportApiError(e, { title: "Erro ao salvar cliente" });
      setErro(e instanceof Error ? e.message : "");
    } finally {
      setSalvandoForm(false);
    }
  };

  if (loading) return <DetailPageSkeleton />;
  if (!conta)
    return (
      <div className="p-6 max-w-lg mx-auto flex items-center min-h-[40vh]">
        <EmptyState
          title="Cliente não encontrado ou indisponível"
          action={
            <button type="button" className="btn-primary" onClick={() => void carregarPrincipal()}>
              Tentar novamente
            </button>
          }
        />
      </div>
    );

  const { cliente } = conta;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/clientes" className="btn-secondary py-1.5 px-2.5 mt-1">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {cliente.nomeFantasia || cliente.razaoSocial}
          </h1>
          <p className="text-gray-500 text-sm">
            {cliente.razaoSocial} • {formatDocumentoCliente(cliente)}
          </p>
          {cliente.cidade && (
            <p className="text-gray-400 text-xs mt-0.5">
              {cliente.cidade}
              {cliente.estado ? " - " + cliente.estado : ""}
            </p>
          )}
        </div>
        <Link href={`/vendas/nova?clienteId=${id}`} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Nova Venda
        </Link>
      </div>

      {/* Painel financeiro — mesmas definições que o relatório de títulos */}
      <div
        className={`card p-5 mb-6 border-l-4 ${conta.saldo > 0 ? "border-l-red-500" : "border-l-green-500"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Resumo financeiro do cliente
            </h2>
          </div>
          <Link
            href={`/relatorios/titulos?clienteId=${id}`}
            className="text-sm text-blue-600 hover:underline whitespace-nowrap"
          >
            Relatório de contas a receber deste cliente →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-gray-50/80 p-3">
            <p className="text-xs text-gray-500 uppercase font-semibold">
              Total compras (vendas)
            </p>
            <p className="text-xl font-bold text-red-600 mt-1">
              {formatMoney(conta.totalDebitos)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50/80 p-3">
            <p className="text-xs text-gray-500 uppercase font-semibold">
              Total pago
            </p>
            <p className="text-xl font-bold text-green-600 mt-1">
              {formatMoney(conta.totalCreditos)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 text-left leading-snug">
              Soma dos pagamentos registrados (dinheiro, PIX, cheques
              etc.).
            </p>
          </div>
          <div className="rounded-lg bg-white border border-amber-100 p-3">
            <p className="text-xs text-amber-800/90 uppercase font-semibold">
              Conta a receber
            </p>
            <p className="text-xl font-bold text-amber-900 mt-1">
              {formatMoney(conta.totalTitulosEmAberto ?? 0)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 text-left leading-snug">
              {conta.resumoFinanceiro?.titulosReceber.ajuda ??
                "Soma do saldo restante nos títulos a receber."}
            </p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {(["conta", "cheques", "precos", "comissoes", "editar"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setAba(tab);
              router.replace(`/clientes/${id}?aba=${tab}`);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              aba === tab
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab === "conta"
              ? "Conta Corrente"
              : tab === "cheques"
                ? `Cheques (${cheques.length})`
                : tab === "precos"
                  ? "Preços Especiais"
                  : tab === "comissoes"
                    ? "Comissões"
                    : "Editar Cliente"}
          </button>
        ))}
      </div>

      {/* Conta Corrente */}
      {aba === "conta" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">
                Vendas ({conta.vendas.length})
              </h3>
              <Link
                href={`/vendas?clienteId=${id}`}
                className="text-blue-600 text-xs hover:underline"
              >
                Ver todas
              </Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {conta.vendas.length === 0 ? (
                <p className="p-4 text-gray-400 text-sm text-center">
                  Nenhuma venda
                </p>
              ) : (
                conta.vendas.map((v: any) => (
                  <div
                    key={v.id}
                    className="flex justify-between items-center px-5 py-3 hover:bg-gray-50"
                  >
                    <div>
                      <VendaOrdem venda={v} size="sm" prefix="Venda" />
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(v.dataVenda)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-red-600">
                      -{formatMoney(v.valorTotal)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="card">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">
                Pagamentos ({conta.pagamentos.length})
              </h3>
              <Link
                href={`/financeiro/novo?clienteId=${id}`}
                className="text-blue-600 text-xs hover:underline"
              >
                + Cheque
              </Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {conta.pagamentos.length === 0 ? (
                <p className="p-4 text-gray-400 text-sm text-center">
                  Nenhum pagamento
                </p>
              ) : (
                conta.pagamentos.map((p: any) => {
                  const valorNum = parseFloat(String(p.valor ?? 0));
                  const tipoLabel = (() => {
                    const t = String(p.tipo || "").toLowerCase();
                    if (t === "dinheiro") return "Dinheiro";
                    if (t === "transferencia") return "PIX / transferência";
                    if (t === "cheque") return "Cheque";
                    if (t.startsWith("troco_dinheiro")) return "Troco (dinheiro)";
                    if (t.startsWith("troco_transferencia")) return "Troco (PIX / transferência)";
                    return p.tipo;
                  })( );
                  return (
                  <div key={p.id} className="flex justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{tipoLabel}</p>
                      <p className="text-xs text-gray-400">
                        {formatDate(p.data)}
                      </p>
                      {p.vendaId && (
                        <VendaOrdem
                          venda={{
                            id: p.vendaId,
                            numeroVenda: p.venda?.numeroVenda,
                          }}
                          size="xs"
                          prefix="Venda"
                          className="mt-0.5"
                        />
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        valorNum >= 0 ? "text-green-600" : "text-amber-700"
                      }`}
                    >
                      {valorNum >= 0 ? "+" : ""}
                      {formatMoney(p.valor)}
                    </span>
                  </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="card lg:col-span-2">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-semibold text-gray-900">
                Títulos a receber ({conta.titulos?.length ?? 0})
              </h3>
              <Link
                href={`/relatorios/titulos?clienteId=${id}`}
                className="text-blue-600 text-xs hover:underline"
              >
                Mesmos dados do relatório →
              </Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {!conta.titulos || conta.titulos.length === 0 ? (
                <p className="p-4 text-gray-400 text-sm text-center">
                  Nenhum título
                </p>
              ) : (
                conta.titulos.map((t) => {
                  const aberto = Math.max(
                    0,
                    Number(t.valorOriginal) - Number(t.valorPago),
                  );
                  return (
                    <div
                      key={t.id}
                      className="flex flex-wrap justify-between gap-2 px-5 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {t.status === "quitado" ? "Quitado" : t.status === "parcial" ? "Parcial" : "Aberto"}{" "}
                          · venc. {formatDate(t.vencimento)}
                        </p>
                        <p className="text-xs text-gray-400">Título #{t.id}</p>
                      </div>
                      <div className="text-right text-sm">
                        <span className="text-gray-600">
                          Aberto:{" "}
                          <span className="font-semibold text-amber-900">
                            {formatMoney(aberto)}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {freteEnabled ? (
          <div className="card lg:col-span-2">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-semibold text-gray-900">
                Fretes avulsos pendentes ({fretesPendentes.length})
              </h3>
              <Link href={`/fretes/novo`} className="text-blue-600 text-xs hover:underline">
                + Novo frete avulso
              </Link>
            </div>
            <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Forma de pagamento</label>
                <select
                  value={pgFreteTipo}
                  onChange={(e) => setPgFreteTipo(e.target.value as "dinheiro" | "transferencia")}
                  className="input-field text-sm"
                >
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência / Pix</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data</label>
                <input
                  type="date"
                  value={pgFreteData}
                  onChange={(e) => setPgFreteData(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {fretesPendentes.length === 0 ? (
                <p className="p-4 text-gray-400 text-sm text-center">Nenhum frete avulso pendente.</p>
              ) : (
                fretesPendentes.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">Frete avulso #{f.id}</p>
                      <p className="text-xs text-gray-400">{formatDate(f.data)}</p>
                      {f.observacao && <p className="text-xs text-gray-500 mt-1">{f.observacao}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-amber-700">{formatMoney(f.valor)}</span>
                      <button
                        type="button"
                        onClick={() => void handlePagarFrete(f)}
                        disabled={pagandoFreteId === f.id}
                        className="btn-primary text-xs"
                      >
                        {pagandoFreteId === f.id ? "Pagando..." : "Pagar frete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          ) : null}
        </div>
        </div>
      )}

      {/* Cheques */}
      {aba === "cheques" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
            <h3 className="font-semibold text-gray-900">Cheques do Cliente</h3>
            <Link
              href={`/financeiro/novo?clienteId=${id}`}
              className="btn-primary text-sm"
            >
              + Novo Cheque
            </Link>
          </div>
          <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">De</label>
              <input
                type="date"
                value={filtroChqIni}
                onChange={(e) => setFiltroChqIni(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Até</label>
              <input
                type="date"
                value={filtroChqFim}
                onChange={(e) => setFiltroChqFim(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <button type="button" onClick={carregarCheques} className="btn-primary text-sm">
              Filtrar
            </button>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">
                Busca (banco, nº cheque, ordem)
              </label>
              <input
                value={buscaChq}
                onChange={(e) => setBuscaChq(e.target.value)}
                className="input-field text-sm"
                placeholder="Filtra na lista carregada..."
              />
            </div>
          </div>
          {cheques.length === 0 ? (
            <p className="p-6 text-center text-gray-400">
              Nenhum cheque registrado
            </p>
          ) : cheques.filter((c) => {
              const q = buscaChq.trim().toLowerCase();
              if (!q) return true;
              return (
                (c.banco && c.banco.toLowerCase().includes(q)) ||
                (c.numero && c.numero.toLowerCase().includes(q)) ||
                String(c.numeroOrdem).includes(q)
              );
            }).length === 0 ? (
            <p className="p-6 text-center text-gray-400">
              Nenhum cheque com os filtros atuais
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header w-16">Ordem</th>
                  <th className="table-header">Banco / Nº</th>
                  <th className="table-header w-28 bg-slate-50">Ordem</th>
                  <th className="table-header">Valor</th>
                  <th className="table-header">Data</th>
                </tr>
              </thead>
              <tbody>
                {cheques
                  .filter((c) => {
                    const q = buscaChq.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (c.banco && c.banco.toLowerCase().includes(q)) ||
                      (c.numero && c.numero.toLowerCase().includes(q)) ||
                      String(c.numeroOrdem).includes(q)
                    );
                  })
                  .map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell font-mono font-bold text-gray-600">
                      #{c.numeroOrdem}
                    </td>
                    <td className="table-cell">
                      <p className="font-medium">{c.banco || "-"}</p>
                      {c.numero && (
                        <p className="text-xs text-gray-400">Nº {c.numero}</p>
                      )}
                    </td>
                    <td className="table-cell">
                      {c.venda ? (
                        <VendaOrdem venda={c.venda} size="sm" prefix="Venda" />
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="table-cell font-semibold">
                      {formatMoney(c.valor)}
                    </td>
                    <td className="table-cell">
                      {formatDate(c.dataRecebimento)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Preços Especiais */}
      {aba === "precos" && (
        <div className="card">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Preços especiais por produto
            </h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Deixe em branco para usar o preço padrão do produto
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Produto</th>
                <th className="table-header">Unidade</th>
                <th className="table-header">Preço Padrão</th>
                <th className="table-header">Preço Especial</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell font-medium">{p.nome}</td>
                  <td className="table-cell text-gray-500">{p.unidade}</td>
                  <td className="table-cell">{formatMoney(p.precoPadrao)}</td>
                  <td className="table-cell">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={`${formatMoney(p.precoPadrao)}`}
                      value={precosEdit[p.id] || ""}
                      onChange={(e) =>
                        setPrecosEdit((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      className="input-field w-36"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-4 border-t border-gray-100">
            <button
              onClick={handleSalvarPrecos}
              disabled={salvandoPrecos}
              className="btn-primary"
            >
              {salvandoPrecos ? "Salvando..." : "Salvar Preços"}
            </button>
          </div>
        </div>
      )}

      {/* Comissões por produto */}
      {aba === "comissoes" && comissoesData && (
        <div className="card">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Comissões por produto
            </h3>
            <p className="text-gray-500 text-xs mt-0.5">
              {comissoesData.vendedor ? (
                <>
                  Representante: <strong>{comissoesData.vendedor.nome}</strong>
                  {" · "}
                  Padrão:{" "}
                  <strong>{comissoesData.comissaoPadrao.toFixed(2)}%</strong>
                  {comissoesData.comissaoFixaPercentual != null
                    ? " (comissão fixa do cliente)"
                    : " (% do representante)"}
                </>
              ) : (
                <>Defina um representante no cadastro do cliente para usar o padrão.</>
              )}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Deixe em branco para usar a comissão padrão do cliente/representante
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Produto</th>
                <th className="table-header">Unidade</th>
                <th className="table-header">Padrão (%)</th>
                <th className="table-header">Comissão específica (%)</th>
                <th className="table-header">Aplicada (%)</th>
              </tr>
            </thead>
            <tbody>
              {comissoesData.produtos.map((p) => {
                const editVal = comissoesEdit[p.id] ?? "";
                const aplicada =
                  editVal !== ""
                    ? parseFloat(editVal.replace(",", ".")) ||
                      comissoesData.comissaoPadrao
                    : p.comissaoAplicada;
                return (
                  <tr key={p.id} className="table-row">
                    <td className="table-cell font-medium">{p.nome}</td>
                    <td className="table-cell text-gray-500">{p.unidade}</td>
                    <td className="table-cell">
                      {comissoesData.comissaoPadrao.toFixed(2)}%
                    </td>
                    <td className="table-cell">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder={`${comissoesData.comissaoPadrao.toFixed(2)}`}
                        value={editVal}
                        onChange={(e) =>
                          setComissoesEdit((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        className="input-field w-28"
                      />
                    </td>
                    <td className="table-cell text-gray-600">
                      {Number.isFinite(aplicada)
                        ? `${aplicada.toFixed(2)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-4 border-t border-gray-100">
            <button
              onClick={handleSalvarComissoes}
              disabled={salvandoComissoes}
              className="btn-primary"
            >
              {salvandoComissoes ? "Salvando..." : "Salvar Comissões"}
            </button>
          </div>
        </div>
      )}

      {aba === "comissoes" && !comissoesData && (
        <div className="card p-8 text-center text-gray-400 text-sm">
          Carregando comissões...
        </div>
      )}

      {/* Editar Cliente */}
      {aba === "editar" && (
        <form onSubmit={handleSalvarCliente} className="card p-5">
          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {erro}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razão Social *
              </label>
              <input
                required
                value={form.razaoSocial || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, razaoSocial: e.target.value }))
                }
                className="input-field"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome Fantasia
              </label>
              <input
                value={form.nomeFantasia || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nomeFantasia: e.target.value }))
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
            {freteEnabled ? (
            <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frete padrão por saco (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.fretePadraoSaco ?? form.fretePadrao ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    fretePadraoSaco: e.target.value === "" ? undefined : parseFloat(e.target.value),
                  }))
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frete padrão por tonelada (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.fretePadraoTonelada ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    fretePadraoTonelada:
                      e.target.value === "" ? undefined : parseFloat(e.target.value),
                  }))
                }
                className="input-field"
              />
            </div>
            </>
            ) : null}
            <div>
              <SearchableSelect
                label="Vendedor do cliente"
                value={
                  form.vendedorId != null && form.vendedorId !== undefined
                    ? String(form.vendedorId)
                    : ""
                }
                onChange={(vid) =>
                  setForm((p) => ({
                    ...p,
                    vendedorId: vid ? parseInt(vid, 10) : null,
                  }))
                }
                loadOptions={loadVendedorOptions}
                loadLabelById={loadVendedorLabelById}
                minChars={0}
                placeholder="Nenhum — digite para buscar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comissão fixa (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.comissaoFixaPercentual ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    comissaoFixaPercentual: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
                className="input-field"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cidade
              </label>
              <input
                value={form.cidade || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cidade: e.target.value }))
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <input
                value={form.estado || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, estado: e.target.value }))
                }
                className="input-field"
                maxLength={2}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço
              </label>
              <input
                value={form.endereco || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, endereco: e.target.value }))
                }
                className="input-field"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={form.observacoes || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, observacoes: e.target.value }))
                }
                className="input-field"
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              type="submit"
              disabled={salvandoForm}
              className="btn-primary"
            >
              {salvandoForm ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
