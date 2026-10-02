export function nfeStatusLabel(status?: string | null, opts?: { short?: boolean }) {
  const short = opts?.short;
  switch (status) {
    case "autorizada":
      return short ? "Autorizada" : "NF-e autorizada";
    case "processando":
      return short ? "Processando" : "NF-e processando";
    case "rejeitada":
      return short ? "Rejeitada" : "NF-e rejeitada";
    case "cancelada":
      return short ? "Cancelada" : "NF-e cancelada";
    case "denegada":
      return short ? "Denegada" : "NF-e denegada";
    default:
      return short ? status || "Sem nota" : "Sem nota";
  }
}

export function nfeStatusClass(status?: string | null) {
  switch (status) {
    case "autorizada":
      return "bg-green-100 text-green-800";
    case "processando":
      return "bg-amber-100 text-amber-900";
    case "rejeitada":
    case "denegada":
      return "bg-red-50 text-red-700";
    case "cancelada":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function NfeStatusBadge({
  status,
  short = false,
}: {
  status?: string | null;
  short?: boolean;
}) {
  return (
    <span
      className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${nfeStatusClass(status)}`}
    >
      {nfeStatusLabel(status, { short })}
    </span>
  );
}
