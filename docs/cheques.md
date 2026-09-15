# Cheques — comportamento real

Este documento descreve o que o código faz hoje. Não descreve um workflow futuro.

## Fluxo atual

```text
Registrar cheque
  → cria Cheque (status "registrado"; legado pode ser "ativo")
  → cria Pagamento tipo "cheque" ligado ao chequeId
  → recalcula títulos do cliente (abate valor pago)
```

Não existe ciclo operacional:

```text
Recebido → Depositado → Compensado / Devolvido
```

Não há endpoint para alterar o status do cheque (depositar/compensar). O campo `dataCompensacao` é preenchido na criação com a data de recebimento e **não** significa liquidação bancária.

## Regras importantes

1. **Abate uma vez** — o impacto financeiro vem do `Pagamento`, não de um segundo lançamento pelo status do cheque.
2. **Exclusão** — `DELETE /api/cheques/:id` remove o pagamento do cheque, limpa trocos órfãos e recalcula títulos.
3. **Troco** — se o valor do cheque excede o saldo da venda, exige `trocoTipo` (dinheiro/transferência) e gera pagamento negativo de troco.
4. **Multi-tenant** — `numeroOrdem` é único por `tenantId`.

## Fase 2 / produto

Um ciclo depositado/compensado só deve ser implementado com decisão explícita de produto e impacto em contas a receber, relatórios e UI. Até lá, labels e documentação devem falar em **cheque registrado** (recebido como pagamento).
