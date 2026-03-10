const express = require("express");
const router = express.Router();
const axios = require("axios");

// GET /api/cnpj/:cnpj - buscar dados do CNPJ via BrasilAPI
router.get("/:cnpj", async (req, res) => {
  try {
    const cnpj = req.params.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      return res
        .status(400)
        .json({ error: "CNPJ inválido. Informe os 14 dígitos." });
    }

    const response = await axios.get(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      {
        timeout: 10000,
      },
    );

    const data = response.data;
    res.json({
      cnpj: data.cnpj,
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia || data.razao_social,
      telefone: data.ddd_telefone_1
        ? `(${data.ddd_telefone_1}) ${data.telefone_1}`
        : "",
      cidade: data.municipio,
      estado: data.uf,
      endereco: `${data.logradouro}, ${data.numero}${data.complemento ? " " + data.complemento : ""} - ${data.bairro}`,
      cep: data.cep,
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return res
        .status(404)
        .json({ error: "CNPJ não encontrado na base da Receita Federal" });
    }
    res.status(500).json({ error: "Erro ao consultar CNPJ. Tente novamente." });
  }
});

module.exports = router;
