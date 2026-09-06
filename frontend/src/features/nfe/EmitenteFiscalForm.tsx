"use client";

import { useEffect, useState } from "react";
import api, { ApiError } from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";

export type EmitenteFiscal = {
  cnpj: string;
  inscricaoEstadual: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  crt: number;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  municipio: string;
  codigoMunicipio: string;
  uf: string;
  cep: string;
  telefone?: string | null;
  serieNfe: number;
  ambiente: "homologacao" | "producao";
  naturezaOperacao?: string;
  modalidadeFrete: number;
  provedorTokenConfigurado?: boolean;
};

const empty: EmitenteFiscal = {
  cnpj: "",
  inscricaoEstadual: "",
  razaoSocial: "",
  nomeFantasia: "",
  crt: 1,
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio: "",
  codigoMunicipio: "",
  uf: "",
  cep: "",
  telefone: "",
  serieNfe: 1,
  ambiente: "homologacao",
  naturezaOperacao: "Venda de mercadoria",
  modalidadeFrete: 9,
};

export function EmitenteFiscalForm() {
  const [form, setForm] = useState<EmitenteFiscal>(empty);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [tokenOk, setTokenOk] = useState(false);

  const set =
    (field: keyof EmitenteFiscal) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  useEffect(() => {
    let cancelled = false;
    api
      .get<EmitenteFiscal | null>("/config/emitente-fiscal")
      .then((row) => {
        if (cancelled) return;
        if (row) {
          setForm({ ...empty, ...row });
          setTokenOk(!!row.provedorTokenConfigurado);
        }
      })
      .catch((e) => {
        if (!cancelled) reportApiError(e, { title: "Não foi possível carregar o emitente" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const saved = await api.put<EmitenteFiscal>("/config/emitente-fiscal", {
        ...form,
        crt: Number(form.crt),
        serieNfe: Number(form.serieNfe) || 1,
        modalidadeFrete: Number(form.modalidadeFrete) || 9,
        provedorToken: token.trim() || undefined,
      });
      setForm({ ...empty, ...saved });
      setTokenOk(!!saved.provedorTokenConfigurado);
      setToken("");
    } catch (err) {
      reportApiError(err, { title: "Erro ao salvar dados fiscais" });
      setErro(err instanceof ApiError ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400">Carregando dados fiscais…</p>;
  }

  return (
    <form onSubmit={(ev) => void salvar(ev)} className="space-y-3">
      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">CNPJ *</span>
          <input required value={form.cnpj} onChange={set("cnpj")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Inscrição estadual *</span>
          <input required value={form.inscricaoEstadual} onChange={set("inscricaoEstadual")} className="input-field" />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="block text-gray-700 mb-1">Razão social *</span>
          <input required value={form.razaoSocial} onChange={set("razaoSocial")} className="input-field" />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="block text-gray-700 mb-1">Nome fantasia</span>
          <input value={form.nomeFantasia ?? ""} onChange={set("nomeFantasia")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">CRT *</span>
          <select className="input-field" value={String(form.crt)} onChange={set("crt")}>
            <option value={1}>1 — Simples Nacional</option>
            <option value={2}>2 — Simples (excesso sublimite)</option>
            <option value={3}>3 — Regime Normal</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Ambiente</span>
          <select className="input-field" value={form.ambiente} onChange={set("ambiente")}>
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          <span className="block text-gray-700 mb-1">Logradouro *</span>
          <input required value={form.logradouro} onChange={set("logradouro")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Número *</span>
          <input required value={form.numero} onChange={set("numero")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Bairro *</span>
          <input required value={form.bairro} onChange={set("bairro")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Município *</span>
          <input required value={form.municipio} onChange={set("municipio")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">UF *</span>
          <input required value={form.uf} onChange={set("uf")} className="input-field" maxLength={2} />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">CEP *</span>
          <input required value={form.cep} onChange={set("cep")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Código IBGE *</span>
          <input required value={form.codigoMunicipio} onChange={set("codigoMunicipio")} className="input-field" maxLength={7} />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Série NF-e</span>
          <input type="number" min={1} value={form.serieNfe} onChange={set("serieNfe")} className="input-field" />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="block text-gray-700 mb-1">Natureza da operação</span>
          <input value={form.naturezaOperacao ?? ""} onChange={set("naturezaOperacao")} className="input-field" />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="block text-gray-700 mb-1">
            Token Focus NFe {tokenOk ? "(já configurado — deixe em branco para manter)" : ""}
          </span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="input-field"
            placeholder={tokenOk ? "••••••••" : "Cole o token do provedor"}
            autoComplete="off"
          />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        O certificado A1 fica no provedor, não neste sistema. Frete da venda não entra na NF-e.
      </p>
      <button type="submit" className="btn-primary" disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar dados fiscais"}
      </button>
    </form>
  );
}
