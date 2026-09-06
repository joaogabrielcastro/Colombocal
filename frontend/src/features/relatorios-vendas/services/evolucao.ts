export type EvolucaoGranularidade = "dia" | "mes";

export type EvolucaoPonto = {
  periodo: string;
  label: string;
  faturamento: number;
  quantidade: number;
};

export type EvolucaoPeriodo = {
  granularidade: EvolucaoGranularidade;
  pontos: EvolucaoPonto[];
};

function toCalendarYmd(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();
  const isCalendarUtc = (h === 0 || h === 12) && m === 0 && s === 0 && ms === 0;
  if (isCalendarUtc) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function parseYmd(raw: string | undefined | null) {
  const s = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function daysInclusive(ini: { y: number; m: number; d: number }, fim: { y: number; m: number; d: number }) {
  const a = Date.UTC(ini.y, ini.m - 1, ini.d);
  const b = Date.UTC(fim.y, fim.m - 1, fim.d);
  return Math.round((b - a) / 86400000) + 1;
}

function labelDia(ymd: string) {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

function labelMes(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[m - 1] || m}/${String(y).slice(2)}`;
}

/** Mesma regra do backend: período curto = dia; longo = mês; série esparsa omite zeros. */
export function montarEvolucaoPeriodo(
  vendas: Array<{ dataVenda: string | Date; valorTotal: number | string }>,
  dataInicio?: string,
  dataFim?: string,
): EvolucaoPeriodo {
  const porDia = new Map<string, { faturamento: number; quantidade: number }>();
  for (const v of vendas) {
    const ymd = toCalendarYmd(v.dataVenda);
    if (!ymd) continue;
    const atual = porDia.get(ymd) || { faturamento: 0, quantidade: 0 };
    atual.faturamento += parseFloat(String(v.valorTotal || 0));
    atual.quantidade += 1;
    porDia.set(ymd, atual);
  }

  let ini = parseYmd(dataInicio);
  let fim = parseYmd(dataFim);
  if (!ini || !fim) {
    const keys = [...porDia.keys()].sort();
    if (!keys.length) return { granularidade: "dia", pontos: [] };
    ini = parseYmd(keys[0]);
    fim = parseYmd(keys[keys.length - 1]);
  }
  if (!ini || !fim) return { granularidade: "dia", pontos: [] };
  if (daysInclusive(ini, fim) < 1) {
    const tmp = ini;
    ini = fim;
    fim = tmp;
  }

  const span = daysInclusive(ini, fim);
  const granularidade: EvolucaoGranularidade = span <= 45 ? "dia" : "mes";

  if (granularidade === "dia") {
    const pontos: EvolucaoPonto[] = [];
    const cursor = new Date(Date.UTC(ini.y, ini.m - 1, ini.d));
    const end = Date.UTC(fim.y, fim.m - 1, fim.d);
    while (cursor.getTime() <= end) {
      const ymd = cursor.toISOString().slice(0, 10);
      const b = porDia.get(ymd) || { faturamento: 0, quantidade: 0 };
      pontos.push({
        periodo: ymd,
        label: labelDia(ymd),
        faturamento: b.faturamento,
        quantidade: b.quantidade,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const preenchidos = pontos.filter((p) => p.quantidade > 0);
    if (pontos.length > 14 && preenchidos.length / pontos.length < 0.3) {
      return { granularidade: "dia", pontos: preenchidos };
    }
    return { granularidade: "dia", pontos };
  }

  const porMes = new Map<string, { faturamento: number; quantidade: number }>();
  for (const [ymd, b] of porDia) {
    const ym = ymd.slice(0, 7);
    const atual = porMes.get(ym) || { faturamento: 0, quantidade: 0 };
    atual.faturamento += b.faturamento;
    atual.quantidade += b.quantidade;
    porMes.set(ym, atual);
  }

  const pontos: EvolucaoPonto[] = [];
  let y = ini.y;
  let m = ini.m;
  while (y < fim.y || (y === fim.y && m <= fim.m)) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    const b = porMes.get(ym) || { faturamento: 0, quantidade: 0 };
    pontos.push({
      periodo: ym,
      label: labelMes(ym),
      faturamento: b.faturamento,
      quantidade: b.quantidade,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { granularidade: "mes", pontos };
}

export function evolucaoDoRelatorio(
  evolucaoApi: EvolucaoPeriodo | undefined,
  vendas: Array<{ dataVenda: string | Date; valorTotal: number | string }>,
  dataInicio?: string,
  dataFim?: string,
): EvolucaoPeriodo {
  // Nunca recalcular a série a partir da página de detalhe (≤500).
  if (evolucaoApi) return evolucaoApi;
  return montarEvolucaoPeriodo(vendas, dataInicio, dataFim);
}
