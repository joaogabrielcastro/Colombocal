"use client";

import { useEffect, useState } from "react";
import type { Cliente, Produto, Vendedor } from "@/lib/utils";
import api from "@/lib/api";

export function useRelatorioVendasLookups() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api.get<Vendedor[]>("/vendedores?take=500"),
      api.get<{ clientes: Cliente[] }>("/clientes?ativo=true&take=500"),
      api.get<Produto[]>("/produtos?ativo=true&take=500"),
    ]).then(([vendedoresResp, clientesResp, produtosResp]) => {
      if (cancelled) return;
      setVendedores(vendedoresResp);
      setClientes(clientesResp.clientes);
      setProdutos(produtosResp);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { vendedores, clientes, produtos };
}
