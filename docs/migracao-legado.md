# Migração, legado e scripts excepcionais

Este documento reúne o que **não faz parte do dia a dia** do sistema em produção: importação de dados antigos, resets pontuais e endpoints equivalentes.

## Scripts npm (pasta `backend`)

| Script | Uso |
|--------|-----|
| `legacy:import:plan`, `legacy:import:dry`, `legacy:import:apply` | Pipeline Python de importação CSV → banco novo. Ver comentários em `backend/scripts/`. |
| `legacy:mdb-notes` | Notas/auxiliar para migração MDB; não é operação de rotina. |
| `legacy:reset-financeiro` | **Destrutivo.** Executa `scripts/reset-financeiro-legacy.js` (exige `--confirm`). Apenas migração/correção pontual com backup. |

Não use `legacy:reset-financeiro` como manutenção normal; ele altera cheques, pagamentos e títulos de forma coordenada (ver `src/services/resetFinanceiroLegacy.js`).

## API

- `POST /api/config/reset-financeiro-legacy` — mesmo efeito do script CLI; manter restrito a admins quando houver autenticação.

## Banco

- `db:reset` (Prisma) apaga e recria o schema — apenas desenvolvimento.

Para dúvidas sobre **frete** (Venda vs `FreteMovimento`), veja comentários em `backend/prisma/schema.prisma` nos modelos `Venda` e `FreteMovimento`.
