"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { AUTH_SESSION_EVENT, getAuthToken } from "@/lib/auth-token";

/**
 * Sessão do usuário (`GET /auth/me`) com cache curto e deduplicação.
 *
 * Antes, shell, menu e features pediam `/auth/me` separadamente — e o shell repetia
 * a chamada a cada troca de rota, escondendo a tela durante a verificação.
 * Agora há uma única fonte: a resposta é reaproveitada por {@link SESSION_TTL_MS}
 * e invalidada sempre que o token muda (login, logout, troca de empresa).
 * O backend continua validando permissões em cada endpoint.
 */

export type SessionUser = {
  id?: number;
  email?: string;
  name?: string | null;
  role?: string;
  tenantId?: number;
  navPermissions?: string[] | null;
};

export type SessionTenant = {
  id?: number;
  name: string;
  slug: string | null;
};

export type SessionData = {
  user: SessionUser;
  tenant?: SessionTenant | null;
  features?: Record<string, unknown>;
};

export const SESSION_TTL_MS = 60_000;

let cache: { token: string; at: number; data: SessionData } | null = null;
let inflight: { token: string; promise: Promise<SessionData> } | null = null;

export function clearSessionCache() {
  cache = null;
  inflight = null;
}

if (typeof window !== "undefined") {
  window.addEventListener(AUTH_SESSION_EVENT, clearSessionCache);
}

/** Sessão em cache para o token atual (sem rede). */
export function getCachedSession(maxAgeMs = SESSION_TTL_MS): SessionData | null {
  const token = getAuthToken();
  if (!token || !cache || cache.token !== token) return null;
  if (Date.now() - cache.at > maxAgeMs) return null;
  return cache.data;
}

export function fetchSession(options: { force?: boolean } = {}): Promise<SessionData> {
  const token = getAuthToken() ?? "";
  if (!options.force) {
    const cached = getCachedSession();
    if (cached) return Promise.resolve(cached);
  }
  if (inflight && inflight.token === token) return inflight.promise;

  const promise = api
    .get<SessionData>("/auth/me")
    .then((data) => {
      const safe: SessionData = {
        user: data?.user ?? {},
        tenant: data?.tenant ?? null,
        features: data?.features,
      };
      // Só grava se o token não mudou durante a requisição.
      if ((getAuthToken() ?? "") === token) {
        cache = { token, at: Date.now(), data: safe };
      }
      return safe;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { token, promise };
  return promise;
}

export function isAdminSession(session: SessionData | null | undefined): boolean {
  return session?.user?.role === "admin";
}

/** Hook de leitura da sessão para componentes de interface (menu, topo, paleta). */
export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((force = false) => {
    if (!getAuthToken()) {
      setSession(null);
      setLoading(false);
      return () => {};
    }
    let cancelled = false;
    const cached = force ? null : getCachedSession();
    if (cached) {
      setSession(cached);
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    fetchSession({ force })
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cleanup = load(false);
    const onAuth = () => {
      cleanup();
      cleanup = load(true);
    };
    window.addEventListener(AUTH_SESSION_EVENT, onAuth);
    return () => {
      cleanup();
      window.removeEventListener(AUTH_SESSION_EVENT, onAuth);
    };
  }, [load]);

  return {
    session,
    loading,
    user: session?.user ?? null,
    tenant: session?.tenant ?? null,
    isAdmin: isAdminSession(session),
    navPermissions: session?.user?.navPermissions ?? null,
  };
}
