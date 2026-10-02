# Plano de melhorias Frontend UI/UX — Colombocal

Base: [frontend-ui-ux.md](./frontend-ui-ux.md)  
Data: 2 de outubro de 2026  
Regra: preservar regras de negócio; não redesenhar o sistema de uma vez; reutilizar `components/ui`, Tailwind e padrões existentes.

Tamanhos: **P** ≤ 1 dia · **M** 2–5 dias · **G** > 1 semana (incluindo testes).

---

## 1. Bugs de interface e riscos operacionais

| ID | Mudança | Aceite | Deps | Tam. |
|---|---|---|---|---|
| UX-001 | Em edição, não zerar itens no `useEffect` de `clienteId`; limpar só em troca intencional na criação | Editar venda mantém itens após load | Nenhuma | P |
| UX-002 | Bloquear submit de receber se saldo &lt; 0,01; desabilitar atalho Receber em quitadas | Ordem quitada não registra baixa “normal” | UX-004 | P |
| UX-003 | Deep link Contas→Receber com `vendaId` + `ordem` | Título abre recebimento na ordem certa | Nenhuma | P |
| UX-004 | Remover auto-preenchimento de saldo por observação; botão “Usar saldo restante” | Obs sem valor não quita | UX-002 | P |
| UX-005 | Export Financeiro busca todas as páginas do filtro (padrão Contas) ou rotula “página atual” | Excel/PDF = universo filtrado ou aviso claro | API paginação já existe | M |
| UX-009 | Confirmar segunda OC na mesma venda | Duplicata exige confirmação | ConfirmDialog a11y (UX-014) opcional | P |
| UX-010 | Toast ao cancelar venda | Feedback após DELETE | Nenhuma | P |
| UX-016 | Validar 15 chars na justificativa NF-e no cliente | Submit bloqueado até válido | Nenhuma | P |
| UX-017 | Trocar `alert()` por toast/erro inline (frete) | Sem dialog nativo do browser | Nenhuma | P |
| UX-022 | Idempotência/UI anti-duplo post em venda e OC (coordenar backend) | Retry não duplica documento | Backend | M |

**Ordem sugerida nesta seção:** 001 → 003 → 004 → 002 → 010 → 009 → 016 → 017 → 005 → 022.

---

## 2. Melhorias nos fluxos principais

### 2.1 Venda (criar → consultar → editar/cancelar)

| Mudança | Aceite | Tam. |
|---|---|---|
| Manter progresso visual da nova venda (cliente → itens → NF-e); expandir “Adicionar detalhes” só quando necessário | Fluxo atual preservado, sem wizard extra | — (manter) |
| UX-011: dirty guard em nova/editar | Sair com alterações pede confirmação | M |
| Após cancelar: toast + permanecer possível ver histórico se produto permitir (hoje DELETE remove da lista) | Operador sabe o resultado | P |
| Lista: não mostrar Receber em Quitado (UX-002) | Menos clique errado | P |

**Proposta de organização do detalhe (sem implementar):**

1. **Header:** Ordem · data · cliente · saldo (pago / em aberto)  
2. **Ações primárias à direita:** Receber · Editar (se permitido)  
3. **Secundárias em menu “Mais”:** Imprimir O.S. · PDF frete · Gerar OC · Cancelar  
4. **Corpo:** Itens → Títulos → Recebimentos → Frete → NF-e  
5. **Mobile:** saldo + Receber fixos; tabela de itens com scroll

### 2.2 Contas + receber + parcial

| Mudança | Aceite | Tam. |
|---|---|---|
| UX-003 + UX-004 + UX-002 | Baixa correta e intencional | P |
| Resumo antes do submit: cliente · ordem · total · saldo após baixa | Operador confirma efeito | M |
| Contas: persistir na URL status/período/ordenação (UX-018) | Voltar da baixa restaura lista | M |

### 2.3 Saldo / histórico cliente

| Mudança | Aceite | Tam. |
|---|---|---|
| UX-006: vendas com saldo/status, não `-valorTotal` cego | Conta não contradiz títulos | M |
| Copy fixa: “Cobrança oficial = títulos” no topo da aba Conta | Mesma mensagem do dashboard | P |

### 2.4 Cheque

| Mudança | Aceite | Tam. |
|---|---|---|
| UX-019 copy: “Cheque abate na hora; para corrigir, estorne e registre de novo” | Expectativa alinhada ao README | P |
| (Opcional produto) editar banco/número sem estornar | Metadados corrigíveis | G |

### 2.5 Frete / pátio

| Mudança | Aceite | Tam. |
|---|---|---|
| UX-009 + filtros na URL | Menos OC duplicada; volta com contexto | P+M |
| Frete novo em `<form>` para Enter-nav consistente | Paridade com outras telas | P |

### 2.6 Relatórios / NF-e

| Mudança | Aceite | Tam. |
|---|---|---|
| UX-005; filtros relatório vendas na URL | Export e refresh confiáveis | M |
| UX-016 + UX-021 polling processando | Menos erro SEFAZ e menos “Consultar” manual | P |

### 2.7 Reorganização de menu (UX-012)

Estrutura alvo:

```
OPERAÇÃO
  Início
  Vendas
  Receber              → /financeiro/novo
  Contas a receber     → /relatorios/financeiro (ou alias /contas-a-receber)
  Financeiro           → extrato de baixas /financeiro

CADASTROS
  Clientes · Produtos · Vendedores · Motoristas*

LOGÍSTICA* (frete)
  Fretes · Carregamento

FISCAL*
RELATÓRIOS            (sem duplicar Contas)
SISTEMA / ADMIN
```

\*conforme feature flags.

**Aceite:** Cobrança diária alcançável sem abrir Relatórios; permissões `rel_financeiro` / `financeiro` mapeadas sem regressão.  
**Tam.:** M · **Risco:** treinar usuários no novo agrupamento.

---

## 3. Padronização visual (enxuta)

Reutilizar `btn-primary|secondary|danger`, `input-field`, `card`, `table-*`, `ListScaffold`, `FilterBar`, `EmptyState`, `ConfirmDialog`, Sonner.

| Elemento | Padrão |
|---|---|
| Título página | `text-2xl font-bold` + subtítulo 1 linha opcional |
| Ação primária | `btn-primary`, uma por viewport de formulário; à esquerda no form (padrão atual) |
| Secundária | `btn-secondary` / link |
| Destrutiva | `btn-danger` + ConfirmDialog; nunca ao lado do CTA mais usado sem hierarquia |
| Campos | Label persistente + `htmlFor`; `*` só obrigatório; erro sob o campo |
| Tabelas | Números `tabular-nums text-right`; status badge compartilhado; sticky ações se ≥6 colunas |
| Filtros | `FilterBar`; Aplicar + Limpar; chips de ativos; URL sync nas listas operacionais |
| Status título | Aberto (vermelho suave) · Parcial (âmbar) · Quitado (verde) — um helper |
| Status NF-e | `NfeStatusBadge` único |
| Modais | ConfirmDialog com a11y (seção 4) |
| Vazio | `EmptyState` com CTA quando fizer sentido |
| Loading | Skeleton de lista/detalhe/form já existentes |
| Erros | `reportApiError` com título humano; evitar só “Erro ao processar” |
| Toast | Sucesso específico (“Venda #12 registrada”); essencial também no próprio fluxo, não só toast 6,5s |

**Telas prioritárias para aplicar o padrão:** vendas lista/detalhe, receber, contas, financeiro export, cliente conta.

**Tam. consolidação badges/labels:** M.

---

## 4. Responsividade e acessibilidade

| ID | Mudança | Aceite | Tam. |
|---|---|---|---|
| UX-007/008 | Tirar `table-fixed` das listas densas ou `min-w` + scroll real; filtros colapsados no mobile | 390/768/1366/1440 legíveis | M |
| UX-014 | Dialog: role, aria-modal, Escape, trap, restore | Teclado completo em estorno/cancel | M |
| UX-015 | Labels associados + aria em cheques/qty | Inputs nomeados | M |
| Sidebar | `aria-expanded` em Fiscal/Relatórios; `inert` no drawer fechado; contraste labels Sistema | Nav anunciável | P |
| Contraste | Revisar `text-gray-400` em `gray-50` e `text-gray-600` na sidebar escura | Texto secundário ≥ 4.5:1 onde for conteúdo | P |
| Mobile ops | Priorizar consulta vendas + receber + menu; não cardificar todas as tabelas | Comparação entre linhas preservada via scroll | M |

Referência WCAG 2.2 AA — sem declaração de certificação.

---

## 5. Desempenho percebido

| Achado | Tipo | Ação | Tam. |
|---|---|---|---|
| Dynamic import de `xlsx` | Bom | Manter | — |
| Export Financeiro página-a-página | Risco funcional (UX-005) | Corrigir fetch completo | M |
| Listas com take=20 | Adequado | Não virtualizar sem dor medida | — |
| NF-e processando | Percepção “travado” | Polling leve UX-021 | P |
| Compiling toast Next em dev | Só local | Ignorar em produção | — |

Não recomenda-se memoização/virtualização em massa sem métrica.

---

## 6. Melhorias adicionais

| Item | Nota | Tam. |
|---|---|---|
| Migrar listas manuais → `ListScaffold` + `EmptyState` | Consistência chrome | M |
| Ampliar `ExportActions` | Um padrão de botões PDF/Excel | P |
| Glossário Quitado/Pago (UX-013) | Um PR só de strings/helpers | P |
| Extrato unificado cliente (UX-020) | Produto; após estabilizar títulos | G |
| Guia operacional (substituir `FluxoOperacional` órfão) | Só se produto quiser onboarding | M |
| Limpeza de código morto | Ver [frontend-limpeza.md](./frontend-limpeza.md) | P |

---

## Ordem sugerida de implementação

### Fase A — risco financeiro (1–3 dias)
1. UX-001 edição itens  
2. UX-003 deep link  
3. UX-004 + UX-002 receber seguro  
4. UX-010 toast cancelamento  

### Fase B — confiança nos dados (3–5 dias)
5. UX-005 export financeiro  
6. UX-006 conta cliente  
7. UX-009 OC duplicada  
8. UX-016 / UX-017 / UX-021  

### Fase C — produtividade e mobile (1 sprint)
9. UX-007/008 tabelas  
10. UX-018 filtros URL  
11. UX-012 menu Contas na operação  
12. UX-011 unsaved guard  

### Fase D — consistência e a11y (contínuo)
13. UX-013/014/015 padronização  
14. Limpeza órfãos  
15. Extrato unificado / ciclo cheque (só com decisão de produto)

### Baixo esforço / alto benefício
- UX-001, UX-003, UX-004, UX-002, UX-010, UX-016, UX-017, copy do cheque (UX-019).

### Exigem mais cuidado
- UX-012 (menu/permissões), UX-005 (expectativa de relatório), UX-006/020 (modelo mental financeiro), UX-022 (backend), ciclo de vida de cheque.

---

## Critérios transversais de pronto

- [ ] Achado fechado com teste automatizado quando for bug (Vitest/E2E).  
- [ ] Screenshot ou checklist nos viewports relevantes se for responsivo.  
- [ ] Sem mudança de regra de negócio sem alinhamento explícito.  
- [ ] Sem remover validações financeiras para “simplificar”.
