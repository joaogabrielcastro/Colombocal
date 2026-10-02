"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Mescla filtros na query atual (replace). Use `null`/"" para remover a chave.
 * Preserva outros parâmetros (ex.: visao em Contas a receber).
 */
export function useSyncListFiltersToUrl(
  updates: Record<string, string | number | null | undefined>,
  enabled = true,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastRef = useRef<string | null>(null);

  const nextQs = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") {
        p.delete(key);
        continue;
      }
      const s = String(value).trim();
      if (!s) {
        p.delete(key);
        continue;
      }
      if (key === "page" && s === "1") {
        p.delete(key);
        continue;
      }
      p.set(key, s);
    }
    return p.toString();
  }, [updates, searchParams]);

  useEffect(() => {
    if (!enabled) return;
    if (nextQs === lastRef.current) return;
    if (nextQs === searchParams.toString()) {
      lastRef.current = nextQs;
      return;
    }
    lastRef.current = nextQs;
    router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, { scroll: false });
  }, [enabled, nextQs, pathname, router, searchParams]);
}
