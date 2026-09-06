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
import { openOrdemCarregamentoPrint } from "@/lib/ordem-carregamento-print";
import { openOrdemServicoPrint } from "@/lib/ordem-servico-print";
import {
  openFreteAvulsoPrint,
  type FreteAvulsoImpressao,
} from "@/lib/frete-avulso-print";
import { VendaOrdem, vendaOrdemTexto } from "@/components/VendaOrdem";
import { toast } from "sonner";
import api from "@/lib/api";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { reportApiError } from "@/lib/report-api-error";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { VendaNfeActions } from "@/features/nfe/VendaNfeActions";

export default function VendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { freteEnabled, fretePagoDefault, nfeEnabled } = useTenantFeatures();
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
  const [gerandoOc, setGerandoOc] = useState(false);
  const [imprimindoFrete, setImprimindoFrete] = useState(false);

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
      recibo: fretePagoDefault
        ? true
        : (f0?.reciboEmitido ?? venda.freteRecibo),
      data:
        toInputDate(f0?.reciboData) ||
        (fretePagoDefault ? toInputDate(venda.dataVenda) : ""),
    });
  }, [venda, fretePagoDefault]);

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
        freteRecibo: fretePagoDefault ? true : freteForm.recibo,
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

  const imprimirFreteVenda = async () => {
    if (!venda) return;
    setImprimindoFrete(true);
    try {
      const resumo = await api.get<FreteAvulsoImpressao>(
        `/vendas/${id}/frete-impressao`,
      );
      openFreteAvulsoPrint(resumo);
      toast.success("Abrindo impressão do frete");
    } catch (e) {
      reportApiError(e, { title: "Não foi possível imprimir o frete da venda" });
    } finally {
      setImprimindoFrete(false);
    }
  };

  const imprimirOrdemServico = () => {
    if (!venda) return;
    openOrdemServicoPrint(venda, {
      freteEnabled,
      numeroPublico: vendaOrdemTexto(venda),
    });
  };

  const gerarOrdemCarregamento = async () => {
    if (!venda) return;
    setGerandoOc(true);
    try {
      const ordem = await api.post<{
        id: number;
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
        itens: {
          descricao: string;
          quantidade: number | string;
          unidade?: string | null;
        }[];
      }>("/ordens-carregamento", { vendaId: venda.id });
      toast.success(
        `OC ${String(ordem.numeroOc).padStart(6, "0")} gerada`,
      );
      openOrdemCarregamentoPrint(ordem);
    } catch (e) {
      reportApiError(e, { title: "Não foi possível gerar a OC" });
    } finally {
      setGerandoOc(false);
    }
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
  // Troco já entra negativo em totalPagoVenda — líquido = soma dos lançamentos desta ordem
  const totalRecebidoNestaOrdem = totalPagoVenda;
  const totalTituloVenda =
    venda.titulos?.reduce(
      (acc, t) => acc + parseFloat(String(t.valorOriginal)),
      0,
    ) ?? parseFloat(String(venda.valorTotal));
  const totalPagoNosTitulos =
    venda.titulos?.reduce(
      (acc, t) => acc + parseFloat(String(t.valorPago ?? 0)),
      0,
    ) ?? 0;
  const saldoAbertoTitulos =
    venda.saldoEmAbertoTitulos != null
      ? Math.max(0, parseFloat(String(venda.saldoEmAbertoTitulos)))
      : Math.max(
          0,
          (venda.titulos ?? []).reduce((acc, t) => {
            const vo = parseFloat(String(t.valorOriginal ?? 0));
            const vp = parseFloat(String(t.valorPago ?? 0));
            return acc + Math.max(0, vo - vp);
          }, 0),
        );
  const quitadoPelosTitulos = saldoAbertoTitulos < 0.01 && totalTituloVenda > 0.01;
  const temBaixas =
    (venda.pagamentos?.length ?? 0) > 0 || (venda.cheques?.length ?? 0) > 0;

  const chequesSemPagamento = (venda.cheques ?? []).filter((ch) => {
    const ligado = (venda.pagamentos ?? []).some(
      (p) => p.chequeId === ch.id || p.cheque?.id === ch.id,
    );
    return !ligado;
  });

  return (
    <div className="p-6 w-full max-w-[90rem] mx-auto">
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
            <span className="text-gray-500">Pago nos títulos: </span>
            <strong className="text-green-700">{formatMoney(totalPagoNosTitulos)}</strong>
            <span className="text-gray-400"> · </span>
            <span className="text-gray-500">Saldo: </span>
            <strong className={quitadoPelosTitulos ? "text-green-700" : "text-red-600"}>
              {quitadoPelosTitulos
                ? "Quitado"
                : `${formatMoney(saldoAbertoTitulos)} a receber`}
            </strong>
            {(venda.pagamentos?.length ?? 0) > 0 ? (
              <span className="text-gray-400">
                {" "}
                · {venda.pagamentos!.length} recebimento
                {venda.pagamentos!.length === 1 ? "" : "s"} nesta ordem
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button onClick={imprimirOrdemServico} className="btn-secondary">
            <PrinterIcon className="w-4 h-4" />
            Imprimir O.S.
          </button>
          {freteEnabled ? (
            <button
              type="button"
              onClick={() => void imprimirFreteVenda()}
              className="btn-secondary"
              disabled={imprimindoFrete}
              title="PDF do frete desta venda (não usa frete avulso)"
            >
              <PrinterIcon className="w-4 h-4" />
              {imprimindoFrete ? "Abrindo PDF…" : "PDF do frete"}
            </button>
          ) : null}
          {freteEnabled ? (
            <button
              onClick={() => void gerarOrdemCarregamento()}
              className="btn-secondary"
              disabled={gerandoOc}
            >
              <PrinterIcon className="w-4 h-4" />
              {gerandoOc ? "Gerando OC…" : "Gerar OC"}
            </button>
          ) : null}
          {venda.podeEditar ? (
            <Link href={`/vendas/${id}/editar`} className="btn-secondary">
              <PencilIcon className="w-4 h-4" />
              Editar
            </Link>
          ) : (
            <span
              className="text-xs text-gray-500 max-w-[12rem] leading-tight"
              title={
                venda.nfeBloqueiaEdicao
                  ? "Não é possível editar com NF-e autorizada ou em processamento"
                  : "Não é possível editar com baixas ou cheques vinculados"
              }
            >
              {venda.nfeBloqueiaEdicao
                ? "Edição bloqueada (NF-e)"
                : "Edição bloqueada (baixas/cheques)"}
            </span>
          )}
          <button
            onClick={() => setConfirmCancelOpen(true)}
            disabled={cancelando || temBaixas || !!venda.nfeBloqueiaEdicao}
            className="btn-danger disabled:opacity-50"
            title={
              temBaixas
                ? "Estorne todas as baixas e cheques antes de cancelar"
                : venda.nfeBloqueiaEdicao
                  ? "Cancele a NF-e autorizada antes de cancelar a venda"
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
          venda.nfeBloqueiaEdicao
            ? "Há NF-e autorizada ou em processamento. Cancele a nota fiscal primeiro."
            : temBaixas
            ? "Estorne todas as baixas e cheques vinculados antes de cancelar a venda."
            : "Tem certeza que deseja cancelar esta venda? As movimentações vinculadas serão removidas."
        }
        tone="danger"
        busy={cancelando}
        confirmText="Cancelar venda"
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={() => void handleCancelar()}
      />

      {(venda.ordensCarregamento?.length ?? 0) > 0 ? (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Ordens de carregamento
            </h2>
            <Link
              href="/carregamento"
              className="text-xs text-blue-600 hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {venda.ordensCarregamento!.map((oc) => (
              <li
                key={oc.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <Link
                    href={`/carregamento/${oc.id}/editar`}
                    className="font-mono font-semibold text-blue-600 hover:underline"
                  >
                    OC {String(oc.numeroOc).padStart(6, "0")}
                  </Link>
                  <span className="text-gray-400 text-xs ml-2">
                    {formatDate(oc.dataEmissao)}
                    {oc.pedido ? ` · Pedido ${oc.pedido}` : ""}
                  </span>
                </div>
                <Link
                  href={`/carregamento/${oc.id}/editar`}
                  className="text-xs text-gray-600 hover:underline"
                >
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {nfeEnabled ? (
        <div className="mb-4">
          <VendaNfeActions
            venda={venda}
            onUpdated={() => void carregar()}
          />
        </div>
      ) : null}

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
              O frete desta venda fica aqui. Para PDF, use o botão abaixo — não é
              preciso cadastrar frete avulso.
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
                <label
                  className={`flex items-center gap-2 text-sm ${
                    fretePagoDefault ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={fretePagoDefault ? true : freteForm.recibo}
                    disabled={fretePagoDefault}
                    onChange={(e) =>
                      setFreteForm((s) => ({ ...s, recibo: e.target.checked }))
                    }
                    className="rounded border-gray-300"
                  />
                  Frete pago
                  {fretePagoDefault ? (
                    <span className="text-gray-400 text-xs">
                      (padrão Colombocal)
                    </span>
                  ) : null}
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
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => void imprimirFreteVenda()}
                  disabled={imprimindoFrete}
                  className="btn-secondary text-sm inline-flex items-center gap-1.5"
                >
                  <PrinterIcon className="w-4 h-4" />
                  {imprimindoFrete ? "Abrindo PDF…" : "Imprimir PDF do frete"}
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
          Nesta ordem: <strong>{formatMoney(totalRecebidoNestaOrdem)}</strong>
          {totalTrocoVenda > 0 ? ` • Troco devolvido: ${formatMoney(totalTrocoVenda)}` : ""}
          {" • "}Saldo dos títulos:{" "}
          <span
            className={
              quitadoPelosTitulos
                ? "text-green-700 font-semibold"
                : "text-red-600 font-semibold"
            }
          >
            {quitadoPelosTitulos
              ? "Quitado"
              : `${formatMoney(saldoAbertoTitulos)} a receber`}
          </span>
        </p>
        {temBaixas ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
            Para cancelar ou editar a venda, estorne todas as baixas abaixo.
          </p>
        ) : null}
        {(venda.pagamentos?.length ?? 0) === 0 && chequesSemPagamento.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Nenhum recebimento registrado nesta ordem.
          </p>
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
