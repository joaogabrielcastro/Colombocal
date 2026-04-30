"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { reportApiError } from "@/lib/report-api-error";

type Cliente = { id: number; razaoSocial: string; nomeFantasia?: string | null; fretePadraoSaco?: number; fretePadraoTonelada?: number };
type Motorista = { id: number; nome: string };
type Produto = { id: number; nome: string; unidade: string };

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
    produtoId: "",
    quantidade: "",
    precoSaco: "",
    precoTonelada: "",
    valorTotal: "",
    dataMovimento: new Date().toISOString().split("T")[0],
    vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    observacao: "",
    pagoNoAto: false,
    pagamentoTipo: "dinheiro" as "dinheiro" | "transferencia",
    pagamentoData: new Date().toISOString().split("T")[0],
  });

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

  const produtoSelecionado = useMemo(
    () => produtos.find((p) => String(p.id) === form.produtoId) || null,
    [produtos, form.produtoId],
  );
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

  const quantidade = Number(form.quantidade.replace(",", ".")) || 0;
  const precoSaco = Number(form.precoSaco.replace(",", ".")) || 0;
  const precoTonelada = Number(form.precoTonelada.replace(",", ".")) || 0;
  const valorCalculado =
    produtoSelecionado?.unidade?.toLowerCase() === "saco"
      ? quantidade * precoSaco
      : produtoSelecionado?.unidade?.toLowerCase() === "ton"
        ? quantidade * precoTonelada
        : produtoSelecionado?.unidade?.toLowerCase() === "kg"
          ? quantidade * (precoTonelada / 1000)
          : 0;
  const valorFinal = Number(form.valorTotal.replace(",", ".")) || valorCalculado;

  const abrirImpressao = (resumo: any) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Frete Avulso #${resumo.freteId}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111} .box{border:1px solid #ddd;border-radius:8px;padding:12px;margin:8px 0} .k{font-size:12px;color:#666} .v{font-size:16px;font-weight:700}</style></head><body>
    <h2>Comprovante de Frete Avulso #${resumo.freteId}</h2>
    <div class="box"><div class="k">Cliente</div><div class="v">${resumo.cliente}</div></div>
    <div class="box"><div class="k">Motorista</div><div class="v">${resumo.motorista}</div></div>
    <div class="box"><div class="k">Produto</div><div class="v">${resumo.produto} (${resumo.quantidade} ${resumo.unidade})</div></div>
    <div class="box"><div class="k">Valor</div><div class="v">${resumo.valorLabel}</div></div>
    <div class="box"><div class="k">Pagamento</div><div class="v">${resumo.pagoNoAto ? "Pago no ato" : "A receber (gerado título)"}</div></div>
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const salvar = async (printAfter: boolean) => {
    const clienteId = Number.parseInt(form.clienteId, 10);
    const motoristaId = Number.parseInt(form.motoristaId, 10);
    const produtoId = Number.parseInt(form.produtoId, 10);
    if (!clienteId || !motoristaId || !produtoId || quantidade <= 0 || valorFinal <= 0) {
      alert("Preencha cliente, motorista, produto, quantidade e valor.");
      return;
    }
    printAfter ? setImprimindo(true) : setSalvando(true);
    try {
      const resp = await api.post<{ frete: { id: number }; resumoImpressao: any }>("/fretes/avulso", {
        clienteId,
        motoristaId,
        produtoId,
        quantidade,
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
      if (printAfter) abrirImpressao(resp.resumoImpressao);
      router.push("/fretes");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível salvar frete avulso" });
    } finally {
      setSalvando(false);
      setImprimindo(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fretes" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Novo Frete Avulso</h1>
      </div>

      <div className="card p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Cliente</label>
          <select className="input-field" value={form.clienteId} onChange={(e) => setForm((s) => ({ ...s, clienteId: e.target.value }))}>
            <option value="">Selecione</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nomeFantasia?.trim() || c.razaoSocial}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Motorista</label>
          <select className="input-field" value={form.motoristaId} onChange={(e) => setForm((s) => ({ ...s, motoristaId: e.target.value }))}>
            <option value="">Selecione</option>
            {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Produto</label>
          <select className="input-field" value={form.produtoId} onChange={(e) => setForm((s) => ({ ...s, produtoId: e.target.value }))}>
            <option value="">Selecione</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Quantidade</label>
          <input className="input-field" value={form.quantidade} onChange={(e) => setForm((s) => ({ ...s, quantidade: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Preço por saco</label>
          <input className="input-field" value={form.precoSaco} onChange={(e) => setForm((s) => ({ ...s, precoSaco: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Preço por tonelada</label>
          <input className="input-field" value={form.precoTonelada} onChange={(e) => setForm((s) => ({ ...s, precoTonelada: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Total calculado</label>
          <input className="input-field bg-gray-50" value={formatMoney(valorCalculado)} readOnly />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Total final (editável)</label>
          <input className="input-field" value={form.valorTotal} onChange={(e) => setForm((s) => ({ ...s, valorTotal: e.target.value }))} placeholder={valorCalculado.toFixed(2)} />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Data do frete</label>
          <input type="date" className="input-field" value={form.dataMovimento} onChange={(e) => setForm((s) => ({ ...s, dataMovimento: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Vencimento (se a receber)</label>
          <input type="date" className="input-field" value={form.vencimento} onChange={(e) => setForm((s) => ({ ...s, vencimento: e.target.value }))} />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Observação</label>
          <input className="input-field" value={form.observacao} onChange={(e) => setForm((s) => ({ ...s, observacao: e.target.value }))} />
        </div>

        <div className="lg:col-span-4 border-t pt-3">
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
  );
}

