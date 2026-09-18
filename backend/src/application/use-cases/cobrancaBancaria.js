const { AppError } = require("../../shared/errors/appError");
const { createBankBillingProvider } = require("../../infra/billing/provider");
const { BankBillingError, CODES } = require("../../infra/billing/errors");
const {
  prepareProvedorTokenForStorage,
  resolveProvedorTokenPlain,
} = require("../../infra/crypto/fiscalTokenCrypto");
const { registrarAuditoria } = require("../../services/financeiroEventos");

const STATUS = {
  PENDENTE: "PENDENTE",
  PROCESSANDO: "PROCESSANDO",
  REGISTRADA: "REGISTRADA",
  DISPONIVEL: "DISPONIVEL",
  ERRO: "ERRO",
  CANCELADA: "CANCELADA",
};

const BANCOS = new Set(["BRADESCO", "SICREDI"]);

function idempotencyKeyForTitulo(tituloId) {
  return `cobranca:titulo:${tituloId}`;
}

function parseSecrets(storedCipher) {
  if (!storedCipher) return null;
  try {
    const plain = resolveProvedorTokenPlain(storedCipher);
    if (!plain) return null;
    return JSON.parse(plain);
  } catch {
    return null;
  }
}

function prepareSecretsForStorage(secretsObj) {
  if (!secretsObj || typeof secretsObj !== "object") return null;
  const cleaned = {};
  for (const [k, v] of Object.entries(secretsObj)) {
    if (v == null || v === "") continue;
    cleaned[k] = String(v);
  }
  if (Object.keys(cleaned).length === 0) return null;
  return prepareProvedorTokenForStorage(JSON.stringify(cleaned));
}

function sanitizarCobranca(c) {
  if (!c) return null;
  const { payloadRetorno, ...rest } = c;
  return {
    ...rest,
    valor: c.valor != null ? parseFloat(String(c.valor)) : null,
    temPdf: !!(c.pdfRef),
    payloadResumo: payloadRetorno
      ? { status: payloadRetorno.status || c.status }
      : undefined,
  };
}

function sanitizarConfig(cfg) {
  if (!cfg) return null;
  return {
    id: cfg.id,
    tenantId: cfg.tenantId,
    banco: cfg.banco,
    ambiente: cfg.ambiente,
    status: cfg.status,
    agencia: cfg.agencia,
    conta: cfg.conta,
    carteira: cfg.carteira,
    convenio: cfg.convenio,
    codigoBeneficiario: cfg.codigoBeneficiario,
    ativo: cfg.ativo,
    secretsConfigurados: !!(cfg.secretsCipher && String(cfg.secretsCipher).trim()),
    createdAt: cfg.createdAt,
    updatedAt: cfg.updatedAt,
  };
}

async function loadProviderForBanco(prisma, { tenantId, banco }) {
  const b = String(banco || "").toUpperCase();
  if (!BANCOS.has(b)) {
    throw new AppError("Banco de cobrança inválido", {
      code: "BANCO_INVALIDO",
      httpStatus: 400,
    });
  }
  const config = await prisma.configuracaoBancaria.findUnique({
    where: { tenantId_banco: { tenantId: Number(tenantId), banco: b } },
  });
  const secrets = parseSecrets(config?.secretsCipher);
  const provider = createBankBillingProvider({
    banco: b,
    config: config || { status: "NAO_CONFIGURADO" },
    secrets,
  });
  return { provider, config };
}

/**
 * Garante registro CobrancaBancaria para o título (idempotente).
 */
async function ensureCobrancaParaTitulo(prisma, {
  tenantId,
  titulo,
  banco,
  auditReq = null,
}) {
  const tid = Number(tenantId);
  const key = idempotencyKeyForTitulo(titulo.id);
  const existing = await prisma.cobrancaBancaria.findUnique({
    where: { tituloId: titulo.id },
  });
  if (existing) return existing;

  const bancoEfetivo = String(banco || "").toUpperCase();
  if (!BANCOS.has(bancoEfetivo)) {
    throw new AppError(
      "Venda sem banco de cobrança definido. Informe BRADESCO ou SICREDI.",
      { code: "BANCO_COBRANCA_AUSENTE", httpStatus: 400 },
    );
  }

  const config = await prisma.configuracaoBancaria.findUnique({
    where: { tenantId_banco: { tenantId: tid, banco: bancoEfetivo } },
  });

  try {
    const created = await prisma.cobrancaBancaria.create({
      data: {
        tenantId: tid,
        tituloId: titulo.id,
        vendaId: titulo.vendaId ?? null,
        clienteId: titulo.clienteId,
        configuracaoBancariaId: config?.id ?? null,
        banco: bancoEfetivo,
        status: STATUS.PENDENTE,
        valor: titulo.valorOriginal,
        vencimento: titulo.vencimento,
        idempotencyKey: key,
      },
    });
    if (auditReq) {
      await registrarAuditoria(prisma, auditReq, {
        tenantId: tid,
        tipo: "COBRANCA_CRIADA",
        entidade: "CobrancaBancaria",
        entidadeId: created.id,
        clienteId: titulo.clienteId,
        vendaId: titulo.vendaId,
        tituloId: titulo.id,
        valor: parseFloat(String(titulo.valorOriginal)),
        payload: { banco: bancoEfetivo },
      });
    }
    return created;
  } catch (err) {
    if (err?.code === "P2002") {
      const again = await prisma.cobrancaBancaria.findUnique({
        where: { tituloId: titulo.id },
      });
      if (again) return again;
    }
    throw err;
  }
}

/**
 * Tenta registrar cobrança no banco (idempotente se já REGISTRADA/DISPONIVEL).
 */
async function registrarCobranca(prisma, {
  tenantId,
  cobrancaId,
  auditReq = null,
  providerOverride = null,
}) {
  const tid = Number(tenantId);
  const cobranca = await prisma.cobrancaBancaria.findFirst({
    where: { id: Number(cobrancaId), tenantId: tid },
    include: { titulo: true, cliente: true },
  });
  if (!cobranca) {
    throw new AppError("Cobrança não encontrada", {
      code: "COBRANCA_NAO_ENCONTRADA",
      httpStatus: 404,
    });
  }

  if (
    cobranca.status === STATUS.REGISTRADA ||
    cobranca.status === STATUS.DISPONIVEL
  ) {
    return sanitizarCobranca(cobranca);
  }
  if (cobranca.status === STATUS.CANCELADA) {
    throw new AppError("Cobrança cancelada não pode ser registrada", {
      code: "COBRANCA_CANCELADA",
      httpStatus: 400,
    });
  }
  if (cobranca.refExterna && cobranca.status === STATUS.PROCESSANDO) {
    return sanitizarCobranca(cobranca);
  }

  await prisma.cobrancaBancaria.update({
    where: { id: cobranca.id },
    data: { status: STATUS.PROCESSANDO, ultimoErro: null },
  });

  let provider = providerOverride;
  let config = null;
  if (!provider) {
    const loaded = await loadProviderForBanco(prisma, {
      tenantId: tid,
      banco: cobranca.banco,
    });
    provider = loaded.provider;
    config = loaded.config;
  }

  try {
    const result = await provider.gerarCobranca({
      tituloId: cobranca.tituloId,
      idempotencyKey: cobranca.idempotencyKey,
      valor: parseFloat(String(cobranca.valor)),
      vencimento: cobranca.vencimento,
      cliente: cobranca.cliente,
      nossoNumeroHint: cobranca.titulo?.numero,
    });

    const nextStatus =
      result.status === STATUS.DISPONIVEL || result.pdfRef
        ? STATUS.DISPONIVEL
        : STATUS.REGISTRADA;

    const updated = await prisma.cobrancaBancaria.update({
      where: { id: cobranca.id },
      data: {
        status: nextStatus,
        nossoNumero: result.nossoNumero || null,
        linhaDigitavel: result.linhaDigitavel || null,
        codigoBarras: result.codigoBarras || null,
        refExterna: result.refExterna || null,
        pdfRef: result.pdfRef || null,
        registradaEm: new Date(),
        ultimoErro: null,
        configuracaoBancariaId: config?.id ?? cobranca.configuracaoBancariaId,
        payloadRetorno: result.raw
          ? { mock: !!result.raw.mock, status: result.status }
          : undefined,
      },
    });

    if (auditReq) {
      await registrarAuditoria(prisma, auditReq, {
        tenantId: tid,
        tipo: "COBRANCA_REGISTRADA",
        entidade: "CobrancaBancaria",
        entidadeId: updated.id,
        clienteId: cobranca.clienteId,
        vendaId: cobranca.vendaId,
        tituloId: cobranca.tituloId,
        valor: parseFloat(String(cobranca.valor)),
        payload: {
          banco: cobranca.banco,
          status: updated.status,
          nossoNumero: updated.nossoNumero,
        },
      });
    }
    return sanitizarCobranca(updated);
  } catch (err) {
    const msg =
      err instanceof BankBillingError
        ? err.message
        : err?.message || "Falha ao registrar cobrança";
    const code = err instanceof BankBillingError ? err.code : CODES.SERVER_ERROR;
    const updated = await prisma.cobrancaBancaria.update({
      where: { id: cobranca.id },
      data: {
        status: STATUS.ERRO,
        ultimoErro: `${code}: ${msg}`.slice(0, 500),
      },
    });
    if (auditReq) {
      await registrarAuditoria(prisma, auditReq, {
        tenantId: tid,
        tipo: "COBRANCA_ERRO",
        entidade: "CobrancaBancaria",
        entidadeId: updated.id,
        clienteId: cobranca.clienteId,
        vendaId: cobranca.vendaId,
        tituloId: cobranca.tituloId,
        payload: { code, message: msg },
      });
    }
    return sanitizarCobranca(updated);
  }
}

/**
 * Após NF-e autorizada: cria e tenta registrar cobranças da venda.
 * Nunca propaga erro para invalidar a NF-e.
 */
async function gerarCobrancasAposNfeAutorizada(prisma, {
  tenantId,
  vendaId,
  auditReq = null,
  providerOverride = null,
}) {
  const tid = Number(tenantId);
  const venda = await prisma.venda.findFirst({
    where: { id: Number(vendaId), tenantId: tid },
    include: {
      titulos: { orderBy: [{ parcelaNumero: "asc" }, { vencimento: "asc" }] },
    },
  });
  if (!venda) return { ok: false, reason: "VENDA_NAO_ENCONTRADA", cobrancas: [] };
  if (!venda.bancoCobranca) {
    return { ok: true, reason: "SEM_BANCO", cobrancas: [] };
  }

  const results = [];
  for (const titulo of venda.titulos || []) {
    try {
      const cobranca = await ensureCobrancaParaTitulo(prisma, {
        tenantId: tid,
        titulo,
        banco: venda.bancoCobranca,
        auditReq,
      });
      const registered = await registrarCobranca(prisma, {
        tenantId: tid,
        cobrancaId: cobranca.id,
        auditReq,
        providerOverride,
      });
      results.push(registered);
    } catch (err) {
      results.push({
        tituloId: titulo.id,
        status: STATUS.ERRO,
        ultimoErro: err?.message || "erro",
      });
    }
  }
  return { ok: true, cobrancas: results };
}

async function cancelarCobranca(prisma, {
  tenantId,
  cobrancaId,
  auditReq = null,
}) {
  const tid = Number(tenantId);
  const cobranca = await prisma.cobrancaBancaria.findFirst({
    where: { id: Number(cobrancaId), tenantId: tid },
  });
  if (!cobranca) {
    throw new AppError("Cobrança não encontrada", {
      code: "COBRANCA_NAO_ENCONTRADA",
      httpStatus: 404,
    });
  }
  if (cobranca.status === STATUS.CANCELADA) {
    return sanitizarCobranca(cobranca);
  }

  if (cobranca.refExterna) {
    const { provider } = await loadProviderForBanco(prisma, {
      tenantId: tid,
      banco: cobranca.banco,
    });
    try {
      await provider.cancelarCobranca({ refExterna: cobranca.refExterna });
    } catch (err) {
      if (!(err instanceof BankBillingError && err.code === CODES.CANCEL_UNSUPPORTED)) {
        throw err;
      }
    }
  }

  const updated = await prisma.cobrancaBancaria.update({
    where: { id: cobranca.id },
    data: { status: STATUS.CANCELADA },
  });
  if (auditReq) {
    await registrarAuditoria(prisma, auditReq, {
      tenantId: tid,
      tipo: "COBRANCA_CANCELADA",
      entidade: "CobrancaBancaria",
      entidadeId: updated.id,
      clienteId: cobranca.clienteId,
      vendaId: cobranca.vendaId,
      tituloId: cobranca.tituloId,
      payload: { banco: cobranca.banco },
    });
  }
  return sanitizarCobranca(updated);
}

module.exports = {
  STATUS,
  BANCOS,
  idempotencyKeyForTitulo,
  parseSecrets,
  prepareSecretsForStorage,
  sanitizarCobranca,
  sanitizarConfig,
  loadProviderForBanco,
  ensureCobrancaParaTitulo,
  registrarCobranca,
  gerarCobrancasAposNfeAutorizada,
  cancelarCobranca,
};
