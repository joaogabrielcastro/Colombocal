"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";

type RecursoFiscal = "nfe" | "cte" | "mdfe";

type EmitenteFiscalOpcao = {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  ambiente: string;
  padrao: boolean;
};

type Props = {
  recurso: RecursoFiscal;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function EmitenteFiscalSelect({ recurso, value, onChange, disabled }: Props) {
  const [rows, setRows] = useState<EmitenteFiscalOpcao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void api
      .get<EmitenteFiscalOpcao[]>(`/config/emitentes-fiscais-opcoes?recurso=${recurso}`)
      .then((next) => {
        if (!active) return;
        setRows(next);
        const selected = next.find((row) => String(row.id) === value);
        const fallback = next.find((row) => row.padrao) || next[0];
        if (!selected && fallback) onChange(String(fallback.id));
      })
      .catch((error) => {
        if (!active) return;
        setRows([]);
        reportApiError(error, { title: "Não foi possível carregar as empresas emissoras." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [recurso]);

  return (
    <label className="block text-sm">
      Empresa emissora
      <select
        className="input mt-1 w-full"
        required
        disabled={disabled || loading}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{loading ? "Carregando empresas…" : "Selecione a empresa emissora"}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.nomeFantasia || row.razaoSocial} — {row.cnpj} ({row.ambiente})
          </option>
        ))}
      </select>
      {!loading && rows.length === 0 ? (
        <span className="mt-1 block text-xs text-red-700">
          Nenhuma empresa ativa está habilitada para este documento.
        </span>
      ) : null}
    </label>
  );
}
