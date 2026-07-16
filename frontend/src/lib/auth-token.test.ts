import { afterEach, describe, expect, it } from "vitest";
import { getAuthToken, setAuthToken, clearAuthToken } from "./auth-token";

afterEach(() => {
  window.localStorage.clear();
});

describe("auth-token", () => {
  it("retorna null quando não há token", () => {
    expect(getAuthToken()).toBeNull();
  });

  it("armazena, lê e limpa o token", () => {
    setAuthToken("abc123");
    expect(getAuthToken()).toBe("abc123");
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });
});
