const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const { prisma, ensureDatabaseCompat } = require("./lib/prisma");
const {
  requestIdMiddleware,
  sendErrorAlert,
} = require("./shared/http/observability");
const { requireTenantUser, requireAdmin } = require("./middleware/auth");
const { runPrismaMigrateOnStart } = require("./startup/migrateOnStart");

// Garante uso do engine local no ambiente de desenvolvimento
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
delete process.env.PRISMA_GENERATE_NO_ENGINE;
delete process.env.PRISMA_GENERATE_DATAPROXY;

const app = express();
app.use(requestIdMiddleware);

const trustProxy = process.env.TRUST_PROXY;
if (typeof trustProxy !== "undefined") {
  if (trustProxy === "true") {
    app.set("trust proxy", true);
  } else if (trustProxy === "false") {
    app.set("trust proxy", false);
  } else {
    const hops = Number(trustProxy);
    if (!Number.isNaN(hops)) {
      app.set("trust proxy", hops);
    }
  }
} else if (process.env.NODE_ENV === "production") {
  // In production, requests usually come from a reverse proxy/load balancer.
  app.set("trust proxy", 1);
}

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin || true,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_PER_WINDOW ?? 600),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.originalUrl.includes("/api/cnpj") ||
    req.originalUrl.startsWith("/api/setup") ||
    (req.method === "POST" && req.originalUrl.startsWith("/api/auth/register")) ||
    (req.method === "GET" && req.originalUrl.startsWith("/api/auth/register-status")),
});

const cnpjLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_CNPJ_PER_MIN ?? 25),
  standardHeaders: true,
  legacyHeaders: false,
});

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_SETUP_PER_HOUR ?? 40),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/cnpj", cnpjLimiter);
app.use("/api", apiLimiter);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "API Colombocal funcionando 🚀" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "colombocal-backend",
    requestId: req.requestId,
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ready",
      service: "colombocal-backend",
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await sendErrorAlert(error, {
      requestId: req.requestId,
      source: "readiness_check",
    });
    res.status(503).json({
      status: "not_ready",
      error: "database_unreachable",
      requestId: req.requestId,
    });
  }
});

// Setup web (primeiro admin) — público, limitado; exige SETUP_SECRET no servidor
app.use("/api/setup", setupLimiter, require("./routes/setup"));

// Rotas públicas de autenticação (sem JWT)
app.use("/api/auth", require("./routes/auth"));

// API protegida: multi-tenant + JWT (ou AUTH_DISABLED=true em desenvolvimento)
app.use("/api/clientes", requireTenantUser, require("./routes/clientes"));
app.use("/api/produtos", requireTenantUser, require("./routes/produtos"));
app.use("/api/motoristas", requireTenantUser, require("./routes/motoristas"));
app.use("/api/vendedores", requireTenantUser, require("./routes/vendedores"));
app.use("/api/vendas", requireTenantUser, require("./routes/vendas"));
app.use("/api/fretes", requireTenantUser, require("./routes/fretes"));
app.use("/api/config", requireTenantUser, require("./routes/config"));
app.use("/api/users", requireTenantUser, requireAdmin, require("./routes/users"));
app.use("/api/cheques", requireTenantUser, require("./routes/cheques"));
app.use("/api/pagamentos", requireTenantUser, require("./routes/pagamentos"));
app.use("/api/relatorios", requireTenantUser, require("./routes/relatorios"));
app.use("/api/dashboard", requireTenantUser, require("./routes/dashboard"));
app.use("/api/cnpj", requireTenantUser, require("./routes/cnpj"));

// Global error handler
app.use((err, req, res, next) => {
  const requestId = req.requestId || "unknown";
  console.error(
    JSON.stringify({
      level: "error",
      type: "http_unhandled_error",
      requestId,
      method: req.method,
      path: req.originalUrl,
      message: err?.message,
      stack: err?.stack,
    }),
  );
  void sendErrorAlert(err, {
    requestId,
    method: req.method,
    path: req.originalUrl,
    source: "express_error_handler",
  });
  const body = {
    error: "Erro interno do servidor",
    requestId,
  };
  if (process.env.NODE_ENV !== "production") {
    body.details = err?.message;
  }
  res.status(500).json(body);
});

const PORT = process.env.PORT || 3011;

function shouldRunStartupDbCompat() {
  if (process.env.ALLOW_STARTUP_DB_COMPAT === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

async function startServer() {
  try {
    try {
      runPrismaMigrateOnStart();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("❌ Falha em RUN_PRISMA_MIGRATE_ON_START (prisma migrate deploy):", msg);
      process.exit(1);
    }
    if (shouldRunStartupDbCompat()) {
      await ensureDatabaseCompat();
    } else {
      console.log(
        "ℹ️ Compatibilidade automática de schema desativada em produção (ALLOW_STARTUP_DB_COMPAT != true).",
      );
    }
    app.listen(PORT, () => {
      console.log(`✅ Servidor Colombocal rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Falha ao validar compatibilidade do banco:", error.message);
    process.exit(1);
  }
}

startServer();

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error(
    JSON.stringify({
      level: "error",
      type: "unhandled_rejection",
      message: err.message,
      stack: err.stack,
    }),
  );
  void sendErrorAlert(err, { source: "process_unhandled_rejection" });
});

process.on("uncaughtException", (error) => {
  console.error(
    JSON.stringify({
      level: "error",
      type: "uncaught_exception",
      message: error.message,
      stack: error.stack,
    }),
  );
  void sendErrorAlert(error, { source: "process_uncaught_exception" });
});

module.exports = app;
