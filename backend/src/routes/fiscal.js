const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  handleRouteError,
  parsePagination,
  setPaginationHeaders,
} = require("../utils/api");
const { parseIntField } = require("../utils/validation");
const { assertNfeEnabled, xmlMockDanfe, htmlDanfeMock } = require("./nfeHelpers");
const { createNfeProvider } = require("../infra/nfe/provider");
const { sanitizarNota } = require("../domain/nfe/notaDaVenda");
const { STATUS } = require("../domain/nfe/constants");
const {
  montarWhereNotas,
  resumoFiscal,
  detectarLacunasNumeracao,
  extrairItensFiscaisDoPayload,
  dataReferenciaNota,
  montarLinhaExport,
  colunasExport,
  resumoFiscalMulti,
} = require("../domain/fiscal");
const { getTenantFeatures } = require("../services/tenantFeaturesResolver");
const { getTenantSlug } = require("../utils/tenantRequest");
const { registrarAuditoria } = require("../services/financeiroEventos");
const { enqueueExportJob } = require("../services/exportJobs");
const { getDateRange } = require("../utils/dateRangeQuery");

async function assertAnyFiscalDocEnabled(req) {
  const slug = await getTenantSlug(req.tenantId);
  const features = await getTenantFeatures(prisma, req.tenantId, slug);
  if (!features.nfe && !features.cte && !features.mdfe && !features.ciot) {
    const { AppError } = require("../shared/errors/appError");
    throw new AppError("Nenhum módulo fiscal de documentos habilitado.", {
      code: "FISCAL_DESABILITADO",
      httpStatus: 403,
    });
  }
  return features;
}

const NOTA_LIST_INCLUDE = {
  venda: {
    select: {
      id: true,
      numeroVenda: true,
      valorTotal: true,
      dataVenda: true,
      cliente: {
        select: {
          id: true,
          nomeFantasia: true,
          razaoSocial: true,
          cnpj: true,
          cpf: true,
        },
      },
    },
  },
};

const NOTA_DETAIL_INCLUDE = {
  venda: {
    include: {
      cliente: true,
      vendedor: true,
      itens: { include: { produto: true } },
    },
  },
};

function filtrosFromQuery(req) {
  return {
    tenantId: req.tenantId,
    dataInicio: req.query.dataInicio || req.query.de || "",
    dataFim: req.query.dataFim || req.query.ate || "",
    status: req.query.status || "",
    numero: req.query.numero || "",
    serie: req.query.serie || "",
    clienteId: req.query.clienteId || "",
    documento: req.query.documento || req.query.cnpjCpf || "",
    vendaId: req.query.vendaId || "",
    numeroVenda: req.query.numeroVenda || req.query.venda || "",
    chave: req.query.chave || req.query.chaveAcesso || "",
  };
}

async function carregarEmitenteAmbiente(tenantId) {
  const emitente = await prisma.emitenteFiscal.findUnique({
    where: { tenantId },
    select: {
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      ambiente: true,
      serieNfe: true,
    },
  });
  return emitente;
}

async function listarNotasPeriodo(filtros, { take, skip, orderBy } = {}) {
  const where = montarWhereNotas(filtros);
  const [total, notas] = await Promise.all([
    prisma.notaFiscal.count({ where }),
    prisma.notaFiscal.findMany({
      where,
      include: NOTA_LIST_INCLUDE,
      orderBy: orderBy || [{ createdAt: "desc" }, { id: "desc" }],
      ...(take != null ? { take } : {}),
      ...(skip != null ? { skip } : {}),
    }),
  ]);
  return { total, notas, where };
}

async function motivosCancelamentoMap(tenantId, notaIds) {
  if (!notaIds.length) return new Map();
  const eventos = await prisma.financeiroEvento.findMany({
    where: {
      tenantId,
      tipo: "NFE_CANCELADA",
      entidade: "NotaFiscal",
      entidadeId: { in: notaIds },
    },
    orderBy: { createdAt: "desc" },
    select: { entidadeId: true, payload: true },
  });
  const map = new Map();
  for (const ev of eventos) {
    if (map.has(ev.entidadeId)) continue;
    const j = ev.payload?.justificativa;
    if (j) map.set(ev.entidadeId, String(j));
  }
  return map;
}

function serializarNotaLista(nota) {
  const base = sanitizarNota(nota);
  return {
    ...base,
    dataReferencia: dataReferenciaNota(nota),
    valor: Number(nota.venda?.valorTotal ?? 0) || 0,
    cliente: nota.venda?.cliente
      ? {
          id: nota.venda.cliente.id,
          nome:
            nota.venda.cliente.nomeFantasia ||
            nota.venda.cliente.razaoSocial ||
            "",
          cnpj: nota.venda.cliente.cnpj,
          cpf: nota.venda.cliente.cpf,
        }
      : null,
    venda: nota.venda
      ? {
          id: nota.venda.id,
          numeroVenda: nota.venda.numeroVenda,
          valorTotal: Number(nota.venda.valorTotal ?? 0) || 0,
        }
      : null,
  };
}

// GET /api/fiscal/notas
router.get("/notas", async (req, res) => {
  try {
    await assertNfeEnabled(req);
    const { page, pageSize, skip } = parsePagination(req);
    const filtros = filtrosFromQuery(req);
    const { total, notas } = await listarNotasPeriodo(filtros, {
      take: pageSize,
      skip,
    });
    setPaginationHeaders(res, { total, page, pageSize });
    const emitente = await carregarEmitenteAmbiente(req.tenantId);
    res.json({
      items: notas.map(serializarNotaLista),
      total,
      page,
      pageSize,
      ambiente: emitente?.ambiente || "homologacao",
      periodo: {
        dataInicio: filtros.dataInicio || null,
        dataFim: filtros.dataFim || null,
      },
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/fiscal/notas/resumo
router.get("/notas/resumo", async (req, res) => {
  try {
    await assertNfeEnabled(req);
    const filtros = filtrosFromQuery(req);
    const where = montarWhereNotas(filtros);
    const notas = await prisma.notaFiscal.findMany({
      where,
      select: {
        status: true,
        venda: { select: { valorTotal: true } },
      },
    });
    const resumo = resumoFiscal(notas);
    const emitente = await carregarEmitenteAmbiente(req.tenantId);
    res.json({
      ...resumo,
      ambiente: emitente?.ambiente || "homologacao",
      periodo: {
        dataInicio: filtros.dataInicio || null,
        dataFim: filtros.dataFim || null,
      },
      observacaoEmissaoIncerta:
        "Emissão incerta não é status persistido: casos inconclusivos permanecem em Processando.",
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/fiscal/notas/:id
router.get("/notas/:id", async (req, res) => {
  try {
    await assertNfeEnabled(req);
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const nota = await prisma.notaFiscal.findFirst({
      where: { id, tenantId: req.tenantId },
      include: NOTA_DETAIL_INCLUDE,
    });
    if (!nota) return res.status(404).json({ error: "NF-e não encontrada" });

    const emitente = await carregarEmitenteAmbiente(req.tenantId);
    const itensFiscais = extrairItensFiscaisDoPayload(nota.payloadEnviado);
    let motivoCancelamento = null;
    if (nota.status === STATUS.CANCELADA) {
      const map = await motivosCancelamentoMap(req.tenantId, [nota.id]);
      motivoCancelamento = map.get(nota.id) || nota.motivoRejeicao || null;
    }

    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      tipo: "NFE_VISUALIZADA",
      entidade: "NotaFiscal",
      entidadeId: nota.id,
      vendaId: nota.vendaId,
      payload: { status: nota.status },
    });

    const venda = nota.venda;
    res.json({
      nota: {
        ...sanitizarNota(nota),
        dataReferencia: dataReferenciaNota(nota),
        motivoCancelamento,
        valor: Number(venda?.valorTotal ?? 0) || 0,
      },
      ambiente: emitente?.ambiente || "homologacao",
      emitente: emitente
        ? {
            razaoSocial: emitente.razaoSocial,
            nomeFantasia: emitente.nomeFantasia,
            cnpj: emitente.cnpj,
            ambiente: emitente.ambiente,
          }
        : null,
      venda: venda
        ? {
            id: venda.id,
            numeroVenda: venda.numeroVenda,
            dataVenda: venda.dataVenda,
            valorTotal: Number(venda.valorTotal ?? 0) || 0,
            cliente: venda.cliente
              ? {
                  id: venda.cliente.id,
                  nomeFantasia: venda.cliente.nomeFantasia,
                  razaoSocial: venda.cliente.razaoSocial,
                  cnpj: venda.cliente.cnpj,
                  cpf: venda.cliente.cpf,
                }
              : null,
            vendedor: venda.vendedor
              ? { id: venda.vendedor.id, nome: venda.vendedor.nome }
              : null,
            itens: (venda.itens || []).map((it) => ({
              id: it.id,
              quantidade: Number(it.quantidade),
              precoUnitario: Number(it.precoUnitario),
              produto: it.produto
                ? {
                    id: it.produto.id,
                    codigo: it.produto.codigo,
                    nome: it.produto.nome,
                    ncm: it.produto.ncm,
                    cfopPadraoDentro: it.produto.cfopPadraoDentro,
                    cfopPadraoFora: it.produto.cfopPadraoFora,
                    cst: it.produto.cst,
                    csosn: it.produto.csosn,
                  }
                : null,
            })),
          }
        : null,
      fiscalItens: itensFiscais,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

async function enviarArquivoNotaPorId(req, res, kind) {
  await assertNfeEnabled(req);
  const id = parseIntField(req.params.id, "id", { min: 1 });
  const nota = await prisma.notaFiscal.findFirst({
    where: { id, tenantId: req.tenantId },
  });
  if (!nota) return res.status(404).json({ error: "NF-e não encontrada" });

  const podeXml =
    nota.status === STATUS.AUTORIZADA ||
    nota.status === STATUS.CANCELADA ||
    !!nota.xmlUrl;
  if (kind === "xml" && !podeXml && !nota.xmlUrl) {
    return res.status(404).json({ error: "XML ainda não disponível." });
  }
  if (kind === "danfe" && nota.status !== STATUS.AUTORIZADA && !nota.danfeUrl) {
    return res.status(404).json({ error: "DANFE ainda não disponível." });
  }

  const venda = await prisma.venda.findFirst({
    where: { id: nota.vendaId, tenantId: req.tenantId },
    select: { numeroVenda: true },
  });
  const emitente = await prisma.emitenteFiscal.findUnique({
    where: { tenantId: req.tenantId },
  });
  const provider = createNfeProvider({ emitente });
  const url = kind === "danfe" ? nota.danfeUrl : nota.xmlUrl;

  if (kind === "xml") {
    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      tipo: "NFE_XML_DOWNLOAD",
      entidade: "NotaFiscal",
      entidadeId: nota.id,
      vendaId: nota.vendaId,
      payload: { temXmlUrl: !!nota.xmlUrl },
    });
  }

  if (url && provider.baixarArquivo) {
    const file = await provider.baixarArquivo(url);
    if (file?.buffer) {
      res.setHeader("Content-Type", file.contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${kind}-nfe-${nota.numero || nota.id}.${kind === "xml" ? "xml" : "pdf"}"`,
      );
      return res.send(file.buffer);
    }
  }

  if (kind === "xml") {
    if (nota.status !== STATUS.AUTORIZADA && nota.status !== STATUS.CANCELADA) {
      return res.status(404).json({ error: "XML ainda não disponível." });
    }
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nfe-${nota.numero || nota.id}.xml"`,
    );
    return res.send(xmlMockDanfe(nota, venda));
  }

  if (nota.status !== STATUS.AUTORIZADA) {
    return res.status(404).json({ error: "DANFE ainda não disponível." });
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(htmlDanfeMock(nota, venda));
}

router.get("/notas/:id/xml", async (req, res) => {
  try {
    await enviarArquivoNotaPorId(req, res, "xml");
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get("/notas/:id/danfe", async (req, res) => {
  try {
    await enviarArquivoNotaPorId(req, res, "danfe");
  } catch (error) {
    handleRouteError(res, error);
  }
});

async function carregarNotasFechamentoComPayload(filtros) {
  const where = montarWhereNotas(filtros);
  return prisma.notaFiscal.findMany({
    where,
    include: {
      venda: NOTA_LIST_INCLUDE.venda,
    },
    orderBy: [{ serie: "asc" }, { numero: "asc" }, { id: "asc" }],
  });
}

// GET /api/fiscal/fechamento
router.get("/fechamento", async (req, res) => {
  try {
    const features = await assertAnyFiscalDocEnabled(req);
    const filtros = filtrosFromQuery(req);
    if (!filtros.dataInicio || !filtros.dataFim) {
      return res.status(400).json({
        error: "Informe dataInicio e dataFim do período.",
        code: "FISCAL_PERIODO",
      });
    }

    const range = getDateRange(filtros.dataInicio, filtros.dataFim);
    const periodFilter = range.gte || range.lte ? range : undefined;

    const notas = features.nfe
      ? await carregarNotasFechamentoComPayload(filtros)
      : [];
    const canceladasIds = notas
      .filter((n) => n.status === STATUS.CANCELADA)
      .map((n) => n.id);
    const motivos = await motivosCancelamentoMap(req.tenantId, canceladasIds);

    const notasComMotivo = notas.map((n) => ({
      ...n,
      motivoCancelamento: motivos.get(n.id) || null,
    }));

    const [ctes, mdfes, ciots] = await Promise.all([
      features.cte
        ? prisma.conhecimentoTransporte.findMany({
            where: {
              tenantId: req.tenantId,
              ...(periodFilter ? { emitidaEm: periodFilter } : {}),
            },
            orderBy: { id: "asc" },
          })
        : [],
      features.mdfe
        ? prisma.manifestoEletronico.findMany({
            where: {
              tenantId: req.tenantId,
              ...(periodFilter ? { emitidaEm: periodFilter } : {}),
            },
            include: { documentos: true },
            orderBy: { id: "asc" },
          })
        : [],
      features.ciot
        ? prisma.operacaoCiot.findMany({
            where: {
              tenantId: req.tenantId,
              ...(periodFilter ? { dataOperacao: periodFilter } : {}),
            },
            orderBy: { id: "asc" },
          })
        : [],
    ]);

    const resumo = resumoFiscal(notasComMotivo);
    const resumoMulti = resumoFiscalMulti({
      notas: notasComMotivo,
      ctes,
      mdfes,
      ciots,
    });
    const lacunas = detectarLacunasNumeracao(
      notasComMotivo.filter((n) =>
        [STATUS.AUTORIZADA, STATUS.CANCELADA].includes(n.status),
      ),
    );
    const emitente = await carregarEmitenteAmbiente(req.tenantId);
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { id: true, name: true, slug: true },
    });

    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      tipo: "FISCAL_FECHAMENTO_GERADO",
      entidade: "FiscalFechamento",
      entidadeId: null,
      payload: {
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        nfe: resumo.total,
        cte: resumoMulti.cte.total,
        mdfe: resumoMulti.mdfe.total,
        ciot: resumoMulti.ciot.total,
      },
    });

    res.json({
      geradoEm: new Date().toISOString(),
      ambiente: emitente?.ambiente || "homologacao",
      empresa: emitente
        ? {
            razaoSocial: emitente.razaoSocial,
            nomeFantasia: emitente.nomeFantasia,
            cnpj: emitente.cnpj,
          }
        : null,
      tenant,
      periodo: {
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
      },
      resumo,
      resumoMulti,
      observacaoValores:
        "Valores de NF-e, CT-e e CIOT não são somados entre si — cada tipo mantém contexto próprio.",
      observacaoEmissaoIncerta:
        "Emissão incerta não é status persistido: casos inconclusivos permanecem em Processando.",
      disclaimer:
        "Relatório para conferência e envio à contabilidade. Não substitui obrigações acessórias ou escrituração fiscal realizada pelo contador.",
      lacunas,
      documentos: notasComMotivo.map(serializarNotaLista),
      cte: ctes.map((d) => ({
        id: d.id,
        numero: d.numero,
        serie: d.serie,
        status: d.status,
        emitidaEm: d.emitidaEm,
        destinatarioNome: d.destinatarioNome,
        origemUf: d.origemUf,
        destinoUf: d.destinoUf,
        valorServico: d.valorServico != null ? Number(d.valorServico) : null,
      })),
      mdfe: mdfes.map((d) => ({
        id: d.id,
        numero: d.numero,
        serie: d.serie,
        status: d.status,
        emitidaEm: d.emitidaEm,
        ufInicio: d.ufInicio,
        ufFim: d.ufFim,
        veiculoPlaca: d.veiculoPlaca,
        documentos: d.documentos?.length || 0,
      })),
      ciot: ciots.map((d) => ({
        id: d.id,
        codigoCiot: d.codigoCiot,
        status: d.status,
        dataOperacao: d.dataOperacao,
        transportadorNome: d.transportadorNome,
        motoristaNome: d.motoristaNome,
        valorOperacao: d.valorOperacao != null ? Number(d.valorOperacao) : null,
      })),
      canceladas: notasComMotivo
        .filter((n) => n.status === STATUS.CANCELADA)
        .map((n) => ({
          ...serializarNotaLista(n),
          motivoCancelamento: n.motivoCancelamento || n.motivoRejeicao || null,
          protocolo: n.protocolo || null,
        })),
      rejeitadas: notasComMotivo
        .filter((n) => n.status === STATUS.REJEITADA)
        .map((n) => ({
          ...serializarNotaLista(n),
          motivoRejeicao: n.motivoRejeicao || null,
        })),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/fiscal/fechamento/export — linhas JSON para Excel no client
router.get("/fechamento/export", async (req, res) => {
  try {
    await assertNfeEnabled(req);
    const filtros = filtrosFromQuery(req);
    if (!filtros.dataInicio || !filtros.dataFim) {
      return res.status(400).json({
        error: "Informe dataInicio e dataFim do período.",
        code: "FISCAL_PERIODO",
      });
    }
    const notas = await carregarNotasFechamentoComPayload(filtros);
    const canceladasIds = notas
      .filter((n) => n.status === STATUS.CANCELADA)
      .map((n) => n.id);
    const motivos = await motivosCancelamentoMap(req.tenantId, canceladasIds);
    const rows = notas.map((n) =>
      montarLinhaExport({
        ...n,
        motivoCancelamento: motivos.get(n.id) || null,
      }),
    );

    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      tipo: "NFE_EXPORT_EXCEL",
      entidade: "FiscalFechamento",
      entidadeId: null,
      payload: {
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        linhas: rows.length,
      },
    });

    res.json({
      colunas: colunasExport,
      rows,
      periodo: {
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
      },
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/fiscal/fechamento/pacote
router.post("/fechamento/pacote", async (req, res) => {
  try {
    await assertNfeEnabled(req);
    const dataInicio =
      req.body?.dataInicio || req.query.dataInicio || req.body?.de || "";
    const dataFim =
      req.body?.dataFim || req.query.dataFim || req.body?.ate || "";
    if (!dataInicio || !dataFim) {
      return res.status(400).json({
        error: "Informe dataInicio e dataFim do período.",
        code: "FISCAL_PERIODO",
      });
    }
    // Validar range
    getDateRange(dataInicio, dataFim);

    const jobId = await enqueueExportJob("nfe_pacote_contabil", req.tenantId, {
      dataInicio: String(dataInicio),
      dataFim: String(dataFim),
    });

    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      tipo: "NFE_PACOTE_CONTABIL",
      entidade: "FiscalFechamento",
      entidadeId: null,
      payload: { dataInicio, dataFim, jobId },
    });

    res.status(202).json({
      jobId,
      status: "pending",
      message: "Pacote contábil em geração.",
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.use("/cte", require("./fiscalCte"));
router.use("/mdfe", require("./fiscalMdfe"));
router.use("/ciot", require("./fiscalCiot"));

module.exports = router;
