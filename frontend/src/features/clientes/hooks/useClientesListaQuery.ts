"use client";

import { useEffect, useState } from "react";
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
  // Evita hydration mismatch: no SSR não há tenant no storage → query disabled
  // → isLoading=false → EmptyState; no cliente a query liga e isLoading=true.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const tenantId = mounted ? getAuthTenantId() : null;

  const query = useQuery({
    queryKey: ["clientes", tenantId, { busca, page, pageSize }],
    enabled: mounted && tenantId != null,
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

  const waitingTenant = mounted && tenantId != null && query.isPending;
  const isLoading = !mounted || query.isLoading || waitingTenant;

  return {
    ...query,
    isLoading,
  };
}
