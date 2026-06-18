"use client";
import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  formatMoney,
  localDateInputValue,
  type Cliente,
  type Venda,
  vendaNumeroPublico,
} from "@/lib/utils";
import api from "@/lib/api";
import { FormPageSkeleton } from "@/components/ui/skeletons";
import SearchableSelect from "@/components/SearchableSelect";
import { toast } from "sonner";
import { useVendasEmAberto } from "@/features/cheques/hooks/useVendasEmAberto";

function vendaOptionLabel(v: Venda) {
  const valor = formatMoney(v.valorTotal);
  const base = `Venda #${vendaNumeroPublico(v)} – ${new Date(v.dataVenda).toLocaleDateString("pt-BR")} – ${valor}`;
  const saldo =
    v.saldoEmAbertoTitulos != null && v.saldoEmAbertoTitulos > 0
      ? ` · em aberto ${formatMoney(v.saldoEmAbertoTitulos)}`
      : "";
  return `${base}${saldo}`;
}

function NovoChequeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preClienteId = searchParams.get("clienteId");

  const [form, setForm] = useState({
    clienteId: preClienteId || "",
    vendaId: "",
    valor: "",
    emitenteNome: "",
    banco: "",
    numero: "",
    agencia: "",
    conta: "",
    dataRecebimento: localDateInputValue(),
    observacoes: "",
  });
  const { vendas } = useVendasEmAberto(form.clienteId);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState<"unitario" | "lote">("unitario");
  const [loteVendaId, setLoteVendaId] = useState("");
  const [unitarioTrocoTipo, setUnitarioTrocoTipo] = useState<
    "dinheiro" | "transferencia"
  >("dinheiro");
  const [loteTrocoTipo, setLoteTrocoTipo] = useState<"dinheiro" | "transferencia">(
    "dinheiro",
  );
  const [loteItens, setLoteItens] = useState([
    {
      emitenteNome: "",
      valor: "",
      banco: "",
      numero: "",
      agencia: "",
      conta: "",
      dataRecebimento: localDateInputValue(),
      observacoes: "",
    },
  ]);

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
      let list = vendas;
      if (qt) {
        list = vendas.filter(
          (v) =>
            String(v.id).includes(qt) ||
            vendaOptionLabel(v).toLowerCase().includes(qt),
        );
      }
      return list.slice(0, 80).map((v) => ({
        id: v.id,
        label: vendaOptionLabel(v),
      }));
    },
    [vendas],
  );
  const set =
    (field: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const addLoteItem = () => {
    setLoteItens((prev) => [
      ...prev,
      {
        emitenteNome: "",
        valor: "",
        banco: "",
        numero: "",
        agencia: "",
        conta: "",
        dataRecebimento: localDateInputValue(),
        observacoes: "",
      },
    ]);
  };

  const removeLoteItem = (index: number) => {
    setLoteItens((prev) => prev.filter((_, i) => i !== index));
  };

  const setLoteItem =
    (index: number, field: keyof (typeof loteItens)[number]) =>
    (value: string) => {
      setLoteItens((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
      );
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId || !form.valor || !form.emitenteNome.trim()) {
      setErro("Selecione o cliente e informe emitente e valor");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const resp = await api.post<{ trocoValor?: number; trocoTipo?: string }>("/cheques", {
        ...form,
        valor: parseFloat(form.valor),
        vendaId: form.vendaId ? parseInt(form.vendaId) : undefined,
        ...(excedenteUnitario > 0 ? { trocoTipo: unitarioTrocoTipo } : {}),
      });
      if ((resp.trocoValor ?? 0) > 0) {
        toast.success(
          `Venda quitada. Troco ${formatMoney(resp.trocoValor || 0)} via ${
            resp.trocoTipo === "transferencia" ? "Pix/transferência" : "dinheiro"
          }.`,
        );
      } else {
        toast.success("Cheque registrado com sucesso.");
      }
      router.push("/cheques");
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  const handleSubmitLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId || !loteVendaId) {
      setErro("Selecione cliente e venda para o cadastro em lote");
      return;
    }
    const itensValidos = loteItens
      .map((i) => ({
        ...i,
        emitenteNome: i.emitenteNome.trim(),
        valor: parseFloat(i.valor),
      }))
      .filter((i) => i.emitenteNome && Number.isFinite(i.valor) && i.valor > 0);
    if (!itensValidos.length) {
      setErro("Informe ao menos um cheque válido no lote");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const resp = await api.post<{
        excedente?: number;
        trocoTipo?: string | null;
      }>("/cheques/lote", {
        clienteId: parseInt(form.clienteId, 10),
        vendaId: parseInt(loteVendaId, 10),
        ...(excedenteLote > 0 ? { trocoTipo: loteTrocoTipo } : {}),
        itens: itensValidos,
      });
      if ((resp.excedente ?? 0) > 0) {
        toast.success(
          `Lote registrado e venda quitada. Troco ${formatMoney(resp.excedente || 0)} via ${
            resp.trocoTipo === "transferencia" ? "Pix/transferência" : "dinheiro"
          }.`,
        );
      } else {
        toast.success("Lote de cheques registrado com sucesso.");
      }
      router.push("/cheques");
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  const vendaSelecionadaUnitario = vendas.find(
    (v) => String(v.id) === String(form.vendaId),
  );
  const saldoVendaUnitario = Math.max(
    0,
    parseFloat(String(vendaSelecionadaUnitario?.saldoEmAbertoTitulos ?? 0)),
  );
  const valorUnitario = parseFloat(form.valor || "0") || 0;
  const restanteUnitario = Math.max(0, saldoVendaUnitario - valorUnitario);
  const excedenteUnitario = Math.max(0, valorUnitario - saldoVendaUnitario);

  const totalLote = loteItens.reduce((acc, i) => acc + (parseFloat(i.valor) || 0), 0);
  const vendaSelecionadaLote = vendas.find((v) => String(v.id) === String(loteVendaId));
  const saldoVendaLote = Math.max(
    0,
    parseFloat(String(vendaSelecionadaLote?.saldoEmAbertoTitulos ?? 0)),
  );
  const restanteAteQuitar = Math.max(0, saldoVendaLote - totalLote);
  const excedenteLote = Math.max(0, totalLote - saldoVendaLote);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cheques" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrar Cheque</h1>
          <p className="text-gray-500 text-sm">
            Cheques A Receber não afetam o saldo até serem marcados como
            Recebidos. Depois, podem ser Repassados para circular.
          </p>
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erro}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={modo === "unitario" ? "btn-primary" : "btn-secondary"}
          onClick={() => setModo("unitario")}
        >
          Cadastro unitário
        </button>
        <button
          type="button"
          className={modo === "lote" ? "btn-primary" : "btn-secondary"}
          onClick={() => setModo("lote")}
        >
          Cadastro em lote
        </button>
      </div>

      <form onSubmit={modo === "unitario" ? handleSubmit : handleSubmitLote} className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2 lg:col-span-3">
            <SearchableSelect
              label="Cliente *"
              value={form.clienteId}
              onChange={(id) =>
                setForm((p) => ({ ...p, clienteId: id, vendaId: "" }))
              }
              loadOptions={loadClienteOptions}
              loadLabelById={loadClienteLabelById}
              minChars={2}
              emptyHint="Digite parte do nome, fantasia ou CNPJ."
            />
          </div>

          {modo === "unitario" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor do Cheque (R$) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.valor}
                  onChange={set("valor")}
                  className="input-field"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emitente do cheque *
                </label>
                <input
                  required
                  value={form.emitenteNome}
                  onChange={set("emitenteNome")}
                  className="input-field"
                  placeholder="Nome de quem emitiu o cheque"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data do pagamento
                </label>
                <input
                  type="date"
                  value={form.dataRecebimento}
                  onChange={set("dataRecebimento")}
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ao salvar, o valor abate o saldo do cliente na hora (como
                  dinheiro ou PIX).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banco
                </label>
                <input
                  value={form.banco}
                  onChange={set("banco")}
                  className="input-field"
                  placeholder="ex: Bradesco, Itaú..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número do Cheque
                </label>
                <input
                  value={form.numero}
                  onChange={set("numero")}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agência
                </label>
                <input
                  value={form.agencia}
                  onChange={set("agencia")}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conta
                </label>
                <input
                  value={form.conta}
                  onChange={set("conta")}
                  className="input-field"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <SearchableSelect
                  label="Venda vinculada (opcional)"
                  value={form.vendaId}
                  onChange={(id) => setForm((p) => ({ ...p, vendaId: id }))}
                  loadOptions={loadVendaOptions}
                  minChars={0}
                  disabled={!form.clienteId}
                  placeholder={
                    form.clienteId
                      ? "Busque por nº da venda ou valor…"
                      : "Selecione o cliente primeiro"
                  }
                  emptyHint="Só aparecem vendas com parcela em aberto no título. Deixe em branco se não houver venda específica."
                />
              </div>
              {!!form.vendaId && (
                <>
                  <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm">
                    <p>
                      Saldo atual da venda:{" "}
                      <span className="font-semibold">
                        {formatMoney(saldoVendaUnitario)}
                      </span>
                    </p>
                    <p>
                      Valor do cheque:{" "}
                      <span className="font-semibold">{formatMoney(valorUnitario)}</span>
                    </p>
                    {excedenteUnitario > 0 ? (
                      <p className="text-amber-700">
                        Excedente (troco):{" "}
                        <span className="font-semibold">
                          {formatMoney(excedenteUnitario)}
                        </span>
                      </p>
                    ) : (
                      <p>
                        Falta para quitar:{" "}
                        <span className="font-semibold">
                          {formatMoney(restanteUnitario)}
                        </span>
                      </p>
                    )}
                  </div>
                  {excedenteUnitario > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Troco do excedente *
                      </label>
                      <select
                        value={unitarioTrocoTipo}
                        onChange={(e) =>
                          setUnitarioTrocoTipo(
                            e.target.value as "dinheiro" | "transferencia",
                          )
                        }
                        className="input-field"
                      >
                        <option value="dinheiro">Dinheiro</option>
                        <option value="transferencia">Pix / transferência</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={form.observacoes}
                  onChange={set("observacoes")}
                  className="input-field"
                  rows={2}
                />
              </div>
            </>
          )}

          {modo === "lote" && (
            <>
              <div className="md:col-span-2 lg:col-span-3">
                <SearchableSelect
                  label="Venda vinculada para abatimento *"
                  value={loteVendaId}
                  onChange={setLoteVendaId}
                  loadOptions={loadVendaOptions}
                  minChars={0}
                  disabled={!form.clienteId}
                  placeholder={
                    form.clienteId
                      ? "Busque por nº da venda ou valor…"
                      : "Selecione o cliente primeiro"
                  }
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm">
                <p>
                  Saldo atual da venda:{" "}
                  <span className="font-semibold">{formatMoney(saldoVendaLote)}</span>
                </p>
                <p>
                  Total do lote:{" "}
                  <span className="font-semibold">{formatMoney(totalLote)}</span>
                </p>
                {excedenteLote > 0 ? (
                  <p className="text-amber-700">
                    Excedente (troco):{" "}
                    <span className="font-semibold">{formatMoney(excedenteLote)}</span>
                  </p>
                ) : (
                  <p>
                    Falta para quitar:{" "}
                    <span className="font-semibold">{formatMoney(restanteAteQuitar)}</span>
                  </p>
                )}
              </div>
              {excedenteLote > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Troco do excedente *
                  </label>
                  <select
                    value={loteTrocoTipo}
                    onChange={(e) =>
                      setLoteTrocoTipo(e.target.value as "dinheiro" | "transferencia")
                    }
                    className="input-field"
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Pix / transferência</option>
                  </select>
                </div>
              )}
              <div className="md:col-span-2 lg:col-span-3 border rounded-lg border-gray-200 p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">
                    Cheques do lote
                  </p>
                  <button
                    type="button"
                    className="btn-secondary text-xs py-1.5"
                    onClick={addLoteItem}
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Adicionar linha
                  </button>
                </div>
                <div className="space-y-3">
                  {loteItens.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-2 border rounded-lg border-gray-100 p-2">
                      <input
                        className="input-field md:col-span-2"
                        placeholder="Emitente *"
                        value={item.emitenteNome}
                        onChange={(e) => setLoteItem(index, "emitenteNome")(e.target.value)}
                      />
                      <input
                        className="input-field"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Valor *"
                        value={item.valor}
                        onChange={(e) => setLoteItem(index, "valor")(e.target.value)}
                      />
                      <input
                        className="input-field"
                        placeholder="Banco"
                        value={item.banco}
                        onChange={(e) => setLoteItem(index, "banco")(e.target.value)}
                      />
                      <input
                        className="input-field"
                        placeholder="Número"
                        value={item.numero}
                        onChange={(e) => setLoteItem(index, "numero")(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <input
                          className="input-field"
                          type="date"
                          value={item.dataRecebimento}
                          onChange={(e) => setLoteItem(index, "dataRecebimento")(e.target.value)}
                        />
                        {loteItens.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLoteItem(index)}
                            className="btn-secondary px-2"
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  Total do lote: <span className="font-semibold">{formatMoney(totalLote)}</span>
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={salvando} className="btn-primary">
            {salvando
              ? "Registrando..."
              : modo === "unitario"
                ? "Registrar Cheque"
                : "Registrar Lote de Cheques"}
          </button>
          <Link href="/cheques" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NovoChequeePage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <NovoChequeForm />
    </Suspense>
  );
}
