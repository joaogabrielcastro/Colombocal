/**
 * Migração Access (.mdb) → PostgreSQL (este projeto)
 *
 * Os arquivos E:\Movime2.Mdb e E:\N_Siste.mdb precisam ser inspecionados para mapear
 * tabelas/colunas ao schema Prisma (Cliente, Produto, Venda, Cheque, etc.).
 *
 * Opções comuns no Windows:
 * 1) Abrir o .mdb no Microsoft Access → exportar cada tabela como CSV → scripts de import.
 * 2) Instalar drivers ODBC Microsoft Access e usar DBeaver ou um script Node com `odbc`.
 * 3) No Git Bash/WSL com mdbtools: `mdb-tables arquivo.mdb` e `mdb-export arquivo.mdb TABELA`.
 *
 * Depois de ter CSV ou SQL:
 * - Ajuste DATABASE_URL no .env apontando para Postgres local.
 * - Rode: npx prisma migrate deploy && npx prisma generate
 * - Importe linha a linha respeitando FKs (vendedores e produtos antes de vendas).
 *
 * Este repositório não inclui leitor binário de .mdb para evitar dependências nativas.
 */
console.log(__filename + " — leia o comentário no topo do arquivo para o passo a passo.");
