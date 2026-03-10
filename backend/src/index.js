const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/clientes", require("./routes/clientes"));
app.use("/api/produtos", require("./routes/produtos"));
app.use("/api/motoristas", require("./routes/motoristas"));
app.use("/api/vendedores", require("./routes/vendedores"));
app.use("/api/vendas", require("./routes/vendas"));
app.use("/api/cheques", require("./routes/cheques"));
app.use("/api/pagamentos", require("./routes/pagamentos"));
app.use("/api/estoque", require("./routes/estoque"));
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor Colombocal rodando na porta ${PORT}`);
});

module.exports = app;
