# Inventário de limpeza segura

Nenhum item foi removido. A classificação considera imports, reexports, convenções do Next.js, scripts, CI, Docker e uso operacional conhecido.

| Caminho ou dependência | Categoria | Evidência | Confiança | Risco | Validação antes de remover |
|---|---|---|---:|---:|---|
| `backend/coverage/tmp/*.json` e demais artefatos de cobertura versionados | Remoção com alta confiança | 69 arquivos sob diretórios `coverage/` estão rastreados; são saídas reproduzíveis de teste, não fontes | Alta | Baixo | Executar cobertura, confirmar `.gitignore`, verificar que CI publica artefato sem depender do Git |
| `frontend/coverage/**` | Remoção com alta confiança | HTML/JS/CSS gerado pelo Vitest está versionado e as buscas encontram cópias de fontes dentro dele | Alta | Baixo | Mesmo procedimento; preservar somente configuração e thresholds |
| `e2e/playwright-report/index.html` | Remoção com alta confiança | Relatório gerado do Playwright; não é consumido pelo app | Alta | Baixo | Gerar relatório em CI e confirmar upload como artifact |
| `e2e/test-results/.last-run.json` | Remoção com alta confiança | Estado transitório da última execução | Alta | Baixo | Rodar Playwright e confirmar recriação/ignore |
| `vite-tsconfig-paths` + plugin em `frontend/vitest.config.ts` | Provavelmente removível | Vitest exibiu aviso de que Vite já possui `resolve.tsconfigPaths`; único uso direto é a config | Média/alta | Baixo | Remover em branch, habilitar opção nativa apropriada e executar toda a suite/build |
| `exportarRelatorioVendasPdf` em `features/relatorios-vendas/services/exports.ts` | Provavelmente removível | Export marcado deprecated; uso encontrado apenas no próprio teste, enquanto a página usa `...PdfSecao` e `...PdfCompleto` | Alta | Baixo | Buscar consumidores externos/publicados, remover teste legado e validar exports de todos os relatórios |
| `backend/src/services/recebiveis.js` e `backend/src/domain/financeiro/recebiveis.js` | Consolidação recomendada | Camada de compatibilidade/reexport coexistindo com implementação de domínio; há consumidores dos dois caminhos | Alta | Médio | Migrar imports em mudança isolada, rodar 511+ testes, só então apagar façade |
| `backend/src/lib/prisma.js::ensureDatabaseCompat` e migrations/scripts manuais equivalentes | Consolidação recomendada | DDL runtime duplica responsabilidades de migrations e contém compatibilidade histórica | Alta | Alto | Inventariar cada banco, comparar `_prisma_migrations`/schema, backup + restauração ensaiada, migration reconciliadora |
| Providers mock que geram chave por `padEnd` | Manter em testes; restringir | Comportamento é útil para mocks, mas não deve vazar para validação real | Alta | Médio | Confirmar que seleção do provider mock é impossível em produção e adicionar guard de startup |
| `frontend/src/app/apple-icon.tsx` e arquivos App Router sem import | Manter | Descoberta por convenção do Next; ausência de import não indica desuso | Alta | Alto se removido | Verificar documentação/manifest/build antes de qualquer mudança |
| Migrations em `backend/prisma/migrations/**` | Manter | Histórico aplicado/implantável, não depende de import | Alta | Crítico se removido | Nunca reescrever histórico aplicado; usar migration nova |
| Scripts `legacy:*`, `db:recover`, backup/restore e SQL manual | Provavelmente removível somente após operação confirmar | Referenciados em `package.json` e documentação; podem ser runbooks de recuperação/importação | Média | Alto | Identificar responsável, último uso, ambientes dependentes e arquivar runbook antes de retirar |
| Referências a Nuvem Fiscal | Manter estado atual (ausente) | Busca case-insensitive por `nuvem fiscal`/`nuvemfiscal` não encontrou código-fonte/configuração fora de artefatos excluídos | Alta | Baixo | Repetir busca após limpar artefatos e conferir secrets/infra fora do repositório |
| `BrandLogo.tsx` versus componentes em `components/brand/` | Consolidação a investigar | Existem abstrações de marca semelhantes; a busca por nome não basta para definir equivalência visual/semântica | Média | Baixo | Mapear imports, snapshots e usos responsivos; escolher API única sem redesenho |
| Dependências npm em geral | Não verificável nesta execução | `npm audit` não obteve resposta; não há base para afirmar ausência/presença explorável | Baixa | Desconhecido | Repetir scanner com rede, registrar versão, caminho de uso e explorabilidade antes de priorizar |

## Sequência recomendada para limpeza

1. Atualizar `.gitignore` e retirar apenas cobertura/relatórios gerados em PR próprio.
2. Remover o export deprecated com busca final e suite verde.
3. Substituir `vite-tsconfig-paths` somente depois de estabilizar COL-008.
4. Consolidar a façade de recebíveis sem alterar regra financeira.
5. Tratar compatibilidade de banco como projeto operacional separado; não misturar com limpeza cosmética.

## Buscas realizadas

- `git ls-files` para diferenciar arquivos rastreados de saídas locais.
- `rg` por basename, imports, funções exportadas, scripts, rotas, Nuvem Fiscal e dependências.
- Leitura de `package.json`, configs Vitest/Next, workflows, Docker e convenções do App Router.

Ausência de correspondência foi usada apenas como indício. Candidatos com possível uso operacional ou descoberta por convenção foram mantidos.
