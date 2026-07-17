"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchWithMeta } from "@/lib/api";
import { getAuthTenantId } from "@/lib/auth-token";
import type { RelVendas, RelatorioVendasParams } from "../types";

function toSearchParams(params: RelatorioVendasParams) {
  const q = new URLSearchParams();
  if (params.dataInicio) q.set("dataInicio", params.dataInicio);
  if (params.dataFim) q.set("dataFim", params.dataFim);
  if (params.busca.trim()) q.set("busca", params.busca.trim());
  if (params.vendedorId) q.set("vendedorId", params.vendedorId);
  if (params.clienteId) q.set("clienteId", params.clienteId);
  if (params.produtoId) q.set("produtoId", params.produtoId);
  q.set("take", "500");
  q.set("skip", "0");
  return q.toString();
}

export function useRelatorioVendasQuery(params: RelatorioVendasParams, enabled: boolean) {
  const tenantId = getAuthTenantId();
  return useQuery({
    queryKey: ["relatorio-vendas", tenantId, params],
    enabled: enabled && tenantId != null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const query = toSearchParams(params);
      const { data, meta } = await apiFetchWithMeta<RelVendas>(`/relatorios/vendas?${query}`);
      return {
        ...data,
        totalRegistros: meta.totalCount ?? data.totalRegistros,
      } as RelVendas;
    },
  });
}
