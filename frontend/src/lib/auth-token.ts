const STORAGE_KEY = 'colombocal_auth_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(STORAGE_KEY);
}
