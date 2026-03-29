# Data Migration (Fora do Core do App)

Esta pasta documenta o processo de migração legado e ajuda a manter o app de produção limpo.

## Princípios

- Scripts de migração não fazem parte do runtime da API.
- Dumps CSV/MDB/planos devem ficar fora de build/deploy.
- Importações devem ser idempotentes e rastreáveis.

## Fluxo recomendado

1. Exportar Access -> CSV (`scripts/export_access_to_csv.py`)
2. Montar/atualizar masters (`scripts/build_master_from_bdgeral.py`)
3. Rodar dry-run e depois apply (`scripts/import_legacy_apply.py`)
4. Validar contagens (`scripts/check_import_counts.py`)

## Observação

Os scripts permanecem em `backend/scripts` por compatibilidade operacional atual.
O objetivo desta pasta é separar claramente o contexto de migração do core da aplicação.
