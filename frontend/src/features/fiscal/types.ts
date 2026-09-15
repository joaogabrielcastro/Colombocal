export type FiscalNotaLista = {
  id: number;
  vendaId: number;
  status: string;
  serie: number | null;
  numero: number | null;
  chaveAcesso: string | null;
  protocolo: string | null;
  motivoRejeicao: string | null;
  emitidaEm: string | null;
  autorizadaEm: string | null;
  canceladaEm: string | null;
  dataReferencia: string | null;
  valor: number;
  temDanfe?: boolean;
  temXml?: boolean;
  cliente: {
    id: number;
    nome: string;
    cnpj: string | null;
    cpf: string | null;
  } | null;
  venda: {
    id: number;
    numeroVenda: number | null;
    valorTotal: number;
  } | null;
};

export type FiscalResumo = {
  total: number;
  autorizadas: number;
  canceladas: number;
  rejeitadas: number;
  processando: number;
  denegadas: number;
  rascunho: number;
  emissaoIncerta: number;
  valorAutorizado: number;
  ambiente?: string;
  observacaoEmissaoIncerta?: string;
  periodo?: { dataInicio: string | null; dataFim: string | null };
};

export type FiscalLacuna = {
  serie: number;
  numerosAusentes: number[];
  label: string;
};

export type FiscalFechamento = {
  geradoEm: string;
  ambiente: string;
  empresa: {
    razaoSocial: string;
    nomeFantasia: string | null;
    cnpj: string;
  } | null;
  tenant: { id: number; name: string; slug: string | null } | null;
  periodo: { dataInicio: string; dataFim: string };
  resumo: FiscalResumo;
  observacaoEmissaoIncerta?: string;
  disclaimer: string;
  lacunas: FiscalLacuna[];
  documentos: FiscalNotaLista[];
  canceladas: Array<FiscalNotaLista & { motivoCancelamento?: string | null }>;
  rejeitadas: Array<FiscalNotaLista & { motivoRejeicao?: string | null }>;
};

export type FiscalNotaDetalhe = {
  nota: FiscalNotaLista & { motivoCancelamento?: string | null };
  ambiente: string;
  emitente: {
    razaoSocial: string;
    nomeFantasia: string | null;
    cnpj: string;
    ambiente: string;
  } | null;
  venda: {
    id: number;
    numeroVenda: number | null;
    dataVenda: string;
    valorTotal: number;
    cliente: {
      id: number;
      nomeFantasia: string | null;
      razaoSocial: string;
      cnpj: string | null;
      cpf: string | null;
    } | null;
    vendedor: { id: number; nome: string } | null;
    itens: Array<{
      id: number;
      quantidade: number;
      precoUnitario: number;
      produto: {
        id: number;
        codigo: string;
        nome: string;
        ncm: string | null;
        cfopPadraoDentro: string | null;
        cfopPadraoFora: string | null;
        cst: string | null;
        csosn: string | null;
      } | null;
    }>;
  } | null;
  fiscalItens: Array<{
    numeroItem: string;
    codigoProduto: string | null;
    descricao: string | null;
    cfop: string | null;
    ncm: string | null;
    cst: string | null;
    csosn: string | null;
    quantidade: string | null;
    valorBruto: number | null;
  }>;
};

export type FiscalFiltros = {
  dataInicio: string;
  dataFim: string;
  status?: string;
  numero?: string;
  serie?: string;
  clienteId?: string;
  documento?: string;
  venda?: string;
  chave?: string;
};
