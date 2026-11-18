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
      return "badge-success";
    case "processando":
      return "badge-warning";
    case "rejeitada":
    case "denegada":
      return "badge-danger";
    case "cancelada":
      return "badge-neutral line-through decoration-gray-400/60";
    default:
      return "badge-neutral";
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
      className={`badge ${nfeStatusClass(status)}`}
    >
      {nfeStatusLabel(status, { short })}
    </span>
  );
}
