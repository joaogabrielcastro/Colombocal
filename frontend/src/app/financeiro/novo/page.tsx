"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  formatMoney,
  localDateInputValue,
  type Cliente,
  type Venda,
} from "@/lib/utils";
import { VendaOrdem, vendaOrdemTexto } from "@/components/VendaOrdem";
import { HelpCallout } from "@/components/ui/help-callout";
import api from "@/lib/api";
import { FormPageSkeleton } from "@/components/ui/skeletons";
import SearchableSelect from "@/components/SearchableSelect";
import { toast } from "sonner";
import { useVendasEmAberto } from "@/features/financeiro/hooks/useVendasEmAberto";

type ChequeLinha = {
  emitenteNome: string;
  valor: string;
  banco: string;
  numero: string;
  agencia: string;
  conta: string;
  dataRecebimento: string;
  observacoes: string;
};

const chequeVazio = (): ChequeLinha => ({
  emitenteNome: "",
  valor: "",
  banco: "",
  numero: "",
  agencia: "",
  conta: "",
  dataRecebimento: localDateInputValue(),
  observacoes: "",
});

function vendaOptionLabel(v: Venda) {
  const valor = formatMoney(v.valorTotal);
  const base = `${vendaOrdemTexto(v)} – ${new Date(v.dataVenda).toLocaleDateString("pt-BR")} – ${valor}`;
  const saldo =
    v.saldoEmAbertoTitulos != null && v.saldoEmAbertoTitulos > 0
      ? ` · em aberto ${formatMoney(v.saldoEmAbertoTitulos)}`
      : "";
  return `${base}${saldo}`;
}

function RegistrarRecebimentoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preClienteId = searchParams.get("clienteId") || "";
  const preVendaId = searchParams.get("vendaId") || "";
  const preOrdem = searchParams.get("ordem") || "";

  const [clienteId, setClienteId] = useState(preClienteId);
  const [vendaId, setVendaId] = useState(preVendaId);
  const [vendaExtra, setVendaExtra] = useState<Venda | null>(null);
  const [ordemInput, setOrdemInput] = useState(preOrdem.replace(/^#/, ""));
  const [buscandoOrdem, setBuscandoOrdem] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [chequeItens, setChequeItens] = useState<ChequeLinha[]>([]);
  const [dinheiro, setDinheiro] = useState({
    valor: "",
    data: localDateInputValue(),
    observacoes: "",
  });
  const [pix, setPix] = useState({
    valor: "",
    data: localDateInputValue(),
    observacoes: "",
  });
  const [trocoTipo, setTrocoTipo] = useState<"dinheiro" | "transferencia">("dinheiro");

  const { vendas } = useVendasEmAberto(clienteId);

  const vendaSelecionada =
    vendas.find((v) => String(v.id) === String(vendaId)) ??
    (vendaExtra && String(vendaExtra.id) === String(vendaId) ? vendaExtra : null);

  const saldoVenda = Math.max(
    0,
    parseFloat(String(vendaSelecionada?.saldoEmAbertoTitulos ?? 0)),
  );

  const aplicarVenda = useCallback((v: Venda) => {
    setVendaExtra(v);
    setClienteId(String(v.clienteId));
    setVendaId(String(v.id));
    setOrdemInput(String(v.numeroVenda ?? v.id));
    setChequeItens((prev) => (prev.length > 0 ? prev : [chequeVazio()]));
  }, []);

  const buscarPorOrdem = useCallback(async (raw?: string) => {
    const termo = (raw ?? ordemInput).trim().replace(/^#/, "");
    if (!termo) {
      setErro("Digite o número da ordem (ex.: 278 ou #278)");
      return;
    }
    setBuscandoOrdem(true);
    setErro("");
    try {
      const v = await api.get<Venda>(`/vendas/por-ordem/${encodeURIComponent(termo)}`);
      aplicarVenda(v);
      toast.success(`Ordem ${vendaOrdemTexto(v)} encontrada.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Venda não encontrada";
      setErro(msg);
    } finally {
      setBuscandoOrdem(false);
    }
  }, [aplicarVenda, ordemInput]);

  useEffect(() => {
    if (preOrdem) void buscarPorOrdem(preOrdem);
    else if (preVendaId && !preClienteId) {
      api
        .get<Venda>(`/vendas/${preVendaId}`)
        .then(aplicarVenda)
        .catch(() => {});
    }
  }, [preOrdem, preVendaId, preClienteId, aplicarVenda, buscarPorOrdem]);

  const loadClienteOptions = useCallback(async (q: string) => {
    const p = new URLSearchParams({ ativo: "true", busca: q, take: "40" });
    const r = await api.get<{ clientes: Cliente[] }>(`/clientes?${p}`);
    return r.clientes.map((c) => ({
      id: c.id,
      label: (c.nomeFantasia?.trim() || c.razaoSocial) as string,
    }));
  }, []);

  const loadClienteLabelById = useCallback(async (id: string) => {
    const c = await api.get<Cliente>(`/clientes/${id}`);
    return (c.nomeFantasia?.trim() || c.razaoSocial) ?? null;
  }, []);

  const loadVendaOptions = useCallback(
    async (q: string) => {
      const qt = q.trim().toLowerCase();
      let list = [...vendas];
      if (vendaExtra && !list.some((v) => String(v.id) === String(vendaExtra.id))) {
        list = [vendaExtra, ...list];
      }
      if (qt) {
        list = list.filter(
          (v) =>
            String(v.id).includes(qt) ||
            String(v.numeroVenda ?? "").includes(qt) ||
            vendaOptionLabel(v).toLowerCase().includes(qt),
        );
      }
      return list.slice(0, 80).map((v) => ({
        id: v.id,
        label: vendaOptionLabel(v),
      }));
    },
    [vendas, vendaExtra],
  );

  const loadVendaLabelById = useCallback(
    async (id: string) => {
      const fromList = vendas.find((v) => String(v.id) === id);
      if (fromList) return vendaOptionLabel(fromList);
      if (vendaExtra && String(vendaExtra.id) === id) return vendaOptionLabel(vendaExtra);
      try {
        const v = await api.get<Venda>(`/vendas/${id}`);
        return vendaOptionLabel(v);
      } catch {
        return null;
      }
    },
    [vendas, vendaExtra],
  );

  const chequesValidos = chequeItens
    .map((i) => ({
      ...i,
      emitenteNome: i.emitenteNome.trim(),
      valor: parseFloat(i.valor),
    }))
    .filter((i) => i.emitenteNome && Number.isFinite(i.valor) && i.valor > 0);

  const valorDinheiro = parseFloat(dinheiro.valor) || 0;
  const valorPix = parseFloat(pix.valor) || 0;
  const totalCheques = chequesValidos.reduce((acc, i) => acc + i.valor, 0);
  const totalGeral = totalCheques + valorDinheiro + valorPix;
  const excedente = Math.max(0, totalGeral - saldoVenda);
  const restante = Math.max(0, saldoVenda - totalGeral);

  const validarBase = () => {
    if (!clienteId) {
      setErro("Selecione o cliente");
      return false;
    }
    if (!vendaId) {
      setErro("Selecione a ordem da venda");
      return false;
    }
    if (totalGeral < 0.01) {
      setErro("Informe ao menos um cheque, valor em dinheiro ou PIX");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarBase()) return;

    setSalvando(true);
    setErro("");
    try {
      const body: Record<string, unknown> = {
        clienteId: parseInt(clienteId, 10),
        vendaId: parseInt(vendaId, 10),
        ...(excedente > 0 ? { trocoTipo } : {}),
      };

      if (chequesValidos.length > 0) {
        body.cheques = chequesValidos.map((i) => ({
          emitenteNome: i.emitenteNome,
          valor: i.valor,
          banco: i.banco || undefined,
          numero: i.numero || undefined,
          agencia: i.agencia || undefined,
          conta: i.conta || undefined,
          dataRecebimento: i.dataRecebimento,
          observacoes: i.observacoes || undefined,
        }));
      }

      if (valorDinheiro > 0) {
        body.dinheiro = {
          valor: valorDinheiro,
          data: dinheiro.data,
          observacoes: dinheiro.observacoes || undefined,
        };
      }

      if (valorPix > 0) {
        body.pix = {
          valor: valorPix,
          data: pix.data,
          observacoes: pix.observacoes || undefined,
        };
      }

      const resp = await api.post<{
        excedente?: number;
        trocoTipo?: string | null;
        resumo?: { cheques: number; dinheiro: number; pix: number };
      }>("/recebimentos", body);

      const partes: string[] = [];
      if ((resp.resumo?.cheques ?? 0) > 0) partes.push(`${formatMoney(resp.resumo!.cheques)} em cheques`);
      if ((resp.resumo?.dinheiro ?? 0) > 0) partes.push(`${formatMoney(resp.resumo!.dinheiro)} em dinheiro`);
      if ((resp.resumo?.pix ?? 0) > 0) partes.push(`${formatMoney(resp.resumo!.pix)} em PIX`);

      if ((resp.excedente ?? 0) > 0) {
        toast.success(
          `Recebimento registrado (${partes.join(", ")}). Troco ${formatMoney(resp.excedente || 0)} via ${
            resp.trocoTipo === "transferencia" ? "Pix/transferência" : "dinheiro"
          }.`,
        );
      } else {
        toast.success(
          partes.length
            ? `Recebimento registrado: ${partes.join(", ")}.`
            : "Recebimento registrado com sucesso.",
        );
      }
      router.push("/financeiro");
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro ao registrar recebimento");
      setSalvando(false);
    }
  };

  const updateCheque = (index: number, patch: Partial<ChequeLinha>) => {
    setChequeItens((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/financeiro" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrar recebimento</h1>
          <p className="text-gray-500 text-sm mt-1">
            Cheque, dinheiro e PIX na mesma baixa — preencha tudo e registre uma vez só.
          </p>
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erro}
        </div>
      )}

      <div className="card p-5 mb-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">1. Localizar a venda</p>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs text-gray-500 mb-1">Buscar pela ordem (#)</label>
            <input
              className="input-field font-mono"
              placeholder="Ex.: 278 ou #278"
              value={ordemInput}
              onChange={(e) => setOrdemInput(e.target.value.replace(/^#/, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void buscarPorOrdem();
                }
              }}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-primary"
              disabled={buscandoOrdem}
              onClick={() => void buscarPorOrdem()}
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              {buscandoOrdem ? "Buscando…" : "Buscar ordem"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableSelect
            label="Cliente *"
            value={clienteId}
            onChange={(id) => {
              setClienteId(id);
              setVendaId("");
              setVendaExtra(null);
            }}
            loadOptions={loadClienteOptions}
            loadLabelById={loadClienteLabelById}
            minChars={2}
            emptyHint="Digite parte do nome, fantasia ou CNPJ."
          />
          <SearchableSelect
            label="Ordem da venda *"
            value={vendaId}
            onChange={(id) => {
              setVendaId(id);
              const v =
                vendas.find((x) => String(x.id) === id) ??
                (vendaExtra && String(vendaExtra.id) === id ? vendaExtra : null);
              setVendaExtra(v ?? null);
            }}
            loadOptions={loadVendaOptions}
            loadLabelById={loadVendaLabelById}
            selectedLabel={vendaSelecionada ? vendaOptionLabel(vendaSelecionada) : undefined}
            minChars={0}
            disabled={!clienteId}
            placeholder={
              clienteId ? "Escolha a ordem ou busque acima pelo #" : "Busque pela ordem ou selecione o cliente"
            }
            emptyHint="Vendas com saldo em aberto deste cliente."
          />
        </div>

        {vendaSelecionada ? (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-sm text-gray-600">Venda selecionada:</span>
              <VendaOrdem venda={vendaSelecionada} size="sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <p>
                Total: <strong>{formatMoney(vendaSelecionada.valorTotal)}</strong>
              </p>
              <p>
                Em aberto: <strong className="text-amber-800">{formatMoney(saldoVenda)}</strong>
              </p>
              <p>
                Data: {new Date(vendaSelecionada.dataVenda).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {vendaSelecionada ? (
          <HelpCallout variant="tip">
            Nesta tela você combina as formas de pagamento: ex. R$ 100 em cheque + R$ 325 em
            dinheiro. Preencha cheque, dinheiro e/ou PIX abaixo e clique em{" "}
            <strong>Registrar recebimento</strong> uma única vez.
          </HelpCallout>
        ) : null}

        <div className="card p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <p className="text-sm font-semibold text-gray-900">2. Formas de pagamento deste recebimento</p>
            {vendaId && totalGeral > 0 ? (
              <div className="text-sm text-right">
                <p>
                  Total informado: <strong>{formatMoney(totalGeral)}</strong>
                </p>
                <p className="text-gray-500">
                  Saldo {formatMoney(saldoVenda)}
                  {excedente > 0 ? (
                    <> · troco {formatMoney(excedente)}</>
                  ) : (
                    <> · falta {formatMoney(restante)}</>
                  )}
                </p>
              </div>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-800">Cheques</p>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5"
                onClick={() => setChequeItens((prev) => [...prev, chequeVazio()])}
              >
                <PlusIcon className="w-3.5 h-3.5" /> Adicionar cheque
              </button>
            </div>

          {chequeItens.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum cheque adicionado. Clique em &quot;Adicionar cheque&quot; se houver cheques neste recebimento.
            </p>
          ) : (
            <div className="space-y-3">
              {chequeItens.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-6 gap-2 border rounded-lg border-gray-100 p-2"
                >
                  <input
                    className="input-field md:col-span-2"
                    placeholder="Emitente *"
                    value={item.emitenteNome}
                    onChange={(e) => updateCheque(index, { emitenteNome: e.target.value })}
                  />
                  <input
                    className="input-field"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Valor *"
                    value={item.valor}
                    onChange={(e) => updateCheque(index, { valor: e.target.value })}
                  />
                  <input
                    className="input-field"
                    placeholder="Banco"
                    value={item.banco}
                    onChange={(e) => updateCheque(index, { banco: e.target.value })}
                  />
                  <input
                    className="input-field"
                    placeholder="Nº cheque"
                    value={item.numero}
                    onChange={(e) => updateCheque(index, { numero: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <input
                      className="input-field"
                      type="date"
                      value={item.dataRecebimento}
                      onChange={(e) => updateCheque(index, { dataRecebimento: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-secondary px-2"
                      onClick={() => setChequeItens((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <TrashIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="text-sm font-medium text-gray-800 mb-3">Dinheiro — preencha junto com o cheque</p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field"
                  placeholder="Ex.: 325,00"
                  value={dinheiro.valor}
                  onChange={(e) => setDinheiro((p) => ({ ...p, valor: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data</label>
                <input
                  type="date"
                  className="input-field"
                  value={dinheiro.data}
                  onChange={(e) => setDinheiro((p) => ({ ...p, data: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Observações</label>
                <input
                  className="input-field"
                  value={dinheiro.observacoes}
                  onChange={(e) => setDinheiro((p) => ({ ...p, observacoes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <p className="text-sm font-medium text-gray-800 mb-3">PIX / transferência</p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field"
                  placeholder="Ex.: 50,00"
                  value={pix.valor}
                  onChange={(e) => setPix((p) => ({ ...p, valor: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data</label>
                <input
                  type="date"
                  className="input-field"
                  value={pix.data}
                  onChange={(e) => setPix((p) => ({ ...p, data: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Observações</label>
                <input
                  className="input-field"
                  value={pix.observacoes}
                  onChange={(e) => setPix((p) => ({ ...p, observacoes: e.target.value }))}
                />
              </div>
            </div>
          </div>
          </div>
        </div>

        {excedente > 0 && (
          <div className="card p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Devolver troco em</label>
            <select
              className="input-field max-w-xs"
              value={trocoTipo}
              onChange={(e) => setTrocoTipo(e.target.value as "dinheiro" | "transferencia")}
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Pix / transferência</option>
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={salvando} className="btn-primary">
            {salvando ? "Registrando…" : "Registrar recebimento"}
          </button>
          <Link href="/financeiro" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function FinanceiroNovoPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <RegistrarRecebimentoForm />
    </Suspense>
  );
}
