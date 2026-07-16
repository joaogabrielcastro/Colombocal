import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useResumoRepresentantesSort } from "./useResumoRepresentantesSort";
import type { ResumoRepresentante } from "../services/resumo";

const base: ResumoRepresentante[] = [
  { nome: "Bruno", total: 200, frete: 0, quantidade: 2, ticketMedio: 100, participacao: 20 },
  { nome: "Ana", total: 500, frete: 0, quantidade: 1, ticketMedio: 500, participacao: 50 },
];

describe("useResumoRepresentantesSort", () => {
  it("ordena por total desc por padrão", () => {
    const { result } = renderHook(() => useResumoRepresentantesSort(base));
    expect(result.current.resumoRepresentantesOrdenado.map((x) => x.nome)).toEqual([
      "Ana",
      "Bruno",
    ]);
    expect(result.current.sortIndicator("total")).toBe(" ↓");
    expect(result.current.sortIndicator("nome")).toBe("");
  });

  it("toggle inverte direção da mesma coluna", () => {
    const { result } = renderHook(() => useResumoRepresentantesSort(base));
    act(() => result.current.toggleRepSort("total"));
    expect(result.current.sortIndicator("total")).toBe(" ↑");
    expect(result.current.resumoRepresentantesOrdenado.map((x) => x.nome)).toEqual([
      "Bruno",
      "Ana",
    ]);
  });

  it("troca de coluna define direção inicial (nome asc)", () => {
    const { result } = renderHook(() => useResumoRepresentantesSort(base));
    act(() => result.current.toggleRepSort("nome"));
    expect(result.current.sortIndicator("nome")).toBe(" ↑");
    expect(result.current.resumoRepresentantesOrdenado.map((x) => x.nome)).toEqual([
      "Ana",
      "Bruno",
    ]);
  });
});
