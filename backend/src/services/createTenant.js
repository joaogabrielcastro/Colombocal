const bcrypt = require("bcrypt");
const { prisma } = require("../lib/prisma");

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const RESERVED_SLUGS = new Set(["default"]);

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function slugify(name) {
  const slug = String(name)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "org";
}

function normalizeSlug(input, fallbackName) {
  const slug =
    input != null && String(input).trim()
      ? String(input).trim().toLowerCase()
      : slugify(fallbackName);

  if (!SLUG_RE.test(slug)) {
    throw httpError(
      400,
      "Slug inválido. Use letras minúsculas, números e hífens (2–48 caracteres).",
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw httpError(400, "Este slug é reservado. Escolha outro identificador.");
  }
  return slug;
}

function validateTenantAdminInput({ tenantName, email, password }) {
  const name = String(tenantName || "").trim();
  if (!name) {
    throw httpError(400, "Informe o nome da organização");
  }

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    throw httpError(400, "Informe o e-mail do administrador");
  }

  const pwd = String(password || "");
  if (!pwd) {
    throw httpError(400, "Informe a senha do administrador");
  }
  if (pwd.length < 6) {
    throw httpError(400, "Senha deve ter pelo menos 6 caracteres");
  }

  return { tenantName: name, email: normalizedEmail, password: pwd };
}

/**
 * Cria um tenant novo com um usuário admin inicial.
 * E-mail é único em todo o sistema (um login por organização).
 */
async function createTenantWithAdmin({
  tenantName,
  tenantSlug,
  email,
  password,
  name,
}) {
  const validated = validateTenantAdminInput({ tenantName, email, password });
  const slug = normalizeSlug(tenantSlug, validated.tenantName);
  const displayName =
    name != null ? String(name).trim() || null : null;

  const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
  if (existingSlug) {
    throw httpError(409, "Já existe uma organização com este slug");
  }

  const tenant = await prisma.tenant.create({
    data: { name: validated.tenantName, slug },
  });

  const dupEmail = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: validated.email } },
  });
  if (dupEmail) {
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
    throw httpError(409, "Este e-mail já está cadastrado");
  }

  const passwordHash = await bcrypt.hash(validated.password, 12);

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: validated.email,
      passwordHash,
      name: displayName,
      role: "admin",
    },
    include: { tenant: true },
  });

  return { tenant: user.tenant, user };
}

module.exports = {
  slugify,
  normalizeSlug,
  validateTenantAdminInput,
  createTenantWithAdmin,
  httpError,
};
