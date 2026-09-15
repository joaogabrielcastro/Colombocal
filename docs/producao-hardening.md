# Segurança de produção / Coolify — Fase 4

Checklist de go-live. Marque **somente** o que foi validado no ambiente real.
Itens de código/local ficam evidenciados; painel Coolify sem acesso = `PENDENTE`.

## Variáveis reais do projeto (não inventar nomes)

### Backend obrigatório (produção)

| Variável | Notas |
|----------|--------|
| `JWT_SECRET` | Obrigatório — boot falha sem |
| `AUTH_DISABLED` | Deve ser `false`/ausente — boot falha se `true` |
| `FISCAL_TOKEN_ENCRYPTION_KEY` | 32 bytes base64 ou hex 64 — boot falha sem |
| `DATABASE_URL` | Postgres |
| `NFE_WEBHOOK_SECRET` | Obrigatório em produção (Fase 4) |

### Recuperação de senha (`PASSWORD_RESET_ENABLED` ≠ `false`)

| Variável | Notas |
|----------|--------|
| `APP_PUBLIC_URL` ou `FRONTEND_URL` | Links do e-mail |
| `EMAIL_TRANSPORT=smtp` | Obrigatório em prod com reset ligado |
| `EMAIL_FROM` | Remetente |
| `SMTP_HOST` | |
| `SMTP_PORT` | default 587 |
| `SMTP_SECURE` | `true` para 465 |
| `SMTP_USER` / `SMTP_PASS` | se o provedor exigir |

> Não existe `EMAIL_PROVIDER` neste projeto — use `EMAIL_TRANSPORT`.

### Fiscal opcional / Focus

| Variável | Notas |
|----------|--------|
| `NFE_PROVIDER` | `focusnfe` ou `mock` |
| `FOCUS_NFE_TOKEN` | fallback se emitente sem token |
| `FOCUS_NFE_AMBIENTE` | `homologacao` / `producao` |

## Checklist Coolify (manual)

- [ ] HTTPS no domínio público
- [ ] Domínio DNS apontando para o proxy
- [ ] `CORS_ORIGIN` = origem do frontend
- [ ] Secrets no painel (nunca no Git)
- [ ] Health: `/health` e `/ready`
- [ ] Postgres persistente + backup do provedor
- [ ] Redis se `EXPORT_QUEUE_MODE` durable
- [ ] `prisma migrate deploy` no release
- [ ] `npm run fiscal:encrypt-existing-tokens` após deploy da Fase 3/4
- [ ] SMTP real testado (forgot → inbox → reset → login)
- [ ] Restore de homologação com a **mesma** `FISCAL_TOKEN_ENCRYPTION_KEY`

## SMTP — homologação segura

1. Definir SMTP_* + `EMAIL_TRANSPORT=smtp` + `APP_PUBLIC_URL`.
2. Abrir `/esqueci-senha` com usuário real de teste.
3. Confirmar e-mail na caixa (sem copiar token para tickets públicos).
4. Abrir link → `/redefinir-senha` → nova senha.
5. Login com senha nova; sessão JWT antiga deve falhar em `/api/auth/me`.

**Logs esperados (sem segredo):** `Password reset email requested` / `sent` / `failed`.

Se SMTP não estiver disponível neste ambiente de desenvolvimento:

`PENDENTE — validação manual no Coolify`

## Backup ≠ chave

```text
Backup DB          = dump/snapshot (contém ciphertext do token fiscal)
Encryption Key     = FISCAL_TOKEN_ENCRYPTION_KEY (secret manager / Coolify)
```

Sem a chave, o restore sobe a API mas **não** descriptografa tokens do emitente.

## Healthcheck

| Endpoint | Significado |
|----------|-------------|
| `GET /health` | Processo vivo (sem DB) |
| `GET /ready` | DB responde `SELECT 1` (503 se não) |

Não expõem env, JWT, tokens ou connection string.

## Gate go-live

Ver relatório Fase 4. Bloqueadores: SMTP/HTTPS/Coolify/CI remoto não validados = no máximo **GO-LIVE READY COM PENDÊNCIAS**.
