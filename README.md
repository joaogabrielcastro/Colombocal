# Colombocal — Sistema de Gestão Comercial

Sistema completo de gestão comercial para distribuidora de cal.

## Funcionalidades

- **Clientes** — Cadastro com consulta automática de CNPJ (BrasilAPI), conta corrente, preços especiais por produto
- **Produtos** — Cadastro com controle de estoque mínimo
- **Estoque** — Movimentações de entrada, saída, ajuste e devolução
- **Motoristas** — Cadastro de motoristas para vincular às vendas
- **Vendedores** — Cadastro com percentual de comissão
- **Vendas** — Emissão com itens, frete, baixa automática de estoque
- **Cheques** — Controle com ciclo de vida: Recebido → Depositado → Compensado / Devolvido
- **Pagamentos** — Registro de pagamentos em dinheiro e transferência
- **Dashboard** — KPIs em tempo real
- **Relatórios** — Vendas, Comissões, Faturamento, Financeiro

## Pré-requisitos

- [Node.js](https://nodejs.org) 18+
- [Docker](https://docker.com) Desktop (para o banco de dados)

## Instalação e Execução

### 1. Clonar / abrir a pasta do projeto

```bash
cd Colombocal
```

### 2. Subir o banco de dados PostgreSQL

```bash
docker-compose up -d
```

### 3. Configurar e iniciar o backend

```bash
cd backend
npm install

# Copiar o arquivo de variáveis de ambiente
copy .env.example .env   # Windows
# ou: cp .env.example .env  (Linux/Mac)

# Criar as tabelas no banco
npx prisma migrate dev --name init

# Popular com dados iniciais (produtos + vendedor padrão)
npm run db:seed

# Iniciar o servidor (porta 3001)
npm run dev
```

### 4. Iniciar o frontend

Abrir um **novo terminal**:

```bash
cd frontend
npm install

# Iniciar o servidor Next.js (porta 3000)
npm run dev
```

### 5. Acessar

Abrir o navegador em: **http://localhost:3000**

---

## Estrutura do Projeto

```
Colombocal/
├── docker-compose.yml          # PostgreSQL 16
├── backend/
│   ├── .env                    # Variáveis de ambiente
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos do banco de dados
│   │   └── seed.js             # Dados iniciais
│   └── src/
│       ├── index.js            # Servidor Express
│       └── routes/             # Rotas da API
│           ├── clientes.js
│           ├── produtos.js
│           ├── motoristas.js
│           ├── vendedores.js
│           ├── vendas.js
│           ├── cheques.js
│           ├── pagamentos.js
│           ├── estoque.js
│           ├── relatorios.js
│           ├── dashboard.js
│           └── cnpj.js
└── frontend/
    └── src/app/
        ├── page.tsx             # Dashboard
        ├── clientes/
        ├── produtos/
        ├── motoristas/
        ├── vendedores/
        ├── vendas/
        ├── cheques/
        ├── estoque/
        └── relatorios/
            ├── vendas/
            ├── comissoes/
            ├── faturamento/
            └── financeiro/
```

## Tech Stack

| Camada         | Tecnologia                           |
| -------------- | ------------------------------------ |
| Frontend       | Next.js 14 (App Router) + TypeScript |
| Estilização    | Tailwind CSS 3                       |
| Backend        | Node.js + Express.js                 |
| ORM            | Prisma 5                             |
| Banco de dados | PostgreSQL 16                        |
| Consulta CNPJ  | BrasilAPI (gratuito, sem auth)       |

## Variáveis de Ambiente do Backend

```env
DATABASE_URL="postgresql://colombocal:colombocal123@localhost:5432/colombocal"
PORT=3001
```

## Comandos Úteis

```bash
# Backend
npm run db:studio     # Abrir Prisma Studio (visualizar dados)
npm run db:migrate    # Rodar migrações pendentes
npm run db:reset      # Resetar banco (APAGA TODOS OS DADOS)

# Docker
docker-compose stop   # Parar o banco
docker-compose down   # Remover container
```
