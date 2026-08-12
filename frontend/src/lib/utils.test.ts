import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatDate,
  localDateInputValue,
  formatCNPJ,
  formatCPF,
  formatDocumentoCliente,
  formatQuantidade,
  vendaNumeroPublico,
  toInputDate,
  formatFreteReciboLinha,
} from "./utils";

describe("formatMoney", () => {
  it("formata número, string e nulo", () => {
    expect(formatMoney(1234.5)).toContain("1.234,50");
    expect(formatMoney("10")).toContain("10,00");
    expect(formatMoney(null)).toContain("0,00");
    expect(formatMoney(undefined)).toContain("0,00");
  });
});

describe("formatDate", () => {
  it("retorna traço para vazio", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
  });
  it("formata data ISO", () => {
    expect(formatDate("2026-04-01T12:00:00Z")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
  it("não atrasa um dia em meia-noite UTC (fuso Brasil)", () => {
    // Sem timeZone UTC, America/Sao_Paulo mostraria 02/08.
    expect(formatDate("2026-08-03T00:00:00.000Z")).toBe("03/08/2026");
  });
  it("meio-dia UTC continua no mesmo dia civil", () => {
    expect(formatDate("2026-08-03T12:00:00.000Z")).toBe("03/08/2026");
  });
});

describe("localDateInputValue", () => {
  it("formata como YYYY-MM-DD local", () => {
    const d = new Date(2026, 0, 5); // 05/01/2026 local
    expect(localDateInputValue(d)).toBe("2026-01-05");
  });
});

describe("formatCNPJ / formatCPF", () => {
  it("formata CNPJ com 14 dígitos", () => {
    expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });
  it("devolve original se CNPJ inválido", () => {
    expect(formatCNPJ("123")).toBe("123");
  });
  it("formata CPF com 11 dígitos", () => {
    expect(formatCPF("39053344705")).toBe("390.533.447-05");
  });
  it("devolve original se CPF inválido", () => {
    expect(formatCPF("123")).toBe("123");
  });
});

describe("formatDocumentoCliente", () => {
  it("PF usa CPF", () => {
    expect(formatDocumentoCliente({ tipoPessoa: "PF", cpf: "39053344705" })).toBe(
      "390.533.447-05",
    );
  });
  it("PJ usa CNPJ", () => {
    expect(formatDocumentoCliente({ cnpj: "11222333000181" })).toBe(
      "11.222.333/0001-81",
    );
  });
  it("cai para CPF quando só há CPF", () => {
    expect(formatDocumentoCliente({ cpf: "39053344705" })).toBe("390.533.447-05");
  });
  it("retorna travessão quando não há documento", () => {
    expect(formatDocumentoCliente({})).toBe("—");
  });
});

describe("formatQuantidade", () => {
  it("inclui a unidade", () => {
    expect(formatQuantidade(2.5, "ton")).toBe("2,5 ton");
    expect(formatQuantidade("3", "saco")).toBe("3 saco");
  });
});

describe("vendaNumeroPublico", () => {
  it("usa numeroVenda quando positivo", () => {
    expect(vendaNumeroPublico({ id: 10, numeroVenda: 5 })).toBe(5);
  });
  it("cai para id quando numeroVenda ausente/zero", () => {
    expect(vendaNumeroPublico({ id: 10 })).toBe(10);
    expect(vendaNumeroPublico({ id: 10, numeroVenda: 0 })).toBe(10);
  });
});

describe("toInputDate", () => {
  it("retorna vazio para nulo ou inválido", () => {
    expect(toInputDate(null)).toBe("");
    expect(toInputDate("data-invalida")).toBe("");
  });
  it("converte data válida", () => {
    expect(toInputDate("2026-04-01T12:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatFreteReciboLinha", () => {
  it("retorna travessão sem frete e sem movimento", () => {
    expect(formatFreteReciboLinha({ frete: 0 })).toBe("—");
  });
  it("mostra pendente quando frete > 0 e não pago", () => {
    expect(formatFreteReciboLinha({ frete: 50, freteRecibo: false })).toBe(
      "Pagamento pendente",
    );
  });
  it("mostra pago com data", () => {
    const out = formatFreteReciboLinha({
      frete: 50,
      fretes: [
        {
          id: 1,
          clienteId: 1,
          valor: 50,
          reciboEmitido: true,
          reciboData: "2026-04-01T12:00:00Z",
          data: "2026-04-01",
        },
      ],
    });
    expect(out).toMatch(/^Pago em /);
  });
  it("mostra pago sem data", () => {
    expect(
      formatFreteReciboLinha({ frete: 50, freteRecibo: true }),
    ).toBe("Pago");
  });
});
