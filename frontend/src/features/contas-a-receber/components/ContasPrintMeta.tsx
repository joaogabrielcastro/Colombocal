"use client";

export function ContasPrintMeta({
  visao,
  linhas,
}: {
  visao: string;
  linhas: string[];
}) {
  const aplicadas = linhas.filter(Boolean);
  return (
    <div className="hidden print:block mb-4 text-sm text-gray-800">
      <p className="font-semibold">Visão: {visao}</p>
      {aplicadas.length ? (
        <p className="mt-1">Filtros: {aplicadas.join(" · ")}</p>
      ) : (
        <p className="mt-1">Filtros: nenhum (conjunto completo da empresa)</p>
      )}
    </div>
  );
}
