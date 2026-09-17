# CT-e, MDF-e e CIOT — arquitetura fiscal (ASE 5.2)

Documentação do módulo de transporte fiscal no Colombocal. A NF-e permanece no fluxo já endurecido; este documento cobre apenas CT-e, MDF-e e CIOT.

## Visão geral

| Documento | Provider atual | Status produção |
|-----------|----------------|-----------------|
| NF-e | Focus NFe / mock | Integrado |
| CT-e | Focus NFe / mock | Integrado (requer produto CT-e + RNTRC no Focus) |
| MDF-e | Focus NFe / mock | Integrado (inclui **encerrar**) |
| CIOT | mock / `nao_implementado` / stub IPEF | **Não** integrado a IPEF/ANTT reais |

## Domínio operacional reutilizado

- `Motorista`, `FreteMovimento`, `OrdemCarregamento`, `Venda`
- Vínculos com CT-e / MDF-e / CIOT são **opcionais**
- Documentos podem existir independentemente

## Models Prisma

- `ConhecimentoTransporte` (CT-e)
- `ManifestoEletronico` + `ManifestoDocumento` (MDF-e)
- `OperacaoCiot` (CIOT — entidade própria)
- `EmitenteFiscal`: campos `rntrc`, `serieCte`, `serieMdfe`

## Status

### CT-e

`rascunho | processando | autorizada | rejeitada | cancelada | denegada | indisponivel`

### MDF-e

`rascunho | processando | autorizada | rejeitada | cancelada | encerrada | denegada | indisponivel`

**Encerrar ≠ cancelar.** Encerramento chama `POST /v2/mdfe/{ref}/encerrar` no Focus.

### CIOT

`rascunho | processando | registrado | rejeitado | cancelado | encerrado | nao_implementado | indisponivel`

## Idempotência

Refs estáveis (sem `Date.now()`):

- CT-e: `cte-{tenantId}-frete-{freteId}[-tN]` ou `cte-{tenantId}-doc-{id}`
- MDF-e: `mdfe-{tenantId}-doc-{id}[-tN]`
- CIOT: `ciot-{tenantId}-frete-{freteId}[-tN]` ou `ciot-{tenantId}-doc-{id}`

Único por `(tenantId, refProvedor)`. Em erro inconclusivo, status permanece `processando` e a consulta precede nova emissão.

## Providers (env)

```
CTE_PROVIDER=mock|focusnfe     # default: NFE_PROVIDER / test→mock
MDFE_PROVIDER=mock|focusnfe
CIOT_PROVIDER=mock|nao_implementado|ipef
```

- Produção: `CIOT_PROVIDER=mock` é **bloqueado** no startup.
- Token Focus: mesmo AES-256-GCM de `EmitenteFiscal.provedorToken` (+ `FOCUS_NFE_TOKEN` fallback).
- Stub `ipef`: contrato preparado; métodos lançam `CIOT_NAO_IMPLEMENTADO` até configurar IPEF (sem amarrar a eFrete/Extratta).

## API

Base: `/api/fiscal` (JWT + ACL `fiscal`)

- `/cte`, `/cte/:id`, emitir/consultar/cancelar, `/xml`, `/dacte`
- `/mdfe`, `/mdfe/:id`, emitir/consultar/cancelar/`encerrar`, `/xml`, `/damdfe`
- `/ciot`, `/ciot/:id`, registrar/consultar/cancelar

Webhooks (secret `NFE_WEBHOOK_SECRET` ou `FISCAL_WEBHOOK_SECRET`):

- `POST /api/webhooks/cte`
- `POST /api/webhooks/mdfe`

Tenant autenticado é a única fonte de verdade. Cross-tenant → **404**.

## Feature flags

Configurações → módulos: `cte`, `mdfe`, `ciot` (além de `nfe`).  
Fallback env: `CTE_TENANT_SLUGS`, `MDFE_TENANT_SLUGS`, `CIOT_TENANT_SLUGS`.

## Fechamento e pacote contábil

Fechamento retorna `resumoMulti` com contagens/valores **separados** por tipo (não somar NF-e + CT-e + CIOT).

ZIP (job `nfe_pacote_contabil` / alias `fiscal_pacote_contabil`):

```
/fechamento-.../
  /nfe/...
  /cte/...
  /mdfe/...
  /ciot/...
  /relatorios/
  README.txt
```

Sem XML/DACTE/DAMDFE falso. Indisponíveis listados no README.

## Homologação

UI exibe banner de homologação. Mock apenas em desenvolvimento/testes/demonstração.

## Pendências reais

| Tipo | Item |
|------|------|
| BLOQUEADOR (produção CIOT) | Escolher e homologar IPEF ou ANTT; implementar adapter |
| PENDENTE DE CONFIGURAÇÃO | Habilitar produtos CT-e/MDF-e na conta Focus; RNTRC; token |
| PENDENTE DE HOMOLOGAÇÃO | Emissão SEFAZ real CT-e/MDF-e com contador |
| BACKLOG | Payload Focus completo (modais avançados), inutilização, CC-e |

## NF-e

Não refeita nesta fase. Continua como em `docs/nfe-homologacao-producao.md`.
