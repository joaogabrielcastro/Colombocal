import { clearTenantFeaturesCache } from './tenant-features-cache';

const STORAGE_KEY = 'colombocal_auth_token';
export const AUTH_SESSION_EVENT = 'colombocal-auth-session';

function notifyAuthSessionChange() {
  clearTenantFeaturesCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

/** Decodifica `tid` do JWT só para chaves de cache (não valida assinatura). */
export function getAuthTenantId(): number | null {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { tid?: unknown };
    const tid = Number(payload.tid);
    return Number.isFinite(tid) && tid > 0 ? tid : null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(STORAGE_KEY, token);
  notifyAuthSessionChange();
}

export function clearAuthToken() {
  window.localStorage.removeItem(STORAGE_KEY);
  notifyAuthSessionChange();
}
