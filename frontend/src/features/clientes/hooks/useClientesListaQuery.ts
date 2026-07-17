"use client";

import { useQuery } from "@tanstack/react-query";
import type { Cliente } from "@/lib/utils";
import api from "@/lib/api";
import { getAuthTenantId } from "@/lib/auth-token";

export function useClientesListaQuery({
  busca,
  page,
  pageSize,
}: {
  busca: string;
  page: number;
  pageSize: number;
}) {
  const tenantId = getAuthTenantId();
  return useQuery({
    queryKey: ["clientes", tenantId, { busca, page, pageSize }],
    enabled: tenantId != null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    queryFn: () => {
      const params = new URLSearchParams({
        ativo: "true",
        take: String(pageSize),
        skip: String(page * pageSize),
      });
      if (busca) params.set("busca", busca);
      return api.get<{ clientes: Cliente[]; total: number }>(`/clientes?${params}`);
    },
  });
}
