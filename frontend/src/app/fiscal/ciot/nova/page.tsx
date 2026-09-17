"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { toast } from "sonner";

export default function NovaCiotPage() {
  const router = useRouter();
  const { ciotEnabled } = useTenantFeatures();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    transportadorNome: "",
    contratanteNome: "",
    origemMunicipio: "",
    origemUf: "",
    destinoMunicipio: "",
    destinoUf: "",
    valorOperacao: "",
    veiculoPlaca: "",
    motoristaNome: "",
  });

  if (!ciotEnabled) return <p className="p-6 text-sm">Módulo CIOT desabilitado.</p>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const doc = await api.post<{ id: number }>("/fiscal/ciot", {
        ...form,
        origemUf: form.origemUf.toUpperCase(),
        destinoUf: form.destinoUf.toUpperCase(),
        valorOperacao: Number(form.valorOperacao),
      });
      toast.success("CIOT processado.");
      router.push(`/fiscal/ciot/${doc.id}`);
    } catch (err) {
      reportApiError(err, { title: "Falha ao registrar CIOT." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-xl space-y-4">
      <Link href="/fiscal/ciot" className="text-sm text-blue-700 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold">Registrar CIOT</h1>
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
        Sem IPEF configurado, a operação fica como NAO_IMPLEMENTADO (não inventamos
        autorização). Em testes, CIOT_PROVIDER=mock gera código de demonstração.
      </p>
      <form className="card p-4 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        {(
          [
            ["transportadorNome", "Transportador"],
            ["contratanteNome", "Contratante"],
            ["origemMunicipio", "Município origem"],
            ["origemUf", "UF origem"],
            ["destinoMunicipio", "Município destino"],
            ["destinoUf", "UF destino"],
            ["valorOperacao", "Valor"],
            ["veiculoPlaca", "Placa"],
            ["motoristaNome", "Motorista"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              className="input mt-1 w-full"
              required={["transportadorNome", "contratanteNome", "origemMunicipio", "origemUf", "destinoMunicipio", "destinoUf", "valorOperacao"].includes(key)}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Enviando…" : "Registrar"}
        </button>
      </form>
    </div>
  );
}
