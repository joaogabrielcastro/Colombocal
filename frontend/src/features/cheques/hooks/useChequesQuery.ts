"use client";

import { useQuery } from "@tanstack/react-query";
import type { Cheque } from "@/lib/utils";
import api from "@/lib/api";

export type ResumoStatus = { status: string; count: number; total: number };
type ChequesPayload = Cheque[] | { items: Cheque[]; resumoPorStatus: ResumoStatus[] };

type ChequesFilters = {
  dataInicio: string;
  dataFim: string;
  cliente: string;
  banco: string;
  numero: string;
  valorMin: string;
  valorMax: string;
  ordem: string;
  page: number;
  pageSize: number;
};

function toParams(f: ChequesFilters) {
  const params = new URLSearchParams();
  if (f.dataInicio) params.set("dataInicio", f.dataInicio);
  if (f.dataFim) params.set("dataFim", f.dataFim);
  if (f.cliente) params.set("cliente", f.cliente);
  if (f.banco) params.set("banco", f.banco);
  if (f.numero) params.set("numero", f.numero);
  if (f.valorMin) params.set("valorMin", f.valorMin);
  const vmaxTrim = f.valorMax.trim();
  if (vmaxTrim !== "") {
    const n = Number(vmaxTrim.replace(",", "."));
    if (!Number.isNaN(n) && n > 0) params.set("valorMax", vmaxTrim);
  }
  const ordemTrim = f.ordem.replace(/^#/, "").trim();
  if (ordemTrim) params.set("ordem", ordemTrim);
  params.set("resumo", "1");
  params.set("take", String(f.pageSize));
  params.set("skip", String((f.page - 1) * f.pageSize));
  return params.toString();
}

export function useChequesQuery(filters: ChequesFilters) {
  return useQuery({
    queryKey: ["cheques", filters],
    queryFn: async () => {
      const resp = await api.getWithMeta<ChequesPayload>(`/cheques?${toParams(filters)}`);
      const raw = resp.data;
      const cheques = Array.isArray(raw) ? raw : raw.items;
      const resumoPorStatus = Array.isArray(raw) ? null : raw.resumoPorStatus;
      return {
        cheques,
        resumoPorStatus,
        total: resp.meta.totalCount ?? cheques.length,
      };
    },
  });
}
