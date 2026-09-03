/**
 * Só permite redirecionar para caminhos internos relativos.
 * Bloqueia protocol-relative (`//evil`), URLs absolutas e loops de auth.
 */
export function safeInternalPath(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "/";
  let value = String(raw);
  try {
    value = decodeURIComponent(value);
  } catch {
    return "/";
  }
  value = value.trim();
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.includes("://") || value.includes("\\")) return "/";
  if (/[\u0000-\u001F]/.test(value)) return "/";
  const pathOnly = value.split("?")[0] || "/";
  if (
    pathOnly === "/login" ||
    pathOnly === "/cadastro" ||
    pathOnly === "/setup" ||
    pathOnly.startsWith("/setup/")
  ) {
    return "/";
  }
  return value;
}

export function nextPathFromSearch(search: string): string {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return safeInternalPath(q.get("next"));
}
