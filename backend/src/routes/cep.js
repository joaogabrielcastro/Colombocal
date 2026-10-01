const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/:cep", async (req, res) => {
  const cep = String(req.params.cep || "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep)) {
    return res.status(400).json({ error: "CEP inválido. Informe 8 dígitos." });
  }
  try {
    const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`, { timeout: 8000 });
    const data = response.data || {};
    if (data.erro) return res.status(404).json({ error: "CEP não encontrado." });
    return res.json({
      cep: String(data.cep || cep).replace(/\D/g, ""),
      logradouro: data.logradouro || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      municipio: data.localidade || "",
      uf: data.uf || "",
      codigoMunicipio: data.ibge || "",
    });
  } catch {
    return res.status(502).json({ error: "Não foi possível consultar o CEP. Preencha o endereço manualmente." });
  }
});

module.exports = router;
