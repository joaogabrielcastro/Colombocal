const { dataReferenciaNota, whereDataReferenciaNoPeriodo } = require("./dataReferencia");
const { resumoFiscal } = require("./resumoFiscal");
const { detectarLacunasNumeracao } = require("./lacunasNumeracao");
const { extrairItensFiscaisDoPayload, resumoFiscalLinha } = require("./extrairFiscal");
const { montarWhereNotas } = require("./montarWhereNotas");
const { montarLinhaExport, colunasExport } = require("./exportLinhas");

module.exports = {
  dataReferenciaNota,
  whereDataReferenciaNoPeriodo,
  resumoFiscal,
  detectarLacunasNumeracao,
  extrairItensFiscaisDoPayload,
  resumoFiscalLinha,
  montarWhereNotas,
  montarLinhaExport,
  colunasExport,
};
