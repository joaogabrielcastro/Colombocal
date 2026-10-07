# Modernização do frontend — outubro de 2026

Data de conclusão: 7 de outubro de 2026.

## Escopo concluído

- Acessibilidade do menu lateral, gaveta mobile, seletores pesquisáveis, abas e diálogos.
- Superfície compartilhada de modal com foco contido, fechamento por `Escape`, restauração de foco e bloqueio de rolagem.
- Rótulos e nomes acessíveis nos formulários de vendas, financeiro, fretes, carregamento, fiscal, relatórios, cadastros e configurações.
- Paginação compartilhada nos relatórios e contas a receber onde a API fornece totalização.
- Estados vazios compartilhados em listas, relatórios, cliente e documentos fiscais.
- Responsividade das tabelas e das abas avançadas do detalhe de cliente.
- Padronização das telas de CT-e, MDF-e e CIOT, incluindo filtros, cabeçalhos, estados desabilitados e formulários.
- Mensagens de erro, sucesso e permissão com semântica apropriada para tecnologias assistivas.

## Validação

- Testes unitários/componentes: 51 arquivos e 264 testes aprovados.
- Build de produção Next.js: aprovado, com TypeScript e 46 rotas geradas.
- `git diff --check`: aprovado.
- Playwright/Chromium: 15 de 15 cenários E2E aprovados, cobrindo autenticação, isolamento multi-tenant, vendas, pagamentos, cobranças, permissões, recuperação de senha e documentos fiscais.
- O banco utilizado foi exclusivamente o PostgreSQL de testes (`db-test`, porta 5436), com seed e migrations próprios.
- Inspeção visual aprovada em desktop 1440×900 e mobile 390×844. As capturas 17 a 22 estão em `docs/auditoria/evidence/frontend-ui/`.

## Limites preservados

- Nenhuma regra de negócio, contrato de API ou operação fiscal/financeira real foi alterada.
- A paginação de cobranças permanece local porque o endpoint atual não informa o total de registros.
