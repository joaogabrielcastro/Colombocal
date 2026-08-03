/** HTML de impressão do frete avulso (meia folha, layout limpo). */

export type FreteAvulsoImpressaoItem = {
  produtoNome?: string;
  quantidade?: number | string;
  unidade?: string;
  subtotal?: number | string;
};

export type FreteAvulsoImpressao = {
  freteId: number;
  cliente: string;
  clienteCidade?: string | null;
  clienteEstado?: string | null;
  clienteTelefone?: string | null;
  motorista?: string | null;
  observacao?: string | null;
  itens?: FreteAvulsoImpressaoItem[];
  valorFinal: number | string;
  valorLabel?: string;
  pagoNoAto?: boolean;
  data?: string | Date | null;
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(v: unknown): string {
  const n = parseFloat(String(v ?? 0).replace(",", "."));
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataLonga(v: unknown): string {
  const d = v ? new Date(v as string | Date) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function numOrdem(id: number): string {
  return String(id).padStart(6, "0");
}

function qtdLabel(qtd: unknown, unidade?: string | null): string {
  const n = parseFloat(String(qtd ?? ""));
  const q = Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })
    : String(qtd ?? "");
  return unidade ? `${q} ${unidade}` : q;
}

export function buildFreteAvulsoPrintHtml(resumo: FreteAvulsoImpressao): string {
  const itens = Array.isArray(resumo.itens) ? resumo.itens : [];
  const local = [resumo.clienteCidade, resumo.clienteEstado]
    .filter(Boolean)
    .join(" / ");
  const rows =
    itens.length > 0
      ? itens
          .map((i) => {
            const qtd = parseFloat(String(i.quantidade ?? 0));
            const sub = parseFloat(String(i.subtotal ?? 0));
            const unit = qtd > 0 && Number.isFinite(sub) ? sub / qtd : 0;
            return `<tr>
              <td>${esc(i.produtoNome || "-")}</td>
              <td class="num">${esc(qtdLabel(i.quantidade, i.unidade))}</td>
              <td class="num">${esc(money(unit))}</td>
              <td class="num">${esc(money(sub))}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="4" class="empty">Nenhum item detalhado neste frete</td></tr>`;

  const valorLabel = resumo.valorLabel || money(resumo.valorFinal);
  const status = resumo.pagoNoAto ? "Pago no ato" : "A receber";
  const obs = String(resumo.observacao || "").trim();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Frete avulso #${esc(numOrdem(resumo.freteId))}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 8mm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 8px 10px;
      font-size: 11px;
    }
    .sheet { max-height: 14cm; overflow: hidden; }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 2px solid #111827;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .head h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
    }
    .head .sub {
      margin-top: 2px;
      font-size: 10px;
      color: #6b7280;
    }
    .badge {
      text-align: right;
      white-space: nowrap;
    }
    .badge .num {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .badge .status {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      background: ${resumo.pagoNoAto ? "#dcfce7" : "#ffedd5"};
      color: ${resumo.pagoNoAto ? "#166534" : "#9a3412"};
    }
    .grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr;
      gap: 6px;
      margin-bottom: 8px;
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 6px 8px;
      background: #fafafa;
    }
    .k {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .v {
      margin-top: 2px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
    }
    .v.muted { font-weight: 500; color: #374151; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 2px;
    }
    th, td {
      padding: 5px 6px;
      font-size: 11px;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      color: #4b5563;
      background: #f3f4f6;
      border-bottom: 1px solid #d1d5db;
    }
    td.num, th.num { text-align: right; white-space: nowrap; }
    td.empty { text-align: center; color: #9ca3af; padding: 12px; }
    .foot {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 2px solid #111827;
    }
    .total-box { text-align: right; }
    .total-label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 700;
    }
    .total-value {
      font-size: 18px;
      font-weight: 800;
      color: #111827;
      line-height: 1.2;
    }
    .obs {
      margin-top: 8px;
      border: 1px dashed #d1d5db;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 11px;
    }
    .date { font-size: 11px; color: #374151; }
    .note {
      margin-top: 6px;
      font-size: 9px;
      color: #9ca3af;
    }
    @media print {
      body { padding: 0; }
      .sheet { max-height: 14cm; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div>
        <h1>Orçamento de frete</h1>
        <div class="sub">Sem valor fiscal · Documento interno</div>
      </div>
      <div class="badge">
        <div class="num">#${esc(numOrdem(resumo.freteId))}</div>
        <div class="status">${esc(status)}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="k">Cliente</div>
        <div class="v">${esc(resumo.cliente)}</div>
        <div class="v muted">${esc(local || "—")}</div>
      </div>
      <div class="card">
        <div class="k">Motorista</div>
        <div class="v">${esc(resumo.motorista || "—")}</div>
        <div class="v muted">Fone cliente: ${esc(resumo.clienteTelefone || "—")}</div>
      </div>
      <div class="card">
        <div class="k">Data</div>
        <div class="v">${esc(dataLonga(resumo.data))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th class="num">Quantidade</th>
          <th class="num">Unitário</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="foot">
      <div class="date">${esc(dataLonga(resumo.data))}</div>
      <div class="total-box">
        <div class="total-label">Total do orçamento</div>
        <div class="total-value">${esc(valorLabel)}</div>
      </div>
    </div>

    ${
      obs
        ? `<div class="obs"><span class="k">Observação</span><div class="v muted" style="margin-top:3px">${esc(obs)}</div></div>`
        : ""
    }
    <div class="note">Documento sem valor fiscal. Não substitui nota ou recibo oficial.</div>
  </div>
</body>
</html>`;
}

export function openFreteAvulsoPrint(resumo: FreteAvulsoImpressao): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(buildFreteAvulsoPrintHtml(resumo));
  w.document.close();
  w.focus();
  w.print();
}
