"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { FLUXO_VENDA_PASSOS } from "@/lib/help-texts";
import { tenantStorageKey } from "@/lib/auth-token";

const STORAGE_KEY = "colombocal_fluxo_guia_oculto";

export function FluxoOperacional() {
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    setOculto(localStorage.getItem(tenantStorageKey(STORAGE_KEY)) === "1");
  }, []);

  if (oculto) return null;

  return (
    <div className="card p-4 mb-6 border border-blue-100 bg-gradient-to-br from-blue-50/90 to-white">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Como funciona no dia a dia
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Siga estes 3 passos para vender e receber sem se perder.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(tenantStorageKey(STORAGE_KEY), "1");
            setOculto(true);
          }}
          className="text-gray-400 hover:text-gray-600 p-1 rounded"
          title="Ocultar guia"
          aria-label="Ocultar guia"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {FLUXO_VENDA_PASSOS.map((s) => (
          <li key={s.passo}>
            <Link
              href={s.href}
              className="block h-full rounded-lg border border-blue-100 bg-white p-3 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                {s.passo}
              </span>
              <p className="font-medium text-gray-900 text-sm mt-2">{s.titulo}</p>
              <p className="text-xs text-gray-500 mt-1 leading-snug">{s.descricao}</p>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
