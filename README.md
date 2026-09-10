# Colombocal — Sistema de Gestão Comercial

Sistema de gestão comercial para distribuidora de cal: vendas, financeiro, frete, carregamento e relatórios. Multi-empresa (tenant), com login e permissões por tela.

## Funcionalidades

- **Login e usuários** — JWT, papéis (admin/usuário) e permissões de menu. Primeiro admin em `/setup`; convites em `/usuarios`
- **Clientes** — Cadastro (CNPJ via BrasilAPI; CPF em alguns tenants), conta corrente, preços especiais e comissão por produto
- **Produtos** — Cadastro com unidade, preço padrão e dados fiscais (NCM/CFOP)
- **Vendedores** — Comissão percentual (e regras específicas por cliente/produto)
- **Vendas** — Itens, preço da venda, motorista, observações e baixa de estoque
- **Financeiro** — Títulos a receber, pagamentos (dinheiro/transferência) e cheques (Recebido → Depositado → Compensado / Devolvido)
- **Fretes e carregamento** — Frete da venda, movimentos avulsos e ordens de pátio (podem ficar ocultos em tenants sem frete)
- **Motoristas** — Cadastro para vincular a vendas e relatórios
- **Dashboard** — KPIs do período
- **Relatórios** — Vendas (KPIs, evolução, rankings, produtos por cliente, PDF/Excel), comissões, contas a receber, fretes, carregamento e motoristas
- **Auditoria** — Trilha de operações relevantes
- **NF-e** — Opcional, desligada por padrão. Ver [docs/nfe-homologacao-producao.md](docs/nfe-homologacao-producao.md)

## Pré-requisitos

- [Node.js](https://nodejs.org) **20.19+** (frontend e imagens Docker usam Node 20)
- [Docker](https://docker.com) Desktop (PostgreSQL, Redis e, no fluxo recomendado, a stack inteira)

## Instalação e execução

### Fluxo recomendado (Docker Compose)

Na raiz do repositório:

```bash
docker compose up --build
```

| Serviço   | URL / porta                         |
| --------- | ----------------------------------- |
| Frontend  | http://localhost:3010               |
| Backend   | http://localhost:3011 (`/health`, `/ready`) |
| PostgreSQL | `localhost:5435`                   |
| Redis     | `localhost:6380` (fila de export CSV) |

O backend espera o banco, aplica `prisma migrate deploy` e sobe a API. Dados de exemplo:

```bash
docker compose exec backend npm run db:seed
```

Primeiro acesso: **http://localhost:3010** → `/login`. Após o seed (não-produção): `admin@local` / `admin123`. Sem seed, crie o admin em `/setup` (use o `SETUP_SECRET` do `docker-compose.yml`).

### Rodar frontend e backend na máquina (banco no Docker)

1. Suba só o banco (e o Redis, se for testar export assíncrono):

```bash
docker compose up -d db redis
```

2. Backend:

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

A API escuta na **3011** por padrão. Aponte `DATABASE_URL` para o Postgres do Compose, por exemplo:

`postgresql://postgres:colombocal_dev@localhost:5435/colombocal_dev`

`REDIS_URL` (opcional): `redis://localhost:6380`

3. Frontend (outro terminal):

```bash
cd frontend
npm install
```

Crie `frontend/.env.local` com `NEXT_PUBLIC_API_ORIGIN=http://localhost:3011` e rode `npm run dev` (porta **3010**).

## Estrutura do projeto

```
Colombocal/
├── docker-compose.yml
├── docs/                          # NF-e, backup, legado, arquitetura
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   ├── scripts/                   # seed, tenants, testes de DB, legado
│   └── src/
│       ├── index.js
│       ├── routes/
│       ├── application/use-cases/
│       ├── domain/
│       ├── middleware/            # auth, permissões de menu
│       └── services/
└── frontend/
    └── src/
        ├── app/                   # rotas Next.js (App Router)
        ├── features/              # vendas, clientes, relatórios, …
        ├── components/
        └── lib/
```

## Tech stack

| Camada         | Tecnologia                                      |
| -------------- | ----------------------------------------------- |
| Frontend       | Next.js 16 (App Router) + TypeScript + React 18 |
| Estilização    | Tailwind CSS 3                                  |
| Dados (UI)     | TanStack Query                                  |
| Backend        | Node.js + Express                                |
| ORM            | Prisma 5                                        |
| Banco          | PostgreSQL 15                                   |
| Fila (export)  | Redis 7 + BullMQ                                |
| Auth           | JWT + bcrypt                                    |
| Consulta CNPJ  | BrasilAPI                                       |

## Variáveis de ambiente (resumo)

Não commite `.env`. No Compose, os valores de desenvolvimento já estão no `docker-compose.yml`.

**Backend (principais)**

| Variável        | Uso |
| --------------- | --- |
| `DATABASE_URL` | Postgres |
| `PORT`          | Padrão `3011` |
| `JWT_SECRET`    | Obrigatório em produção |
| `SETUP_SECRET`  | Primeiro admin em `/setup` (mín. 8 caracteres) |
| `REDIS_URL`     | Fila de export CSV (`EXPORT_QUEUE_MODE=redis`) |
| `OPEN_REGISTRATION` | `true` só se quiser `/cadastro` aberto |

NF-e, CORS e rate limit: ver [docs/nfe-homologacao-producao.md](docs/nfe-homologacao-producao.md) e `backend/src/index.js`.

**Frontend**

| Variável | Uso |
| -------- | --- |
| `NEXT_PUBLIC_API_ORIGIN` | Origem da API (rewrite `/api` → backend). No Compose: `http://backend:3011` |

## Testes

```bash
# Frontend
cd frontend
npm test

# Backend (unitários + integração)
# Integração precisa do Postgres de teste na 5433:
cd backend
npm run test:db:up          # uma vez
npm run test:db:migrate
npm test
```

## Comandos úteis

```bash
# Backend
npm run db:studio     # Prisma Studio
npm run db:migrate     # migrações em desenvolvimento
npm run db:deploy     # migrate deploy (CI / produção)
npm run db:seed       # tenants + admin + produtos de exemplo
npm run tenant:create
npm run db:reset       # APAGA TODOS OS DADOS do banco apontado

# Docker
docker compose stop
docker compose down     # remove containers; volumes persistentes ficam
```

## Documentação

- [NF-e — homologação e produção](docs/nfe-homologacao-producao.md)
- [Backup e restore](docs/operacao-backup-restore.md)
- [Migração de legado](docs/migracao-legado.md)
- [Arquitetura (evolução)](docs/arquitetura-single-tenant-evolucao.md)
- [Scripts de legado](backend/scripts/README.md)
