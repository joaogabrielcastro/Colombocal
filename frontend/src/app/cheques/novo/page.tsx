"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { type Cliente, type Venda } from "@/lib/utils";
import api from "@/lib/api";
import { FormPageSkeleton } from "@/components/ui/skeletons";

function NovoChequeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preClienteId = searchParams.get("clienteId");

  const [clientes, setClientes] = useState<Cliente[]>([]);
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

  useEffect(() => {
    api
      .get<{ clientes: Cliente[] }>("/clientes?ativo=true")
      .then((d) => setClientes(d.clientes));
  }, []);
  // Ao trocar o cliente, carrega as vendas dele
  useEffect(() => {
    if (!form.clienteId) {
      setVendas([]);
      return;
    }
    api.get<Venda[]>(`/vendas?clienteId=${form.clienteId}`).then(setVendas);
  }, [form.clienteId]);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente *
            </label>
            <select
              required
              value={form.clienteId}
              onChange={set("clienteId")}
              className="input-field"
            >
              <option value="">Selecione o cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia || c.razaoSocial}
                </option>
              ))}
            </select>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venda vinculada (opcional)
            </label>
            <select
              value={form.vendaId}
              onChange={set("vendaId")}
              className="input-field"
            >
              <option value="">Sem venda específica</option>
              {vendas.map((v) => (
                <option key={v.id} value={v.id}>
                  Venda #{v.id} –{" "}
                  {new Date(v.dataVenda).toLocaleDateString("pt-BR")} –{" "}
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(parseFloat(String(v.valorTotal)))}
                </option>
              ))}
            </select>
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
