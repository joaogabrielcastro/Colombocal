# Plano de ação da auditoria Colombocal

O plano separa correções técnicas de decisões de negócio e propõe mudanças pequenas, revisáveis e reversíveis. Cada PR deve incluir testes de regressão e não deve misturar limpeza ampla com correção financeira/fiscal.

## 1. Correções urgentes

### A1 — Restaurar contrato de CT-e/MDF-e

- Status: **implementado em 1º de outubro de 2026; pendente validação manual em homologação**.
- IDs: COL-003, COL-006.
- Dependências: endpoint de emitentes já existente; decisão de emitente padrão.
- Esforço: pequeno/médio.
- Entrega: seletor reutilizável, envio de `emitenteFiscalId`, validação real de chave de 44 dígitos, mensagens por campo.
- Aceite: ambos os formulários passam validação com emitente elegível; nenhum input é completado/truncado silenciosamente; testes de contrato cobrem 400 e sucesso mockado.

### A2 — Corrigir downloads autenticados

- Status: **implementado em 1º de outubro de 2026; pendente validação com arquivo real do provedor**.
- IDs: COL-007.
- Dependências: cliente API atual.
- Esforço: pequeno.
- Entrega: utilitário de download autenticado por Blob e tratamento de erros.
- Aceite: XML/DACTE baixam com sessão válida, 401 volta para login/mensagem e URL temporária é revogada.

### A3 — Tornar recebimento idempotente e serializado

- Status: **implementado em 2 de outubro de 2026; migration pendente nos ambientes de desenvolvimento/produção**.
- IDs: COL-001.
- Dependências: escolha de idempotency key e estratégia de lock; migration.
- Esforço: médio.
- Entrega em PRs: (1) contrato/chave/índice; (2) lock ou serializable+retry; (3) concorrência e reconciliação.
- Aceite: duas requisições simultâneas e replay geram uma única intenção financeira; nenhum saldo negativo/duplicidade; evento de auditoria identifica replay.

### A4 — Corrigir pacote contábil multiemitente

- Status: implementado em 2026-10-02; pendente somente validação de download com credenciais reais de homologação.
- IDs: COL-004.
- Formato: um ZIP com uma pasta por CNPJ; documentos antigos sem emitente ficam isolados em `_sem-emitente` para conciliação.
- Esforço: médio.
- Aceite atendido: cada XML usa credenciais do emitente do documento; ZIP/planilha identifica CNPJ; falha de um emitente não oculta arquivos dos demais; teste cobre dois emitentes com movimento e um terceiro sem movimento.

### A5 — Impedir regressão de status de webhook

- IDs: COL-005.
- Dependências: documentação de eventos do provider.
- Esforço: médio.
- Entrega: máquina de estados, idempotência de eventos e reconciliação.
- Aceite: duplicata é no-op; evento antigo não regride autorizado/cancelado; evento incompatível é auditado e reconciliável.

## 2. Integridade financeira e isolamento

### A6 — Autorizações por ação, deny-by-default

- Status: **adiado por decisão do responsável**. Nesta etapa somente a exclusão de pagamentos foi restrita a administradores; a matriz granular não foi implementada.
- IDs: COL-002.
- Dependências: matriz das demais ações e migration/backfill. Exclusão de pagamentos já foi definida como exclusiva de administradores.
- Esforço: médio/grande.
- Aceite: membro sem capacidade recebe 403 em POST/PATCH/DELETE mesmo chamando API; leitura pode ser independente; admin mantém acesso; testes cruzam papéis e tenants.

### A7 — Garantias compostas de tenant no banco

- IDs: COL-012.
- Dependências: auditoria read-only e correção de dados; janela de migration.
- Esforço: grande.
- Aceite: consulta de pré-flight não encontra relações divergentes; FKs compostas são validadas; plano de rollback e impacto de lock documentados.

### A8 — Definir ciclo de cheques

- IDs: COL-014.
- Dependências: o recebimento já foi definido como momento da quitação; ainda falta definir devolução e reapresentação.
- Esforço: grande se devolução/reapresentação forem necessárias.
- Aceite: cheque recebido quita imediatamente; eventual devolução cria reversão auditável sem apagar o evento original; cada transição é autorizada; saldos e relatórios refletem a política; migration trata cheques existentes explicitamente.

### A9 — Validar regras históricas de comissão e cancelamento

- IDs relacionados: decisão de negócio da auditoria.
- Dependências: definição competência/caixa e política de estorno.
- Esforço: médio.
- Aceite: exemplos calculados manualmente para venda, parcial, inadimplência, cancelamento e estorno; relatórios e pagamentos usam a mesma fonte.

## 3. Confiabilidade e operação

### A10 — Estabilizar testes frontend

- IDs: COL-008.
- Esforço: pequeno/médio.
- Aceite: suite termina repetidamente sem handles presos; CI tem timeout razoável; nenhum `forceExit`; build inicia após os testes.

### A11 — Tornar build hermético

- IDs: COL-009.
- Esforço: pequeno.
- Aceite: `npm run build` passa sem internet e preserva a tipografia/licença.

### A12 — Limitar e desacoplar exportações pesadas

- IDs: COL-010.
- Dependências: limites D4; fila/armazenamento se assíncrono.
- Esforço: médio/grande.
- Aceite: limite documentado, consulta agregada/paginada, progresso/erro visível, teste de carga com orçamento de memória e total global correto.

### A13 — Encerrar DDL de compatibilidade em runtime

- IDs: COL-011.
- Dependências: inventário de todos os ambientes, backup e restauração realmente ensaiada.
- Esforço: grande.
- Aceite: schemas convergem para migrations, startup não altera schema, drift falha de forma observável e runbook cobre rollback.

### A14 — Reexecutar análise de dependências

- IDs: limitação de dependências.
- Esforço: pequeno para triagem; variável para correções.
- Aceite: relatório com pacote/versão/advisory, caminho de uso, exploração no contexto e atualização testada; alertas sem uso real não recebem severidade automática.

## 4. Limpeza e manutenção

### A15 — Remover artefatos gerados versionados

- IDs: inventário de limpeza.
- Esforço: pequeno.
- Aceite: 69 arquivos de coverage e 2 artefatos Playwright deixam de ser rastreados, `.gitignore` previne retorno, CI ainda publica resultados.

### A16 — Retirar API deprecated de PDF

- Esforço: pequeno.
- Aceite: busca sem consumidores externos, página continua usando APIs novas e testes de export passam.

### A17 — Simplificar configuração Vitest

- Dependências: A10.
- Esforço: pequeno.
- Aceite: opção nativa de tsconfig paths substitui plugin, lockfile atualizado de forma controlada, suite e build passam.

### A18 — Consolidar serviços de recebíveis

- Dependências: A3 concluída para evitar conflito.
- Esforço: pequeno/médio.
- Aceite: um caminho canônico de import, nenhuma mudança de comportamento e suite backend integral verde.

## 5. Produto e experiência

### A19 — Fluxo único da carga: venda → NF-e → CT-e → MDF-e

- Dependências: A1, A4 e decisões fiscais.
- Esforço: grande, em incrementos.
- Entrega: aproveitar venda, motorista, cliente, itens, frete e ordem já existentes; uma visão de “documentos da carga” com estado e próximas ações, sem criar várias abas desconectadas.
- Aceite: CT-e nasce pré-preenchido da venda/frete/ordem; MDF-e seleciona CT-e/NF-e autorizados; usuário revisa somente campos ausentes; vínculos e auditoria permanecem navegáveis.

### A20 — Mensagens de erro operacionais e recuperação

- IDs: COL-003, COL-005, COL-007.
- Esforço: médio.
- Aceite: erros distinguem validação, credencial, indisponibilidade e estado desconhecido; não anunciam sucesso antes de confirmação; oferecem consulta/retry seguro.

## Decisões do responsável pelo negócio

Confirmadas:

- D1: pacote contábil em um ZIP, separado em cinco pastas por CNPJ.
- D2: somente administradores podem excluir pagamentos.
- D3: cheque quita a venda no recebimento.
- D4: cadastro público de membros permanece ativo, com permissões mínimas e sem ações destrutivas por padrão.

Pendentes:

- D5: papéis para receber, estornar, excluir venda/frete e emitir/cancelar em produção.
- D6: estados e efeitos de devolução/reapresentação de cheque.
- D7: limites máximos de período/documentos e expectativa de tempo para relatórios/exportações.
- D8: comissão segue venda, faturamento ou caixa e como reverte.

## Ordem prática dos primeiros cinco trabalhos

1. A1 — restaurar CT-e/MDF-e e validar chave sem alteração silenciosa.
2. A3 — idempotência e concorrência de recebimentos.
3. A6 — autorização por ação e permissões mínimas.
4. A4 — pacote contábil correto para cinco CNPJs.
5. A5 — estados monotônicos e idempotência de webhooks.

Depois deles: A2, A10/A11, A7 e A12/A13. Limpeza cosmética entra em PRs próprios e não deve atrasar correções de integridade.
