# Printer SaaS

SaaS multi-tenant de gestão, monitoramento e operação para empresas de locação e manutenção de impressoras.

## Arquitetura (Fase 1)

Monorepo com npm workspaces:

```
apps/
  api/       NestJS + Prisma + PostgreSQL — API REST multi-tenant
  worker/    NestJS + BullMQ — jobs assíncronos (offline detection, alertas, agendados)
  frontend/  Next.js + Tailwind + shadcn/ui
packages/    (reservado para código compartilhado entre apps)
infrastructure/docker/  docker-compose para dependências locais (Postgres + Redis)
docs/        documentação técnica
```

Fluxo: `Frontend → API → PostgreSQL/Redis → Worker`.

### Multi-tenancy

Todo dado pertencente a um tenant é protegido no backend, não só no frontend.
[`apps/api/src/prisma/tenant-scoped.extension.ts`](apps/api/src/prisma/tenant-scoped.extension.ts) implementa uma
Prisma Client Extension que injeta/filtra `tenantId` automaticamente em toda
query contra um modelo tenant-owned. O tenantId nunca vem de header/query/body —
vem exclusivamente do JWT validado (ver `JwtStrategy` + `TenantPrismaService`).

Veja `docs/security.md` para os detalhes de isolamento.

## Requisitos

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker (opcional para dev, recomendado para deploy)

## Desenvolvimento local

```bash
npm install
cp .env.example .env   # preencha JWT_SECRET / JWT_REFRESH_SECRET com valores aleatórios
```

Suba Postgres e Redis (via Docker):

```bash
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
```

Ou aponte `DATABASE_URL`/`REDIS_URL` no `.env` para instâncias já existentes na sua máquina.

Depois, copie o `.env` para cada app (dotenv resolve relativo ao cwd do processo):

```bash
cp .env apps/api/.env
cp .env apps/worker/.env
```

Gere o client do Prisma e rode a primeira migration:

```bash
npm run prisma:generate
cd apps/api && npx prisma migrate dev --name init
npx prisma db seed
```

Suba os três serviços (em terminais separados):

```bash
npm run dev:api
npm run dev:worker
npm run dev:frontend
```

- API: http://localhost:3001/api/v1 (Swagger em `/docs`)
- Frontend: http://localhost:3000
- Worker health: http://localhost:3002/health

### Login de demonstração

O seed cria um tenant "Empresa Demonstração" (marcado `isDemo=true`) com:

- `admin@demo.local` / `Demo@1234`
- `tecnico@demo.local` / `Demo@1234`
- `financeiro@demo.local` / `Demo@1234`

## Docker / EasyPanel

`docker-compose.yml` (raiz) sobe a stack completa (postgres, redis, api, worker, frontend)
para produção/EasyPanel. Ver `docs/easypanel.md`.

## Documentação

- [docs/architecture.md](docs/architecture.md)
- [docs/database.md](docs/database.md)
- [docs/security.md](docs/security.md)
- [docs/agent.md](docs/agent.md)
- [docs/easypanel.md](docs/easypanel.md)
- [docs/development.md](docs/development.md)

## Status

Implementado: Fase 1 (arquitetura, banco, Docker, auth, multi-tenancy), Fase 2-3
(frontend base, clientes/locais/usuários), Fase 4-6 (agents, discovery/ingestão de
dados, contadores/toners, dashboard, alertas), Fase 7-9 (Ordens de Serviço completas,
Contratos com motor de franquia/excedente), Fase 10-11 (Financeiro, Estoque),
Relatórios exportáveis (CSV), Portal do Cliente, Super Admin da plataforma, estrutura
de Planos, e o **Agent Windows** completo (.NET 10, `apps/agent-windows/` — discovery
SNMP, coleta, fila offline, Windows Service, instalador PowerShell).

Testes de isolamento multi-tenant e de portal do cliente escritos
(`apps/api/test/tenant-isolation.e2e-spec.ts`, `apps/api/test/portal-isolation.e2e-spec.ts`)
mas ainda não executados contra um banco real — essa validação continua sendo a
pendência mais importante antes de produção. Faturamento fiscal (NF-e), notificações
por e-mail/WhatsApp e SNMP v3 ainda não foram implementados — ver
`docs/architecture.md`.
