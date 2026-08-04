"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { localDateInputValue, toInputDate } from "@/lib/utils";
import { reportApiError } from "@/lib/report-api-error";
import FreteFeatureGuard from "@/components/FreteFeatureGuard";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";

type FreteDetail = {
  id: number;
  valor: number | string;
  data: string;
  observacao?: string | null;
  reciboEmitido: boolean;
  reciboData?: string | null;
  reciboNumero?: string | null;
  vendaId?: number | null;
  cliente: { id: number; razaoSocial: string; nomeFantasia?: string | null };
  venda?: { id: number; numeroVenda?: number | null } | null;
};

export default function EditarFretePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [frete, setFrete] = useState<FreteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    valor: "",
    data: localDateInputValue(),
    observacao: "",
    reciboEmitido: false,
    reciboData: localDateInputValue(),
    reciboNumero: "",
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
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
        setForm({
          valor: String(f.valor ?? ""),
          data: toInputDate(f.data) || localDateInputValue(),
          observacao: f.observacao || "",
          reciboEmitido: !!f.reciboEmitido,
          reciboData: toInputDate(f.reciboData) || localDateInputValue(),
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

  const salvar = async () => {
    const valor = Number(String(form.valor).replace(",", "."));
    if (!(valor >= 0)) {
      toast.error("Informe um valor válido");
      return;
    }
    setSalvando(true);
    try {
      await api.patch(`/fretes/${id}`, {
        valor,
        data: form.data,
        observacao: form.observacao.trim() || null,
        reciboEmitido: form.reciboEmitido,
        reciboData: form.reciboEmitido ? form.reciboData : null,
        reciboNumero: form.reciboEmitido
          ? form.reciboNumero.trim() || null
          : null,
      });
      toast.success("Frete atualizado");
      router.push("/fretes");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível salvar o frete" });
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <DetailPageSkeleton />;
  if (!frete) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        Frete não encontrado.
      </div>
    );
  }

  const clienteNome =
    frete.cliente.nomeFantasia?.trim() || frete.cliente.razaoSocial;

  return (
    <FreteFeatureGuard>
      <div className="p-6 w-full max-w-[90rem] mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/fretes" className="btn-secondary py-1.5 px-2.5">
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Editar frete avulso
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{clienteNome}</p>
          </div>
        </div>

        <div className="card p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor (R$)
              </label>
              <input
                className="input-field"
                value={form.valor}
                onChange={(e) =>
                  setForm((s) => ({ ...s, valor: e.target.value }))
                }
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data do frete
              </label>
              <input
                type="date"
                className="input-field"
                value={form.data}
                onChange={(e) =>
                  setForm((s) => ({ ...s, data: e.target.value }))
                }
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observação
              </label>
              <input
                className="input-field"
                value={form.observacao}
                onChange={(e) =>
                  setForm((s) => ({ ...s, observacao: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.reciboEmitido}
                onChange={(e) =>
                  setForm((s) => ({ ...s, reciboEmitido: e.target.checked }))
                }
              />
              Frete pago
            </label>
            {form.reciboEmitido ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 max-w-xl">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Data do pagamento
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.reciboData}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, reciboData: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Nº recibo
                  </label>
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
