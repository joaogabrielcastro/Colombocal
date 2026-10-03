"use client";

import { useEffect, useState } from "react";
import api, { ApiError } from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { isValidCnpjDigits, onlyDigits } from "@/lib/document-validation";

export type EmitenteFiscal = {
  id?: number;
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
  rntrc?: string | null;
  serieCte?: number;
  serieMdfe?: number;
  ambiente: "homologacao" | "producao";
  naturezaOperacao?: string;
  modalidadeFrete: number;
  provedor: "notaas" | "focusnfe";
  provedorTokenConfigurado?: boolean;
  ativo?: boolean;
  padrao?: boolean;
  habilitaNfe?: boolean;
  habilitaCte?: boolean;
  habilitaMdfe?: boolean;
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
  rntrc: "",
  serieCte: 1,
  serieMdfe: 1,
  ambiente: "homologacao",
  naturezaOperacao: "Venda de mercadoria",
  modalidadeFrete: 9,
  provedor: "notaas",
  ativo: true,
  padrao: false,
  habilitaNfe: true,
  habilitaCte: false,
  habilitaMdfe: false,
};

type CepData = Pick<EmitenteFiscal, "cep" | "logradouro" | "complemento" | "bairro" | "municipio" | "uf" | "codigoMunicipio">;
type CnpjData = CepData & Pick<EmitenteFiscal, "cnpj" | "razaoSocial" | "nomeFantasia" | "telefone" | "numero">;

const maskCnpj = (value: string) => onlyDigits(value).slice(0, 14)
  .replace(/^(\d{2})(\d)/, "$1.$2")
  .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/\.(\d{3})(\d)/, ".$1/$2")
  .replace(/(\d{4})(\d)/, "$1-$2");
const maskCep = (value: string) => onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const maskPhone = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

function isValidIeParana(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 10 || /^(\d)\1{9}$/.test(d)) return false;
  const calc = (base: string, weights: number[]) => {
    const rest = base.split("").reduce((sum, n, i) => sum + Number(n) * weights[i], 0) % 11;
    const result = 11 - rest;
    return result >= 10 ? 0 : result;
  };
  const first = calc(d.slice(0, 8), [3, 2, 7, 6, 5, 4, 3, 2]);
  const second = calc(d.slice(0, 8) + first, [4, 3, 2, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${first}${second}`);
}

export function EmitenteFiscalForm() {
  const [form, setForm] = useState<EmitenteFiscal>(empty);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [tokenOk, setTokenOk] = useState(false);
  const [emitentes, setEmitentes] = useState<EmitenteFiscal[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [ultimoCepBuscado, setUltimoCepBuscado] = useState("");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [ultimoCnpjBuscado, setUltimoCnpjBuscado] = useState("");

  const set =
    (field: keyof EmitenteFiscal) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const selecionar = (row: EmitenteFiscal | null) => {
    setSelectedId(row?.id ?? null);
    setForm(row ? { ...empty, ...row } : { ...empty });
    setTokenOk(!!row?.provedorTokenConfigurado);
    setToken("");
    setErro("");
    setUltimoCepBuscado(onlyDigits(row?.cep || ""));
    setUltimoCnpjBuscado(onlyDigits(row?.cnpj || ""));
  };

  const buscarCnpj = async () => {
    const cnpj = onlyDigits(form.cnpj);
    if (!isValidCnpjDigits(cnpj)) {
      setErro("CNPJ inválido. Verifique os dígitos informados.");
      return;
    }
    if (buscandoCnpj || cnpj === ultimoCnpjBuscado) return;
    setBuscandoCnpj(true);
    setErro("");
    try {
      const data = await api.get<CnpjData>(`/cnpj/${cnpj}`);
      setForm((prev) => ({
        ...prev,
        cnpj: maskCnpj(data.cnpj),
        razaoSocial: data.razaoSocial || prev.razaoSocial,
        nomeFantasia: data.nomeFantasia || data.razaoSocial || prev.nomeFantasia,
        telefone: data.telefone ? maskPhone(data.telefone) : prev.telefone,
        cep: data.cep ? maskCep(data.cep) : prev.cep,
        logradouro: data.logradouro || prev.logradouro,
        numero: data.numero || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        municipio: data.municipio || prev.municipio,
        uf: data.uf || prev.uf,
        codigoMunicipio: data.codigoMunicipio || prev.codigoMunicipio,
      }));
      setUltimoCnpjBuscado(cnpj);
      if (data.cep) setUltimoCepBuscado(onlyDigits(data.cep));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const buscarCep = async () => {
    const cep = onlyDigits(form.cep);
    if (cep.length !== 8) {
      setErro("CEP inválido. Informe 8 dígitos.");
      return;
    }
    if (buscandoCep || cep === ultimoCepBuscado) return;
    setBuscandoCep(true);
    setErro("");
    try {
      const data = await api.get<CepData>(`/cep/${cep}`);
      setForm((prev) => ({ ...prev, ...data, cep: maskCep(data.cep), complemento: prev.complemento || data.complemento || "" }));
      setUltimoCepBuscado(cep);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  };

  const carregar = async (preferredId?: number) => {
    const rows = await api.get<EmitenteFiscal[]>("/config/emitentes-fiscais");
    setEmitentes(rows);
    selecionar(rows.find((r) => r.id === preferredId) || rows.find((r) => r.padrao) || rows[0] || null);
  };

  useEffect(() => {
    let cancelled = false;
    api
      .get<EmitenteFiscal[]>("/config/emitentes-fiscais")
      .then((rows) => {
        if (cancelled) return;
        setEmitentes(rows);
        selecionar(rows.find((r) => r.padrao) || rows[0] || null);
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
    setErro("");
    if (!isValidCnpjDigits(form.cnpj)) {
      setErro("CNPJ inválido. Verifique os dígitos informados.");
      return;
    }
    if (form.uf.trim().toUpperCase() === "PR" && form.inscricaoEstadual.trim().toUpperCase() !== "ISENTO" && !isValidIeParana(form.inscricaoEstadual)) {
      setErro("Inscrição estadual do Paraná inválida.");
      return;
    }
    if (onlyDigits(form.cep).length !== 8 || onlyDigits(form.codigoMunicipio).length !== 7) {
      setErro("Confira o CEP e o código IBGE do município.");
      return;
    }
    if (form.telefone && ![10, 11].includes(onlyDigits(form.telefone).length)) {
      setErro("Telefone deve ter DDD e 10 ou 11 dígitos.");
      return;
    }
    setSalvando(true);
    try {
      const body = {
        ...form,
        cnpj: onlyDigits(form.cnpj),
        inscricaoEstadual: form.inscricaoEstadual.trim().toUpperCase() === "ISENTO" ? "ISENTO" : onlyDigits(form.inscricaoEstadual),
        cep: onlyDigits(form.cep),
        codigoMunicipio: onlyDigits(form.codigoMunicipio),
        telefone: form.telefone ? onlyDigits(form.telefone) : null,
        uf: form.uf.trim().toUpperCase(),
        crt: Number(form.crt),
        serieNfe: Number(form.serieNfe) || 1,
        serieCte: Number(form.serieCte) || 1,
        serieMdfe: Number(form.serieMdfe) || 1,
        rntrc: form.rntrc || null,
        modalidadeFrete: Number(form.modalidadeFrete) || 9,
        provedorToken: token.trim() || undefined,
      };
      const saved = selectedId
        ? await api.put<EmitenteFiscal>(`/config/emitentes-fiscais/${selectedId}`, body)
        : await api.post<EmitenteFiscal>("/config/emitentes-fiscais", body);
      setForm({ ...empty, ...saved });
      setTokenOk(!!saved.provedorTokenConfigurado);
      setToken("");
      setSelectedId(saved.id ?? null);
      await carregar(saved.id);
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
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <label className="text-sm flex-1 min-w-64">
          <span className="block text-gray-700 mb-1">Empresa emissora</span>
          <select
            className="input-field"
            value={selectedId ?? ""}
            onChange={(e) => selecionar(emitentes.find((row) => row.id === Number(e.target.value)) || null)}
          >
            {emitentes.length === 0 ? <option value="">Nenhuma empresa cadastrada</option> : null}
            {emitentes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.nomeFantasia || row.razaoSocial} — {row.cnpj}{row.padrao ? " (padrão)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-secondary" onClick={() => selecionar(null)}>
          Adicionar empresa
        </button>
      </div>
      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2 flex flex-wrap gap-4 rounded-lg border border-gray-200 p-3">
          {([
            ["ativo", "Empresa ativa"],
            ["padrao", "Empresa padrão"],
            ["habilitaNfe", "NF-e"],
            ["habilitaCte", "CT-e"],
            ["habilitaMdfe", "MDF-e"],
          ] as const).map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={!!form[field]} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">CNPJ *</span>
          <span className="flex gap-2">
            <input required value={form.cnpj} onChange={(e) => { setForm((p) => ({ ...p, cnpj: maskCnpj(e.target.value) })); setUltimoCnpjBuscado(""); }} onBlur={() => void buscarCnpj()} className="input-field" placeholder="00.000.000/0000-00" maxLength={18} inputMode="numeric" />
            <button type="button" className="btn-secondary whitespace-nowrap" disabled={buscandoCnpj || !isValidCnpjDigits(form.cnpj)} onClick={() => void buscarCnpj()}>
              {buscandoCnpj ? "Buscando…" : "Buscar CNPJ"}
            </button>
          </span>
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Inscrição estadual *</span>
          <input required value={form.inscricaoEstadual} onChange={(e) => setForm((p) => ({ ...p, inscricaoEstadual: e.target.value.toUpperCase().replace(/[^\dA-Z]/g, "").slice(0, 10) }))} className="input-field" placeholder="10 dígitos ou ISENTO" maxLength={10} />
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
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Provedor fiscal</span>
          <select
            className="input-field"
            value={form.provedor}
            onChange={(e) => {
              setForm((p) => ({ ...p, provedor: e.target.value as EmitenteFiscal["provedor"] }));
              setToken("");
              setTokenOk(false);
            }}
          >
            <option value="notaas">Nôtaas</option>
            <option value="focusnfe">Focus NFe</option>
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
          <input required value={form.uf} onChange={(e) => setForm((p) => ({ ...p, uf: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) }))} className="input-field" maxLength={2} />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">CEP *</span>
          <span className="flex gap-2">
            <input required value={form.cep} onChange={(e) => { setForm((p) => ({ ...p, cep: maskCep(e.target.value) })); setUltimoCepBuscado(""); }} onBlur={() => void buscarCep()} className="input-field" placeholder="00000-000" maxLength={9} inputMode="numeric" />
            <button type="button" className="btn-secondary whitespace-nowrap" disabled={buscandoCep || onlyDigits(form.cep).length !== 8} onClick={() => void buscarCep()}>
              {buscandoCep ? "Buscando…" : "Buscar CEP"}
            </button>
          </span>
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Código IBGE *</span>
          <input required value={form.codigoMunicipio} onChange={(e) => setForm((p) => ({ ...p, codigoMunicipio: onlyDigits(e.target.value).slice(0, 7) }))} className="input-field" maxLength={7} inputMode="numeric" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Telefone</span>
          <input value={form.telefone ?? ""} onChange={(e) => setForm((p) => ({ ...p, telefone: maskPhone(e.target.value) }))} className="input-field" placeholder="(41) 99999-9999" maxLength={15} inputMode="tel" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Série NF-e</span>
          <input type="number" min={1} value={form.serieNfe} onChange={set("serieNfe")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">RNTRC (CT-e / MDF-e)</span>
          <input value={form.rntrc ?? ""} onChange={set("rntrc")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Série CT-e</span>
          <input type="number" min={1} value={form.serieCte ?? 1} onChange={set("serieCte")} className="input-field" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Série MDF-e</span>
          <input type="number" min={1} value={form.serieMdfe ?? 1} onChange={set("serieMdfe")} className="input-field" />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="block text-gray-700 mb-1">Natureza da operação</span>
          <input value={form.naturezaOperacao ?? ""} onChange={set("naturezaOperacao")} className="input-field" />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="block text-gray-700 mb-1">
            {form.provedor === "notaas" ? "Chave de API Nôtaas" : "Token Focus NFe"} {tokenOk ? "(já configurado — deixe em branco para manter)" : ""}
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
        O certificado A1 e o ambiente ficam configurados no projeto do provedor. O frete da venda não entra na NF-e.
      </p>
      <button type="submit" className="btn-primary" disabled={salvando}>
        {salvando ? "Salvando…" : selectedId ? "Salvar empresa" : "Cadastrar empresa"}
      </button>
    </form>
  );
}
