# Auditoria Frontend UI/UX — Colombocal

Data: 2 de outubro de 2026  
Referência Git: `fdbc761719a824b4994349d0fc194a8eae7fe2c1` (`main`, ahead of origin)  
Natureza: auditoria heurística + inspeção de código + inspeção visual local com dados sintéticos do seed. Nenhuma mudança funcional foi implementada; alterações já presentes no workspace foram preservadas.

Não há `AGENTS.md` no repositório. Foram usados `README.md`, docs existentes em `docs/auditoria/` e o código do frontend.

## Resumo executivo

A interface já cobre o dia a dia de uma distribuidora de cal: vender, receber (cheque/dinheiro/PIX na mesma tela), acompanhar títulos, frete/pátio e NF-e opcional. Há sinais claros de produto operacional — microcopys corretas (“frete cobrado à parte”, divergência conta × títulos no dashboard), filtros com URL em vendas/financeiro, skeletons, `EmptyState`, toasts com retry e formulário de recebimento bem estruturado.

O maior risco não é estética: é **clareza e segurança nas operações financeiras e de edição**. A edição de venda pode zerar itens após carregar o cliente; o recebimento permanece enviável em ordem quitada e pode completar saldo só com observação; o atalho “Receber” em Contas a receber não pré-seleciona a venda do título; o export do Financeiro usa só a página atual. Em mobile, a lista de vendas fica ilegível por `table-fixed` dentro do viewport.

Em desktop 1440×900 a experiência de consulta e baixa é utilizável. A inconsistência principal é de **vocabulário e caminhos** (Financeiro vs Contas a receber sob Relatórios; Quitado vs Pago; labels de ação) e de **padrões compartilhados incompletos** (ListScaffold parcial, ConfirmDialog sem semântica de diálogo, labels sem `htmlFor` nos formulários de negócio).

**Diagnóstico:** produto operacional maduro o suficiente para uso diário em desktop, com pontos de fricção e risco financeiro que devem ser corrigidos antes de qualquer redesenho visual.

## Escopo e estado inicial

- Ambiente local Docker: frontend `3010`, backend `3011` (saudável).
- Login de teste autorizado: seed `admin@local` (credenciais não reproduzidas neste relatório).
- Screenshots em `docs/auditoria/evidence/frontend-ui/` com redigitação de nomes/documentos do seed onde aplicável.
- Não houve deploy, emissão fiscal de produção, reset de git, exclusão de arquivos ou alteração de regras de negócio.
- Workspace já continha mudanças não commitadas (fiscal, financeiro, UI parcial); a auditoria observa o estado do código no disco + HEAD indicado acima.

## Inventário das telas

~50 rotas App Router (`frontend/src/app/**/page.tsx`). Shell único: `ClientShell` + `Sidebar` (`layout.tsx` raiz apenas).

| Módulo | Rotas |
|---|---|
| Auth / setup | `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`, `/setup`, `/setup/novo-tenant` |
| Dashboard | `/` |
| Cadastros | `/clientes`, `/clientes/novo`, `/clientes/[id]`, `/produtos`, `/vendedores`, `/motoristas` |
| Vendas | `/vendas`, `/vendas/nova`, `/vendas/[id]`, `/vendas/[id]/editar` |
| Financeiro | `/financeiro`, `/financeiro/novo`, `/financeiro/cobrancas`, `/contas-a-receber` → redirect `/relatorios/financeiro` |
| Frete / pátio | `/fretes`, `/fretes/novo`, `/fretes/[id]/editar`, `/carregamento`, `/carregamento/nova`, `/carregamento/[id]/editar` |
| Fiscal | `/fiscal`, `/fiscal/notas`, `/fiscal/notas/[id]`, `/fiscal/cte*`, `/fiscal/mdfe*`, `/fiscal/ciot*`, `/fiscal/fechamento` |
| Relatórios | vendas, financeiro (contas), títulos (redirect), comissões, fretes, carregamento, motoristas |
| Admin | `/usuarios`, `/configuracoes`, `/auditoria` |

**Stack UI:** Next.js 16, React 18, Tailwind 3, Heroicons, Sonner, TanStack Query. UI própria em `components/ui` (sem shadcn/Radix). Tokens: `globals.css` (`.btn-*`, `.card`, `.table-*`) + `primary` no Tailwind + `lib/brand.ts`.

**Nav canônica:** `lib/navigation.ts` + `Sidebar.tsx`. Labels: Dashboard→“Início”; Contas a receber vive em Relatórios.

## Perfis e tarefas identificados

| Perfil | Implementação | Tarefas típicas na UI |
|---|---|---|
| **Admin** | `role: 'admin'` | Tudo + Configurações, Usuários, permissões de menu |
| **Membro** | `role: 'member'` | Telas liberadas por `navPermissions`; `null`/vazio = acesso total às abas (não-admin) |
| Features tenant | `useTenantFeatures` | Frete/pátio/motoristas; NF-e; CT-e/MDF-e/CIOT; CPF cliente |

Não há papéis de “caixa”, “pátio” ou “fiscal” distintos — só recorte de abas. Mutações financeiras destrutivas dependem da permissão da aba (ver auditoria técnica COL-002).

## Matriz de telas e estados inspecionados

Legenda de evidência: **V** = visual (Playwright local); **C** = código; **—** = não exercitado.

| Tela / fluxo | Carregando | Vazio | Com dados | Muitos regs | Erro | Sucesso | Sem permissão | Inválido | Visual? |
|---|---|---|---|---|---|---|---|---|---|
| Login | C | — | V | — | C | V | — | C | Sim (fluxo) |
| Dashboard | C skeleton | — | V | — | C | — | C redirect | — | 1440 |
| Vendas lista | C | C EmptyState | V | C paginação | C | — | C | — | 1440 / 390 |
| Nova venda | C | V form vazio | — | — | C | C toast | — | C | 1440 |
| Detalhe venda | C | — | V | — | C | parcial | — | C alert frete | 1440 |
| Editar venda | C | — | C (risco wipe) | — | C | C | — | C | Código |
| Receber | C | V | C | — | C | C | — | C | 1440 |
| Financeiro lista | C | C | V | C page-only export | C | C estorno | — | — | 1440 / 768 |
| Contas a receber | C | C | V | C Excel 5k | C | — | — | — | 1440 / 1366 |
| Cliente conta | C | C | C | — | C | — | — | — | Código |
| Fretes / OC | C | C | V | — | C | C | FeatureGuard | C alert | 1440 |
| NF-e | C | V | V | — | C | C | feature | C | 1440 |
| Relatório vendas | C | V (pede período) | — | — | C | C | — | C | 1440 |
| Mobile menu | — | — | V | — | — | — | — | — | 390 |

## Achados priorizados

### UX-001 — Edição de venda zera itens ao carregar o cliente

- **Tela/fluxo:** Editar venda (`/vendas/[id]/editar`)
- **Categoria:** Bug de interface / risco operacional
- **Severidade:** Crítico
- **Evidência:** Código — `NovaVendaForm.tsx` efeito em `[clienteId, isEdit]` chama `setItens(...emptyItem())` incondicionalmente (aprox. linha 250), inclusive em edição após o load popular os itens.
- **Confiança:** Alta (caminho inequívoco no código)
- **Arquivos:** `frontend/src/features/vendas/components/NovaVendaForm.tsx`
- **Cenário:** Abrir edição de venda existente com cliente já definido.
- **Problema:** Operador vê linhas vazias / precisa redigitar produtos; risco de salvar venda “vazia” ou errada.
- **Recomendação:** Em `isEdit`, não limpar itens no efeito de cliente; limpar só quando o usuário **trocar** o cliente em modo criação (ou com confirmação).
- **Aceite:** Abrir edição de venda com N itens → após load, N itens e preços permanecem; trocar cliente na criação limpa linhas.
- **Esforço:** Pequeno
- **Riscos:** Regressão no fluxo “mudou cliente → nova tabela de preço”.

### UX-002 — Receber permanece disponível em ordem quitada

- **Tela/fluxo:** `/financeiro/novo`
- **Categoria:** Prevenção de erro financeiro
- **Severidade:** Alto
- **Evidência:** Código — `avisoSemSaldo` só gera `toast.warning`; submit `disabled={salvando}` apenas (`financeiro/novo/page.tsx` ~114–124, ~727). Lista de vendas sempre mostra “Receber” inclusive Quitado.
- **Confiança:** Alta
- **Arquivos:** `financeiro/novo/page.tsx`, `vendas/page.tsx`
- **Problema:** Facilita baixa indevida / troco / erro de API confuso.
- **Recomendação:** Desabilitar submit quando `saldo < 0.01`, ocultar ou desabilitar atalho “Receber” em quitadas; fluxo explícito “registrar troco” se necessário.
- **Aceite:** Ordem quitada → botão Receber desabilitado com motivo; atalho da lista ausente ou desabilitado.
- **Esforço:** Pequeno

### UX-003 — Contas “Receber” não pré-seleciona a venda do título

- **Tela/fluxo:** Contas a receber → Receber
- **Categoria:** Fluxo / risco de erro
- **Severidade:** Alto
- **Evidência:** Código — `ContasPorTituloPanel.tsx` link só com `clienteId`; vendas lista passa `clienteId&vendaId&ordem`.
- **Confiança:** Alta
- **Problema:** Cliente com várias ordens abertas → baixa na ordem errada.
- **Recomendação:** Incluir `vendaId` e `ordem` no deep link (mesmo padrão da lista de vendas).
- **Aceite:** Clique Receber no título abre formulário com ordem já travada/selecionada.
- **Esforço:** Pequeno

### UX-004 — Observação sem valor completa o saldo integral

- **Tela/fluxo:** Receber pagamento
- **Categoria:** Prevenção de erro
- **Severidade:** Alto
- **Evidência:** Código — `podeCompletarSaldo` quando há obs e valor vazio (`financeiro/novo` ~248–258).
- **Confiança:** Alta
- **Problema:** Intenção de parcial ou só anotar vira quitação total.
- **Recomendação:** Completar saldo só via botão explícito “Usar saldo restante”; nunca só por observação.
- **Aceite:** Obs sem valor → erro pedindo valor; botão “Preencher saldo” opcional.
- **Esforço:** Pequeno

### UX-005 — Export Financeiro = página atual (não o filtro)

- **Tela/fluxo:** `/financeiro` Excel/PDF
- **Categoria:** Clareza / confiabilidade
- **Severidade:** Alto
- **Evidência:** Código — `pagamentos.map` na página corrente; UI mostra total filtrado de todas as páginas. Contas a receber já pagina o Excel corretamente.
- **Confiança:** Alta (código) + visual confirma totais
- **Screenshot:** `evidence/frontend-ui/04-financeiro.png`
- **Problema:** Relatório incompleto usado como se fosse a carteira filtrada.
- **Recomendação:** Fetch paginado como Contas; ou rotular “Exportar página atual” com destaque.
- **Aceite:** Export com filtro X inclui todos os registros do filtro (ou aviso inequívoco de página).
- **Esforço:** Médio

### UX-006 — Aba Conta do cliente mostra venda inteira como débito vermelho

- **Tela/fluxo:** Cliente → Conta
- **Categoria:** Clareza financeira
- **Severidade:** Alto
- **Evidência:** Código — `ClienteContaTab.tsx` renderiza `-valorTotal` em vermelho para cada venda, sem saldo em aberto da ordem; resumo oficial é por títulos.
- **Confiança:** Alta
- **Problema:** Parece que tudo continua em aberto; conflita com “Em aberto (títulos)” e com Contas a receber.
- **Recomendação:** Por venda: saldo em aberto + status (Quitado/Parcial/Aberto); manter títulos como fonte oficial.
- **Aceite:** Venda quitada não aparece como débito integral vermelho.
- **Esforço:** Médio

### UX-007 — Lista de vendas ilegível em celular (`table-fixed`)

- **Tela/fluxo:** `/vendas` em 390×844
- **Categoria:** Responsividade
- **Severidade:** Alto (consulta móvel)
- **Evidência:** Visual — cabeçalhos/colunas colidem; código usa `table-fixed w-full` dentro de `overflow-x-auto`, o que impede scroll horizontal útil.
- **Screenshot:** `evidence/frontend-ui/13-vendas-mobile-390.png`
- **Confiança:** Alta (visual + código)
- **Problema:** Consulta rápida de ordem/status no celular falha.
- **Recomendação:** Remover `table-fixed` ou usar `min-w-[…]` na tabela para forçar scroll; colunas prioritárias Ordem/Cliente/Total/Status/Receber; filtros colapsados por padrão no mobile.
- **Aceite:** Em 390px, tabela legível via scroll horizontal sem sobreposição; CTA Nova/Receber acessível.
- **Esforço:** Médio

### UX-008 — Cabeçalhos Ordem/Data colidem em desktop denso

- **Tela/fluxo:** Lista de vendas (frete + NF-e ligados)
- **Categoria:** Legibilidade
- **Severidade:** Médio
- **Evidência:** Visual 1440 — “ORDEMDATA” aparenta fundido; HTML tem dois `<th>`, mas `colgroup` com % estreitos + `table-fixed` comprime.
- **Screenshot:** `evidence/frontend-ui/02-vendas-lista.png`
- **Recomendação:** Larguras mínimas em px/`min-w`, não % rígidos; hierarquia de colunas secundárias.
- **Aceite:** “Ordem” e “Data” legíveis e separados em 1366 e 1440.
- **Esforço:** Pequeno

### UX-009 — “Gerar OC” sem proteção contra duplicata

- **Tela/fluxo:** Detalhe da venda
- **Categoria:** Prevenção de erro operacional
- **Severidade:** Médio
- **Evidência:** Código — `gerarOrdemCarregamento` sem confirmar se já há OC listada; toast de sucesso e impressão.
- **Screenshot contexto:** `12-venda-detalhe.png` (botão “Gerar OC” no header)
- **Recomendação:** Se já existir OC vinculada, confirmar “Gerar outra OC?”; listar OCs existentes perto do botão.
- **Aceite:** Segunda geração exige confirmação explícita.
- **Esforço:** Pequeno

### UX-010 — Cancelar venda sem toast de sucesso

- **Tela/fluxo:** Detalhe venda → Cancelar
- **Categoria:** Feedback
- **Severidade:** Médio
- **Evidência:** Código — `DELETE` + `router.push('/vendas')` sem `toast.success`.
- **Problema:** Dúvida se cancelou ou só voltou.
- **Recomendação:** Toast “Venda #N cancelada” antes/ao redirecionar.
- **Aceite:** Após cancelar, lista com feedback inequívoco.
- **Esforço:** Pequeno

### UX-011 — Nenhum aviso de alterações não salvas

- **Tela/fluxo:** Venda, receber, frete, OC, configs
- **Categoria:** Recuperação / prevenção
- **Severidade:** Médio
- **Evidência:** Grep sem `beforeunload` / unsaved blocker no frontend.
- **Problema:** Voltar/fechar perde digitação longa (comum em venda e recebimento composto).
- **Recomendação:** Guard em formulários longos (venda, receber, cliente, frete) com `ConfirmDialog`.
- **Aceite:** Com dirty state, navegar para trás pede confirmação.
- **Esforço:** Médio

### UX-012 — Contas a receber sob “Relatórios” (IA)

- **Tela/fluxo:** Navegação
- **Categoria:** Arquitetura de informação
- **Severidade:** Médio
- **Evidência:** Visual — item ativo em Relatórios; `/contas-a-receber` só redireciona; operação diária de cobrança não é “relatório”.
- **Screenshot:** `06-contas-receber.png`
- **Recomendação concreta de menu:**
  1. **Operação:** Início · Vendas · **Receber** (`/financeiro/novo`) · **Contas a receber** · Financeiro (extrato de baixas)
  2. **Cadastros:** Clientes · Produtos · Vendedores · Motoristas
  3. **Logística** (se frete): Fretes · Carregamento
  4. **Fiscal**
  5. **Relatórios** (análises/exportações, sem duplicar Contas)
  6. **Sistema / Admin**
- **Facilita:** Cobrança diária em 1 clique a partir da operação, não do submenu de relatórios.
- **Aceite:** Contas a receber acessível no grupo Operação/Financeiro; Relatórios não é o único caminho.
- **Esforço:** Médio (nav + permissões)

### UX-013 — Vocabulário inconsistente de status e ações

- **Categoria:** Consistência
- **Severidade:** Médio
- **Evidência:** “Quitado/Parcial/Aberto” (vendas) vs “Pago” (`display.ts`); Salvar / Registrar / Receber / Emitir; Cancelar vs Voltar (fiscal).
- **Recomendação:** Glossário único — status de título: Aberto / Parcial / Quitado; ações primárias por domínio (ver plano).
- **Esforço:** Médio (consolidação)

### UX-014 — ConfirmDialog sem semântica de modal acessível

- **Categoria:** Acessibilidade
- **Severidade:** Médio
- **Evidência:** Código — sem `role="dialog"`, `aria-modal`, trap de foco, Escape, restore focus (`confirm-dialog.tsx`).
- **Problema:** Estornos/cancelamentos críticos ruins para teclado/leitor de tela.
- **Aceite:** Escape fecha; foco preso; retorno ao gatilho; `aria-labelledby`.
- **Esforço:** Médio

### UX-015 — Labels de formulário de negócio sem associação

- **Categoria:** Acessibilidade / formulários
- **Severidade:** Médio
- **Evidência:** `htmlFor` só em auth; Nova venda, receber, frete, ClienteForm usam `<label>` visual; cheques com placeholder-only.
- **Aceite:** Todo input tem nome acessível; cheque rows com label ou `aria-label`.
- **Esforço:** Médio/grande (várias telas)

### UX-016 — NF-e: justificativa de cancelamento não validada no cliente

- **Categoria:** Feedback / erro evitável
- **Severidade:** Médio
- **Evidência:** Copy menciona ≥15 caracteres; submit sem check local (`VendaNfeActions.tsx`).
- **Aceite:** Botão desabilitado ou erro inline até 15 chars.
- **Esforço:** Pequeno

### UX-017 — Validação com `alert()` nativo em frete/venda

- **Categoria:** Consistência de feedback
- **Severidade:** Baixo
- **Evidência:** `fretes/novo`, frete na venda detalhe usam `alert()`; resto usa toast/`setErro`.
- **Aceite:** Mesmo padrão Sonner/erro inline.
- **Esforço:** Pequeno

### UX-018 — Persistência de filtros incompleta

- **Categoria:** Eficiência operacional
- **Severidade:** Médio
- **Evidência:** Forte em `/vendas` e `/financeiro`; parcial em contas; fraca em fretes, carregamento, relatório de vendas.
- **Problema:** Voltar da edição perde contexto de busca.
- **Aceite:** Filtros principais das listas operacionais na URL.
- **Esforço:** Médio

### UX-019 — Cheque sem ciclo de vida / edição

- **Categoria:** Fluxo (alinhado ao README)
- **Severidade:** Melhoria / limitação de produto
- **Evidência:** README — cheques registrados abatem na hora; UI só registra + estorna; sem compensado/devolvido/editar número.
- **Nota:** Não é bug se for decisão de produto; operadores precisam saber que correção = estorno + novo registro.
- **Recomendação:** Copy explícita na UI + eventual edição de metadados sem reabrir saldo.
- **Esforço:** Pequeno (copy) / Grande (ciclo completo)

### UX-020 — Dualidade conta corrente × títulos sem unificação visual

- **Categoria:** Clareza financeira
- **Severidade:** Médio (já há alerta no dashboard — ponto positivo)
- **Evidência:** Visual dashboard avisa divergência; Contas e Cliente Conta ainda convivem com dois modelos.
- **Recomendação:** Sempre rotular “oficial = títulos”; extrato único cronológico como fase 2.
- **Esforço:** Grande (extrato unificado)

### UX-021 — Processamento NF-e sem polling

- **Categoria:** Feedback
- **Severidade:** Baixo / Melhoria
- **Evidência:** Status `processando` exige “Consultar” manual.
- **Aceite:** Auto-consulta a cada N s enquanto processando, com stop on unmount.
- **Esforço:** Pequeno

### UX-022 — Idempotência só em recebimentos

- **Categoria:** Bug técnico → UX
- **Severidade:** Médio
- **Evidência:** `Idempotency-Key` em receber; venda/frete/OC/NF-e dependem só de `disabled`.
- **Problema:** Rede lenta + retry pode duplicar venda/OC.
- **Esforço:** Médio (coordenar com backend)

## Evidências

Diretório: [`docs/auditoria/evidence/frontend-ui/`](./evidence/frontend-ui/)

| Arquivo | Conteúdo |
|---|---|
| `01-dashboard-1440.png` | Dashboard operacional + alerta divergência |
| `02-vendas-lista.png` | Lista densa, badges, colunas comprimidas |
| `03-vendas-nova.png` | Form progressivo (“Adicionar detalhes”) |
| `04-financeiro.png` | Extrato de recebimentos |
| `05-receber.png` | Fluxo numerado 1–2 bem estruturado |
| `06-contas-receber.png` | KPIs, aging, sob Relatórios |
| `12-venda-detalhe.png` | Header com muitas ações + frete à parte |
| `13-vendas-mobile-390.png` | Tabela ilegível |
| `14-menu-mobile.png` | Drawer móvel funcional |
| `15-financeiro-tablet-768.png` | Tablet |
| `16-contas-notebook-1366.png` | Notebook |

Nomes/documentos do seed foram redigidos nas capturas sensíveis. Credenciais não constam neste relatório.

## Pontos positivos comprovados

1. **Receber pagamento** com passos numerados, busca por ordem e composição cheque+dinheiro+PIX — visualmente claro (`05-receber.png`).
2. **Dashboard** prioriza Nova venda / Receber e expõe divergência financeira com orientação (`01-dashboard-1440.png`).
3. **Contas a receber** com KPIs, aging e distinção vencido/a vencer (`06-contas-receber.png`).
4. **Detalhe da venda** deixa explícito “Pago nos títulos / Saldo” e “frete cobrado à parte” (`12-venda-detalhe.png`).
5. **Filtros de vendas** com Aplicar/Limpar/Mais filtros e totais filtrados vs subtotal da página (evita confusão de total — padrão a replicar no export do Financeiro).
6. **Sidebar** com item ativo visível; menu mobile com overlay e Escape.
7. **Infra de UX:** `reportApiError` + retry, skeletons, `EmptyState`, `FormEnterNavigation` (Enter avança campo — útil em ERP), `SearchableSelect` com teclado parcial.
8. **NF-e na criação:** venda pode gravar mesmo se emissão falhar (toast específico) — bom recovery.

## Limitações

- Sem testes com usuários reais; severidades e frequências são estimativas de especialista + evidência código/visual.
- CT-e/MDF-e/CIOT desligados no tenant seed (`features.cte/mdfe/ciot: false`) — telas não renderizadas com dados; analisadas por código.
- Perfis membro com permissões parciais e “sem permissão” UI não foram exercitados visualmente (só caminho de código/`canAccessPath`).
- Contraste WCAG: inspeção pontual, sem auditoria automatizada axe em todas as rotas.
- Desempenho: sem medições Lighthouse; apenas padrões de código (Query, dynamic `xlsx`).
- Detalhe da venda capturado em ordem com dados seed; não se validou visualmente o wipe da edição (evidência só código).
- Não se afirma certificação WCAG.

## Glossário sugerido (para padronização)

| Conceito | Termo único | Evitar |
|---|---|---|
| Título sem saldo | Quitado | Pago (reservar para linha de pagamento) |
| Título com parte paga | Parcial | — |
| Título integral em aberto | Aberto | Pendente (usar só frete/recibo) |
| Baixa | Receber pagamento | Registrar pagamento (exceto docs internos) |
| Documento pátio | Ordem de carregamento (OC) | — |
| Extrato de baixas | Financeiro | Contas a receber |

---

Entregáveis irmãos: [plano de melhorias](./frontend-plano-de-melhorias.md) · [limpeza frontend](./frontend-limpeza.md)
