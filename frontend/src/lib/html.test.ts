import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html";

describe("escapeHtml", () => {
  it("escapa caracteres perigosos", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(escapeHtml("A & B")).toBe("A &amp; B");
    expect(escapeHtml("o'reilly")).toBe("o&#39;reilly");
  });
});
