"use client";

import { useEffect } from "react";

const CLEARED_FLAG = "colombocal_sw_cache_cleared_v3";

async function clearBrowserAppCaches() {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

async function unregisterAllServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((reg) => reg.unregister()));
}

/**
 * Remove service workers/caches antigos que prendiam HTML/JS velho.
 * Depois registra o kill-switch uma vez para limpar clientes que ainda
 * estejam sob o SW v1/v2.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "COLOMBOCAL_SW_CLEARED") return;
      if (sessionStorage.getItem(CLEARED_FLAG) === "1") return;
      sessionStorage.setItem(CLEARED_FLAG, "1");
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("message", onMessage);

    void (async () => {
      try {
        await clearBrowserAppCaches();

        // Se já limpamos nesta sessão, só garante que não há SW ativo.
        if (sessionStorage.getItem(CLEARED_FLAG) === "1") {
          await unregisterAllServiceWorkers();
          return;
        }

        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0) {
          sessionStorage.setItem(CLEARED_FLAG, "1");
          return;
        }

        // Há SW antigo: registra kill-switch para ativar limpeza + reload.
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        await registration.update();

        if (cancelled) return;

        // Fallback: se o SW não mandar mensagem, limpa e recarrega uma vez.
        window.setTimeout(() => {
          if (cancelled || sessionStorage.getItem(CLEARED_FLAG) === "1") return;
          void (async () => {
            await clearBrowserAppCaches();
            await unregisterAllServiceWorkers();
            sessionStorage.setItem(CLEARED_FLAG, "1");
            window.location.reload();
          })();
        }, 1500);
      } catch {
        /* PWA opcional — falha silenciosa */
      }
    })();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
