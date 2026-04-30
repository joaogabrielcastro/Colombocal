"use client";

import { useEffect, useState } from "react";
import type { Venda } from "@/lib/utils";
import api from "@/lib/api";

export function useVendasEmAberto(clienteId: string) {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clienteId) {
      setVendas([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<Venda[]>(`/vendas?clienteId=${clienteId}&take=500&saldoEmAberto=true`)
      .then((rows) => {
        if (!cancelled) setVendas(rows);
      })
      .catch(() => {
        if (!cancelled) setVendas([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  return { vendas, loading };
}
