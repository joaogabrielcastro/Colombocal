# Operacao mensal de backup e restore (PRD)

Este playbook existe para garantir que backup nao seja apenas configurado, mas validado em restauracao real.

## Frequencia

- Backup: diario (automatico pelo provedor)
- Teste de restore: 1x por mes (obrigatorio)

## Antes da janela de restore

- Confirmar snapshot/backup mais recente disponivel.
- Definir banco alvo de homologacao (nunca restaurar por cima de PRD para teste).
- Registrar no changelog interno:
  - data/hora da operacao
  - responsavel
  - backup ID/snapshot ID

## Procedimento (resumo)

1. Criar banco temporario de homologacao para validacao.
2. Restaurar o snapshot de PRD nesse banco temporario.
3. Apontar uma instancia do backend de homologacao para esse banco (DATABASE_URL).
4. Validar:
   - `/health` retorna `ok`
   - `/ready` retorna `ready`
   - tela de clientes carrega
   - relatórios principais retornam dados
5. Registrar evidencias (prints ou logs).
6. Encerrar ambiente temporario para controle de custo.

## Checklist de validacao de dados (SQL)

Executar no banco restaurado:

```sql
SELECT COUNT(*) AS clientes FROM "Cliente";
SELECT COUNT(*) AS vendas FROM "Venda";
SELECT COUNT(*) AS pagamentos FROM "Pagamento";
SELECT COUNT(*) AS cheques FROM "Cheque";
SELECT COUNT(*) AS titulos FROM "TituloReceber";
```

Esperado: contagens coerentes com o periodo de backup e sem erro de integridade.

## Em caso de incidente real (restore em PRD)

1. Ativar janela de manutencao.
2. Restaurar backup para PRD conforme runbook do provedor.
3. Subir backend e validar `health`/`ready`.
4. Validar fluxos criticos:
   - consulta de clientes
   - conta corrente
   - registro de venda
   - registro de cheque
5. Comunicar conclusao para operacao.

## Observacoes de seguranca

- Nunca executar `reset-financeiro-legacy` sem backup validado.
- Para reset em PRD, usar aprovacao dupla (tecnica + negocio).
