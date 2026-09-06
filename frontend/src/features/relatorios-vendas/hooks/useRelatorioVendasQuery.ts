"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchWithMeta } from "@/lib/api";
import { getAuthTenantId } from "@/lib/auth-token";
import type { RelVendas, RelatorioVendasParams } from "../types";

export const PAGE_TAKE = 500;
export const EXPORT_TAKE = 1000;
export const EXPORT_MAX_ROWS = 5000;

export function toRelatorioVendasSearchParams(
  params: RelatorioVendasParams,
  opts?: { take?: number; skip?: number; somenteDetalhes?: boolean },
) {
  const q = new URLSearchParams();
  if (params.dataInicio) q.set("dataInicio", params.dataInicio);
  if (params.dataFim) q.set("dataFim", params.dataFim);
  if (params.busca.trim()) q.set("busca", params.busca.trim());
  if (params.vendedorId) q.set("vendedorId", params.vendedorId);
  if (params.motoristaId) q.set("motoristaId", params.motoristaId);
  if (params.clienteId) q.set("clienteId", params.clienteId);
  if (params.produtoId) q.set("produtoId", params.produtoId);
  q.set("take", String(opts?.take ?? PAGE_TAKE));
  q.set("skip", String(opts?.skip ?? 0));
  if (opts?.somenteDetalhes) q.set("somenteDetalhes", "true");
  return q.toString();
}

function toSearchParams(params: RelatorioVendasParams) {
  return toRelatorioVendasSearchParams(params);
}

/** Completa o detalhamento para PDF/Excel sem recalcular agregados. */
export async function fetchVendasDetalhesCompletos(
  params: RelatorioVendasParams,
  atual: RelVendas,
): Promise<RelVendas> {
  const total = atual.totalRegistros ?? atual.vendas.length;
  if (atual.vendas.length >= total) return atual;

  const seen = new Set(atual.vendas.map((v) => v.id));
  const vendas = [...atual.vendas];
  let skip = atual.vendas.length;

  while (vendas.length < Math.min(total, EXPORT_MAX_ROWS)) {
    const query = toRelatorioVendasSearchParams(params, {
      take: EXPORT_TAKE,
      skip,
      somenteDetalhes: true,
    });
    const { data } = await apiFetchWithMeta<RelVendas>(`/relatorios/vendas?${query}`);
    const lote = data.vendas ?? [];
    if (!lote.length) break;
    for (const v of lote) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      vendas.push(v);
    }
    skip += lote.length;
    if (lote.length < EXPORT_TAKE) break;
  }

  return { ...atual, vendas };
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
