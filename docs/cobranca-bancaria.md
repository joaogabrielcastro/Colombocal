# Cobrança bancária e condições de pagamento (ASE FINANCEIRO 5.3)

## Arquitetura

```text
Cliente → condição padrão + banco padrão
   ↓
Venda (snapshot da condição e do banco)
   ↓
Parcelas → TituloReceber (SSOT financeiro)
   ↓
Pagamentos / cheques (fluxo existente)
   ↓
NF-e autorizada → CobrancaBancaria → boleto (instrumento de cobrança)
```

- **Título** = obrigação financeira (fonte da verdade).
- **Boleto / cobrança** = instrumento bancário vinculado 1:1 ao título.
- Baixa financeira continua **manual** no Colombocal (sem retorno automático do banco nesta fase).

## Condições de pagamento

Modelo `CondicaoPagamento` por tenant:

- `nome` (ex.: `15/30/45`)
- `diasParcelas` (ex.: `[15, 30, 45]`)
- `ativo`

Na criação da venda:

1. condição do payload, senão do cliente, senão fallback `30`;
2. snapshot gravado na venda (`condicaoPagamentoNome`, `condicaoPagamentoDias`);
3. títulos gerados com divisão igual; **última parcela absorve centavos**;
4. vencimentos em **dias corridos** a partir de `dataVenda`.

Alterar a condição no cadastro do cliente **não** recalcula vendas antigas.

## Bancos

Uma empresa pode ter **Bradesco** e **Sicredi** ao mesmo tempo (`ConfiguracaoBancaria` unique por `(tenantId, banco)`).

Cada cobrança guarda o banco efetivamente usado (snapshot).

### Providers

| Banco    | Classificação nesta fase | Notas |
|----------|--------------------------|--------|
| Sicredi  | Preparado + Mock         | API Cobrança (portal Sicredi Developers). OAuth2 + `x-api-key`. PDF via API quando configurado. |
| Bradesco | Preparado + Mock         | Portal Bradesco Developers / OpenAPIs Cobrança. Sem credencial → `NAO_CONFIGURADO`. PDF: só se o banco fornecer. |

Env:

- `BRADESCO_PROVIDER=mock|api`
- `SICREDI_PROVIDER=mock|api`

Em **produção**, `*_PROVIDER=mock` é bloqueado no startup.

Sem configuração/credencial válida: status `NAO_CONFIGURADO` — **não** fingir registro bancário.

Secrets: AES-256-GCM (mesmo padrão do token fiscal). Nunca no frontend, logs ou respostas GET.

## NF-e → boleto

Após transição para NF-e `autorizada` (emit / consult / webhook):

1. cria cobranças `PENDENTE` por título (idempotente);
2. tenta registrar no provider;
3. falha do banco **não** altera a NF-e.

Retry: `POST /api/cobrancas/:id/registrar` sem duplicar título nem NF-e.

## Idempotência

- Unique `CobrancaBancaria.tituloId`
- Unique `(tenantId, idempotencyKey)` com chave `cobranca:titulo:{tituloId}`

## Status de cobrança

`PENDENTE` | `PROCESSANDO` | `REGISTRADA` | `DISPONIVEL` | `ERRO` | `CANCELADA`

## Impressão

Pacote da venda: DANFE + boletos disponíveis. Sem PDF/registro: mensagem clara, sem layout inventado.

## Homologação / produção

1. Contratar produto Cobrança Online na cooperativa/banco.
2. Obter credenciais no portal oficial.
3. Configurar no Colombocal (admin) — ambiente homologação primeiro.
4. Testar registro + PDF (Sicredi) / linha digitável (Bradesco).
5. Só então ativar produção.

---

## ASE FINANCEIRO 5.3 — RESULTADO (implementação)

### 1. Implementado

- Condições de pagamento por tenant + snapshot na venda
- Parcelamento automático em `TituloReceber` (SSOT preservado)
- `ConfiguracaoBancaria` + `CobrancaBancaria` (1:1 com título)
- Providers Bradesco/Sicredi (preparados) + mock para test/dev
- Hook `onNfeAutorizada` (emit/consult/webhook) → cobranças sem acoplar falha à NF-e
- API `/api/cobrancas`, `/api/config/bancaria`, `/api/config/condicoes-pagamento`
- UI cliente/venda/cobranças
- Testes unitários de parcelamento, providers, idempotência, prod mock block
- E2E Playwright `cobranca-boleto.spec.js`
- Doc `docs/cobranca-bancaria.md`

### 2–4. Condições / Parcelamento / Títulos

Conforme seções acima. Fallback condição `30`. Última parcela absorve centavos.

### 5. Bradesco

```text
Preparado
Mock
Pendente de credencial
Pendente de homologação
```

### 6. Sicredi

```text
Preparado
Mock
Pendente de credencial
Pendente de homologação
```

### 7–9. Boletos / NF-e → Boleto / Impressão

Boleto via mock em test; PDF real depende do banco. NF-e autorizada independente. UI mostra status e link de boleto quando `pdfRef` existir.

### 10. Duplicatas

```text
NÃO IMPLEMENTADO — CONHECIMENTO INSUFICIENTE — VALIDAR COM CLIENTE
```

### 11. CNAB

```text
NÃO IMPLEMENTADO — CONHECIMENTO INSUFICIENTE — VALIDAR COM CLIENTE/BANCO
```

Integração escolhida: API-first.

### 12–14. Segurança / Multi-tenant / Migrations

Secrets AES-GCM (padrão fiscal). Tenant via JWT. Migration `20260918040000_ase_financeiro_5_3_cobranca`.

### 15. Testes (números reais da suíte ASE 5.3 local)

```text
Backend ASE 5.3 + regressões relacionadas: 44 passing / 0 failing
(parcelamento, billing-providers, cobranca-idempotencia, financeiro-usecases, recebiveis, nav, fiscal-token)
E2E: spec cobranca-boleto.spec.js criado (execução depende de ambiente e2e/DB)
Migration: arquivo SQL criado — apply via prisma migrate deploy no ambiente com DB
Build: Prisma client generate OK
```

### 16. Pendências

```text
PENDENTE DE CONFIGURAÇÃO — credenciais Bradesco/Sicredi nos portais
PENDENTE DE HOMOLOGAÇÃO — HTTP real contra collection oficial
PENDENTE DE INFORMAÇÃO DO CLIENTE — duplicata, CNAB/remessa/retorno
BACKLOG — layout PDF Bradesco se banco não fornecer PDF
```

### 17. Veredito

```text
PRONTO COM PENDÊNCIAS
```

Não considerar integração bancária pronta em produção sem credencial/homologação.

---

## Limitações desta fase

- Sem baixa automática / webhook de liquidação.
- Sem juros/multa/desconto calculados no Colombocal (banco configura).
- Sem CNAB remessa/retorno.
- Sem entidade “Duplicata”.
- Mock proibido em produção.

---

## PENDÊNCIAS A VALIDAR COM O CLIENTE

### Duplicata

```text
CONHECIMENTO INSUFICIENTE — VALIDAR COM CLIENTE
```

Significado operacional (parcela? documento impresso? numeração própria?) ainda não confirmado. **Não implementado.**

### CNAB

```text
CONHECIMENTO INSUFICIENTE — VALIDAR COM CLIENTE/BANCO
```

Não há confirmação se o cliente usa CNAB 240/400, remessa ou retorno. Integração desta fase é **API-first**. CNAB fica como fase separada se necessário.

### Remessa / Retorno

```text
CONHECIMENTO INSUFICIENTE — VALIDAR
```

### Credenciais

```text
PENDENTE DE CONFIGURAÇÃO / HOMOLOGAÇÃO
```

Verificar se a conta já possui API de cobrança Bradesco e Sicredi habilitada nos portais oficiais.

### Formato de impressão da duplicata

```text
PENDENTE DE INFORMAÇÃO DO CLIENTE
```

---

## Fontes oficiais consultadas (referência)

- Bradesco Developers / OpenAPIs: https://api.bradesco/
- Sicredi Developers — API Cobrança: https://developer.sicredi.com.br

Endpoints HTTP concretos só devem ser usados a partir da documentation/collection do portal do cliente — **não inventar**.
