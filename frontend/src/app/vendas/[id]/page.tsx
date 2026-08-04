"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PencilIcon,
  PrinterIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  formatMoney,
  formatDate,
  formatQuantidade,
  formatFreteReciboLinha,
  formatChequeDetalhe,
  toInputDate,
  type Venda,
} from "@/lib/utils";
import { freteLinha } from "@/lib/frete";
import { VendaOrdem, vendaOrdemTexto } from "@/components/VendaOrdem";
import { toast } from "sonner";
import api from "@/lib/api";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { reportApiError } from "@/lib/report-api-error";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

export default function VendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { freteEnabled } = useTenantFeatures();
  const [venda, setVenda] = useState<Venda | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [freteForm, setFreteForm] = useState({
    valor: "",
    recibo: false,
    data: "",
  });
  const [salvandoFrete, setSalvandoFrete] = useState(false);
  const [estornandoId, setEstornandoId] = useState<number | null>(null);
  const [confirmEstorno, setConfirmEstorno] = useState<{
    kind: "pagamento" | "cheque";
    id: number;
    label: string;
  } | null>(null);

  const carregar = () => api.get<Venda>(`/vendas/${id}`).then(setVenda);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    carregar()
      .catch((e) => {
        if (alive) {
          reportApiError(e, {
            title: "Não foi possível carregar a venda",
            onRetry: () => {
              setLoading(true);
              carregar()
                .catch((err) => reportApiError(err, { title: "Venda indisponível" }))
                .finally(() => setLoading(false));
            },
          });
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!venda) return;
    const f0 = venda.fretes?.[0];
    setFreteForm({
      valor: String(parseFloat(String(venda.frete))),
      recibo: f0?.reciboEmitido ?? venda.freteRecibo,
      data: toInputDate(f0?.reciboData),
    });
  }, [venda]);

  const salvarFreteRecibo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venda) return;
    const valor = parseFloat(freteForm.valor.replace(",", "."));
    if (Number.isNaN(valor) || valor < 0) {
      alert("Valor de frete inválido");
      return;
    }
    setSalvandoFrete(true);
    try {
      const updated = await api.patch<Venda>(`/vendas/${id}`, {
        frete: valor,
        freteRecibo: freteForm.recibo,
        freteReciboNum: null,
        freteReciboData: freteForm.data.trim() || null,
      });
      setVenda(updated);
      toast.success("Frete atualizado");
    } catch (err: unknown) {
      reportApiError(err, { title: "Erro ao salvar frete" });
    } finally {
      setSalvandoFrete(false);
    }
  };

  const handleCancelar = async () => {
    setConfirmCancelOpen(false);
    setCancelando(true);
    try {
      await api.delete(`/vendas/${id}`);
      router.push("/vendas");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível cancelar a venda" });
      setCancelando(false);
    }
  };

  const executarEstorno = async () => {
    if (!confirmEstorno) return;
    const { kind, id: alvoId } = confirmEstorno;
    setConfirmEstorno(null);
    setEstornandoId(alvoId);
    try {
      if (kind === "cheque") {
        await api.delete(`/cheques/${alvoId}`);
        toast.success("Cheque estornado");
      } else {
        await api.delete(`/pagamentos/${alvoId}`);
        toast.success("Pagamento estornado");
      }
      await carregar();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível estornar" });
    } finally {
      setEstornandoId(null);
    }
  };

  const labelTipoPagamento = (tipo: string) => {
    const t = tipo.toLowerCase();
    if (t === "dinheiro") return "Dinheiro";
    if (t === "transferencia") return "PIX / transferência";
    if (t === "cheque") return "Cheque";
    if (t.startsWith("troco_dinheiro")) return "Troco (dinheiro)";
    if (t.startsWith("troco_transferencia")) return "Troco (PIX / transferência)";
    return tipo;
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const imprimirOrdemServico = () => {
    if (!venda) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const numPub = vendaOrdemTexto(venda);

    const clienteNome = venda.cliente.nomeFantasia || venda.cliente.razaoSocial;
    const enderecoCliente = [
      venda.cliente.endereco,
      venda.cliente.cidade,
      venda.cliente.estado,
    ]
      .filter(Boolean)
      .join(" - ");
    const tarifaSaco = parseFloat(String(venda.freteTarifaSaco ?? 0));
    const tarifaTon = parseFloat(String(venda.freteTarifaTonelada ?? 0));

    let temSacoPadrao = false;
    let fretePinturaUnit: number | null = null;

    for (const item of venda.itens) {
      const qtd = parseFloat(String(item.quantidade ?? 0));
      if (!freteEnabled || !(qtd > 0)) continue;
      const nome = String(item.produto.nome || "");
      const isPintura = /pintura/i.test(nome);
      const unidade = String(item.produto.unidade || "")
        .trim()
        .toLowerCase();

      if (isPintura) {
        const freteLin = freteLinha({
          unidade: item.produto.unidade,
          pesoKg: item.produto.pesoKg,
          quantidade: qtd,
          fretePorSaco: tarifaSaco,
          fretePorTonelada: tarifaTon,
        });
        fretePinturaUnit = freteLin / qtd;
      } else if (unidade === "saco" || unidade === "sacos") {
        temSacoPadrao = true;
      }
    }

    const freteDestaqueParts: string[] = [];
    if (freteEnabled && (temSacoPadrao || tarifaSaco > 0)) {
      freteDestaqueParts.push(
        `<span class="frete-tag">FRETE: <strong>${escapeHtml(formatMoney(tarifaSaco))}</strong></span>`,
      );
    }
    if (freteEnabled && fretePinturaUnit != null) {
      freteDestaqueParts.push(
        `<span class="frete-tag frete-pintura">FRETE PINTURA: <strong>${escapeHtml(formatMoney(fretePinturaUnit))}</strong></span>`,
      );
    }

    const itensRows = venda.itens
      .map((item) => {
        const preco = parseFloat(String(item.precoUnitario ?? 0));
        const subtotal = parseFloat(String(item.subtotal ?? 0));
        return `
        <tr>
          <td>${escapeHtml(item.produto.nome)}</td>
          <td style="text-align:right">${escapeHtml(formatQuantidade(item.quantidade, item.produto.unidade))}</td>
          <td style="text-align:right">${escapeHtml(formatMoney(preco))}</td>
          <td style="text-align:right">${escapeHtml(formatMoney(subtotal))}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ordem de Serviço - Venda ${numPub}</title>
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
    .fretes-linha {
      margin-top: 6px;
      padding: 5px 6px;
      border: 2px solid #111827;
      border-radius: 3px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px 28px;
      align-items: baseline;
      font-size: 12px;
      letter-spacing: 0.02em;
    }
    .frete-tag { font-weight: 700; text-transform: uppercase; }
    .frete-tag strong { font-size: 13px; }
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
    <div class="meta">Venda ${numPub} • Data ${formatDate(venda.dataVenda)}</div>

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

    <div class="totais">
      <div>Total produtos: <strong>${escapeHtml(formatMoney(venda.valorTotal))}</strong></div>
    </div>
    ${
      freteEnabled && freteDestaqueParts.length
        ? `<div class="fretes-linha">${freteDestaqueParts.join("")}</div>
    <div class="frete-hint">Valores unitários de frete por tipo de produto (como no sistema antigo).</div>`
        : ""
    }

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

    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const imprimirOrdemCarregamento = () => {
    if (!venda) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const numPub = vendaOrdemTexto(venda);

    const clienteNome = venda.cliente.nomeFantasia || venda.cliente.razaoSocial;
    const enderecoCliente = [
      venda.cliente.endereco,
      venda.cliente.cidade,
      venda.cliente.estado,
    ]
      .filter(Boolean)
      .join(" - ");

    let totalSacos = 0;
    let temSaco = false;
    const itensRows = venda.itens
      .map((item) => {
        const qtd = parseFloat(String(item.quantidade ?? 0));
        const unidade = String(item.produto.unidade || "")
          .trim()
          .toLowerCase();
        if (
          Number.isFinite(qtd) &&
          qtd > 0 &&
          (unidade === "saco" || unidade === "sacos" || unidade === "sc")
        ) {
          temSaco = true;
          totalSacos += qtd;
        }
        return `
        <tr>
          <td>${escapeHtml(item.produto.nome)}</td>
          <td style="text-align:right">${escapeHtml(formatQuantidade(item.quantidade, item.produto.unidade))}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ordem de Carregamento - Venda ${numPub}</title>
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
    <div class="meta">Venda ${numPub} • Data ${formatDate(venda.dataVenda)}</div>

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
        </tr>
      </thead>
      <tbody>
        ${itensRows}
      </tbody>
    </table>

    ${
      temSaco
        ? `<div class="totais">
      <div>Total sacos: <strong>${escapeHtml(
        totalSacos.toLocaleString("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        }),
      )}</strong></div>
    </div>`
        : ""
    }

    <div class="obs">
      <div class="label">Observações</div>
      <div style="margin-top:2px;">${escapeHtml(venda.observacoes || "Sem observações.")}</div>
    </div>

    <div class="assinatura">
      <div class="linha">Conferido / Carregado por</div>
    </div>
  </div>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  if (loading) return <DetailPageSkeleton />;
  if (!venda)
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        Venda não encontrada ou indisponível.
      </div>
    );

  const totalPagoVenda =
    venda.pagamentos?.reduce(
      (acc, p) => acc + parseFloat(String(p.valor)),
      0,
    ) ?? 0;
  const totalTrocoVenda =
    venda.pagamentos?.reduce((acc, p) => {
      const tipo = String(p.tipo || "").toLowerCase();
      if (!tipo.startsWith("troco_")) return acc;
      return acc + Math.abs(parseFloat(String(p.valor || 0)));
    }, 0) ?? 0;
  const totalRecebidoLiquido = totalPagoVenda + totalTrocoVenda;
  const totalTituloVenda =
    venda.titulos?.reduce(
      (acc, t) => acc + parseFloat(String(t.valorOriginal)),
      0,
    ) ?? parseFloat(String(venda.valorTotal));
  const saldoVenda = totalPagoVenda - totalTituloVenda;
  const temBaixas =
    (venda.pagamentos?.length ?? 0) > 0 || (venda.cheques?.length ?? 0) > 0;

  const chequesSemPagamento = (venda.cheques ?? []).filter((ch) => {
    const ligado = (venda.pagamentos ?? []).some(
      (p) => p.chequeId === ch.id || p.cheque?.id === ch.id,
    );
    return !ligado;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start gap-3 mb-6">
        <Link href="/vendas" className="btn-secondary py-1.5 px-2.5 shrink-0">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-[14rem]">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
            <span className="text-gray-500 font-normal text-lg">Venda</span>
            <VendaOrdem venda={venda} link={false} size="xl" />
          </h1>
          <p className="text-gray-500 text-sm">{formatDate(venda.dataVenda)}</p>
          <p className="text-sm mt-1">
            <span className="text-gray-500">Recebido: </span>
            <strong className="text-green-700">{formatMoney(totalRecebidoLiquido)}</strong>
            <span className="text-gray-400"> · </span>
            <span className="text-gray-500">Saldo: </span>
            <strong className={saldoVenda >= 0 ? "text-green-700" : "text-red-600"}>
              {formatMoney(saldoVenda)}
              {saldoVenda >= 0 ? " quitado" : " a receber"}
            </strong>
            {(venda.pagamentos?.length ?? 0) > 0 ? (
              <span className="text-gray-400">
                {" "}
                · {venda.pagamentos!.length} recebimento
                {venda.pagamentos!.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button onClick={imprimirOrdemServico} className="btn-secondary">
            <PrinterIcon className="w-4 h-4" />
            Imprimir O.S.
          </button>
          <button onClick={imprimirOrdemCarregamento} className="btn-secondary">
            <PrinterIcon className="w-4 h-4" />
            Imprimir carregamento
          </button>
          {venda.podeEditar ? (
            <Link href={`/vendas/${id}/editar`} className="btn-secondary">
              <PencilIcon className="w-4 h-4" />
              Editar
            </Link>
          ) : (
            <span
              className="text-xs text-gray-500 max-w-[10rem] leading-tight"
              title="Não é possível editar com baixas ou cheques vinculados"
            >
              Edição bloqueada (baixas/cheques)
            </span>
          )}
          <button
            onClick={() => setConfirmCancelOpen(true)}
            disabled={cancelando || temBaixas}
            className="btn-danger disabled:opacity-50"
            title={
              temBaixas
                ? "Estorne todas as baixas e cheques antes de cancelar"
                : undefined
            }
          >
            <TrashIcon className="w-4 h-4" />
            {cancelando ? "Cancelando..." : "Cancelar Venda"}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmEstorno != null}
        title="Estornar baixa"
        description={
          confirmEstorno
            ? `Remover ${confirmEstorno.label}? O saldo do cliente e os títulos desta venda serão recalculados.`
            : undefined
        }
        tone="danger"
        busy={estornandoId != null}
        confirmText="Estornar"
        onCancel={() => setConfirmEstorno(null)}
        onConfirm={() => void executarEstorno()}
      />
      <ConfirmDialog
        open={confirmCancelOpen}
        title="Cancelar venda"
        description={
          temBaixas
            ? "Estorne todas as baixas e cheques vinculados antes de cancelar a venda."
            : "Tem certeza que deseja cancelar esta venda? As movimentações vinculadas serão removidas."
        }
        tone="danger"
        busy={cancelando}
        confirmText="Cancelar venda"
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={() => void handleCancelar()}
      />

      <div className="card p-5 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase">
              Cliente
            </p>
            <Link
              href={`/clientes/${venda.clienteId}`}
              className="font-medium text-blue-600 hover:underline mt-1 block"
            >
              {venda.cliente.nomeFantasia || venda.cliente.razaoSocial}
            </Link>
            {venda.cliente.cidade && (
              <p className="text-xs text-gray-400">
                {venda.cliente.cidade}-{venda.cliente.estado}
              </p>
            )}
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase">
              Vendedor
            </p>
            <p className="font-medium mt-1">{venda.vendedor.nome}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase">
              Motorista
            </p>
            <p className="font-medium mt-1">{venda.motorista?.nome || "-"}</p>
            {venda.motorista?.placa && (
              <p className="text-xs text-gray-400">{venda.motorista.placa}</p>
            )}
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase">
              Comissão aplicada
            </p>
            <p className="font-medium mt-1">
              {venda.comissaoPercentualAplicado ?? 0}% (
              {formatMoney(venda.comissaoValor ?? 0)})
            </p>
          </div>
          {venda.observacoes && (
            <div className="col-span-full">
              <p className="text-gray-500 text-xs font-semibold uppercase">
                Observações
              </p>
              <p className="font-medium mt-1">{venda.observacoes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="card overflow-hidden lg:col-span-3">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Produtos</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Produto</th>
                <th className="table-header text-right">Quantidade</th>
                <th className="table-header text-right">Preço Unit.</th>
                <th className="table-header text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {venda.itens.map((item) => (
                <tr key={item.id} className="table-row">
                  <td className="table-cell font-medium">{item.produto.nome}</td>
                  <td className="table-cell text-right">
                    {formatQuantidade(item.quantidade, item.produto.unidade)}
                  </td>
                  <td className="table-cell text-right">
                    {formatMoney(item.precoUnitario)}
                  </td>
                  <td className="table-cell text-right font-medium">
                    {formatMoney(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {freteEnabled ? (
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-2">Frete e pagamento</h3>
            <p className="text-xs text-gray-500 mb-3">
              O primeiro movimento de frete da venda é mantido alinhado com os campos
              abaixo (valor, frete pago e data do pagamento).
            </p>
            <form
              onSubmit={salvarFreteRecibo}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 pb-4 border-b border-gray-100"
            >
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Valor do frete (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={freteForm.valor}
                  onChange={(e) =>
                    setFreteForm((s) => ({ ...s, valor: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Data do pagamento
                </label>
                <input
                  type="date"
                  value={freteForm.data}
                  onChange={(e) =>
                    setFreteForm((s) => ({ ...s, data: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={freteForm.recibo}
                    onChange={(e) =>
                      setFreteForm((s) => ({ ...s, recibo: e.target.checked }))
                    }
                    className="rounded border-gray-300"
                  />
                  Frete pago
                </label>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={salvandoFrete}
                  className="btn-primary text-sm w-full sm:w-auto"
                >
                  {salvandoFrete ? "Salvando…" : "Salvar frete"}
                </button>
              </div>
            </form>

            {venda.fretes && venda.fretes.length > 0 ? (
              <ul className="divide-y divide-gray-100 text-sm mb-4">
                {venda.fretes.map((f) => (
                  <li key={f.id} className="py-2 flex justify-between gap-2">
                    <span className="text-gray-700">
                      {formatDate(f.data)} •{" "}
                      {f.reciboEmitido ? "Frete pago" : "Pagamento pendente"}
                      {f.reciboData ? ` • ${formatDate(f.reciboData)}` : ""}
                    </span>
                    <span className="font-medium shrink-0">
                      {formatMoney(f.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 mb-4">Sem movimentação de frete.</p>
            )}

            <div className="space-y-2 pt-1">
              <div className="flex justify-between font-bold text-gray-900 border-b pb-2 mb-1">
                <span>Total Produtos:</span>
                <span className="text-green-700 text-lg">
                  {formatMoney(venda.valorTotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Frete (cobrado à parte):</span>
                <span className="font-medium">{formatMoney(venda.frete)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-5 lg:col-span-2 flex flex-col justify-end">
            <div className="space-y-2">
              <div className="flex justify-between font-bold text-gray-900 border-b pb-2 mb-1">
                <span>Total Produtos:</span>
                <span className="text-green-700 text-lg">
                  {formatMoney(venda.valorTotal)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-2">Títulos desta venda</h3>
        {venda.titulos && venda.titulos.length > 0 ? (
          <ul className="divide-y divide-gray-100 text-sm mb-3">
            {venda.titulos.map((t) => (
              <li key={t.id} className="py-2 flex justify-between">
                <span className="text-gray-700">
                  {t.numero || `Título #${t.id}`} • Vence {formatDate(t.vencimento)} •{" "}
                  <span className="capitalize">{t.status}</span>
                </span>
                <span className="font-medium">
                  {formatMoney(t.valorPago)} / {formatMoney(t.valorOriginal)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 mb-3">Nenhum título vinculado.</p>
        )}
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">
              Recebimentos nesta ordem
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Cheque, dinheiro e PIX vinculados a esta venda.
            </p>
          </div>
          <Link
            href={`/financeiro/novo?clienteId=${venda.clienteId}&vendaId=${venda.id}&ordem=${venda.numeroVenda ?? venda.id}`}
            className="btn-primary text-sm"
          >
            Receber pagamento
          </Link>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Recebido líquido: <strong>{formatMoney(totalRecebidoLiquido)}</strong>
          {totalTrocoVenda > 0 ? ` • Troco devolvido: ${formatMoney(totalTrocoVenda)}` : ""}
          {" • "}Saldo:{" "}
          <span
            className={
              saldoVenda >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"
            }
          >
            {formatMoney(saldoVenda)}
            {saldoVenda >= 0 ? " (quitado)" : " (a receber)"}
          </span>
        </p>
        {temBaixas ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
            Para cancelar ou editar a venda, estorne todas as baixas abaixo.
          </p>
        ) : null}
        {(venda.pagamentos?.length ?? 0) === 0 && chequesSemPagamento.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum recebimento registrado nesta ordem.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {(venda.pagamentos ?? []).map((p) => {
              const isCheque = String(p.tipo || "").toLowerCase() === "cheque";
              const chequeId = p.chequeId ?? p.cheque?.id;
              const estornoKind: "cheque" | "pagamento" =
                isCheque && chequeId ? "cheque" : "pagamento";
              const estornoAlvoId =
                estornoKind === "cheque" ? Number(chequeId) : p.id;
              const chequeInfo =
                isCheque && p.cheque
                  ? ` ${formatChequeDetalhe(p.cheque)}`
                  : "";
              const tipo = String(p.tipo || "").toLowerCase();
              const badgeClass =
                tipo === "cheque"
                  ? "bg-violet-100 text-violet-800"
                  : tipo === "dinheiro"
                    ? "bg-emerald-100 text-emerald-800"
                    : tipo === "transferencia"
                      ? "bg-sky-100 text-sky-800"
                      : tipo.startsWith("troco_")
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-700";
              return (
                <li
                  key={`pag-${p.id}`}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="text-gray-700 flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badgeClass}`}
                    >
                      {labelTipoPagamento(p.tipo)}
                    </span>
                    {chequeInfo ? (
                      <span className="text-gray-500">{chequeInfo}</span>
                    ) : null}
                    {p.observacoes && !isCheque ? (
                      <span className="text-gray-400 truncate max-w-[14rem]">
                        {p.observacoes}
                      </span>
                    ) : null}
                    <span className="text-gray-400">• {formatDate(p.data)}</span>
                  </span>
                  <div className="flex items-center gap-3 ml-auto">
                    <span
                      className={`font-medium ${parseFloat(String(p.valor)) >= 0 ? "text-green-700" : "text-amber-700"}`}
                    >
                      {parseFloat(String(p.valor)) >= 0 ? "+" : ""}
                      {formatMoney(p.valor)}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      disabled={estornandoId != null}
                      onClick={() =>
                        setConfirmEstorno({
                          kind: estornoKind,
                          id: estornoAlvoId,
                          label:
                            estornoKind === "cheque"
                              ? `o cheque${chequeInfo}`
                              : `o pagamento (${labelTipoPagamento(p.tipo)} · ${formatMoney(p.valor)})`,
                        })
                      }
                    >
                      {estornandoId === estornoAlvoId ? "Estornando…" : "Estornar"}
                    </button>
                  </div>
                </li>
              );
            })}
            {chequesSemPagamento.map((ch) => (
              <li
                key={`ch-${ch.id}`}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-gray-700 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-violet-100 text-violet-800">
                    Cheque
                  </span>
                  <span className="text-gray-500">
                    #{ch.numeroOrdem}
                    {ch.banco ? ` · ${ch.banco}` : ""}
                    {ch.numero ? ` nº ${ch.numero}` : ""}
                  </span>
                </span>
                <div className="flex items-center gap-3 ml-auto">
                  <span className="font-medium text-green-700">
                    {formatMoney(ch.valor ?? 0)}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    disabled={estornandoId != null}
                    onClick={() =>
                      setConfirmEstorno({
                        kind: "cheque",
                        id: ch.id,
                        label: `o cheque #${ch.numeroOrdem}`,
                      })
                    }
                  >
                    {estornandoId === ch.id ? "Estornando…" : "Estornar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}
