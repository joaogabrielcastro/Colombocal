# Redesign e modernização do frontend — novembro de 2026

Branch: `claude/amazing-hypatia-vdv84a` · Escopo: somente `frontend/` (nenhuma alteração em backend, Prisma, migrations, filas BullMQ ou integrações Focus NFe/BrasilAPI).

Este documento complementa as auditorias anteriores ([frontend-ui-ux.md](./frontend-ui-ux.md), [frontend-modernizacao-2026-10.md](./frontend-modernizacao-2026-10.md)). Os achados UX-001 a UX-022 daquela auditoria foram reverificados no código atual; os que já estavam resolvidos (ex.: "Receber" desabilitado em ordem quitada, deep link com `vendaId`, aviso de alterações não salvas, `ConfirmDialog` acessível) não foram retrabalhados.

---

## 1. Diagnóstico inicial

**Arquitetura.** Next.js 16 (App Router, 100% client components), React 18, Tailwind 3, TanStack Query (usado em 6 arquivos), Sonner, Heroicons. Backend Express + Prisma multi-tenant; permissões por aba (`navPermissions`) aplicadas no backend (`requireNavKey`) e espelhadas no front (`canAccessPath`). ~32 mil linhas no frontend, ~50 rotas.

**Módulos encontrados (implementação real verificada):** Início/dashboard · Vendas (lista, nova, detalhe, edição, OC, O.S., NF-e da venda) · Receber (recebimento composto cheque + dinheiro + PIX, idempotente) · Contas a receber (por cliente / por título, aging) · Financeiro (extrato de baixas, estorno, cobranças/boletos) · Fretes avulsos e Carregamento (OC) · Cadastros (clientes com conta/preços/comissões, produtos, motoristas, vendedores) · Fiscal (NF-e, CT-e, MDF-e, CIOT, fechamento mensal/pacote contábil) · Relatórios (vendas, comissões, fretes, carregamento, motoristas; export CSV assíncrono via BullMQ) · Sistema (auditoria, configurações, usuários e permissões).

**Pontos fortes já existentes:** filtros em URL em vendas/financeiro, skeletons, `EmptyState`, `reportApiError` com retry, `FormEnterNavigation`, diálogos acessíveis, avisos financeiros corretos (títulos como fonte oficial).

## 2. Problemas encontrados no frontend

| # | Problema | Evidência | Impacto |
|---|---|---|---|
| P1 | Identidade da marca ausente na interface | 0 usos do token `primary`; ~680 classes `gray-*`, ~140 `slate-*` e ~110 `blue-*` do Tailwind padrão; sidebar `#1a1f2e` genérica; navy `#004071` só no logo | Aparência de template; dois cinzas diferentes convivendo |
| P2 | `/auth/me` chamado pelo shell **a cada troca de rota**, mais Sidebar e hook de features | `ClientShell` (efeito em `pathname`), `Sidebar.useMe`, `fetchTenantFeatures` | Requisição extra por navegação e tela inteira trocada por "A carregar…" durante a verificação |
| P3 | Navegação sem busca global nem atalhos | — | Encontrar um cliente ou ordem exigia abrir a lista e filtrar |
| P4 | Dashboard genérico | Cards "Cheques 0", "Produtos ativos 3" com o mesmo peso de faturamento; nenhum indicador de **vencidos** nem de NF-e com problema | Pendências reais invisíveis na tela inicial |
| P5 | Bug de texto | "3 **ordemns**" no dashboard | — |
| P6 | Tabelas espremidas em cards estreitos | Regra global `min-width: 720px` em qualquer tabela de card → "Subtotal" cortado no detalhe da venda | Informação cortada no desktop |
| P7 | Lista de vendas | Coluna fixa de ações sobrepunha NF-e ("Sem not…"); no celular só Ordem/Data/Ações visíveis; filtros ocupavam a tela inteira | Consulta móvel inviável |
| P8 | Detalhe da venda sem ação "Receber" | Era preciso voltar à lista ou ao menu | Cliques extras na tarefa mais frequente |
| P9 | Rejeição de NF-e pouco visível | Motivo só como linha no meio do card "Identificação"; lista sem motivo | Problema fiscal passa despercebido |
| P10 | Inconsistências de cabeçalho/feedback | 41 `<h1>` montados à mão; "A carregar…" (pt-PT); paginação "Nenhum nota" abaixo de um estado vazio | Ruído e vocabulário inconsistente |
| P11 | Código morto | `TopNav.tsx` (432 linhas) sem nenhum import | Manutenção |
| P12 | Nome acessível duplicado | Logo e item "Início" com o mesmo rótulo | Ambiguidade para leitores de tela (detectado pelos testes) |

## 3. Proposta visual adotada

- **Marca como base, não como enfeite.** Escala `brand` derivada do navy Colombocal (`brand-800 = #004071`), usada em ações primárias, links e item ativo. Sidebar em `brand-950` com indicador ativo no dourado do wordmark. Vermelho/âmbar/verde reservados a **status** (vencido, parcial, quitado).
- **Um único neutro.** `gray` e `slate` apontam para a mesma escala levemente fria (fim da mistura de dois cinzas). Feito em `tailwind.config.js`, sem reescrever 40 arquivos.
- **Densidade de ERP.** Botões de 36px (44px no celular), tabelas com cabeçalho discreto e números tabulares, sombras quase imperceptíveis, separação por borda.
- **Badges semânticos** (`badge-success|warning|danger|info|neutral`) usados por status de título e NF-e.
- **Componentes**: `PageHeader` (trilha, título, meta, ações que quebram linha quando falta espaço), `KpiCard`, `EmptyState` com ícone, diálogos com animação curta e fundo desfocado.

## 4. Melhorias de UX implementadas

1. **Busca global / paleta de comandos** (`Ctrl/⌘+K` ou `/`): clientes por nome/CNPJ/cidade (`GET /clientes?busca=`), ordem por número (`#12` → `GET /vendas/por-ordem/12`), telas e ações rápidas. Só mostra e só consulta o que a permissão do usuário permite. Navegação por teclado (↑ ↓ Enter Esc).
2. **Barra superior** com busca e ações rápidas "Nova venda" e "Receber" (ocultas quando a própria tela já oferece a ação).
3. **Menu lateral** agrupado (Operação, Cadastros, Fiscal, Relatórios, Sistema), recolhível no desktop (preferência salva), bloco com usuário, empresa e papel.
4. **Dashboard orientado a ação**: KPIs (faturamento hoje/mês com o mês anterior como contexto, a receber, **vencido**) e painel **Pendências** com dados reais — títulos vencidos (`/relatorios/financeiro`), NF-e rejeitadas/denegadas e em processamento nos últimos 30 dias (`/fiscal/notas/resumo`), divergências conta × títulos. Cada pendência leva direto à tela filtrada. Produtos ativos e cheques continuam visíveis (rodapé do painel).
5. **Vendas**: atalhos de período (Hoje / 7 dias / Este mês) sobre os filtros existentes, contador de filtros ativos, botão "Receber" por linha com o saldo no título, lista em cartões no celular, filtros secundários recolhidos no celular.
6. **Detalhe da venda**: trilha, badge de status, saldo no cabeçalho e ação primária **"Receber R$ X"**; "Cancelar venda" como ação destrutiva discreta.
7. **NF-e**: alerta no topo para rejeitada/denegada com a mensagem da SEFAZ e o caminho de correção; aviso para "processando"; linha do tempo (emitida/autorizada/cancelada); motivo da rejeição na própria lista; a lista aceita `?status=&dataInicio=&dataFim=` (deep link).
8. **Navegação sem "piscar"**: a verificação de permissão usa a sessão em cache; a tela só fica oculta na primeira verificação.
9. Link "Pular para o conteúdo", `aria-current` no menu, foco visível consistente.

## 5. Módulos modernizados

| Módulo | O que mudou |
|---|---|
| Shell (todas as telas) | Sidebar, barra superior, paleta, sessão única, tokens |
| Início | Reescrito (KPIs + pendências + saldos + faturamento + últimas vendas) |
| Vendas (lista e detalhe) | Ver itens 5 e 6 |
| Fiscal — NF-e (lista e detalhe) | Ver item 7 |
| Contas a receber / Financeiro / Clientes / Produtos / Relatórios / Configurações / Usuários / Auditoria / Fretes / Carregamento | Herdam tokens, botões, badges, tabelas, diálogos e cabeçalho (`ListScaffold` → `PageHeader`) sem mudança de fluxo |

## 6. Componentes criados ou modificados

**Novos:** `components/shell/Topbar.tsx`, `components/shell/CommandPalette.tsx`, `components/ui/page-header.tsx`, `components/ui/kpi-card.tsx`, `lib/session.ts`.
**Reescritos:** `components/Sidebar.tsx`, `components/ClientShell.tsx`, `app/page.tsx`.
**Modificados:** `tailwind.config.js`, `app/globals.css`, `components/ui/{list-scaffold,empty-state,skeletons,pagination,confirm-dialog,modal-surface}.tsx`, `lib/navigation.ts` (`buildNavGroups`, `isNavHrefActive` — fonte única para menu e paleta), `lib/status-badges.ts`, `features/nfe/status.tsx`, `hooks/useTenantFeatures.ts`, `components/DashboardFaturamentoChart.tsx` (mês atual destacado), `app/vendas/page.tsx`, `app/vendas/[id]/page.tsx`, `app/fiscal/notas/page.tsx`, `app/fiscal/notas/[id]/page.tsx`.
**Removido:** `components/TopNav.tsx` (sem uso).

## 7. Alterações técnicas

- `lib/session.ts`: cache de 60 s por token, deduplicação de requisições simultâneas, invalidação no evento de sessão (login/logout/troca de empresa); só grava cache se o token não mudou durante a requisição. Medido no navegador: **1** chamada a `/auth/me` para carregar + 4 navegações (antes: 1 por navegação, mais Sidebar e features).
- Dashboard migrado para TanStack Query; consultas complementares só disparam com a sessão carregada **e** permissão do módulo (evita 403 para membros — problema encontrado e corrigido durante os testes).
- Regra de largura mínima de tabela restrita a telas < 1024px.
- Nenhum contrato de endpoint alterado; nenhuma dependência nova.

## 8. Funcionalidades preservadas

Todas as rotas, formulários, filtros, exportações (PDF/Excel/CSV assíncrono), impressões (O.S., OC, frete), emissão/consulta/cancelamento fiscal, recebimento composto com `Idempotency-Key`, estornos, permissões por aba e papel, isolamento multi-tenant, `data-testid` usados pelo E2E (`dashboard-title`, `sidebar-desktop`, `sidebar-mobile`, `mobile-menu-button`, `sidebar-tenant-name` etc.). Nenhum campo ou informação removido: o subtotal da página de vendas segue no rodapé da tabela; produtos ativos e cheques seguem no dashboard.

## 9. Testes executados e resultados

Ambiente: PostgreSQL 16 e Redis locais, banco de desenvolvimento populado **via API pública** (8 clientes, 26 vendas com pagamentos totais/parciais/abertos em ~6 meses, 2 NF-e de teste) e banco de teste separado para o E2E. Nada apontou para produção.

| Verificação | Resultado |
|---|---|
| TypeScript (`tsc --noEmit`) | Sem erros |
| Testes unitários/componentes (Vitest) | **54 arquivos, 286 testes aprovados** (linha de base: 51 / 264). Novos: sessão (cache, deduplicação, troca de token, invalidação, erro), paleta (permissões, busca de ordem + Enter, Esc), `buildNavGroups`/`isNavHrefActive`, paginação vazia, `ClientShell` em telas públicas |
| Build de produção (`next build`, standalone) | Aprovado, 54 rotas |
| E2E Playwright (suíte do projeto) | **15/15 aprovados** — login, multi-tenant, nova venda pela UI, pagamento, permissão de membro, redefinição de senha, NF-e/fechamento, CT-e/MDF-e/CIOT, cobranças |
| `git diff --check` | Aprovado |
| Console do navegador | Sem erros de página nas rotas percorridas |
| Perfil membro | Menu e paleta só com abas liberadas; `/usuarios` redireciona ao início; **nenhum 403** no dashboard |
| Inspeção visual | 1440×900 e 390×844, em 16 rotas (evidências em [`evidence/frontend-redesign/`](./evidence/frontend-redesign/)) |

**Regressões encontradas pelos testes e corrigidas antes da entrega:**
1. E2E de redefinição de senha falhou na 1ª rodada: o hook de features passou a rodar também em telas públicas; sem token, o 401 redirecionava "Esqueci a senha" para o login. Corrigido isolando a moldura autenticada (`PrivateChrome`) e coberto por teste que falha na versão com defeito.
2. E2E da venda: "#3" duplicado (trilha + título). Último item da trilha removido.
3. Dashboard do membro disparava `/relatorios/financeiro` antes de a sessão carregar (403). Consultas condicionadas à sessão.
4. Nome acessível duplicado entre logo e "Início".

**Evidências (antes → depois):** `01/02/03-antes-*` e `11–18-depois-*` em `evidence/frontend-redesign/`.

## 10. Problemas ainda existentes

- Cerca de 35 telas ainda montam o próprio cabeçalho; herdam os tokens, mas a migração para `PageHeader` deve continuar gradualmente.
- `NovaVendaForm.tsx` (1.308 linhas), `financeiro/novo` (831) e `vendas/[id]` (933) seguem grandes; dividir em subcomponentes reduziria re-renderizações e facilitaria testes.
- O `QueryClient` usa `staleTime: 0` / `gcTime: 0` por segurança multi-tenant; com a chave de tenant já no provider, dá para usar cache curto em listas de apoio (vendedores, motoristas, produtos).
- "NF-e rejeitadas" no dashboard conta tentativas rejeitadas no período, mesmo que a venda já tenha uma nota autorizada depois — o backend não expõe "rejeitada sem nota válida posterior".
- Paginação de cobranças continua local (o endpoint não informa total).
- Sem dark mode (não foi requisito; os tokens já permitem).

## 11. Recomendações

1. Endpoint leve `GET /dashboard/pendencias` (vencidos, NF-e pendentes de fato, OCs abertas) para uma única consulta no início.
2. Ordenação por coluna nas listas de vendas e clientes (exige parâmetro `orderBy` no backend).
3. Ações em lote em Contas a receber (ex.: gerar cobranças de vários títulos) quando o backend suportar.
4. Quebrar os três formulários grandes citados em subcomponentes com `React.memo`.
5. Continuar a migração de cabeçalhos para `PageHeader` e de tabelas para um componente `DataTable` com ordenação/estado vazio padronizados.
