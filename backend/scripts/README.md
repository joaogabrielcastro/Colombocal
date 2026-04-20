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

## Corrigir CNPJ a partir dos bancos Access legados

O import antigo gera CNPJ sintético (`99…` dígitos) a partir do código legado. Para **varrer** os `.mdb` reais (os arquivos `.ldb` na pasta são só lock do Access — use o `.mdb` ou `.accdb`), gerar um mapa e **atualizar** o PostgreSQL:

```bash
cd backend
pip install pyodbc psycopg[binary]

# 1) Gerar mapa (use os .mdb/.accdb — os .ldb são só lock; ou use CSV já exportado)
python scripts/legacy_scan_and_fix_cnpj.py scan --mdb E:/BdGeral.mdb --mdb E:/Movime2.mdb --mdb E:/N_Siste.mdb --password "" --out scripts/legacy_cnpj_map.csv
# Alternativa sem ODBC: exporte Geral.csv do Access e rode:
# python scripts/legacy_scan_and_fix_cnpj.py scan --csv E:/pasta/Geral.csv --out scripts/legacy_cnpj_map.csv

# 2) Ver quantos clientes ainda estão “legado” no banco novo
python scripts/legacy_scan_and_fix_cnpj.py report --env .env

# 3) Simular correções, depois aplicar (use o .cleaned.csv após o filter-map)
python scripts/legacy_scan_and_fix_cnpj.py apply --env .env --map scripts/legacy_cnpj_map.cleaned.csv
python scripts/legacy_scan_and_fix_cnpj.py apply --env .env --map scripts/legacy_cnpj_map.cleaned.csv --apply
# Opcional: também criar clientes que estão no mapa mas nunca tiveram placeholder no import:
# python scripts/legacy_scan_and_fix_cnpj.py apply --env .env --map scripts/legacy_cnpj_map.cleaned.csv --create-missing --apply
```

Você pode editar o CSV manualmente antes do `apply`. Linhas com CNPJ inválido ou conflito com outro cliente são ignoradas e listadas no console.

### Problemas comuns (Windows)

- **`CSV não encontrado`:** o caminho `E:/export/Geral.csv` precisa existir de verdade. Copie o `Geral.csv` para uma pasta que você confirme no Explorer e use aspas, por exemplo:  
  `--csv "C:\Users\seu_usuario\Desktop\Geral.csv"`

- **`failed to resolve host` / DNS:** o `DATABASE_URL` do `.env` aponta para um Postgres na nuvem cujo hostname só funciona na rede do provedor (ou com VPN). Neste PC, use uma destas opções:  
  - `set DATABASE_URL=postgresql://usuario:senha@localhost:5432/nome_do_banco` (PowerShell: `$env:DATABASE_URL="..."`) apontando para um banco local ou túnel;  
  - ou `python scripts/legacy_scan_and_fix_cnpj.py report --database-url "postgresql://..."`;  
  - ou rode o script no mesmo ambiente onde o backend já conecta (ex.: servidor / CI).

- **`legacy_cnpj_map.csv` não existe:** o `scan` precisa concluir com sucesso antes do `apply`. Sem CSV de origem válido, o mapa não é gerado.

- **Mapa com linhas estranhas (`scan_celula:DATA`, valores tipo `20110809000000`):** são datas do Access confundidas com CNPJ. Reescaneie com a versão atual do script **ou** limpe o CSV sem reabrir o pendrive:

  `python scripts/legacy_scan_and_fix_cnpj.py filter-map --in scripts/legacy_cnpj_map.csv --out scripts/legacy_cnpj_map.cleaned.csv --drop-scan-celula`

  Use o `.cleaned.csv` no `apply`.

- **Nome, telefone, cidade e UF no mapa e no `apply`:** o `scan` preenche **`nome`**, **`telefone`**, **`cidade`** e **`estado`** quando essas colunas existirem no Access/CSV (`NOME/RAZAO/FANT`, `TELEFONE/FONE/TEL`, `CIDADE/MUNICIPIO`, `UF/ESTADO`). O `apply` atualiza `razaoSocial`/`nomeFantasia` com `nome` e também atualiza `telefone`, `cidade` e `estado` quando vierem preenchidos no mapa.

- **Inativar só os cadastros placeholder legados** (não apaga; some da lista de ativos como o botão Excluir):

  `python scripts/legacy_scan_and_fix_cnpj.py deactivate-legacy --env .env`

  Depois de conferir a lista: `... deactivate-legacy --env .env --apply`

  Critério: `razaoSocial` tipo “Cliente legado%”, ou `nomeFantasia` “CL %” com CNPJ `99%`, ou CNPJ `99%` com `[LEGACY_CLIENTE:` nas observações. Rode o **`apply` do CNPJ antes** se quiser manter quem já foi corrigido para CNPJ real.
