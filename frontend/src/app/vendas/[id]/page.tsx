"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PrinterIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  formatMoney,
  formatDate,
  formatQuantidade,
  toInputDate,
  type Venda,
  type Pagamento,
} from "@/lib/utils";
import { toast } from "sonner";
import api from "@/lib/api";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";

export default function VendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [venda, setVenda] = useState<Venda | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [tipoBaixa, setTipoBaixa] = useState<"dinheiro" | "transferencia">(
    "dinheiro",
  );
  const [valorBaixa, setValorBaixa] = useState("");
  const [dataBaixa, setDataBaixa] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [obsBaixa, setObsBaixa] = useState("");
  const [trocoTipo, setTrocoTipo] = useState<"dinheiro" | "transferencia">(
    "dinheiro",
  );
  const [salvandoBaixa, setSalvandoBaixa] = useState(false);
  const [freteForm, setFreteForm] = useState({
    valor: "",
    recibo: false,
    data: "",
  });
  const [salvandoFrete, setSalvandoFrete] = useState(false);

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
    if (
      !confirm(
        "Tem certeza que deseja cancelar esta venda? As movimentações vinculadas serão removidas.",
      )
    )
      return;
    setCancelando(true);
    try {
      await api.delete(`/vendas/${id}`);
      router.push("/vendas");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível cancelar a venda" });
      setCancelando(false);
    }
  };

  const handleBaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venda) return;
    const v = parseFloat(valorBaixa.replace(",", "."));
    if (!v || v <= 0) {
      alert("Informe um valor válido");
      return;
    }
    setSalvandoBaixa(true);
    try {
      await api.post<Pagamento>("/pagamentos", {
        clienteId: venda.clienteId,
        vendaId: venda.id,
        tipo: tipoBaixa,
        valor: v,
        trocoTipo,
        data: dataBaixa,
        observacoes: obsBaixa || `Baixa venda #${venda.id}`,
      });
      setValorBaixa("");
      setObsBaixa("");
      await carregar();
      toast.success("Pagamento registrado");
    } catch (e) {
      reportApiError(e, { title: "Erro ao registrar pagamento" });
    } finally {
      setSalvandoBaixa(false);
    }
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

    const clienteNome = venda.cliente.nomeFantasia || venda.cliente.razaoSocial;
    const enderecoCliente = [
      venda.cliente.endereco,
      venda.cliente.cidade,
      venda.cliente.estado,
    ]
      .filter(Boolean)
      .join(" - ");
    const itensRows = venda.itens
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.produto.nome)}</td>
          <td style="text-align:right">${escapeHtml(formatQuantidade(item.quantidade, item.produto.unidade))}</td>
        </tr>`,
      )
      .join("");
    const tarifaSaco = parseFloat(String(venda.freteTarifaSaco ?? 0));
    const tarifaTon = parseFloat(String(venda.freteTarifaTonelada ?? 0));
    const tarifaKg = tarifaTon / 1000;
    const qtdSaco = venda.itens
      .filter((i) => String(i.produto.unidade).toLowerCase() === "saco")
      .reduce((a, i) => a + parseFloat(String(i.quantidade)), 0);
    const qtdTon = venda.itens
      .filter((i) => String(i.produto.unidade).toLowerCase() === "ton")
      .reduce((a, i) => a + parseFloat(String(i.quantidade)), 0);
    const qtdKg = venda.itens
      .filter((i) => String(i.produto.unidade).toLowerCase() === "kg")
      .reduce((a, i) => a + parseFloat(String(i.quantidade)), 0);
    const freteSaco = qtdSaco * tarifaSaco;
    const freteTon = qtdTon * tarifaTon;
    const freteKg = qtdKg * tarifaKg;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ordem de Serviço - Venda #${venda.id}</title>
  <style>
    body { font-family: Arial, sans-serif; color:#111827; margin: 24px; }
    h1 { margin:0; font-size:20px; }
    .meta { margin-top:6px; color:#4b5563; font-size:12px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top: 18px; }
    .box { border:1px solid #e5e7eb; border-radius:8px; padding:10px; }
    .label { color:#6b7280; font-size:11px; text-transform: uppercase; font-weight: 700; }
    .value { margin-top:3px; font-size:14px; }
    table { width:100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border:1px solid #e5e7eb; padding:8px; font-size:12px; }
    th { background:#f9fafb; text-align:left; }
    .obs { margin-top: 16px; border:1px dashed #d1d5db; border-radius:8px; padding:10px; min-height:56px; font-size:12px; }
    .assinatura { margin-top: 36px; display:grid; grid-template-columns: 1fr 1fr; gap:32px; }
    .linha { border-top:1px solid #9ca3af; padding-top:6px; text-align:center; font-size:12px; color:#374151; }
  </style>
</head>
<body>
  <h1>Ordem de Serviço - Entrega</h1>
  <div class="meta">Venda #${venda.id} • Data ${formatDate(venda.dataVenda)}</div>

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
  </div>

  <div class="box" style="margin-top:10px;">
    <div class="label">Endereço / Local</div>
    <div class="value">${escapeHtml(enderecoCliente || "-")}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produto</th>
        <th style="text-align:right">Quantidade</th>
      </tr>
    </thead>
    <tbody>
      ${itensRows}
    </tbody>
  </table>

  <div class="obs">
    <div class="label">Observações</div>
    <div style="margin-top:6px;">${escapeHtml(venda.observacoes || "Sem observações.")}</div>
  </div>

  <div class="box" style="margin-top:10px;">
    <div class="label">Resumo de frete para cobrança</div>
    <div class="value">
      Tarifa por saco: ${escapeHtml(formatMoney(tarifaSaco))} · Quantidade: ${escapeHtml(formatQuantidade(qtdSaco, "saco"))} · Subtotal: ${escapeHtml(formatMoney(freteSaco))}
    </div>
    <div class="value">
      Tarifa por tonelada: ${escapeHtml(formatMoney(tarifaTon))} · Quantidade: ${escapeHtml(formatQuantidade(qtdTon, "ton"))} · Subtotal: ${escapeHtml(formatMoney(freteTon))}
    </div>
    <div class="value">
      Tarifa equivalente por kg: ${escapeHtml(formatMoney(tarifaKg))} · Quantidade: ${escapeHtml(formatQuantidade(qtdKg, "kg"))} · Subtotal: ${escapeHtml(formatMoney(freteKg))}
    </div>
    <div class="value" style="font-weight:700; margin-top:6px;">
      Frete total cobrado: ${escapeHtml(formatMoney(venda.frete))}
    </div>
  </div>

  <div class="assinatura">
    <div class="linha">Assinatura do Motorista</div>
    <div class="linha">Assinatura do Recebedor</div>
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/vendas" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Venda #{venda.id}
          </h1>
          <p className="text-gray-500 text-sm">{formatDate(venda.dataVenda)}</p>
        </div>
        <button onClick={imprimirOrdemServico} className="btn-secondary">
          <PrinterIcon className="w-4 h-4" />
          Imprimir O.S.
        </button>
        <button
          onClick={handleCancelar}
          disabled={cancelando}
          className="btn-danger"
        >
          <TrashIcon className="w-4 h-4" />
          {cancelando ? "Cancelando..." : "Cancelar Venda"}
        </button>
      </div>

      <div className="card p-5 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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

      <div className="card overflow-hidden mb-4">
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

      <div className="card p-5 mb-4">
        <h3 className="font-semibold text-gray-900 mb-2">Frete e pagamento</h3>
        <p className="text-xs text-gray-500 mb-3">
          O primeiro movimento de frete da venda é mantido alinhado com os campos
          abaixo (valor, frete pago e data do pagamento).
        </p>
        <form
          onSubmit={salvarFreteRecibo}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 pb-6 border-b border-gray-100"
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
          <div className="md:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={salvandoFrete}
              className="btn-primary text-sm"
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

        <div className="flex justify-end">
          <div className="w-72 space-y-2">
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
      </div>

      <div className="card p-5 mb-4">
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

      <div className="card p-5 mb-4">
        <h3 className="font-semibold text-gray-900 mb-2">
          Baixas nesta ordem (pagamentos vinculados)
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          Recebido líquido: {formatMoney(totalRecebidoLiquido)}
          {totalTrocoVenda > 0 ? ` • Troco devolvido: ${formatMoney(totalTrocoVenda)}` : ""}
          {" • "}Saldo desta ordem:{" "}
          <span
            className={
              saldoVenda >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"
            }
          >
            {formatMoney(saldoVenda)}
            {saldoVenda >= 0 ? " (quitado)" : " (a receber)"}
          </span>
        </p>
        {venda.pagamentos && venda.pagamentos.length > 0 ? (
          <ul className="divide-y divide-gray-100 text-sm">
            {venda.pagamentos.map((p) => (
              <li key={p.id} className="py-2 flex justify-between">
                <span className="capitalize text-gray-700 flex items-center gap-2">
                  {p.tipo} • {formatDate(p.data)}
                  {String(p.tipo || "").toLowerCase().startsWith("troco_") && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                      Troco
                    </span>
                  )}
                </span>
                <span
                  className={`font-medium ${parseFloat(String(p.valor)) >= 0 ? "text-green-700" : "text-amber-700"}`}
                >
                  {parseFloat(String(p.valor)) >= 0 ? "+" : ""}
                  {formatMoney(p.valor)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">Nenhum pagamento vinculado.</p>
        )}

        <form onSubmit={handleBaixa} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select
              value={tipoBaixa}
              onChange={(e) =>
                setTipoBaixa(e.target.value as "dinheiro" | "transferencia")
              }
              className="input-field"
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={valorBaixa}
              onChange={(e) => setValorBaixa(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data</label>
            <input
              type="date"
              value={dataBaixa}
              onChange={(e) => setDataBaixa(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Troco (se passar do saldo)
            </label>
            <select
              value={trocoTipo}
              onChange={(e) =>
                setTrocoTipo(e.target.value as "dinheiro" | "transferencia")
              }
              className="input-field"
            >
              <option value="dinheiro">Devolver em dinheiro</option>
              <option value="transferencia">Devolver em transferência</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Observações</label>
            <input
              value={obsBaixa}
              onChange={(e) => setObsBaixa(e.target.value)}
              className="input-field"
              placeholder="Opcional"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={salvandoBaixa}
              className="btn-primary"
            >
              {salvandoBaixa ? "Registrando..." : "Registrar baixa nesta venda"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
