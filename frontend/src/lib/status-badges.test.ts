import { describe, expect, it } from "vitest";
import {
  badgeTipoPagamento,
  classStatusTituloUi,
  labelStatusTituloUi,
  statusTituloFromSaldo,
} from "./status-badges";

describe("status-badges", () => {
  it("glossário Quitado/Parcial/Aberto", () => {
    expect(statusTituloFromSaldo(0, 100)).toBe("quitado");
    expect(statusTituloFromSaldo(40, 100)).toBe("parcial");
    expect(statusTituloFromSaldo(100, 100)).toBe("aberto");
    expect(labelStatusTituloUi("quitado")).toBe("Quitado");
    expect(classStatusTituloUi("aberto")).toMatch(/red/);
  });

  it("badge de tipo de pagamento", () => {
    expect(badgeTipoPagamento("cheque").label).toBe("Cheque");
    expect(badgeTipoPagamento("transferencia").label).toMatch(/PIX/);
  });
});
