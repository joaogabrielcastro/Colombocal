import { describe, expect, it } from "vitest";
import { nomeArquivoExcel } from "./exportExcel";

describe("nomeArquivoExcel", () => {
  it("usa prefixo e data ISO", () => {
    expect(nomeArquivoExcel("contas-receber-clientes")).toMatch(
      /^contas-receber-clientes_\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
  });
});
