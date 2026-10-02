# Auditoria técnica da Colombocal

Data: 1º de outubro de 2026  
Referência Git: `7d5f8ab11300e7ff8f6eb3736cf825f452c95419` (`main`)  
Natureza: auditoria estática e verificações locais seguras; nenhuma correção funcional foi implementada.

## Resumo executivo

A base possui controles importantes: o tenant é obtido do JWT e confirmado no banco a cada requisição, as consultas centrais normalmente incluem `tenantId`, senhas usam bcrypt, tokens de recuperação são armazenados por hash, há transações nos fluxos financeiros, auditoria financeira, índices por tenant e testes extensos no backend. Não foi demonstrado acesso cruzado simples entre empresas.

Ainda não é recomendável depender em produção dos fluxos novos de CT-e/MDF-e nem aceitar recebimentos concorrentes sem correção. Há três riscos altos: pagamentos simultâneos podem duplicar baixas; usuários comuns podem executar mutações financeiras destrutivas porque a autorização é por aba e permissões nulas significam acesso total; e as telas de CT-e/MDF-e não enviam o emitente que o backend passou a exigir. O pacote contábil também não está preparado para cinco CNPJs: escolhe um único emitente/provedor para documentos de todos os emitentes.

Foram consolidados 14 achados: 4 altos, 8 médios e 2 baixos. Entre eles, um é classificado como melhoria de segurança e outro depende de decisão de negócio, sem bug confirmado. O número expressa causas independentes, não cada ocorrência.

## Escopo e estado inicial

O workspace já continha alterações não commitadas no schema, emissão fiscal, webhooks, providers, rotas e testes, além de arquivos novos de migration e hardening fiscal. Essas alterações foram preservadas e fazem parte do estado observado, mas não da referência Git acima. Não houve reset, limpeza, emissão fiscal, chamada a provedor, seed, migration, deploy ou push.

Não foi encontrado `AGENTS.md`. Foram lidos `package.json`, compose, CI, schema/migrations, pontos de entrada, rotas, casos de uso, providers, páginas, hooks e testes relevantes. Diretórios de dependências e cobertura foram excluídos das buscas normais.

## Mapa da arquitetura

- Frontend: Next.js 16.1.6, React 18, TypeScript, TanStack Query, Tailwind e Vitest; porta local 3010. O bearer token fica em `localStorage` e o cliente HTTP adiciona `Authorization`.
- Backend: Node >=20.19, Express 4, Prisma 5, Zod, JWT, bcrypt, Axios, BullMQ, ExcelJS e Archiver; porta local 3011.
- Dados: PostgreSQL 15; Redis 7 para filas. Banco de teste descartável declarado na porta 5436.
- Entrada: `backend/src/index.js` monta middleware e rotas; `frontend/src/app` usa App Router.
- Autenticação: JWT assinado, usuário relido no banco e `tokenVersion` para revogação. O tenant efetivo vem do usuário/token, não do corpo da requisição.
- Autorização: proteção por área de navegação (`requireNavKey`) e algumas rotas administrativas. Não há matriz granular de ações.
- Fiscal: NF-e, CT-e, MDF-e e CIOT, emitentes múltiplos e providers externos; webhooks atualizam o estado local. Tokens fiscais são tratados no backend.
- Financeiro: vendas, títulos, pagamentos, cheques, fretes, cobrança bancária, recálculo e eventos de auditoria.
- Jobs: BullMQ e worker iniciado junto ao processo HTTP. Exportações e pacote contábil realizam trabalho potencialmente pesado.
- Qualidade: testes Node, Vitest, Playwright e workflows de CI para backend, frontend e E2E.

Fluxo central observado: tela → cliente HTTP com JWT → autenticação e permissão por aba → rota/Zod → caso de uso/transação Prisma → PostgreSQL → consultas de relatório/auditoria. No fiscal, o caso de uso seleciona emitente/provider, persiste a referência e recebe atualizações por consulta/webhook.

## Matriz de cobertura

| Área | Profundidade | Resultado |
|---|---:|---|
| Autenticação e tenants | Alta | Origem do tenant e revogação adequadas; autorização por ação insuficiente |
| Vendas e financeiro | Alta | Transações existentes; corrida de baixa e regras de cheque pendentes |
| Fretes, pátio e comissão | Média | Vínculos e transações inspecionados; regra histórica de comissão requer negócio |
| NF-e/CT-e/MDF-e/CIOT | Alta | Regressão de contrato, multiemitente e ordenação de webhook |
| Banco e migrations | Alta | Bons índices; compatibilidade em runtime e FKs compostas ausentes |
| Frontend | Média/alta | Fluxos fiscais, autenticação, testes e build verificados |
| Relatórios/exportações | Média | Consultas e pacote contábil; sem benchmark ou conjunto sintético completo |
| Operação/CI | Média | Build/testes/health/configuração; sem teste de restauração |
| Dependências/código morto | Média | Busca de referências e artefatos; scanner remoto ficou inconclusivo |

## Achados priorizados

### COL-001 — Recebimentos concorrentes podem duplicar baixas

- Severidade: **Alta**. Classificação: **Confirmado por caminho inequívoco**. Confiança: **alta**.
- Módulo: financeiro.
- Evidência: `registrarPagamento.js:30-78` e `registrarRecebimentoComposto.js:36-94` leem o saldo e depois inserem pagamentos dentro de uma transação padrão, sem lock por venda, nível serializável, versão otimista ou chave de idempotência. As rotas `POST /pagamentos` e `POST /recebimentos` também não recebem chave idempotente.
- Pré-condição/reprodução: disparar simultaneamente dois POSTs válidos para o saldo integral da mesma venda. Ambos podem ler o mesmo saldo antes dos commits e registrar o valor integral.
- Atual/esperado: o recálculo posterior pode limitar o status dos títulos, mas dois registros positivos e eventos permanecem. Uma intenção de recebimento deve produzir no máximo uma baixa e o saldo não pode ser consumido duas vezes.
- Impacto/causa: caixa e auditoria incorretos por condição de corrida e repetição de requisição.
- Correção: chave idempotente única por tenant e intenção, lock transacional por venda/cliente (ou `SERIALIZABLE` com retry) e verificação final do saldo dentro da região protegida.
- Riscos/migration: exige coluna/tabela de idempotência ou índice único e auditoria prévia de duplicidades. Esforço: médio.
- Regressão: teste com duas promises/conexões sincronizadas e replay da mesma chave.

### COL-002 — Permissões por aba autorizam mutações financeiras destrutivas

- Severidade: **Alta**. Classificação: **Confirmado**. Confiança: **alta**.
- Módulo: autorização/financeiro.
- Evidência: `index.js:184-187` protege pagamentos, recebimentos e cheques apenas com `requireNavKey("financeiro")`; `pagamentos.js:163`, `cheques.js:202`, `vendas.js:932` e `fretes.js:1008` expõem exclusões sem autorização de ação. `navPermissions.js:45-52` dá acesso total a membros com permissões nulas; o cadastro cria `role: "member"` em `auth.js:111-183`.
- Pré-condição/reprodução: autenticar um membro com `navPermissions=null`, obter um ID do próprio tenant e chamar DELETE/POST diretamente.
- Atual/esperado: ver a aba equivale a receber, estornar e excluir. Operações destrutivas devem exigir capacidades explícitas e verificadas no servidor.
- Impacto/causa: fraude ou perda de integridade dentro da empresa, mesmo que não haja vazamento entre tenants.
- Correção: capacidades como `financeiro.ver`, `receber`, `estornar`, `excluir`; negar por padrão para membro; manter admin como exceção; auditar todas as mutações.
- Riscos/migration: backfill de perfis para não bloquear usuários legítimos. Esforço: médio/grande.
- Regressão: matriz de testes por papel, ação e tenant, incluindo requisição direta sem interface.

### COL-003 — Telas de CT-e e MDF-e não enviam o emitente obrigatório

- Severidade: **Alta**. Classificação: **Confirmado**. Confiança: **alta**.
- Módulo: fiscal/frontend.
- Evidência: `schemas/cte.js:4` e `schemas/mdfe.js:10` exigem `emitenteFiscalId`; os payloads de `fiscal/cte/nova/page.tsx:34-45` e `fiscal/mdfe/nova/page.tsx:26-41` não possuem o campo.
- Reprodução: preencher e enviar qualquer uma das telas; a validação do backend responde 400 antes do provider.
- Atual/esperado: UI informa falha; deveria listar emitentes habilitados para o documento, selecionar padrão e enviar o ID.
- Impacto/causa: fluxo central recém-criado fica indisponível por mudança de contrato sem atualização do consumidor.
- Correção: seletor compartilhado de emitente, DTO compartilhado/OpenAPI e teste de contrato frontend-backend.
- Riscos/migration: nenhuma migration; tratar tenant sem emitente elegível. Esforço: pequeno/médio.

### COL-004 — Pacote contábil mistura emitentes e usa um único provider

- Severidade: **Alta**. Classificação: **Confirmado**. Confiança: **alta**.
- Módulo: fiscal/exportação.
- Evidência: `nfePacoteContabil.js:95-128` carrega todas as notas do tenant e escolhe só um emitente ativo; `:189-228` faz o mesmo para CT-e/MDF-e. Os documentos possuem `emitenteFiscalId`, mas o download ignora-o.
- Pré-condição: tenant com dois ou mais CNPJs e documentos emitidos por credenciais diferentes.
- Atual/esperado: XMLs do emitente não padrão falham ou consultam a conta errada, e o cabeçalho representa apenas uma empresa. Cada documento deve usar suas credenciais; o pacote deve ser separado por CNPJ ou declarar claramente uma consolidação.
- Impacto/causa: fechamento fiscal incompleto/enganoso para Requinte e Colombocal.
- Correção: agrupar por emitente, criar provider por grupo, gerar subpastas/planilhas por CNPJ e impedir pacote sem vínculo de emitente.
- Riscos/migration: notas antigas com emitente nulo precisam de conciliação, não preenchimento automático cego. Esforço: médio.

### COL-005 — Webhooks podem regredir estados fiscais por ordem de chegada

- Severidade: **Média**. Classificação: **Confirmado por caminho de código**. Confiança: **alta**.
- Módulo: fiscal/webhooks.
- Evidência: `gerirNfe.js:150-183`, `gerirCte.js:119+` e `gerirMdfe.js:202+` mapeiam o status recebido e sobrescrevem o documento sem versão do evento, timestamp confiável, fingerprint ou máquina de transição monotônica.
- Reprodução: aplicar webhook `autorizada` e depois um evento atrasado `processando/rejeitada` para a mesma referência.
- Atual/esperado: o último pacote recebido vence. Estados terminais devem impedir regressão, duplicatas devem ser idempotentes e exceções precisam de conciliação explícita.
- Impacto/causa: UI, downloads e fechamento fiscal divergem do provedor.
- Correção: tabela/fingerprint de eventos, transições permitidas, data/sequência do provedor e job de reconciliação.
- Riscos/migration: preservar payloads históricos e definir precedência com o provedor. Esforço: médio.

### COL-006 — MDF-e altera silenciosamente chaves de acesso

- Severidade: **Média**. Classificação: **Confirmado**. Confiança: **alta**.
- Módulo: fiscal/frontend.
- Evidência: `fiscal/mdfe/nova/page.tsx:35-39` remove caracteres, completa com zeros e corta para 44 posições. O backend valida essencialmente o tamanho.
- Reprodução: informar uma chave curta; a tela envia outra chave de 44 dígitos.
- Atual/esperado: dado inválido é transformado e pode referenciar documento inexistente. A tela deve rejeitar, validar 44 dígitos e dígito verificador, sem inventar conteúdo.
- Impacto/causa: manifesto rejeitado ou associação fiscal incorreta.
- Correção: validação compartilhada de chave e mensagem de campo. Sem migration. Esforço: pequeno.

### COL-007 — Downloads de XML/DACTE não carregam o bearer token

- Severidade: **Média**. Classificação: **Confirmado**. Confiança: **alta**.
- Módulo: fiscal/frontend.
- Evidência: o token está em `lib/auth-token.ts:15-46` e é adicionado pelo cliente API; `fiscal/cte/[id]/page.tsx:129-136` usa `<a href="/api/...">`. Navegação por link não adiciona o header exigido por `requireTenantUser`.
- Reprodução: clicar em XML ou DACTE numa sessão autenticada apenas por localStorage; resposta esperada do backend é 401.
- Correção: baixar como `Blob` pelo cliente autenticado, criar URL temporária e revogá-la; ou adotar cookie HttpOnly. Esforço: pequeno.
- Riscos/teste: conferir nomes, content-type, erros e revogação da URL; teste de integração autenticado.

### COL-008 — Suite Vitest não encerra de forma confiável

- Severidade: **Média**. Classificação: **Confirmado por execução**. Confiança: **alta**.
- Módulo: qualidade/CI.
- Evidência: `npm test` no frontend excedeu 246 s; Vitest reportou workers presos em `useRelatorioVendasQuery.test.ts` e `useChequesQuery.test.ts`, além de navegação JSDOM não implementada. A CI executa a mesma suite.
- Atual/esperado: o gate pode permanecer até o timeout do job. Testes devem terminar e limpar QueryClient, timers, listeners e mocks.
- Correção: isolar os dois arquivos, identificar handle aberto, usar teardown explícito e timeout curto na CI. Não mascarar com `forceExit`.
- Migration: nenhuma. Esforço: pequeno/médio.

### COL-009 — Build de produção depende da rede do Google Fonts

- Severidade: **Média**. Classificação: **Confirmado por execução**. Confiança: **alta**.
- Módulo: build/operação.
- Evidência: `npm run build` falhou após 171 s ao buscar Inter; `app/layout.tsx:2,9` usa `next/font/google`.
- Impacto: builds e releases falham em ambientes sem egress, indisponibilidade externa ou proxy restritivo.
- Correção: versionar a fonte e usar `next/font/local`, ou stack de fontes do sistema. Esforço: pequeno.
- Regressão: build em ambiente sem rede.

### COL-010 — Relatórios e pacote contábil carregam volumes sem limite

- Severidade: **Média**. Classificação: **Provável**. Confiança: **alta**.
- Módulo: desempenho/exportações.
- Evidência: `nfePacoteContabil.js:95-116,189-208` carrega todos os documentos do período e monta planilha/ZIP; `relatorios.js:878` carrega todas as ordens para agregação; `clientes.js:219-251` traz histórico completo sem paginação.
- Pré-condição: tenant/período grande. Não foi feito benchmark, portanto lentidão/OOM não é afirmada como reproduzida.
- Correção: limites de período/quantidade, paginação/cursor, agregação SQL e exportação assíncrona/streaming com teto de memória.
- Riscos: mudar semântica de totais; preservar total global separado da página. Esforço: médio/grande.

### COL-011 — DDL de compatibilidade em runtime pode mascarar drift

- Severidade: **Média**. Classificação: **Provável**. Confiança: **alta**.
- Módulo: banco/operação.
- Evidência: `lib/prisma.js:19+` mantém uma longa sequência de `$executeRawUnsafe` com ALTER/CREATE e saneamentos que duplicam migrations. A inicialização também possui mecanismos para resolver migrations legadas.
- Atual/esperado: ambientes com a flag de compatibilidade podem divergir do histórico oficial e aparentar saúde sem constraints completas. Evolução de schema deve ocorrer por migrations revisadas e observáveis.
- Correção: inventário por ambiente, migration de reconciliação idempotente controlada e remoção gradual do caminho de compatibilidade.
- Riscos: não desligar antes de confirmar todos os bancos; backup e ensaio de restauração obrigatórios. Esforço: grande.

### COL-012 — Banco não garante que os dois lados de relações pertençam ao mesmo tenant

- Severidade: **Média**. Classificação: **Provável**. Confiança: **alta**.
- Módulo: dados/multi-tenant.
- Evidência: modelos como Venda, Pagamento, Cheque, Título, Frete e documentos fiscais armazenam `tenantId`, mas FKs apontam apenas para `id` (`schema.prisma:233-503,632-794`). A aplicação faz muitas verificações corretas, porém a invariável não existe no banco.
- Impacto: importadores, scripts, bugs futuros ou SQL manual podem criar relações cruzadas; consultas filtradas escondem parte da corrupção.
- Correção: auditar dados, criar chaves únicas compostas `[tenantId,id]` e FKs compostas, ou remover redundância quando o tenant puder ser derivado com segurança.
- Riscos/migration: migration com validação gradual para evitar lock; tratar divergências antes da constraint. Esforço: grande.

### COL-013 — Bearer de sete dias em localStorage amplia impacto de XSS

- Severidade: **Baixa**. Classificação: **Melhoria de segurança**. Confiança: **alta**.
- Módulo: autenticação/frontend.
- Evidência: `auth-token.ts:15-46`. Não foi encontrada uma XSS explorável nesta auditoria; saídas HTML examinadas possuem escape.
- Impacto: qualquer XSS futura ou extensão maliciosa pode copiar o token até expirar/revogar.
- Correção: avaliar cookie `HttpOnly`, `Secure`, `SameSite`, CSP estrita e duração menor; se mantiver bearer, documentar o risco e endurecer CSP.
- Riscos: cookies exigem desenho CSRF/CORS correto. Esforço: médio.

### COL-014 — Ciclo de vida de cheques não representa devolução/reapresentação

- Severidade: **Baixa**. Classificação: **Não verificável como bug; decisão de negócio**. Confiança no comportamento: **alta**.
- Módulo: cheques/financeiro.
- Evidência: `registrarRecebimentoComposto.js:69-95` cria cheque `registrado`, define compensação no recebimento e cria pagamento imediatamente. A documentação descreve registro/exclusão, não uma máquina de estados bancária.
- Decisão: confirmar se o saldo deve baixar no recebimento ou somente na compensação e como devolução/reapresentação afetam caixa, comissão e inadimplência.
- Se necessário: modelar transições e razão do evento, manter histórico imutável e estorno compensatório. Migration/backfill de status exigidos. Esforço: grande.

## Invariantes verificadas e lacunas

- Tenant: o backend deve derivá-lo da sessão e filtrar todas as operações; isso é amplamente cumprido na aplicação. Falta defesa composta no banco (COL-012).
- Venda: número é único por tenant e a criação usa proteção de concorrência; itens/títulos são tratados em transações.
- Recebível: saldo deriva de títulos/pagamentos e é recalculado; falta serialização/idempotência da intenção (COL-001).
- Fiscal: referência do provider é única por tenant e timeouts ambíguos recebem tratamento; falta monotonicidade de eventos e consistência multiemitente.
- Auditoria: há eventos financeiros e fiscais, mas autorização granular ainda não acompanha as ações.

## Pontos positivos comprovados

- O tenant efetivo não é aceito cegamente do frontend; JWT e usuário no banco definem o escopo.
- Mudança/reset de senha incrementa versão de token; senha usa bcrypt e reset persiste hash do token.
- Rate limit existe nos endpoints sensíveis de autenticação e webhooks possuem segredo/autenticação no estado atual.
- Fluxos críticos usam transações e validam ownership de cliente/venda.
- Valores persistidos usam `Decimal`; parcelamento possui distribuição de centavos.
- Há índices e unicidades por tenant em chaves de negócio relevantes.
- Emissão de NF-e possui referência persistida e tratamento para resultado ambíguo, reduzindo reemissão cega.
- Providers fiscais foram endurecidos contra downloads arbitrários no estado não commitado auditado.
- CI separa backend, frontend e E2E; backend possui cobertura ampla de integração.

## Verificações executadas

- `git status --short`, `git rev-parse HEAD`, `git log -1`: estado e referência registrados; workspace sujo preservado.
- Buscas `rg` direcionadas por rotas, tenant, permissões, transações, fiscal, exports, dependências e referências.
- Suite backend (execução realizada no mesmo estado do workspace imediatamente antes desta auditoria): **511 testes aprovados, 0 falhas**, usando banco de teste local descartável na porta 5436.
- `npm test` no frontend: não concluiu em 246 s; dois workers presos (COL-008).
- `npm run build` no frontend: falhou ao baixar Google Inter (COL-009); não chegou a validar o restante do bundle.
- Prisma format/generate no mesmo estado: concluídos anteriormente sem erro.
- `npm audit --omit=dev --json`: tentativa sem rede falhou; nova consulta autorizada ficou sem resposta e foi interrompida sem alterar arquivos. Dependências não estão aprovadas por scanner.
- Nenhuma migration, seed, E2E, restauração, emissão fiscal ou chamada a provedor foi executada nesta etapa.

## Limitações

- Não houve ambiente externo, credenciais de provedor, certificado real nem documentação tributária oficial; conformidade fiscal não foi atestada.
- Não foram consultados dados pessoais do banco de desenvolvimento nem executados testes que os alterassem.
- O build incompleto impediu análise final do bundle e typecheck integral.
- E2E não foi executado para evitar seed/mutações sem necessidade; os contratos quebrados foram provados diretamente pelo código.
- Não houve carga/benchmark, teste de restauração, failover de Redis/provider ou inspeção de infraestrutura de produção.
- O scanner de vulnerabilidades npm não retornou; versões precisam de nova verificação com conectividade estável.

## Decisões de negócio

Confirmadas em 1º de outubro de 2026:

1. O cheque quita a venda quando é recebido. Eventual devolução futura deverá gerar uma reversão auditável, sem apagar o recebimento original.
2. Somente administradores podem excluir pagamentos.
3. O pacote contábil será um único ZIP, separado internamente em cinco pastas, uma por CNPJ.
4. O cadastro público de novos usuários continuará habilitado. Por segurança, o cadastro não deve conceder permissões destrutivas; acesso adicional será atribuído por administrador.

Ainda pendentes:

1. Quais estados de devolução/reapresentação do cheque serão necessários e como afetam comissão e inadimplência?
2. Quais papéis podem receber, estornar, excluir venda/frete e operar produção fiscal, além da regra já definida para excluir pagamentos?
3. Comissão é por competência, faturamento ou caixa? Cancelamentos, inadimplência e estornos a revertem?
4. Quais limites de período/volume são aceitáveis para relatórios e exportações?

## Hipóteses descartadas

- O alerta visual de hidratação mostrado anteriormente continha atributo `data-bry-content-script-bryweb`, injetado por extensão do navegador. `suppressHydrationWarning` já existe no `<html>`; não há evidência de que esse caso específico seja falha do layout da Colombocal.
- Arquivos de App Router sem imports diretos (por exemplo ícones e páginas) não foram tratados como mortos, pois são descobertos por convenção.
- Migrations, scripts de recuperação e ferramentas legadas não foram chamados de lixo apenas por não terem imports; são candidatos operacionais que exigem confirmação.
