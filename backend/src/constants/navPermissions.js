/** Chaves de menu configuráveis por admin (devem bater com frontend navigation). */
const NAV_PERMISSION_KEYS = [
  "dashboard",
  "clientes",
  "produtos",
  "vendas",
  "financeiro",
  "fretes",
  "carregamento",
  "motoristas",
  "vendedores",
  "rel_vendas",
  "rel_financeiro",
  "rel_comissoes",
  "auditoria",
];

/** Chaves legadas → canônicas. */
const LEGACY_NAV_KEY_ALIASES = {
  cheques: "financeiro",
  rel_titulos: "rel_financeiro",
};

const NAV_KEY_SET = new Set(NAV_PERMISSION_KEYS);

function normalizeNavKey(key) {
  const k = String(key ?? "").trim();
  return LEGACY_NAV_KEY_ALIASES[k] || k;
}

function normalizeNavPermissions(raw) {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const keys = raw
    .map((k) => normalizeNavKey(k))
    .filter((k) => NAV_KEY_SET.has(k));
  const unique = [...new Set(keys)];
  return unique.length ? unique : null;
}

/** Admin ou lista null = acesso total às abas (exceto usuarios, sempre admin). */
function userHasNavKey(user, key) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const perms = normalizeNavPermissions(user.navPermissions);
  if (!perms) return true;
  const resolved = normalizeNavKey(key);
  return perms.includes(resolved);
}

module.exports = {
  NAV_PERMISSION_KEYS,
  NAV_KEY_SET,
  LEGACY_NAV_KEY_ALIASES,
  normalizeNavKey,
  normalizeNavPermissions,
  userHasNavKey,
};
