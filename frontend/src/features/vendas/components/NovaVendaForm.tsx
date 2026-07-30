"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  formatMoney,
  localDateInputValue,
  toInputDate,
  vendaNumeroPublico,
  type Cliente,
  type Produto,
  type Vendedor,
  type Motorista,
  type Venda,
} from "@/lib/utils";
import api from "@/lib/api";
import { VendaOrdem } from "@/components/VendaOrdem";
import { FormPageSkeleton } from "@/components/ui/skeletons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { reportApiError } from "@/lib/report-api-error";
import {
  buildClienteCadastroDiff,
  diffToAtualizarClientePayload,
  formatClienteCadastroDiffMessage,
  type ClienteCadastroDiff,
} from "@/lib/venda-cliente-sync";
import SearchableSelect from "@/components/SearchableSelect";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

interface ItemForm {
  produtoId: string;
  produtoNome: string;
  quantidade: string;
  precoUnitario: string;
  precoReferencia: string;
  unidade: string;
}

const emptyItem = (): ItemForm => ({
  produtoId: "",
  produtoNome: "",
  quantidade: "",
  precoUnitario: "",
  precoReferencia: "",
  unidade: "",
});

interface ProdutoPreco extends Produto {
  precoEspecial: number | null;
  precoAplicado: number;
}

export function NovaVendaForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const { freteEnabled } = useTenantFeatures();
  const searchParams = useSearchParams();
  const clienteIdFromQuery = searchParams.get("clienteId");
  const isEdit = !!editId;
  const [carregandoVenda, setCarregandoVenda] = useState(!!editId);
  const [numeroVenda, setNumeroVenda] = useState<number | null>(null);

  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  const [vendedorId, setVendedorId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [clienteId, setClienteId] = useState(clienteIdFromQuery || "");
  const clienteIdRef = useRef(clienteId);
  clienteIdRef.current = clienteId;
  const [frete, setFrete] = useState("");
  const [fretePorSaco, setFretePorSaco] = useState("");
  const [fretePorTonelada, setFretePorTonelada] = useState("");
  const [dataVenda, setDataVenda] = useState(localDateInputValue());
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);
  const [freteRefSaco, setFreteRefSaco] = useState("");
  const [freteRefTonelada, setFreteRefTonelada] = useState("");
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncDialogDiff, setSyncDialogDiff] = useState<ClienteCadastroDiff | null>(
    null,
  );
  const [obsAckClienteId, setObsAckClienteId] = useState<number | null>(null);
  const [obsModalOpen, setObsModalOpen] = useState(false);

  const [freteRecibo, setFreteRecibo] = useState(false);
  const [freteReciboData, setFreteReciboData] = useState(localDateInputValue());

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarDetalhes, setMostrarDetalhes] = useState(isEdit);

  useEffect(() => {
    api.get<Vendedor[]>("/vendedores?take=1").then((arr) => {
      if (arr.length > 0) {
        setVendedorId((v) => v || String(arr[0].id));
      }
    });
  }, []);

  useEffect(() => {
    if (!isEdit && clienteIdFromQuery) setClienteId(clienteIdFromQuery);
  }, [clienteIdFromQuery, isEdit]);

  useEffect(() => {
    if (!editId) return;
    let alive = true;
    setCarregandoVenda(true);
    api
      .get<Venda & { podeEditar?: boolean }>(`/vendas/${editId}`)
      .then((v) => {
        if (!alive) return;
        if (!v.podeEditar) {
          router.replace(`/vendas/${editId}`);
          return;
        }
        setNumeroVenda(vendaNumeroPublico(v));
        setClienteId(String(v.clienteId));
        setVendedorId(String(v.vendedorId));
        setMotoristaId(v.motoristaId ? String(v.motoristaId) : "");
        setFretePorSaco(String(v.freteTarifaSaco ?? 0));
        setFretePorTonelada(String(v.freteTarifaTonelada ?? 0));
        setFrete(String(parseFloat(String(v.frete))));
        setDataVenda(toInputDate(v.dataVenda));
        setObservacoes(v.observacoes || "");
        setFreteRecibo(v.freteRecibo);
        const rd = v.fretes?.[0]?.reciboData;
        setFreteReciboData(rd ? toInputDate(rd) : localDateInputValue());
        setSelectedCliente(v.cliente);
        setItens(
          v.itens.map((item) => ({
            produtoId: String(item.produtoId),
            produtoNome: item.produto.nome,
            quantidade: String(item.quantidade),
            precoUnitario: String(item.precoUnitario),
            precoReferencia: String(item.precoUnitario),
            unidade: String(item.produto.unidade || ""),
          })),
        );
        setFreteRefSaco(String(v.freteTarifaSaco ?? 0));
        setFreteRefTonelada(String(v.freteTarifaTonelada ?? 0));
      })
      .catch((e) => {
        if (alive) {
          reportApiError(e, { title: "Não foi possível carregar a venda" });
          router.push("/vendas");
        }
      })
      .finally(() => {
        if (alive) setCarregandoVenda(false);
      });
    return () => {
      alive = false;
    };
  }, [editId, router]);

  useEffect(() => {
    if (!clienteId) {
      setSelectedCliente(null);
      setFretePorSaco("");
      setFretePorTonelada("");
      setFreteRefSaco("");
      setFreteRefTonelada("");
      return;
    }
    let cancelled = false;
    setSelectedCliente(null);
    api
      .get<Cliente>(`/clientes/${clienteId}`)
      .then((cli) => {
        if (cancelled) return;
        setSelectedCliente(cli);
        const saco = String(cli.fretePadraoSaco ?? cli.fretePadrao ?? 0);
        const ton = String(cli.fretePadraoTonelada ?? 0);
        setFretePorSaco(saco);
        setFretePorTonelada(ton);
        setFreteRefSaco(saco);
        setFreteRefTonelada(ton);
        if (cli.vendedorId) setVendedorId(String(cli.vendedorId));
      })
      .catch(() => {
        if (!cancelled) setSelectedCliente(null);
      });
    setItens((prev) => prev.map(() => emptyItem()));
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  const clienteObs = (selectedCliente?.observacoes ?? "").trim();
  const clienteCarregado =
    Boolean(clienteId) &&
    selectedCliente != null &&
    String(selectedCliente.id) === String(clienteId);
  const precisaAckObs = Boolean(clienteCarregado && clienteObs);
  const obsLiberada =
    !precisaAckObs || obsAckClienteId === selectedCliente?.id;
  const formBloqueadoPorObs =
    Boolean(clienteId) && (!clienteCarregado || !obsLiberada);

  useEffect(() => {
    if (!clienteId) {
      setObsModalOpen(false);
      setObsAckClienteId(null);
      return;
    }
    if (!selectedCliente || String(selectedCliente.id) !== String(clienteId)) {
      return;
    }
    const obs = (selectedCliente.observacoes ?? "").trim();
    if (!obs) {
      setObsModalOpen(false);
      return;
    }
    if (obsAckClienteId === selectedCliente.id) {
      setObsModalOpen(false);
      return;
    }
    setObsModalOpen(true);
  }, [clienteId, selectedCliente, obsAckClienteId]);

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
        prev.map((item, i) => (i === idx ? emptyItem() : item)),
      );
      return;
    }

    let preco = "";
    let precoReferencia = "";
    let unidade = "";
    let produtoNome = "";
    if (cidSnapshot) {
      try {
        const rows = await api.get<ProdutoPreco[]>(
          `/clientes/${cidSnapshot}/precos?produtoId=${encodeURIComponent(produtoId)}`,
        );
        if (clienteIdRef.current !== cidSnapshot) return;
        const pc = rows[0];
        if (pc) {
          preco = parsePrecoApi(pc.precoAplicado);
          precoReferencia = preco;
          unidade = String(pc.unidade || "");
          produtoNome = pc.nome;
        }
      } catch {
        if (clienteIdRef.current !== cidSnapshot) return;
      }
    } else {
      try {
        const p = await api.get<Produto>(`/produtos/${produtoId}`);
        if (clienteIdRef.current !== "") return;
        preco = parsePrecoApi(p.precoPadrao);
        precoReferencia = preco;
        unidade = String(p.unidade || "");
        produtoNome = p.nome;
      } catch {
        if (clienteIdRef.current !== "") return;
      }
    }

    if (cidSnapshot && clienteIdRef.current !== cidSnapshot) return;

    setItens((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              produtoId,
              produtoNome,
              precoUnitario: preco,
              precoReferencia,
              unidade,
            }
          : item,
      ),
    );
  };

  const addItem = () => setItens((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) =>
    setItens((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = itens.reduce((acc, item) => {
    const q = parseFloat(item.quantidade || "0");
    const p = parseFloat(item.precoUnitario || "0");
    return acc + q * p;
  }, 0);
  const freteVal = parseFloat(frete || "0");
  const fretePorSacoVal = parseFloat(fretePorSaco || "0");
  const fretePorTonVal = parseFloat(fretePorTonelada || "0");

  useEffect(() => {
    if (!freteEnabled) {
      setFrete("0");
      return;
    }
    const tarifaSaco = Number.isFinite(fretePorSacoVal) ? fretePorSacoVal : 0;
    const tarifaTon = Number.isFinite(fretePorTonVal) ? fretePorTonVal : 0;
    const tarifaKg = tarifaTon / 1000;
    const totalFrete = itens.reduce((acc, item) => {
      const unidade = String(item.unidade || "").trim().toLowerCase();
      const qtd = parseFloat(item.quantidade || "0");
      if (!Number.isFinite(qtd) || qtd <= 0) return acc;
      if (unidade === "saco") return acc + qtd * tarifaSaco;
      if (unidade === "ton") return acc + qtd * tarifaTon;
      if (unidade === "kg") return acc + qtd * tarifaKg;
      return acc;
    }, 0);
    setFrete(totalFrete.toFixed(2));
  }, [itens, fretePorSacoVal, fretePorTonVal, freteEnabled]);

  const salvarVenda = async (atualizarCliente?: ClienteCadastroDiff | null) => {
    const itensValidos = itens.filter(
      (i) => i.produtoId && i.quantidade && i.precoUnitario,
    );
    const payload = {
      clienteId: parseInt(clienteId, 10),
      vendedorId: parseInt(vendedorId, 10),
      motoristaId: motoristaId ? parseInt(motoristaId, 10) : null,
      freteRecibo,
      freteReciboData: freteRecibo ? freteReciboData : null,
      fretePorSaco: Number.isFinite(fretePorSacoVal) ? fretePorSacoVal : 0,
      fretePorTonelada: Number.isFinite(fretePorTonVal) ? fretePorTonVal : 0,
      dataVenda,
      observacoes: observacoes || null,
      itens: itensValidos.map((i) => ({
        produtoId: parseInt(i.produtoId, 10),
        quantidade: parseFloat(i.quantidade),
        precoUnitario: parseFloat(i.precoUnitario),
      })),
      ...(atualizarCliente
        ? { atualizarCliente: diffToAtualizarClientePayload(atualizarCliente) }
        : {}),
    };

    if (isEdit && editId) {
      const venda = await api.put<Venda>(`/vendas/${editId}`, payload);
      router.push(`/vendas/${venda.id}`);
    } else {
      const venda = await api.post<{ id: number }>("/vendas", {
        ...payload,
        frete: freteVal,
        clienteId,
        vendedorId,
        motoristaId: motoristaId || undefined,
        itens: itensValidos,
      });
      router.push(`/vendas/${venda.id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formBloqueadoPorObs) {
      setErro("Leia a observação do cliente e confirme em Li e entendi");
      setObsModalOpen(true);
      return;
    }
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

    setErro("");
    const diff = freteEnabled
      ? buildClienteCadastroDiff({
          itens: itensValidos,
          fretePorSaco,
          fretePorTonelada,
          freteRefSaco,
          freteRefTonelada,
          clienteId,
        })
      : buildClienteCadastroDiff({
          itens: itensValidos,
          fretePorSaco: "",
          fretePorTonelada: "",
          freteRefSaco: "",
          freteRefTonelada: "",
          clienteId,
        });

    if (diff) {
      setSyncDialogDiff(diff);
      setSyncDialogOpen(true);
      return;
    }

    setSalvando(true);
    try {
      await salvarVenda(null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar");
      setSalvando(false);
    }
  };

  const fecharSyncDialog = () => {
    setSyncDialogOpen(false);
    setSyncDialogDiff(null);
    setSalvando(false);
  };

  const confirmarSyncCliente = async () => {
    if (!syncDialogDiff) return;
    setSalvando(true);
    try {
      await salvarVenda(syncDialogDiff);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar");
      setSalvando(false);
      setSyncDialogOpen(false);
    }
  };

  const salvarSemAtualizarCliente = async () => {
    setSalvando(true);
    try {
      await salvarVenda(null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar");
      setSalvando(false);
      setSyncDialogOpen(false);
    }
  };

  const cli = selectedCliente;
  const com =
    cli?.comissaoFixaPercentual != null
      ? cli.comissaoFixaPercentual
      : cli?.vendedor?.comissaoPercentual;

  if (carregandoVenda) return <FormPageSkeleton />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={isEdit && editId ? `/vendas/${editId}` : "/vendas"}
          className="btn-secondary py-1.5 px-2.5"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
          {isEdit && editId ? (
            <>
              <span className="text-gray-500 font-normal text-lg">Editar</span>
              <VendaOrdem
                venda={{
                  id: Number(editId),
                  numeroVenda: numeroVenda ? Number(numeroVenda) : null,
                }}
                link={false}
                size="xl"
              />
            </>
          ) : (
            "Nova Venda"
          )}
        </h1>
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
          <div className="space-y-4">
            <SearchableSelect
              label="Cliente"
              value={clienteId}
              onChange={setClienteId}
              loadOptions={loadClienteOptions}
              loadLabelById={loadClienteLabel}
              minChars={2}
              placeholder="Nome, fantasia, CNPJ ou cidade…"
            />

            {formBloqueadoPorObs && precisaAckObs ? (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Este cliente tem observação. Confirme a leitura no aviso para
                continuar a venda.
              </p>
            ) : null}

            {obsLiberada && clienteCarregado && clienteObs ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Observação do cliente
                </p>
                <p className="mt-1 text-sm text-amber-950 whitespace-pre-line">
                  {clienteObs}
                </p>
              </div>
            ) : null}

            <fieldset
              disabled={formBloqueadoPorObs}
              className={
                formBloqueadoPorObs
                  ? "space-y-4 opacity-50 pointer-events-none"
                  : "space-y-4"
              }
            >
            {freteEnabled && !mostrarDetalhes ? (
              <p className="text-sm text-gray-600">
                Frete calculado:{" "}
                <span className="font-semibold text-gray-900">
                  {formatMoney(freteVal)}
                </span>
                <span className="text-gray-400 text-xs ml-1">
                  (tarifas padrão do cliente)
                </span>
              </p>
            ) : null}

            {!mostrarDetalhes ? (
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline"
                onClick={() => setMostrarDetalhes(true)}
              >
                Adicionar detalhes (vendedor, frete, data…)
              </button>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                {freteEnabled ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Frete (R$) — cobrado à parte
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={frete}
                        className="input-field"
                        placeholder="0,00"
                        readOnly
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Calculado automaticamente por unidade e quantidade.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tarifa frete por saco (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fretePorSaco}
                        onChange={(e) => setFretePorSaco(e.target.value)}
                        className="input-field"
                        placeholder="Ex.: 5,00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tarifa frete por tonelada (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fretePorTonelada}
                        onChange={(e) => setFretePorTonelada(e.target.value)}
                        className="input-field"
                        placeholder="Ex.: 120,00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pagamento do frete
                      </label>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={freteRecibo}
                          onChange={(e) => setFreteRecibo(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm text-gray-700">Frete pago</span>
                      </label>
                      {freteRecibo && (
                        <input
                          type="date"
                          value={freteReciboData}
                          onChange={(e) => setFreteReciboData(e.target.value)}
                          className="input-field mt-2"
                        />
                      )}
                    </div>
                  </>
                ) : null}
                <div className="xl:col-span-2">
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
            )}
            </fieldset>
          </div>
        </div>

        <fieldset
          disabled={formBloqueadoPorObs}
          className={
            formBloqueadoPorObs
              ? "card p-5 opacity-50 pointer-events-none"
              : "card p-5"
          }
        >
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
        </fieldset>

        <div
          className={
            formBloqueadoPorObs
              ? "card p-5 opacity-50 pointer-events-none"
              : "card p-5"
          }
        >
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between font-bold text-gray-900 border-b pb-2 mb-1">
                <span>Total Produtos:</span>
                <span className="text-green-700 text-lg">
                  {formatMoney(subtotal)}
                </span>
              </div>
              {freteEnabled ? (
                <>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Frete (cobrado à parte):</span>
                <span className="font-medium">{formatMoney(freteVal)}</span>
              </div>
              {freteRecibo && (
                <div className="text-xs text-blue-600 text-right">
                  Frete pago{freteReciboData ? ` em ${new Date(freteReciboData).toLocaleDateString("pt-BR")}` : ""}
                </div>
              )}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={salvando || formBloqueadoPorObs}
            className="btn-primary"
          >
            {salvando
              ? isEdit
                ? "Salvando..."
                : "Registrando..."
              : isEdit
                ? "Salvar alterações"
                : "Registrar Venda"}
          </button>
          <Link
            href={isEdit && editId ? `/vendas/${editId}` : "/vendas"}
            className="btn-secondary"
          >
            Cancelar
          </Link>
        </div>
      </form>

      <ConfirmDialog
        open={obsModalOpen}
        title="Observação do cliente"
        description={
          selectedCliente
            ? `${selectedCliente.nomeFantasia?.trim() || selectedCliente.razaoSocial}\n\n${clienteObs}`
            : clienteObs
        }
        cancelText="Trocar cliente"
        confirmText="Li e entendi"
        onConfirm={() => {
          if (selectedCliente) setObsAckClienteId(selectedCliente.id);
          setObsModalOpen(false);
        }}
        onCancel={() => {
          setObsModalOpen(false);
          setClienteId("");
          setSelectedCliente(null);
          setObsAckClienteId(null);
        }}
      />

      <ConfirmDialog
        open={syncDialogOpen}
        title="Atualizar cadastro do cliente?"
        description={
          syncDialogDiff ? formatClienteCadastroDiffMessage(syncDialogDiff) : undefined
        }
        cancelText="Voltar"
        secondaryText="Só salvar venda"
        onSecondary={() => void salvarSemAtualizarCliente()}
        confirmText="Atualizar cliente e salvar"
        busy={salvando}
        onConfirm={() => void confirmarSyncCliente()}
        onCancel={fecharSyncDialog}
      />
    </div>
  );
}
