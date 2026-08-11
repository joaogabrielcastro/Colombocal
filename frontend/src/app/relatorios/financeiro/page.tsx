"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ContasPorClientePanel } from "@/features/contas-a-receber/components/ContasPorClientePanel";
import { ContasPorTituloPanel } from "@/features/contas-a-receber/components/ContasPorTituloPanel";
import { TableListSkeleton } from "@/components/ui/skeletons";

export type VisaoContas = "clientes" | "titulos";

function parseVisao(raw: string | null): VisaoContas {
  return raw === "titulos" ? "titulos" : "clientes";
}

function ContasAReceberHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visao = parseVisao(searchParams.get("visao"));
  const clienteId = searchParams.get("clienteId") ?? "";

  const setVisao = useCallback(
    (next: VisaoContas) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "clientes") {
        params.delete("visao");
      } else {
        params.set("visao", next);
      }
      const qs = params.toString();
      router.replace(qs ? `/relatorios/financeiro?${qs}` : "/relatorios/financeiro");
    },
    [router, searchParams],
  );

  return (
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Contas a receber
        </h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-2xl">
          Quem deve e quanto — por cliente ou por título (parcela).
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <button
          type="button"
          onClick={() => setVisao("clientes")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            visao === "clientes"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Por cliente
        </button>
        <button
          type="button"
          onClick={() => setVisao("titulos")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            visao === "titulos"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Por título
        </button>
      </div>

      {visao === "clientes" ? (
        <ContasPorClientePanel />
      ) : (
        <ContasPorTituloPanel initialClienteId={clienteId} />
      )}
    </div>
  );
}

export default function FinanceiroPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
          <TableListSkeleton />
        </div>
      }
    >
      <ContasAReceberHub />
    </Suspense>
  );
}
