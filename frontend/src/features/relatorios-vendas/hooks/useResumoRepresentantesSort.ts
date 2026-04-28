"use client";

import { useMemo, useState } from "react";
import {
  ordenarResumoRepresentantes,
  type ResumoRepresentante,
  type SortRepKey,
  type SortRepState,
} from "../services/resumo";

export function useResumoRepresentantesSort(resumoRepresentantes: ResumoRepresentante[]) {
  const [repSort, setRepSort] = useState<SortRepState>({
    key: "total",
    dir: "desc",
  });

  const resumoRepresentantesOrdenado = useMemo(
    () => ordenarResumoRepresentantes(resumoRepresentantes, repSort),
    [resumoRepresentantes, repSort],
  );

  const toggleRepSort = (key: SortRepKey) => {
    setRepSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "nome" ? "asc" : "desc" },
    );
  };

  const sortIndicator = (key: SortRepKey) =>
    repSort.key === key ? (repSort.dir === "asc" ? " ↑" : " ↓") : "";

  return {
    resumoRepresentantesOrdenado,
    toggleRepSort,
    sortIndicator,
  };
}
