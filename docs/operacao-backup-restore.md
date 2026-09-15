# Operação de backup e restore

Este playbook descreve o que o **repositório** documenta e o que **ainda precisa ser validado no Coolify/produção**.

Não trate este ficheiro como prova de que o backup de produção está a funcionar.

## VERIFICADO NO CÓDIGO

- Não há job de backup implementado na aplicação (nem cron no `docker-compose.yml`).
- O Postgres de desenvolvimento usa o volume Docker `colombocal_pgdata`.
- Tokens fiscais (`EmitenteFiscal.provedorToken`) ficam **criptografados em repouso** (AES-256-GCM) quando `FISCAL_TOKEN_ENCRYPTION_KEY` está definida. O backup do PostgreSQL contém o **ciphertext**, não o token em claro.
- **O backup do banco sozinho não é suficiente para recuperar tokens fiscais.** A chave `FISCAL_TOKEN_ENCRYPTION_KEY` precisa ser preservada separadamente (secret manager / Coolify secrets) e com segurança. Sem a mesma chave, o restore não consegue emitir NF-e com o token do emitente.
- Hashes de senha e hashes de tokens de reset também ficam no PostgreSQL: trate backups como dado confidencial.
- Após restore em ambiente novo: confirme `FISCAL_TOKEN_ENCRYPTION_KEY`, `JWT_SECRET` e secrets de e-mail/webhook no painel.
- Tokens legados em texto puro: `npm run fiscal:encrypt-existing-tokens` (idempotente; nunca imprime o token).
- Reset financeiro legado (`reset-financeiro-legacy`) não deve ser usado em produção sem backup validado (`ENABLE_LEGACY_RESET_API` + secret).
- Health checks da API: `GET /health` e `GET /ready`.

## PRECISA SER VALIDADO NO COOLIFY/PRODUÇÃO

O ambiente real (Coolify) não foi inspecionado nesta fase. Confirme no painel:

1. **Onde o backup é gerado** — snapshot do volume/Postgres do Coolify, backup do provedor (Hetzner, etc.) ou ambos.
2. **Onde é armazenado** — região, bucket, retenção no painel.
3. **Retenção** — quantos dias/semanas; se há backup off-site.
4. **Como restaurar** — runbook do Coolify/provedor para volume ou dump SQL.
5. **Como validar o restore** — nunca por cima de produção na primeira vez.

## Frequência sugerida

- Backup: diário (pelo provedor), se estiver ligado.
- Teste de restore: 1× por mês, em banco temporário de homologação.

## Procedimento prático de restore (homologação)

1. **Gerar backup** — snapshot Coolify/provedor ou `pg_dump` (sem incluir secrets do `.env`).
2. **Armazenar backup** — bucket/retenção definidos no painel.
3. **Armazenar chave separadamente** — `FISCAL_TOKEN_ENCRYPTION_KEY` no secret manager (nunca no dump).
4. **Criar banco novo** — volume/instância temporária (nunca em cima de PRD na 1ª vez).
5. **Restaurar** dump/snapshot no banco novo.
6. **Migrations** — `npx prisma migrate deploy` se o dump não incluir schema completo.
7. **Configurar variáveis** — `DATABASE_URL`, `JWT_SECRET`, `FISCAL_TOKEN_ENCRYPTION_KEY` (mesma da origem), `NFE_WEBHOOK_SECRET`, SMTP/`APP_PUBLIC_URL` se reset ligado.
8. **Iniciar aplicação**.
9. **Healthcheck** — `/health` ok; `/ready` ready.
10. **Login** — usuário de teste.
11. **Decrypt fiscal** — GET emitente (admin) com `provedorTokenConfigurado: true`; emissão mock/homolog se aplicável. **Não logar o token.**
12. **Operação** — listar clientes, uma venda, um título.

### Evidência local (dev)

```bash
cd backend
npm run go-live:backup-restore-check
```

Confirma dump sem plaintext/chave e decrypt após persistência. **Não substitui** restore Coolify.

> Sem `FISCAL_TOKEN_ENCRYPTION_KEY`, o banco restaurado não consegue descriptografar os tokens fiscais.

## Checklist SQL no banco restaurado

```sql
SELECT COUNT(*) AS clientes FROM "Cliente";
SELECT COUNT(*) AS vendas FROM "Venda";
SELECT COUNT(*) AS pagamentos FROM "Pagamento";
SELECT COUNT(*) AS cheques FROM "Cheque";
SELECT COUNT(*) AS titulos FROM "TituloReceber";
SELECT COUNT(*) AS notas FROM "NotaFiscal";
```

Esperado: contagens coerentes com o período do backup, sem erro de integridade.

## Incidente real (restore em PRD)

1. Janela de manutenção.
2. Restaurar conforme runbook do Coolify/provedor.
3. Subir backend e validar `health`/`ready`.
4. Validar login, clientes, conta corrente, venda, cheque, consulta de NF-e.
5. Comunicar conclusão.

## Observações de segurança

- Nunca executar `reset-financeiro-legacy` sem backup validado.
- Reset em PRD exige aprovação dupla (técnica + negócio).
- Backups do PostgreSQL incluem `provedorToken` **cifrado** (formato `v1:…`). Preserve `FISCAL_TOKEN_ENCRYPTION_KEY` fora do dump SQL.
