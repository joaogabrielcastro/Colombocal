import { apiFetchWithMeta } from "@/lib/api";
import { CONTAS_EXPORT_MAX_ROWS, CONTAS_EXPORT_TAKE } from "../constants";

export async function fetchTodasPaginas<T>(opts: {
  path: string;
  params: URLSearchParams;
  pick: (data: T) => unknown[];
  totalFrom: (data: T, metaTotal: number | null) => number;
}): Promise<{ items: unknown[]; truncated: boolean }> {
  const items: unknown[] = [];
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;
  let truncated = false;

  while (items.length < CONTAS_EXPORT_MAX_ROWS && skip < total) {
    const q = new URLSearchParams(opts.params);
    q.set("take", String(CONTAS_EXPORT_TAKE));
    q.set("skip", String(skip));
    const { data, meta } = await apiFetchWithMeta<T>(`${opts.path}?${q}`, {
      method: "GET",
      cache: "no-store",
    });
    const batch = opts.pick(data);
    total = opts.totalFrom(data, meta.totalCount);
    if (!batch.length) break;
    items.push(...batch);
    skip += batch.length;
    if (batch.length < CONTAS_EXPORT_TAKE) break;
  }

  if (items.length > CONTAS_EXPORT_MAX_ROWS) {
    truncated = true;
    items.length = CONTAS_EXPORT_MAX_ROWS;
  } else if (Number.isFinite(total) && items.length < total) {
    truncated = true;
  }

  return { items, truncated };
}
