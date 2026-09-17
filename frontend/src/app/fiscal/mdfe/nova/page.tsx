"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { toast } from "sonner";

export default function NovaMdfePage() {
  const router = useRouter();
  const { mdfeEnabled } = useTenantFeatures();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ufInicio: "",
    ufFim: "",
    veiculoPlaca: "",
    motoristaNome: "",
    chaveDoc: "",
    tipoDoc: "nfe" as "nfe" | "cte",
  });

  if (!mdfeEnabled) return <p className="p-6 text-sm">Módulo MDF-e desabilitado.</p>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const doc = await api.post<{ id: number }>("/fiscal/mdfe", {
        ufInicio: form.ufInicio.toUpperCase(),
        ufFim: form.ufFim.toUpperCase(),
        veiculoPlaca: form.veiculoPlaca,
        motoristaNome: form.motoristaNome || null,
        documentos: [
          {
            tipo: form.tipoDoc,
            chaveAcesso: form.chaveDoc.replace(/\D/g, "").padEnd(44, "0").slice(0, 44),
          },
        ],
      });
      toast.success("MDF-e enviado ao provedor.");
      router.push(`/fiscal/mdfe/${doc.id}`);
    } catch (err) {
      reportApiError(err, { title: "Falha ao emitir MDF-e." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-xl space-y-4">
      <Link href="/fiscal/mdfe" className="text-sm text-blue-700 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold">Emitir MDF-e</h1>
      <form className="card p-4 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <input
          className="input w-full"
          placeholder="UF início"
          required
          maxLength={2}
          value={form.ufInicio}
          onChange={(e) => setForm((f) => ({ ...f, ufInicio: e.target.value }))}
        />
        <input
          className="input w-full"
          placeholder="UF fim"
          required
          maxLength={2}
          value={form.ufFim}
          onChange={(e) => setForm((f) => ({ ...f, ufFim: e.target.value }))}
        />
        <input
          className="input w-full"
          placeholder="Placa"
          required
          value={form.veiculoPlaca}
          onChange={(e) => setForm((f) => ({ ...f, veiculoPlaca: e.target.value }))}
        />
        <input
          className="input w-full"
          placeholder="Motorista"
          value={form.motoristaNome}
          onChange={(e) => setForm((f) => ({ ...f, motoristaNome: e.target.value }))}
        />
        <select
          className="input w-full"
          value={form.tipoDoc}
          onChange={(e) =>
            setForm((f) => ({ ...f, tipoDoc: e.target.value as "nfe" | "cte" }))
          }
        >
          <option value="nfe">Vincular NF-e</option>
          <option value="cte">Vincular CT-e</option>
        </select>
        <input
          className="input w-full"
          placeholder="Chave de acesso (44 dígitos)"
          required
          value={form.chaveDoc}
          onChange={(e) => setForm((f) => ({ ...f, chaveDoc: e.target.value }))}
        />
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Enviando…" : "Emitir"}
        </button>
      </form>
    </div>
  );
}
