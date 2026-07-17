"use client";

import { useQuery } from "@tanstack/react-query";
import type { Cheque } from "@/lib/utils";
import api from "@/lib/api";
import { getAuthTenantId } from "@/lib/auth-token";

export type ResumoCheques = { count: number; total: number };
type ChequesPayload = Cheque[] | { items: Cheque[]; resumo: ResumoCheques };

type ChequesFilters = {
  dataInicio: string;
  dataFim: string;
  cliente: string;
  emitente: string;
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
  if (f.emitente) params.set("emitente", f.emitente);
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
  const tenantId = getAuthTenantId();
  return useQuery({
    queryKey: ["cheques", tenantId, filters],
    enabled: tenantId != null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const resp = await api.getWithMeta<ChequesPayload>(`/cheques?${toParams(filters)}`);
      const raw = resp.data;
      const cheques = Array.isArray(raw) ? raw : raw.items;
      const resumo = Array.isArray(raw) ? null : raw.resumo;
      return {
        cheques,
        resumo,
        total: resp.meta.totalCount ?? cheques.length,
      };
    },
  });
}
