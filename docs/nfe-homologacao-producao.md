# NF-e — homologação e produção

Checklist para ligar a emissão de NF-e (modelo 55) no Colombocal. O sistema **não** guarda certificado A1: ele fica no provedor (Focus NFe ou equivalente).

## 1. Contador (antes de emitir a primeira nota)

Confirme e cadastre no sistema:

- **CRT** do emitente: 1 Simples Nacional, 2 Simples (excesso), 3 Regime Normal
- **NCM** de cada produto (exemplos comuns de cal, *sempre validar*):
  - Cal virgem: `25221000`
  - Cal hidratada: `25222000`
- **CFOP** intra/interestadual (revenda típica: `5102` / `6102`; indústria: `5101` / `6101`)
- **CSOSN** (Simples, ex. `102`) ou **CST** (regime normal)
- **IE** de todos os clientes PJ (ou `ISENTO` + indicador 2)
- Código **IBGE** do município do emitente e dos clientes (7 dígitos)

Frete da venda **não entra** na NF-e (permanece no recibo interno).

## 2. Provedor

1. Abrir conta na [Focus NFe](https://focusnfe.com.br) (ou Nuvem Fiscal / PlugNotas — exige outro adapter).
2. Enviar o **certificado A1** da empresa no painel do provedor.
3. Copiar o **token** da empresa.
4. No Colombocal: Configurações → marcar **Habilitar emissão de NF-e** → Dados fiscais do emitente (colar o token).
5. Ambiente: começar em **homologação**.

Até esse checkbox ser marcado, a produção opera **só venda sem nota** (sem rádio Com NF-e e sem botão de emitir). Depois do certificado, ligue o módulo para aparecerem as duas opções.

Variáveis de ambiente úteis no backend:

```
NFE_PROVIDER=focusnfe
FOCUS_NFE_TOKEN=          # fallback se o token não estiver no emitente
FOCUS_NFE_AMBIENTE=homologacao
NFE_WEBHOOK_SECRET=       # obrigatório em produção
# opcional: liga NF-e por slug sem passar pela tela (não use até ter certificado)
# NFE_TENANT_SLUGS=default,colombocal
```

Webhook do provedor: `POST https://<api>/api/webhooks/nfe` com header `x-webhook-token: <NFE_WEBHOOK_SECRET>`.

Em testes automatizados o provedor é `mock` (`NFE_PROVIDER=mock` ou `NODE_ENV=test`).

### Idempotência da `ref`

A referência enviada ao Focus **não** usa relógio. Formato:

- primeira emissão da venda: `venda-{tenantId}-{vendaId}`
- reemissão após cancelar/rejeitar confirmados: `venda-{tenantId}-{vendaId}-t2`, `-t3`, …

Timeout, 502/503 ou erro de rede **mantêm** a nota local em `processando` e **reutilizam** a mesma `ref`. Antes de um novo POST, o sistema consulta essa `ref` no provedor. Se a NF-e já existir, o status local é sincronizado e não há segunda emissão.

## 3. Homologação SEFAZ

1. Preencher emitente, produtos (NCM/CFOP/CSOSN) e um cliente com endereço/IE/CEP/IBGE.
2. Criar uma venda de teste: **Sem nota** (padrão) ou **Com NF-e**. Também dá para emitir depois na tela da venda (**Emitir NF-e**). A venda é gravada mesmo se a nota falhar.
3. Conferir status, DANFE e XML.
4. Testar **Cancelar NF-e** (justificativa ≥ 15 caracteres) e rejeição (cadastro incompleto).
5. Só então pedir ao contador para validar o XML.

## 4. Produção

0. Com o certificado A1 no provedor, em Configurações marque **Habilitar emissão de NF-e** e salve. Só então a nova venda mostra as opções **Sem nota** e **Com NF-e**.
1. Certificado A1 válido no provedor.
2. Trocar ambiente do emitente para **produção** (e `FOCUS_NFE_AMBIENTE=producao` se usar env).
3. Definir `NFE_WEBHOOK_SECRET`.
4. Emitir a primeira nota real com o contador acompanhando.
5. Numeração: a série/número é do provedor/SEFAZ — **nunca** use o `#` da venda.

## 5. Operação no dia a dia

- A venda continua sendo a ordem comercial (estoque, título, frete, O.S., OC).
- NF-e autorizada **bloqueia** editar e cancelar a venda. Cancele a nota primeiro (prazo SEFAZ, em geral 24h) ou use nota de devolução depois.
- Cancelar NF-e ≠ cancelar venda.
- Um token/certificado por empresa (tenant). Não misture em variável global se houver mais de um CNPJ.

## 6. Fechamento Fiscal Mensal

O menu **Fiscal** (quando a feature NF-e está ligada e o usuário tem permissão `fiscal`) oferece:

- **Notas fiscais** — histórico com filtros (período, status, número, série, cliente, documento, venda, chave), resumo do período e detalhe com XML/DANFE quando disponíveis.
- **Fechamento fiscal** — resumo do mês/período, possíveis lacunas de numeração (apenas alerta para investigação, **não** classificação automática de erro), listagem de canceladas/rejeitadas, exportação Excel e **pacote contábil** (ZIP com `relatorio-nfe.xlsx`, XMLs disponíveis e `README.txt`).

O fechamento reúne as NF-e do período e permite exportar os dados necessários para conferência e envio à contabilidade.

**O relatório não substitui obrigações acessórias ou escrituração fiscal realizada pelo contador.**

Data de referência do período: `autorizadaEm`, senão `emitidaEm`, senão `createdAt`.  
Valor autorizado: soma de `venda.valorTotal` apenas de notas com status `autorizada` (canceladas/rejeitadas/processando ficam de fora).

Dependência de empacotamento ZIP: `archiver@7.0.1` (exato; a API v8 não é compatível com o processor atual).

Emissão incerta (`NFE_STATUS_INCERTO`) **não** é status persistido: a nota permanece em `processando` e não entra no valor autorizado.

Em ambiente de **homologação**, a UI exibe o aviso de demonstração sem validade fiscal.

## Fora deste módulo (backlog fiscal)

- NFC-e, NFS-e, nota de entrada, devolução (CFOP 1202/2202)
- Carta de correção (CC-e)
- **Inutilização** de numeração (quando existir, o fechamento deve considerar as faixas inutilizadas ao avaliar lacunas)
- SPED / obrigações acessórias
- Persistência local do XML (hoje o XML é obtido via URL do provedor no momento do download)
- Alíquotas/valores de ICMS, PIS e COFINS no cadastro (o sistema envia/exibe NCM, CFOP, CST/CSOSN)
