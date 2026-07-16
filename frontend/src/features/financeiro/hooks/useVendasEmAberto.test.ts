import { describe, expect, it } from "vitest";
import { useVendasEmAberto } from "./useVendasEmAberto";

describe("financeiro/useVendasEmAberto (re-export)", () => {
  it("reexporta o hook de cheques", () => {
    expect(typeof useVendasEmAberto).toBe("function");
  });
});
