const express = require("express");
const router = express.Router();
const axios = require("axios");
const { z } = require("zod");
const { isValidCnpj } = require("../utils/cpf");

const cnpjDigits = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().length(14).regex(/^\d{14}$/, "14 dígitos numéricos"));

// GET /api/cnpj/:cnpj - buscar dados do CNPJ via BrasilAPI
router.get("/:cnpj", async (req, res) => {
  try {
    const parsed = cnpjDigits.safeParse(req.params.cnpj);
    if (!parsed.success) {
      return res.status(400).json({
        error: "CNPJ inválido. Informe os 14 dígitos.",
      });
    }
    const cnpj = parsed.data;
    if (!isValidCnpj(cnpj)) {
      return res.status(400).json({ error: "CNPJ inválido. Verifique os dígitos." });
    }

    const response = await axios.get(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      {
        timeout: 10000,
        headers: { "User-Agent": "Colombocal/1.0 (consulta cadastral)" },
      },
    );

    const data = response.data;
    res.json({
      cnpj: data.cnpj,
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia || data.razao_social,
      telefone: data.ddd_telefone_1 || "",
      cidade: data.municipio,
      estado: data.uf,
      municipio: data.municipio || "",
      uf: data.uf || "",
      endereco: `${data.logradouro}, ${data.numero}${data.complemento ? " " + data.complemento : ""} - ${data.bairro}`,
      cep: data.cep,
      logradouro: data.logradouro || "",
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      codigoMunicipio: data.codigo_municipio_ibge
        ? String(data.codigo_municipio_ibge)
        : "",
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
