"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { formatMoney, type Cliente, type Venda } from "@/lib/utils";
import api from "@/lib/api";
import { FormPageSkeleton } from "@/components/ui/skeletons";
import SearchableSelect from "@/components/SearchableSelect";

function vendaOptionLabel(v: Venda) {
  const valor = formatMoney(v.valorTotal);
  return `Venda #${v.id} – ${new Date(v.dataVenda).toLocaleDateString("pt-BR")} – ${valor}`;
}

function NovoChequeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preClienteId = searchParams.get("clienteId");

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [form, setForm] = useState({
    clienteId: preClienteId || "",
    vendaId: "",
    status: "a_receber",
    valor: "",
    banco: "",
    numero: "",
    agencia: "",
    conta: "",
    dataRecebimento: new Date().toISOString().split("T")[0],
    observacoes: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

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

  useEffect(() => {
    if (!form.clienteId) {
      setVendas([]);
      return;
    }
    let cancelled = false;
    api
      .get<Venda[]>(`/vendas?clienteId=${form.clienteId}&take=500`)
      .then((rows) => {
        if (!cancelled) setVendas(rows);
      })
      .catch(() => {
        if (!cancelled) setVendas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.clienteId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId || !form.valor) {
      setErro("Selecione o cliente e informe o valor");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await api.post("/cheques", {
        ...form,
        valor: parseFloat(form.valor),
        vendaId: form.vendaId ? parseInt(form.vendaId) : undefined,
      });
      router.push("/cheques");
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cheques" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrar Cheque</h1>
          <p className="text-gray-500 text-sm">
            Cheques A Receber não afetam o saldo até serem marcados como
            Recebidos
          </p>
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
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
              Data de Recebimento
            </label>
            <input
              type="date"
              value={form.dataRecebimento}
              onChange={set("dataRecebimento")}
              className="input-field"
            />
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

          <div className="md:col-span-2">
            <SearchableSelect
              label="Venda vinculada (opcional)"
              value={form.vendaId}
              onChange={(id) =>
                setForm((p) => ({ ...p, vendaId: id }))
              }
              loadOptions={loadVendaOptions}
              minChars={0}
              disabled={!form.clienteId}
              placeholder={
                form.clienteId
                  ? "Busque por nº da venda ou valor…"
                  : "Selecione o cliente primeiro"
              }
              emptyHint="Deixe em branco se não houver venda específica."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status inicial
            </label>
            <select
              value={form.status}
              onChange={set("status")}
              className="input-field"
            >
              <option value="a_receber">
                A Receber (cheque prometido, ainda não entregue)
              </option>
              <option value="recebido">Recebido (cheque em mãos)</option>
              <option value="depositado">Depositado</option>
              <option value="devolvido">Devolvido</option>
            </select>
          </div>

          <div className="md:col-span-2">
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
        </div>

        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={salvando} className="btn-primary">
            {salvando ? "Registrando..." : "Registrar Cheque"}
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
