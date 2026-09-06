import { escapeHtml } from "@/lib/html";
import { formatDate, formatMoney, formatQuantidade, type Venda } from "@/lib/utils";
import { freteLinha, normalizarUnidade } from "@/lib/frete";

export type OrdemServicoPrintOpts = {
  freteEnabled: boolean;
  numeroPublico: string;
};

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Tags de frete unitário da O.S. (saco, tonelada e pintura), no padrão do sistema antigo. */
export function buildOrdemServicoFreteDestaqueHtml(
  venda: Pick<Venda, "freteTarifaSaco" | "freteTarifaTonelada" | "itens">,
  freteEnabled: boolean,
): { tagsHtml: string; hintHtml: string } {
  if (!freteEnabled) return { tagsHtml: "", hintHtml: "" };

  const tarifaSaco = toNum(venda.freteTarifaSaco);
  const tarifaTon = toNum(venda.freteTarifaTonelada);

  let temSacoPadrao = false;
  let fretePinturaUnit: number | null = null;

  for (const item of venda.itens ?? []) {
    const qtd = toNum(item.quantidade);
    if (!(qtd > 0)) continue;
    const nome = String(item.produto?.nome || "");
    const isPintura = /pintura/i.test(nome);
    const unidade = normalizarUnidade(item.produto?.unidade);

    if (isPintura) {
      const freteLin = freteLinha({
        unidade: item.produto?.unidade,
        pesoKg: item.produto?.pesoKg,
        quantidade: qtd,
        fretePorSaco: tarifaSaco,
        fretePorTonelada: tarifaTon,
      });
      fretePinturaUnit = freteLin / qtd;
    } else if (unidade === "saco") {
      temSacoPadrao = true;
    }
  }

  const parts: string[] = [];
  if (temSacoPadrao || tarifaSaco > 0) {
    parts.push(
      `<span class="frete-tag">FRETE: <strong>${escapeHtml(formatMoney(tarifaSaco))}</strong></span>`,
    );
  }
  // Dolomita (ton): a O.S. antiga mostrava a tarifa/t para o cliente calcular.
  if (tarifaTon > 0) {
    parts.push(
      `<span class="frete-tag">FRETE TONELADA: <strong>${escapeHtml(formatMoney(tarifaTon))}</strong></span>`,
    );
  }
  if (fretePinturaUnit != null) {
    parts.push(
      `<span class="frete-tag frete-pintura">FRETE PINTURA: <strong>${escapeHtml(formatMoney(fretePinturaUnit))}</strong></span>`,
    );
  }

  if (!parts.length) return { tagsHtml: "", hintHtml: "" };

  return {
    tagsHtml: `<div class="fretes-linha">${parts.join("")}</div>`,
    hintHtml: `<div class="frete-hint">Valores unitários de frete por tipo de produto (saco e tonelada, como no sistema antigo).</div>`,
  };
}

export function buildOrdemServicoPrintHtml(venda: Venda, opts: OrdemServicoPrintOpts): string {
  const numPub = opts.numeroPublico;
  const clienteNome = venda.cliente.nomeFantasia || venda.cliente.razaoSocial;
  const enderecoCliente = [venda.cliente.endereco, venda.cliente.cidade, venda.cliente.estado]
    .filter(Boolean)
    .join(" - ");

  const { tagsHtml, hintHtml } = buildOrdemServicoFreteDestaqueHtml(venda, opts.freteEnabled);

  const itensRows = (venda.itens ?? [])
    .map((item) => {
      const preco = toNum(item.precoUnitario);
      const subtotal = toNum(item.subtotal);
      return `
        <tr>
          <td>${escapeHtml(item.produto.nome)}</td>
          <td style="text-align:right">${escapeHtml(formatQuantidade(item.quantidade, item.produto.unidade))}</td>
          <td style="text-align:right">${escapeHtml(formatMoney(preco))}</td>
          <td style="text-align:right">${escapeHtml(formatMoney(subtotal))}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ordem de Serviço - Venda ${escapeHtml(numPub)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 6mm; }
    body { font-family: Arial, sans-serif; color:#111827; margin: 0; padding: 4px 6px; font-size: 11px; }
    .sheet { max-height: 13.8cm; overflow: hidden; }
    h1 { margin:0; font-size: 14px; font-weight: 700; line-height: 1.15; }
    .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 3px; margin-top: 5px; }
    .box { border:1px solid #d1d5db; border-radius: 3px; padding: 3px 5px; }
    .box-full { grid-column: 1 / -1; }
    .label { color:#6b7280; font-size: 8px; text-transform: uppercase; font-weight: 700; line-height: 1.15; }
    .value { margin-top: 1px; font-size: 11px; line-height: 1.2; font-weight: 600; }
    .venda-meta { margin-top: 3px; font-size: 10px; font-weight: 700; color:#111827; line-height: 1.2; }
    table { width:100%; border-collapse: collapse; margin-top: 5px; }
    th, td { border:1px solid #d1d5db; padding: 2px 4px; font-size: 10px; }
    th { background:#f3f4f6; text-align:left; font-size: 9px; text-transform: uppercase; }
    .totais { margin-top: 5px; padding: 3px 5px; border:1px solid #d1d5db; border-radius: 3px; font-size: 10px; line-height: 1.25; }
    .totais strong { font-weight: 700; }
    .total-produtos-linha {
      margin-top: 6px;
      padding: 5px 6px;
      border: 2px solid #111827;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .total-produtos-linha strong { font-size: 13px; }
    .fretes-linha {
      margin-top: 5px;
      padding: 3px 5px;
      border:1px solid #d1d5db;
      border-radius: 3px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: baseline;
      font-size: 10px;
      line-height: 1.25;
    }
    .frete-tag { font-weight: 600; text-transform: uppercase; }
    .frete-tag strong { font-size: 11px; }
    .frete-pintura { color: #14532d; }
    .frete-hint { color:#6b7280; font-size: 8px; margin-top: 2px; }
    .obs { margin-top: 5px; border:1px dashed #d1d5db; border-radius: 3px; padding: 3px 5px; min-height: 18px; font-size: 10px; }
    .assinatura { margin-top: 10px; }
    .linha { border-top:1px solid #9ca3af; padding-top: 3px; text-align:center; font-size: 9px; color:#374151; max-width: 200px; margin: 0 auto; }
    @media print {
      body { padding: 0; }
      .sheet { max-height: 13.8cm; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h1>Ordem de Serviço - Entrega</h1>

    <div class="grid">
      <div class="box">
        <div class="label">Cliente</div>
        <div class="value">${escapeHtml(clienteNome)}</div>
      </div>
      <div class="box">
        <div class="label">Motorista</div>
        <div class="value">${escapeHtml(venda.motorista?.nome || "-")}</div>
      </div>
      <div class="box">
        <div class="label">Telefone</div>
        <div class="value">${escapeHtml(venda.cliente.telefone || "-")}</div>
      </div>
      <div class="box">
        <div class="label">Veículo / Placa</div>
        <div class="value">${escapeHtml(
          [venda.motorista?.veiculo, venda.motorista?.placa].filter(Boolean).join(" - ") || "-",
        )}</div>
        <div class="venda-meta">Venda ${escapeHtml(numPub)} · Data ${escapeHtml(formatDate(venda.dataVenda))}</div>
      </div>
      <div class="box box-full">
        <div class="label">Endereço / Local</div>
        <div class="value">${escapeHtml(enderecoCliente || "-")}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th style="text-align:right">Qtd</th>
          <th style="text-align:right">Preço</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itensRows}
      </tbody>
    </table>

    <div class="total-produtos-linha">
      Total produtos: <strong>${escapeHtml(formatMoney(venda.valorTotal))}</strong>
    </div>
    ${tagsHtml}
    ${hintHtml}

    <div class="obs">
      <div class="label">Observações</div>
      <div style="margin-top:2px;">${escapeHtml(venda.observacoes || "Sem observações.")}</div>
    </div>

    <div class="assinatura">
      <div class="linha">Assinatura do Recebedor</div>
    </div>
  </div>
</body>
</html>`;
}

export function openOrdemServicoPrint(venda: Venda, opts: OrdemServicoPrintOpts): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(buildOrdemServicoPrintHtml(venda, opts));
  w.document.close();
  w.focus();
  w.print();
}
