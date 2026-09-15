"use client";

export function HomologacaoBanner({ ambiente }: { ambiente?: string | null }) {
  if (!ambiente || ambiente === "producao") return null;
  return (
    <div
      className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <strong className="font-semibold">AMBIENTE DE HOMOLOGAÇÃO</strong>
      <span className="ml-2 text-amber-900">
        — DEMONSTRAÇÃO SEM VALIDADE FISCAL. Não confundir com autorização SEFAZ de produção.
      </span>
    </div>
  );
}
