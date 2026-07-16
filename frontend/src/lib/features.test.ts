import { describe, expect, it } from "vitest";
import { UI_HIDE_ADVANCED } from "./features";

describe("UI_HIDE_ADVANCED", () => {
  it("é booleano derivado de env", () => {
    expect(typeof UI_HIDE_ADVANCED).toBe("boolean");
  });
});
