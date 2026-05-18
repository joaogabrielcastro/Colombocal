/** Chaves de menu configuráveis por admin (devem bater com frontend navigation). */
const NAV_PERMISSION_KEYS = [
  "dashboard",
  "clientes",
  "produtos",
  "vendas",
  "cheques",
  "fretes",
  "motoristas",
  "vendedores",
  "rel_vendas",
  "rel_financeiro",
  "rel_comissoes",
  "rel_titulos",
  "auditoria",
];

const NAV_KEY_SET = new Set(NAV_PERMISSION_KEYS);

function normalizeNavPermissions(raw) {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const keys = raw
    .map((k) => String(k).trim())
    .filter((k) => NAV_KEY_SET.has(k));
  return keys.length ? keys : null;
}

/** Admin ou lista null = acesso total às abas (exceto usuarios, sempre admin). */
function userHasNavKey(user, key) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const perms = normalizeNavPermissions(user.navPermissions);
  if (!perms) return true;
  return perms.includes(key);
}

module.exports = {
  NAV_PERMISSION_KEYS,
  NAV_KEY_SET,
  normalizeNavPermissions,
  userHasNavKey,
};
