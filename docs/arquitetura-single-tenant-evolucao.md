# Arquitetura Single-Tenant - Evolucao

## Objetivo

Evoluir o sistema para um padrao profissional, mantendo operacao single-tenant, com foco em:

- qualidade de codigo
- performance
- consistencia de UX
- manutencao simples

## Arquitetura alvo (incremental)

```text
backend/src
  http/
    routes/
    controllers/
  application/
    use-cases/
  domain/
    financeiro/
    vendas/
    cheques/
  infra/
    prisma/
      repositories/
  shared/
    errors/
    validation/
    utils/

frontend/src
  app/
  features/
    cheques/
    vendas/
    clientes/
    relatorios/
  components/
    ui/
  lib/
    api/
    domain/
```

## Regras para o backend

1. `routes` apenas parseia request/response e chama use-case.
2. Regra de negocio fica em `domain` e `application/use-cases`.
3. Prisma fica em repositorios (`infra/prisma/repositories`), nao em rotas.
4. Validacao de entrada deve usar Zod em 100% dos endpoints.
5. Erros devem seguir padrao unico:
   - `code`
   - `message`
   - `httpStatus`

## Regras para o frontend

1. Paginas em `app/` devem ser finas (composicao + hooks).
2. Logica de dominio vai para `features/*/hooks` e `lib/domain`.
3. Fluxos de listagem devem usar componentes padrao:
   - `FilterBar`
   - `ListScaffold`
   - `ExportActions`
4. Confirmacoes devem usar `ConfirmDialog` (sem `window.confirm`).
5. Erros devem ser tratados por `reportApiError` + toast consistente.

## Plano de execucao

### Fase 1 (imediata)

- Unificar regras financeiras reutilizaveis (saldo/troco).
- Remover duplicacao mais critica em rotas de pagamentos/cheques.
- Padronizar dialogos de confirmacao no frontend.

### Fase 2

- Criar primeiros use-cases:
  - `RegistrarPagamento`
  - `RegistrarCheque`
  - `RegistrarChequeLote`
- Introduzir repositorios Prisma dessas entidades.

### Fase 3

- Extrair paginas grandes para `features/*`.
- Criar camada de server-state com cache e invalidacao.
- Consolidar exportacao PDF/Excel/CSV em utilitarios por dominio.

### Fase 4

- Otimizar consultas de relatorios:
  - agregacoes em lote
  - paginacao server-side obrigatoria
  - indices voltados aos filtros mais usados

## Decisoes de simplificacao (KISS)

- Sem overengineering de microservicos.
- Sem multi-tenant neste momento.
- Sem ACL completa agora; manter base preparada para evolucao futura.
- Foco em poucos fluxos criticos por vez, com testes e mediacao de impacto.
