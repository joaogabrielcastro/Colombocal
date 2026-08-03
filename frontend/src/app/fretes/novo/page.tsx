"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { formatMoney, localDateInputValue } from "@/lib/utils";
import { freteLinha } from "@/lib/frete";
import { reportApiError } from "@/lib/report-api-error";
import FreteFeatureGuard from "@/components/FreteFeatureGuard";
import SearchableSelect from "@/components/SearchableSelect";
import { openFreteAvulsoPrint } from "@/lib/frete-avulso-print";

type Cliente = { id: number; razaoSocial: string; nomeFantasia?: string | null; fretePadraoSaco?: number; fretePadraoTonelada?: number };
type Motorista = { id: number; nome: string };
type Produto = { id: number; nome: string; unidade: string; pesoKg?: number | null };
type FreteItemForm = { produtoId: string; quantidade: string };

export default function NovoFretePage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  const [form, setForm] = useState({
    clienteId: "",
    motoristaId: "",
    precoSaco: "",
    precoTonelada: "",
    valorTotal: "",
    dataMovimento: localDateInputValue(),
    vencimento: localDateInputValue(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ),
    observacao: "",
    pagoNoAto: false,
    pagamentoTipo: "dinheiro" as "dinheiro" | "transferencia",
    pagamentoData: localDateInputValue(),
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

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => String(c.id) === form.clienteId) || null,
    [clientes, form.clienteId],
  );

  useEffect(() => {
    if (!clienteSelecionado) return;
    setForm((s) => ({
      ...s,
      precoSaco: s.precoSaco || String(clienteSelecionado.fretePadraoSaco ?? 0),
      precoTonelada: s.precoTonelada || String(clienteSelecionado.fretePadraoTonelada ?? 0),
    }));
  }, [clienteSelecionado]);

  const precoSaco = Number(form.precoSaco.replace(",", ".")) || 0;
  const precoTonelada = Number(form.precoTonelada.replace(",", ".")) || 0;
  const subtotais = itens.map((item) => {
    const produto = produtos.find((p) => String(p.id) === item.produtoId);
    const quantidade = Number(item.quantidade.replace(",", ".")) || 0;
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
  const valorFinal = Number(form.valorTotal.replace(",", ".")) || valorCalculado;

  const salvar = async (printAfter: boolean) => {
    const clienteId = Number.parseInt(form.clienteId, 10);
    const motoristaId = Number.parseInt(form.motoristaId, 10);
    const itensValidos = itens
      .map((item) => ({
        produtoId: Number.parseInt(item.produtoId, 10),
        quantidade: Number(item.quantidade.replace(",", ".")),
      }))
      .filter((item) => item.produtoId > 0 && Number.isFinite(item.quantidade) && item.quantidade > 0);
    if (!clienteId || !motoristaId || itensValidos.length === 0 || valorFinal <= 0) {
      alert("Preencha cliente, motorista, pelo menos um item e valor.");
      return;
    }
    printAfter ? setImprimindo(true) : setSalvando(true);
    try {
      const resp = await api.post<{ frete: { id: number }; resumoImpressao: any }>("/fretes/avulso", {
        clienteId,
        motoristaId,
        itens: itensValidos,
        precoSaco,
        precoTonelada,
        valorTotal: valorFinal,
        dataMovimento: form.dataMovimento,
        vencimento: form.vencimento,
        observacao: form.observacao,
        pagoNoAto: form.pagoNoAto,
        pagamentoTipo: form.pagamentoTipo,
        pagamentoData: form.pagamentoData,
      });
      if (printAfter) openFreteAvulsoPrint(resp.resumoImpressao);
      router.push("/fretes");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível salvar frete avulso" });
    } finally {
      setSalvando(false);
      setImprimindo(false);
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
        .map((m) => ({ id: m.id, label: m.nome })),
    [motoristas],
  );
  const loadMotoristaLabelById = useCallback(
    async (id: string) => {
      const m = motoristas.find((x) => String(x.id) === id);
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
    async (id: string) => {
      const p = produtos.find((x) => String(x.id) === id);
      return p ? `${p.nome} (${p.unidade})` : null;
    },
    [produtos],
  );

  return (
    <FreteFeatureGuard>
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fretes" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Novo Frete Avulso</h1>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SearchableSelect
            label="Cliente"
            value={form.clienteId}
            onChange={(id) => setForm((s) => ({ ...s, clienteId: id }))}
            loadOptions={loadClienteOptions}
            loadLabelById={loadClienteLabelById}
            minChars={0}
            placeholder="Buscar cliente..."
          />
          <SearchableSelect
            label="Motorista"
            value={form.motoristaId}
            onChange={(id) => setForm((s) => ({ ...s, motoristaId: id }))}
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
            <button type="button" className="btn-secondary text-xs py-1.5" onClick={adicionarItem}>
              + Adicionar item
            </button>
          </div>
          <div className="space-y-2">
            {itens.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-7">
                  <SearchableSelect
                    hideLabel
                    label={`Produto item ${index + 1}`}
                    value={item.produtoId}
                    onChange={(id) =>
                      setItens((prev) => prev.map((it, i) => (i === index ? { ...it, produtoId: id } : it)))
                    }
                    loadOptions={loadProdutoOptions}
                    loadLabelById={loadProdutoLabelById}
                    minChars={0}
                    placeholder="Buscar produto..."
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    className="input-field"
                    placeholder="Quantidade"
                    value={item.quantidade}
                    onChange={(e) =>
                      setItens((prev) => prev.map((it, i) => (i === index ? { ...it, quantidade: e.target.value } : it)))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <button type="button" className="btn-secondary w-full" onClick={() => removerItem(index)}>
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
            <input className="input-field bg-gray-50" value={formatMoney(valorCalculado)} readOnly />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Total final (editável)</label>
            <input
              className="input-field"
              value={form.valorTotal}
              onChange={(e) => setForm((s) => ({ ...s, valorTotal: e.target.value }))}
              placeholder={valorCalculado.toFixed(2)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Data do frete</label>
            <input
              type="date"
              className="input-field"
              value={form.dataMovimento}
              onChange={(e) => setForm((s) => ({ ...s, dataMovimento: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Vencimento (se a receber)</label>
            <input
              type="date"
              className="input-field"
              value={form.vencimento}
              onChange={(e) => setForm((s) => ({ ...s, vencimento: e.target.value }))}
            />
          </div>
          <div className="lg:col-span-4">
            <label className="block text-sm text-gray-600 mb-1">Observação</label>
            <input
              className="input-field"
              value={form.observacao}
              onChange={(e) => setForm((s) => ({ ...s, observacao: e.target.value }))}
            />
          </div>
        </div>

        <div className="border-t pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pagoNoAto} onChange={(e) => setForm((s) => ({ ...s, pagoNoAto: e.target.checked }))} />
            Pago no ato (não gerar a receber)
          </label>
          {form.pagoNoAto && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Forma de pagamento</label>
                <select className="input-field" value={form.pagamentoTipo} onChange={(e) => setForm((s) => ({ ...s, pagamentoTipo: e.target.value as "dinheiro" | "transferencia" }))}>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência / Pix</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Data pagamento</label>
                <input type="date" className="input-field" value={form.pagamentoData} onChange={(e) => setForm((s) => ({ ...s, pagamentoData: e.target.value }))} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button className="btn-primary" onClick={() => void salvar(false)} disabled={salvando || imprimindo}>
          {salvando ? "Salvando..." : "Salvar frete"}
        </button>
        <button className="btn-secondary" onClick={() => void salvar(true)} disabled={salvando || imprimindo}>
          {imprimindo ? "Imprimindo..." : "Salvar e imprimir"}
        </button>
        <Link href="/fretes" className="btn-secondary">Cancelar</Link>
      </div>
    </div>
    </FreteFeatureGuard>
  );
}

