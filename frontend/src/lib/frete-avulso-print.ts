/** HTML de impressão do frete avulso (meia folha, layout limpo). */

import { quantidadeEmSacos } from "@/lib/frete";

export type FreteAvulsoImpressaoItem = {
  produtoId?: number;
  produtoNome?: string;
  quantidade?: number | string;
  unidade?: string;
  pesoKg?: number | string | null;
  subtotal?: number | string;
};

export type FreteAvulsoImpressao = {
  freteId: number;
  cliente: string;
  clienteCidade?: string | null;
  clienteEstado?: string | null;
  clienteTelefone?: string | null;
  clienteEndereco?: string | null;
  motorista?: string | null;
  motoristaVeiculo?: string | null;
  motoristaPlaca?: string | null;
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

function dataCurta(v: unknown): string {
  const d = v ? new Date(v as string | Date) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
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

function sacosLabel(n: number): string {
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} saco`;
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
    .badge { text-align: right; }
    .badge .num { font-size: 16px; font-weight: 800; }
    .badge .status { font-size: 10px; color: #4b5563; margin-top: 2px; }
    .grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr 0.8fr;
      gap: 6px;
      margin-bottom: 8px;
    }
    .card {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 6px 8px;
    }
    .k {
      font-size: 8px;
      text-transform: uppercase;
      font-weight: 700;
      color: #6b7280;
    }
    .v { margin-top: 2px; font-weight: 600; font-size: 11px; }
    .muted { font-weight: 500; color: #6b7280; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 3px 5px; font-size: 10px; }
    th { background: #f3f4f6; text-align: left; font-size: 9px; text-transform: uppercase; }
    .num { text-align: right; }
    .empty { text-align: center; color: #9ca3af; }
    .foot {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .total-box {
      border: 2px solid #111827;
      border-radius: 6px;
      padding: 6px 10px;
      text-align: right;
      min-width: 160px;
    }
    .total-label {
      font-size: 8px;
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

/** Ordem de carregamento do frete avulso — sempre em sacos, sem preços. */
export function buildFreteAvulsoCarregamentoHtml(
  resumo: FreteAvulsoImpressao,
): string {
  const itens = Array.isArray(resumo.itens) ? resumo.itens : [];
  let totalSacos = 0;
  const rows =
    itens.length > 0
      ? itens
          .map((i) => {
            const sacos = quantidadeEmSacos({
              quantidade: i.quantidade ?? 0,
              unidade: i.unidade,
              pesoKg: i.pesoKg,
            });
            totalSacos += sacos;
            return `<tr>
              <td>${esc(i.produtoNome || "-")}</td>
              <td style="text-align:right">${esc(sacosLabel(sacos))}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="2" style="text-align:center;color:#9ca3af">Nenhum item neste frete</td></tr>`;

  const endereco =
    resumo.clienteEndereco ||
    [resumo.clienteCidade, resumo.clienteEstado].filter(Boolean).join(" - ") ||
    "-";
  const veiculo =
    [resumo.motoristaVeiculo, resumo.motoristaPlaca].filter(Boolean).join(" - ") ||
    "-";
  const obs = String(resumo.observacao || "").trim() || "Sem observações.";
  const num = numOrdem(resumo.freteId);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ordem de Carregamento - Frete #${esc(num)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 6mm; }
    body { font-family: Arial, sans-serif; color:#111827; margin: 0; padding: 4px 6px; font-size: 11px; }
    .sheet { max-height: 13.8cm; overflow: hidden; }
    h1 { margin:0; font-size: 14px; font-weight: 700; line-height: 1.15; }
    .meta { margin-top: 1px; color:#4b5563; font-size: 10px; }
    .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 3px; margin-top: 5px; }
    .box { border:1px solid #d1d5db; border-radius: 3px; padding: 3px 5px; }
    .box-full { grid-column: 1 / -1; }
    .label { color:#6b7280; font-size: 8px; text-transform: uppercase; font-weight: 700; line-height: 1.15; }
    .value { margin-top: 1px; font-size: 11px; line-height: 1.2; font-weight: 600; }
    table { width:100%; border-collapse: collapse; margin-top: 5px; }
    th, td { border:1px solid #d1d5db; padding: 2px 4px; font-size: 10px; }
    th { background:#f3f4f6; text-align:left; font-size: 9px; text-transform: uppercase; }
    .totais { margin-top: 5px; padding: 3px 5px; border:1px solid #d1d5db; border-radius: 3px; font-size: 10px; line-height: 1.25; }
    .totais strong { font-weight: 700; }
    .obs { margin-top: 5px; border:1px dashed #d1d5db; border-radius: 3px; padding: 3px 5px; min-height: 18px; font-size: 10px; }
    .assinatura { margin-top: 10px; }
    .linha { border-top:1px solid #9ca3af; padding-top: 3px; text-align:center; font-size: 9px; color:#374151; max-width: 220px; margin: 0 auto; }
    @media print {
      body { padding: 0; }
      .sheet { max-height: 13.8cm; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h1>Ordem de Carregamento</h1>
    <div class="meta">Frete avulso #${esc(num)} • Data ${esc(dataCurta(resumo.data))}</div>

    <div class="grid">
      <div class="box">
        <div class="label">Cliente</div>
        <div class="value">${esc(resumo.cliente)}</div>
      </div>
      <div class="box">
        <div class="label">Motorista</div>
        <div class="value">${esc(resumo.motorista || "-")}</div>
      </div>
      <div class="box">
        <div class="label">Telefone</div>
        <div class="value">${esc(resumo.clienteTelefone || "-")}</div>
      </div>
      <div class="box">
        <div class="label">Veículo / Placa</div>
        <div class="value">${esc(veiculo)}</div>
      </div>
      <div class="box box-full">
        <div class="label">Endereço / Local</div>
        <div class="value">${esc(endereco)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th style="text-align:right">Qtd (sacos)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totais">
      <div>Total sacos: <strong>${esc(
        totalSacos.toLocaleString("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        }),
      )}</strong></div>
    </div>

    <div class="obs">
      <div class="label">Observações</div>
      <div style="margin-top:2px;">${esc(obs)}</div>
    </div>

    <div class="assinatura">
      <div class="linha">Conferido / Carregado por</div>
    </div>
  </div>
</body>
</html>`;
}

function openHtml(html: string): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export function openFreteAvulsoPrint(resumo: FreteAvulsoImpressao): void {
  openHtml(buildFreteAvulsoPrintHtml(resumo));
}

export function openFreteAvulsoCarregamentoPrint(
  resumo: FreteAvulsoImpressao,
): void {
  openHtml(buildFreteAvulsoCarregamentoHtml(resumo));
}
