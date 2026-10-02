type CteForm = {
  remetenteNome: string;
  remetenteDoc: string;
  destinatarioNome: string;
  destinatarioDoc: string;
  origemMunicipio: string;
  origemUf: string;
  destinoMunicipio: string;
  destinoUf: string;
  valorServico: string;
  valorCarga: string;
  pesoKg: string;
  observacoes: string;
};

type MdfeForm = {
  ufInicio: string;
  ufFim: string;
  veiculoPlaca: string;
  motoristaNome: string;
  chaveDoc: string;
  tipoDoc: "nfe" | "cte";
};

export function buildCteEmissionPayload(form: CteForm, emitenteFiscalId: number) {
  return {
    ...form,
    emitenteFiscalId,
    origemUf: form.origemUf.toUpperCase(),
    destinoUf: form.destinoUf.toUpperCase(),
    valorServico: form.valorServico ? Number(form.valorServico) : null,
    valorCarga: form.valorCarga ? Number(form.valorCarga) : null,
    pesoKg: form.pesoKg ? Number(form.pesoKg) : null,
  };
}

export function buildMdfeEmissionPayload(form: MdfeForm, emitenteFiscalId: number) {
  return {
    emitenteFiscalId,
    ufInicio: form.ufInicio.toUpperCase(),
    ufFim: form.ufFim.toUpperCase(),
    veiculoPlaca: form.veiculoPlaca,
    motoristaNome: form.motoristaNome || null,
    documentos: [{ tipo: form.tipoDoc, chaveAcesso: form.chaveDoc }],
  };
}
