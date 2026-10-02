import { describe, expect, it } from "vitest";
import { buildCteEmissionPayload, buildMdfeEmissionPayload } from "./transport-payload";

describe("transport fiscal payloads", () => {
  it("inclui o emitente e normaliza o contrato do CT-e", () => {
    const payload = buildCteEmissionPayload(
      {
        remetenteNome: "Origem",
        remetenteDoc: "",
        destinatarioNome: "Destino",
        destinatarioDoc: "",
        origemMunicipio: "Curitiba",
        origemUf: "pr",
        destinoMunicipio: "Joinville",
        destinoUf: "sc",
        valorServico: "150.50",
        valorCarga: "1000",
        pesoKg: "500",
        observacoes: "",
      },
      27,
    );

    expect(payload).toMatchObject({
      emitenteFiscalId: 27,
      origemUf: "PR",
      destinoUf: "SC",
      valorServico: 150.5,
    });
  });

  it("inclui o emitente e preserva a chave informada no MDF-e", () => {
    const key = "35260911222333000181550010000001251000001251";
    const payload = buildMdfeEmissionPayload(
      {
        ufInicio: "pr",
        ufFim: "sc",
        veiculoPlaca: "ABC1D23",
        motoristaNome: "Motorista",
        chaveDoc: key,
        tipoDoc: "nfe",
      },
      31,
    );

    expect(payload.emitenteFiscalId).toBe(31);
    expect(payload.documentos).toEqual([{ tipo: "nfe", chaveAcesso: key }]);
  });
});
