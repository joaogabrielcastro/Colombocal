# Limpeza do frontend — Colombocal

Data: 2 de outubro de 2026  
Complementa [colombocal-limpeza.md](./colombocal-limpeza.md) com foco exclusivo em `frontend/`.  
**Nenhum arquivo foi removido nesta auditoria.**

Método: grafo de imports em `frontend/src`, convenções do App Router, imports dinâmicos (`xlsx`), testes, strings de rota e leitura de páginas. Ausência de import = indício, não prova absoluta.

## Classificação

### Remoção com alta confiança

| Item | Evidência | Validação antes de apagar |
|---|---|---|
| `frontend/src/components/TopNav.tsx` (~396 linhas) | Nenhum import; shell usa `Sidebar` via `ClientShell` | Busca final por `TopNav`; suite Vitest/Sidebar; smoke login |
| `frontend/src/components/FluxoOperacional.tsx` | Zero consumidores | Confirmar que produto não planeja remontar o guia; senão mover para feature flag |
| Exports órfãos em `frontend/src/lib/help-texts.ts` (`FLUXO_VENDA_PASSOS`, e similares só usados pelo Fluxo) | Só referenciados pelo componente órfão | Manter textos se o guia voltar |
| `exportarRelatorioVendasPdf` (deprecated) em `features/relatorios-vendas/services/exports.ts` | Página usa `PdfSecao` / `PdfCompleto`; só teste legado chama a API antiga | Remover export + teste legado; validar PDFs dos relatórios |
| Regra CSS `.print-hidden` em `globals.css` | Call sites usam Tailwind `print:hidden` | Grep `print-hidden`; smoke print de contas/financeiro |

### Provavelmente removível (sujeito a validação)

| Item | Evidência | Confiança | Validação |
|---|---|---|---|
| `features/cheques/hooks/useChequesQuery.ts` (+ teste) | Só o próprio teste; financeiro/cliente usam outros caminhos | Alta | Confirmar roadmap sem página `/cheques` |
| `features/relatorios-shared/hooks/useExportCsvAsync.ts` (+ teste) | Relatórios chamam libs diretamente | Alta | Manter `lib/async-export` |
| Variante `BrandLogo` `"sidebar"` | Nunca usada; Sidebar usa `BrandMark`/`BrandWordmark` | Média-alta | Remover só a variante |
| `vite-tsconfig-paths` (devDep) | Aviso Vite 6 + `vitest.config.ts` | Média-alta | Branch + suite completa (já em colombocal-limpeza) |
| `frontend/coverage/**` se versionado | Artefato Vitest | Alta | `.gitignore` + CI artifacts |

### Consolidar por refatoração

| Tema | Arquivos | Objetivo |
|---|---|---|
| Brand | `BrandLogo.tsx` + `components/brand/*` | Uma API pública; dropar TopNav |
| Status título | `display.ts` vs badges inline em `vendas/page.tsx` / `ClienteContaTab` | Helper único Aberto/Parcial/Quitado |
| Status NF-e | `features/nfe/status.tsx` vs classes privadas em `VendaNfeActions` | Um badge |
| Tipo pagamento | maps duplicados em `financeiro/page.tsx` e `vendas/[id]/page.tsx` | `badgeTipoPagamento()` |
| KPI cards | `ContasKpiCards` vs `FiscalKpiCards` | Primitive opcional de KPI |
| List chrome | Listas hand-rolled vs `ListScaffold` | Adotar scaffold |
| Empty states | `EmptyState` vs `<p>Nenhum…` | Preferir EmptyState |
| `ExportActions` | Só financeiro usa | Ampliar ou documentar escopo |
| `ListScaffold` `description` vs `subtitle` | Alias legado | Uma prop |
| `useVendasEmAberto` façade | re-export em financeiro | Importar fonte direta |
| Writers Excel | contas / fiscal / relatorios-vendas | Thin shared writer (opcional) |

### Manter

| Item | Motivo |
|---|---|
| `app/apple-icon.tsx`, `icon.tsx`, `manifest.ts`, `layout.tsx` | Convenção Next — sem import |
| `app/relatorios/titulos/page.tsx` | Redirect legado intencional |
| `app/contas-a-receber/page.tsx` | Alias amigável → contas |
| `Sidebar`, `ClientShell`, `SearchableSelect`, `FreteFeatureGuard`, `FormEnterNavigation`, `PwaRegister` | Em uso |
| Runtime deps (`next`, `react`, `react-query`, `heroicons`, `sonner`, `xlsx`) | Referenciados |
| Features fiscais/contas/relatórios (não deprecated) | Ligados a rotas |

## Inconsistências que não são “código morto”

Documentadas em UX-013 / plano de padronização: labels Salvar vs Registrar vs Receber; posição de botões em dialog vs form; verdes conflitantes em status. Tratar como refatoração de UI, não delete.

## Código comentado

Sem blocos grandes abandonados. Comentários estruturais em SVG/charts — manter.

## Sequência recomendada

1. PR higiene: TopNav + FluxoOperacional + help-texts órfãos + `.print-hidden`.  
2. PR exports: remover `exportarRelatorioVendasPdf` + teste legado.  
3. PR hooks mortos: `useChequesQuery` / `useExportCsvAsync` após OK de produto.  
4. PR consolidação badges/status (junto com glossário UX-013).  
5. `vite-tsconfig-paths` / coverage — alinhar com limpeza repo-wide.

## Buscas realizadas

- Glob de `page.tsx` e `components/**`
- Grep de imports por basename (`TopNav`, `FluxoOperacional`, `useChequesQuery`, `useExportCsvAsync`, `ExportActions`, `BrandLogo`)
- Leitura de `package.json`, `vitest.config`, `ClientShell`, `navigation.ts`
- Subagentes de inventário + limpeza (2026-10-02)

## Relação com limpeza geral

Itens já listados em `colombocal-limpeza.md` (coverage, `vite-tsconfig-paths`, PDF deprecated, BrandLogo) permanecem válidos; este arquivo detalha evidência frontend e candidatos adicionais (`TopNav`, `FluxoOperacional`, hooks).
