import { describe, expect, it } from "vitest";
import { UI_HIDE_ADVANCED, REQUIRE_LOGIN } from "./features";

describe("UI_HIDE_ADVANCED", () => {
  it("é booleano derivado de env", () => {
    expect(typeof UI_HIDE_ADVANCED).toBe("boolean");
  });
});

describe("REQUIRE_LOGIN", () => {
  it("é booleano (produção sempre exige login)", () => {
    expect(typeof REQUIRE_LOGIN).toBe("boolean");
  });
});

describe("UI_HIDE_ADVANCED", () => {
  it("é booleano derivado de env", () => {
    expect(typeof UI_HIDE_ADVANCED).toBe("boolean");
  });
});
