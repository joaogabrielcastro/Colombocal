/** Impressão da ordem de carregamento (pátio) — layout estilo sistema antigo. */

import { formatDate } from "@/lib/utils";

export type OrdemCarregamentoPrintItem = {
  descricao: string;
  quantidade: number | string;
  unidade?: string | null;
};

export type OrdemCarregamentoPrintData = {
  numeroOc: number;
  dataEmissao: string;
  doct?: string | null;
  pedido?: string | null;
  clienteNome: string;
  clienteEndereco?: string | null;
  clienteCidade?: string | null;
  clienteUf?: string | null;
  motoristaNome?: string | null;
  motoristaPlaca?: string | null;
  motoristaCidade?: string | null;
  motoristaUf?: string | null;
  observacoes?: string | null;
  itens: OrdemCarregamentoPrintItem[];
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtQtd(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function padOc(n: number): string {
  return String(n).padStart(6, "0");
}

export function buildOrdemCarregamentoHtml(ordem: OrdemCarregamentoPrintData): string {
  const enderecoCliente = [
    ordem.clienteEndereco,
    [ordem.clienteCidade, ordem.clienteUf].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" - ");

  const motoristaLocal = [ordem.motoristaCidade, ordem.motoristaUf]
    .filter(Boolean)
    .join("/");

  let totalSacos = 0;
  const linhas = (ordem.itens || [])
    .map((item) => {
      const qtd = Number(item.quantidade) || 0;
      const uni = String(item.unidade || "SAC").toUpperCase();
      if (uni === "SAC" || uni === "SACO" || uni === "SACOS") totalSacos += qtd;
      const qtdTxt = `${fmtQtd(qtd)} ${uni}`;
      return `    <tr>
      <td class="desc">${esc(item.descricao)}</td>
      <td class="qtd">${esc(qtdTxt)}</td>
    </tr>`;
    })
    .join("\n");

  const obs = String(ordem.observacoes || "").trim();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>OC Nº ${esc(padOc(ordem.numeroOc))}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 8mm; }
    body {
      font-family: "Courier New", Courier, monospace;
      color: #111;
      margin: 0;
      padding: 4px 2px;
      font-size: 12px;
      line-height: 1.35;
    }
    .sheet { max-width: 19cm; }
    .title {
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.04em;
      margin: 0 0 8px;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 4px 10px;
      margin-bottom: 8px;
    }
    .meta span { white-space: nowrap; }
    .meta b { font-weight: 700; }
    .block { margin: 2px 0; }
    .sep {
      border: none;
      border-top: 1px dashed #333;
      margin: 8px 0;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; vertical-align: top; }
    th {
      text-align: left;
      font-size: 11px;
      border-bottom: 1px solid #333;
      padding-bottom: 3px;
    }
    th.qtd, td.qtd { text-align: right; white-space: nowrap; width: 9rem; }
    td.desc { padding-right: 8px; }
    .totais {
      margin-top: 10px;
      font-weight: 700;
      font-size: 13px;
    }
    .obs { margin-top: 10px; white-space: pre-wrap; }
    .assinatura {
      margin-top: 28px;
      text-align: center;
      max-width: 240px;
      margin-left: auto;
      margin-right: auto;
    }
    .assinatura .linha {
      border-top: 1px solid #333;
      padding-top: 4px;
      font-size: 11px;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="title">ORDEM DE CARREGAMENTO</div>

    <div class="meta">
      <span>Doct: <b>${esc(ordem.doct || "-")}</b></span>
      <span>Emissão: <b>${esc(formatDate(ordem.dataEmissao))}</b></span>
      <span>Pedido: <b>${esc(ordem.pedido || "-")}</b></span>
      <span>OC Nº: <b>${esc(padOc(ordem.numeroOc))}</b></span>
    </div>

    <div class="block">Motorista: <b>${esc(ordem.motoristaNome || "-")}</b></div>
    <div class="block">Placa: <b>${esc(ordem.motoristaPlaca || "-")}</b>${
      motoristaLocal ? ` &nbsp; ${esc(motoristaLocal)}` : ""
    }</div>
    <div class="block">Cliente: <b>${esc(ordem.clienteNome)}</b></div>
    <div class="block">Endereço: <b>${esc(enderecoCliente || "-")}</b></div>

    <hr class="sep" />

    <table>
      <thead>
        <tr>
          <th>DESCRIÇÃO</th>
          <th class="qtd">QUANTIDADE-UNI</th>
        </tr>
      </thead>
      <tbody>
${linhas}
      </tbody>
    </table>

    <hr class="sep" />

    <div class="totais">TT DA ORDEM: ${esc(fmtQtd(totalSacos))} SAC</div>

    ${
      obs
        ? `<div class="obs">Obs.: ${esc(obs)}</div>`
        : ""
    }

    <div class="assinatura">
      <div class="linha">Conferido / Carregado por</div>
    </div>
  </div>
</body>
</html>`;
}

export function openOrdemCarregamentoPrint(ordem: OrdemCarregamentoPrintData): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(buildOrdemCarregamentoHtml(ordem));
  w.document.close();
  w.focus();
  w.print();
}
