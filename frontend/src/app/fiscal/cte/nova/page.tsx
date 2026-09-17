"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { toast } from "sonner";

export default function NovaCtePage() {
  const router = useRouter();
  const { cteEnabled } = useTenantFeatures();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    remetenteNome: "",
    remetenteDoc: "",
    destinatarioNome: "",
    destinatarioDoc: "",
    origemMunicipio: "",
    origemUf: "",
    destinoMunicipio: "",
    destinoUf: "",
    valorServico: "",
    valorCarga: "",
    pesoKg: "",
    observacoes: "",
  });

  if (!cteEnabled) {
    return <p className="p-6 text-sm">Módulo CT-e desabilitado.</p>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const doc = await api.post<{ id: number }>("/fiscal/cte", {
        ...form,
        origemUf: form.origemUf.toUpperCase(),
        destinoUf: form.destinoUf.toUpperCase(),
        valorServico: form.valorServico ? Number(form.valorServico) : null,
        valorCarga: form.valorCarga ? Number(form.valorCarga) : null,
        pesoKg: form.pesoKg ? Number(form.pesoKg) : null,
      });
      toast.success("CT-e enviado ao provedor.");
      router.push(`/fiscal/cte/${doc.id}`);
    } catch (err) {
      reportApiError(err, { title: "Falha ao emitir CT-e." });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, opts?: { required?: boolean }) => (
    <label className="block text-sm">
      {label}
      <input
        className="input mt-1 w-full"
        required={opts?.required}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <Link href="/fiscal/cte" className="text-sm text-blue-700 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold">Emitir CT-e</h1>
      <form className="card p-4 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        {field("remetenteNome", "Remetente", { required: true })}
        {field("remetenteDoc", "Doc. remetente")}
        {field("destinatarioNome", "Destinatário", { required: true })}
        {field("destinatarioDoc", "Doc. destinatário")}
        <div className="grid grid-cols-2 gap-3">
          {field("origemMunicipio", "Município origem", { required: true })}
          {field("origemUf", "UF origem", { required: true })}
          {field("destinoMunicipio", "Município destino", { required: true })}
          {field("destinoUf", "UF destino", { required: true })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field("valorServico", "Valor serviço")}
          {field("valorCarga", "Valor carga")}
          {field("pesoKg", "Peso kg")}
        </div>
        {field("observacoes", "Observações")}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Enviando…" : "Emitir"}
        </button>
      </form>
    </div>
  );
}
