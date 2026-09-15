# E2E (Playwright)

Fluxos críticos do Colombocal. **Não** aponta para produção.

## Pré-requisitos

1. Postgres de teste (porta 5436):

```bash
cd backend
npm run test:db:up
npm run test:db:migrate
npm run db:seed
```

2. Build do frontend (o Playwright sobe `npm run start:e2e` / standalone):

```bash
cd frontend
npm ci
npm run build
```

3. Instalar E2E:

```bash
cd e2e
npm ci
npx playwright install chromium
```

## Executar

```bash
cd e2e
npm test
```

Credenciais padrão do seed: `admin@local` / `admin123`, `membro@local` / `admin123`, `demo@local` / `admin123`.

Variáveis opcionais: `E2E_BASE_URL`, `E2E_API_URL`, `DATABASE_URL`, `JWT_SECRET`.
