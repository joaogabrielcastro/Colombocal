"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { toast } from "sonner";
import { EmitenteFiscalSelect } from "@/features/fiscal/components/EmitenteFiscalSelect";
import { buildCteEmissionPayload } from "@/features/fiscal/services/transport-payload";
import { EmptyState } from "@/components/ui/empty-state";

export default function NovaCtePage() {
  const router = useRouter();
  const { cteEnabled } = useTenantFeatures();
  const [saving, setSaving] = useState(false);
  const [emitenteFiscalId, setEmitenteFiscalId] = useState("");
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
    return <div className="page-container max-w-xl"><EmptyState title="Módulo CT-e desabilitado" description="Ative o módulo nas configurações antes de emitir um CT-e." /></div>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const doc = await api.post<{ id: number }>(
        "/fiscal/cte",
        buildCteEmissionPayload(form, Number(emitenteFiscalId)),
      );
      toast.success("CT-e enviado ao provedor.");
      router.push(`/fiscal/cte/${doc.id}`);
    } catch (err) {
      reportApiError(err, { title: "Falha ao emitir CT-e." });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, opts?: { required?: boolean }) => (
    <label htmlFor={`cte-${key}`} className="block">
      <span className="field-label">{label}</span>
      <input
        id={`cte-${key}`}
        className="input-field"
        required={opts?.required}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div className="page-container max-w-2xl space-y-4">
      <Link href="/fiscal/cte" className="text-sm text-blue-700 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Emitir CT-e</h1>
      <form className="card p-4 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <EmitenteFiscalSelect
          recurso="cte"
          value={emitenteFiscalId}
          onChange={setEmitenteFiscalId}
          disabled={saving}
        />
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
        <button type="submit" className="btn-primary" disabled={saving || !emitenteFiscalId}>
          {saving ? "Enviando…" : "Emitir"}
        </button>
      </form>
    </div>
  );
}
