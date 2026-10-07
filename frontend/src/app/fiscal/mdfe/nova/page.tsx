"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { toast } from "sonner";
import { EmitenteFiscalSelect } from "@/features/fiscal/components/EmitenteFiscalSelect";
import { fiscalAccessKeyError } from "@/features/fiscal/services/access-key";
import { buildMdfeEmissionPayload } from "@/features/fiscal/services/transport-payload";
import { EmptyState } from "@/components/ui/empty-state";

export default function NovaMdfePage() {
  const router = useRouter();
  const { mdfeEnabled } = useTenantFeatures();
  const [saving, setSaving] = useState(false);
  const [emitenteFiscalId, setEmitenteFiscalId] = useState("");
  const [chaveError, setChaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    ufInicio: "",
    ufFim: "",
    veiculoPlaca: "",
    motoristaNome: "",
    chaveDoc: "",
    tipoDoc: "nfe" as "nfe" | "cte",
  });

  if (!mdfeEnabled) return <div className="page-container max-w-xl"><EmptyState title="Módulo MDF-e desabilitado" description="Ative o módulo nas configurações antes de emitir um MDF-e." /></div>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = fiscalAccessKeyError(form.chaveDoc);
    setChaveError(validationError);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const doc = await api.post<{ id: number }>(
        "/fiscal/mdfe",
        buildMdfeEmissionPayload(form, Number(emitenteFiscalId)),
      );
      toast.success("MDF-e enviado ao provedor.");
      router.push(`/fiscal/mdfe/${doc.id}`);
    } catch (err) {
      reportApiError(err, { title: "Falha ao emitir MDF-e." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container max-w-xl space-y-4">
      <Link href="/fiscal/mdfe" className="text-sm text-blue-700 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Emitir MDF-e</h1>
      <form className="card p-4 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <EmitenteFiscalSelect
          recurso="mdfe"
          value={emitenteFiscalId}
          onChange={setEmitenteFiscalId}
          disabled={saving}
        />
        <label htmlFor="mdfe-uf-inicio" className="block">
          <span className="field-label">UF de início</span>
          <input
          id="mdfe-uf-inicio"
          className="input-field"
          placeholder="Ex.: PR"
          required
          maxLength={2}
          value={form.ufInicio}
          onChange={(e) => setForm((f) => ({ ...f, ufInicio: e.target.value }))}
          />
        </label>
        <label htmlFor="mdfe-uf-fim" className="block">
          <span className="field-label">UF de destino</span>
          <input
          id="mdfe-uf-fim"
          className="input-field"
          placeholder="Ex.: SP"
          required
          maxLength={2}
          value={form.ufFim}
          onChange={(e) => setForm((f) => ({ ...f, ufFim: e.target.value }))}
          />
        </label>
        <label htmlFor="mdfe-placa" className="block">
          <span className="field-label">Placa</span>
          <input
          id="mdfe-placa"
          className="input-field"
          placeholder="ABC-1D23"
          required
          value={form.veiculoPlaca}
          onChange={(e) => setForm((f) => ({ ...f, veiculoPlaca: e.target.value }))}
          />
        </label>
        <label htmlFor="mdfe-motorista" className="block">
          <span className="field-label">Motorista</span>
          <input
          id="mdfe-motorista"
          className="input-field"
          value={form.motoristaNome}
          onChange={(e) => setForm((f) => ({ ...f, motoristaNome: e.target.value }))}
          />
        </label>
        <label htmlFor="mdfe-tipo-documento" className="block">
          <span className="field-label">Documento vinculado</span>
          <select
          id="mdfe-tipo-documento"
          className="input-field"
          value={form.tipoDoc}
          onChange={(e) =>
            setForm((f) => ({ ...f, tipoDoc: e.target.value as "nfe" | "cte" }))
          }
        >
          <option value="nfe">Vincular NF-e</option>
          <option value="cte">Vincular CT-e</option>
          </select>
        </label>
        <label htmlFor="mdfe-chave" className="block">
          <span className="field-label">Chave de acesso (44 dígitos)</span>
          <input
          id="mdfe-chave"
          className="input-field font-mono"
          required
          inputMode="numeric"
          maxLength={44}
          aria-invalid={Boolean(chaveError)}
          aria-describedby={chaveError ? "mdfe-chave-error" : undefined}
          value={form.chaveDoc}
          onChange={(e) => {
            const chaveDoc = e.target.value.replace(/\D/g, "").slice(0, 44);
            setForm((f) => ({ ...f, chaveDoc }));
            if (chaveError) setChaveError(fiscalAccessKeyError(chaveDoc));
          }}
          />
        </label>
        {chaveError ? (
          <p id="mdfe-chave-error" className="text-sm text-red-700">
            {chaveError}
          </p>
        ) : null}
        <button type="submit" className="btn-primary" disabled={saving || !emitenteFiscalId}>
          {saving ? "Enviando…" : "Emitir"}
        </button>
      </form>
    </div>
  );
}
