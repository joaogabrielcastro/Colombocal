"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import api from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { toast } from "sonner";
import { localDateInputValue } from "@/lib/utils";
import type {
  Cheque,
  Cliente,
  ComissoesData,
  ContaData,
  FreteMovimento,
  ProdutoPreco,
} from "@/features/clientes/types";

type Options = { onClienteSalvo?: () => void };

export function useClienteDetail(id: string, freteEnabled: boolean, options: Options = {}) {
  const [conta, setConta] = useState<ContaData | null>(null);
  const [produtos, setProdutos] = useState<ProdutoPreco[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [erro, setErro] = useState("");
  const [salvandoForm, setSalvandoForm] = useState(false);
  const [precosEdit, setPrecosEdit] = useState<Record<number, string>>({});
  const [salvandoPrecos, setSalvandoPrecos] = useState(false);
  const [comissoesData, setComissoesData] = useState<ComissoesData | null>(null);
  const [comissoesEdit, setComissoesEdit] = useState<Record<number, string>>({});
  const [salvandoComissoes, setSalvandoComissoes] = useState(false);
  const [filtroChqIni, setFiltroChqIni] = useState("");
  const [filtroChqFim, setFiltroChqFim] = useState("");
  const [buscaChq, setBuscaChq] = useState("");
  const [fretesPendentes, setFretesPendentes] = useState<FreteMovimento[]>([]);
  const [pagandoFreteId, setPagandoFreteId] = useState<number | null>(null);
  const [pgFreteTipo, setPgFreteTipo] = useState<"dinheiro" | "transferencia">("dinheiro");
  const [pgFreteData, setPgFreteData] = useState(localDateInputValue());
  const [reconciliando, setReconciliando] = useState(false);

  const carregarPrincipal = useCallback(async () => {
    setLoading(true);
    try {
      const [contaData, prodData] = await Promise.all([
        api.get<ContaData>(`/clientes/${id}/conta`),
        api.get<ProdutoPreco[]>(`/clientes/${id}/precos`),
      ]);
      setConta(contaData);
      setForm({
        ...contaData.cliente,
        vendedorId: contaData.cliente.vendedorId ?? undefined,
        comissaoFixaPercentual: contaData.cliente.comissaoFixaPercentual ?? undefined,
      });
      setProdutos(prodData);
      const mapa: Record<number, string> = {};
      prodData.forEach((p) => {
        if (p.precoEspecial) mapa[p.id] = String(p.precoEspecial);
      });
      setPrecosEdit(mapa);
    } catch (e) {
      setConta(null);
      reportApiError(e, {
        title: "Não foi possível carregar o cliente",
        onRetry: () => void carregarPrincipal(),
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  const carregarCheques = useCallback(() => {
    const params = new URLSearchParams({ clienteId: String(id) });
    if (filtroChqIni) params.set("dataInicio", filtroChqIni);
    if (filtroChqFim) params.set("dataFim", filtroChqFim);
    return api.get<Cheque[]>(`/cheques?${params}`).then(setCheques);
  }, [filtroChqFim, filtroChqIni, id]);

  const carregarComissoes = useCallback(() => api
    .get<ComissoesData>(`/clientes/${id}/comissoes`)
    .then((data) => {
      setComissoesData(data);
      const mapa: Record<number, string> = {};
      data.produtos.forEach((p) => {
        if (p.comissaoEspecial != null) mapa[p.id] = String(p.comissaoEspecial);
      });
      setComissoesEdit(mapa);
    }), [id]);

  const carregarFretesPendentes = useCallback(() => api
    .get<FreteMovimento[]>(`/fretes?clienteId=${id}&reciboEmitido=false&take=300&skip=0`)
    .then((rows) => setFretesPendentes((rows || []).filter((f) => !f.vendaId)))
    .catch(() => setFretesPendentes([])), [id]);

  const loadVendedorOptions = useCallback(async (q: string) => {
    const p = new URLSearchParams({ take: "80" });
    if (q.trim()) p.set("busca", q.trim());
    const r = await api.get<{ id: number; nome: string }[]>(`/vendedores?${p}`);
    return r.map((v) => ({ id: v.id, label: v.nome }));
  }, []);

  const loadVendedorLabelById = useCallback(async (vid: string) => {
    const v = await api.get<{ nome: string }>(`/vendedores/${vid}`);
    return v.nome;
  }, []);

  useEffect(() => {
    void carregarPrincipal();
    if (freteEnabled) void carregarFretesPendentes();
  }, [carregarFretesPendentes, carregarPrincipal, freteEnabled]);
  useEffect(() => { void carregarCheques(); }, [id]);

  const handlePagarFrete = async (frete: FreteMovimento) => {
    setPagandoFreteId(frete.id);
    try {
      await api.post("/pagamentos", { clienteId: Number(id), vendaId: null, tipo: pgFreteTipo, valor: Number(frete.valor), data: pgFreteData, observacoes: `Pagamento de frete avulso #${frete.id}` });
      await api.patch(`/fretes/${frete.id}`, { reciboEmitido: true, reciboData: pgFreteData });
      toast.success("Frete avulso pago com sucesso.");
      await Promise.all([carregarPrincipal(), carregarFretesPendentes()]);
    } catch (e) {
      reportApiError(e, { title: "Não foi possível pagar o frete avulso" });
    } finally {
      setPagandoFreteId(null);
    }
  };

  const handleReconciliarRecebiveis = async () => {
    setReconciliando(true);
    try {
      await api.post(`/clientes/${id}/reconciliar-recebiveis`, {});
      toast.success("Títulos alinhados com os pagamentos.");
      await carregarPrincipal();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível recalcular títulos" });
    } finally {
      setReconciliando(false);
    }
  };

  const handleSalvarPrecos = async () => {
    setSalvandoPrecos(true);
    try {
      await api.put(`/clientes/${id}/precos`, { precos: produtos.map((p) => ({ produtoId: p.id, preco: precosEdit[p.id] ? parseFloat(precosEdit[p.id]) : null })) });
      setProdutos(await api.get<ProdutoPreco[]>(`/clientes/${id}/precos`));
      toast.success("Preços salvos");
    } catch (e) {
      reportApiError(e, { title: "Erro ao salvar preços" });
    } finally {
      setSalvandoPrecos(false);
    }
  };

  const handleSalvarComissoes = async () => {
    if (!comissoesData) return;
    setSalvandoComissoes(true);
    try {
      await api.put(`/clientes/${id}/comissoes`, { comissoes: comissoesData.produtos.map((p) => ({ produtoId: p.id, comissaoPercentual: comissoesEdit[p.id] ? parseFloat(comissoesEdit[p.id].replace(",", ".")) : null })) });
      await carregarComissoes();
      toast.success("Comissões salvas");
    } catch (e) {
      reportApiError(e, { title: "Erro ao salvar comissões" });
    } finally {
      setSalvandoComissoes(false);
    }
  };

  const handleSalvarCliente = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSalvandoForm(true);
    setErro("");
    try {
      await api.put(`/clientes/${id}`, {
        ...form,
        vendedorId: form.vendedorId == null ? null : Number(form.vendedorId),
        comissaoFixaPercentual: form.comissaoFixaPercentual == null ? null : parseFloat(String(form.comissaoFixaPercentual).replace(",", ".")),
      });
      await carregarPrincipal();
      options.onClienteSalvo?.();
    } catch (e) {
      reportApiError(e, { title: "Erro ao salvar cliente" });
      setErro(e instanceof Error ? e.message : "");
    } finally {
      setSalvandoForm(false);
    }
  };

  return {
    conta, produtos, cheques, loading, form, erro, salvandoForm, precosEdit, salvandoPrecos,
    comissoesData, comissoesEdit, salvandoComissoes, filtroChqIni, filtroChqFim, buscaChq,
    fretesPendentes, pagandoFreteId, pgFreteTipo, pgFreteData, reconciliando,
    setForm, setPrecosEdit, setComissoesEdit, setFiltroChqIni, setFiltroChqFim, setBuscaChq,
    setPgFreteTipo, setPgFreteData, carregarPrincipal, carregarCheques, carregarComissoes,
    carregarFretesPendentes, handlePagarFrete, handleReconciliarRecebiveis, handleSalvarPrecos,
    handleSalvarComissoes, handleSalvarCliente, loadVendedorOptions, loadVendedorLabelById,
  };
}
