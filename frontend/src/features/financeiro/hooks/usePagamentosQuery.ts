"use client";

import { useQuery } from "@tanstack/react-query";
import type { Pagamento } from "@/lib/utils";
import api from "@/lib/api";
import { getAuthTenantId } from "@/lib/auth-token";

export type ResumoPagamentos = { count: number; total: number };
type PagamentosPayload = Pagamento[] | { items: Pagamento[]; resumo: ResumoPagamentos };

type PagamentosFilters = {
  dataInicio: string;
  dataFim: string;
  cliente: string;
  ordem: string;
  tipo: string;
  page: number;
  pageSize: number;
};

function toParams(f: PagamentosFilters) {
  const params = new URLSearchParams();
  if (f.dataInicio) params.set("dataInicio", f.dataInicio);
  if (f.dataFim) params.set("dataFim", f.dataFim);
  if (f.cliente) params.set("cliente", f.cliente);
  const ordemTrim = f.ordem.replace(/^#/, "").trim();
  if (ordemTrim) params.set("ordem", ordemTrim);
  if (f.tipo) params.set("tipo", f.tipo);
  params.set("resumo", "1");
  params.set("take", String(f.pageSize));
  params.set("skip", String((f.page - 1) * f.pageSize));
  return params.toString();
}

export function usePagamentosQuery(filters: PagamentosFilters) {
  const tenantId = getAuthTenantId();
  return useQuery({
    queryKey: ["pagamentos", tenantId, filters],
    enabled: tenantId != null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const resp = await api.getWithMeta<PagamentosPayload>(
        `/pagamentos?${toParams(filters)}`,
      );
      const raw = resp.data;
      const pagamentos = Array.isArray(raw) ? raw : raw.items;
      const resumo = Array.isArray(raw) ? null : raw.resumo;
      return {
        pagamentos,
        resumo,
        total: resp.meta.totalCount ?? pagamentos.length,
      };
    },
  });
}
