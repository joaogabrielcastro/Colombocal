const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Garante uso do engine local no ambiente de desenvolvimento
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
delete process.env.PRISMA_GENERATE_NO_ENGINE;
delete process.env.PRISMA_GENERATE_DATAPROXY;

const app = express();

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
  skip: (req) => req.originalUrl.includes("/api/cnpj"),
});

const cnpjLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_CNPJ_PER_MIN ?? 25),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/cnpj", cnpjLimiter);
app.use("/api", apiLimiter);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "API Colombocal funcionando 🚀" });
});

// Routes
app.use("/api/clientes", require("./routes/clientes"));
app.use("/api/produtos", require("./routes/produtos"));
app.use("/api/motoristas", require("./routes/motoristas"));
app.use("/api/vendedores", require("./routes/vendedores"));
app.use("/api/vendas", require("./routes/vendas"));
app.use("/api/fretes", require("./routes/fretes"));
app.use("/api/config", require("./routes/config"));
app.use("/api/cheques", require("./routes/cheques"));
app.use("/api/pagamentos", require("./routes/pagamentos"));
app.use("/api/relatorios", require("./routes/relatorios"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/cnpj", require("./routes/cnpj"));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ error: "Erro interno do servidor", details: err.message });
});

const PORT = process.env.PORT || 3011;
app.listen(PORT, () => {
  console.log(`✅ Servidor Colombocal rodando na porta ${PORT}`);
});

module.exports = app;
