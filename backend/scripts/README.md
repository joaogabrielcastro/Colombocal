# Scripts utilitários

Esta pasta é **migração one-off / legado** (Access/MDB, CSV, Python). Não faz parte do runtime da API nem do deploy diário. Se o projeto já migrou e não precisa reimportar, pode **mover** este conteúdo para um repositório ou arquivo separado e manter aqui só um `README` com o histórico.

## Migração a partir de sistema legado

Arquivos Python (`import_legacy_*.py`), exports CSV em `legacy_exports/` e JSON de plano/perfil (`legacy_import_plan.json`, `legacy_*_profile.json`) foram usados para **importação pontual** de dados antigos para o schema Prisma atual.

Se a migração já foi concluída em produção:

- Pode **arquivar** esta pasta fora do repositório principal ou mantê-la apenas como referência histórica.
- Os comandos npm `legacy:*` no `package.json` do backend continuam disponíveis para reexecução manual, se necessário.

## Comandos npm (backend)

| Script | Função |
|--------|--------|
| `npm run legacy:mdb-notes` | Notas / inspeção MDB legado |
| `npm run legacy:plan` | Gera plano de import a partir dos CSV |
| `npm run legacy:import:dry` | Simula import |
| `npm run legacy:import:apply` | Aplica import (limites configuráveis no script) |

Não é necessário para operação diária do sistema em produção.
