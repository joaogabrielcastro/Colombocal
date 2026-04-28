"use client";

import { useQuery } from "@tanstack/react-query";
import type { Cliente } from "@/lib/utils";
import api from "@/lib/api";

export function useClientesListaQuery({
  busca,
  page,
  pageSize,
}: {
  busca: string;
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: ["clientes", { busca, page, pageSize }],
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
