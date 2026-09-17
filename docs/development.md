# Guia de desenvolvimento

## Estrutura

```
apps/api          NestJS (Express) — module por domínio (auth, users, customers,
                   locations, agents, printers, dashboard, financial, inventory...),
                   Prisma no módulo global `prisma`.
apps/worker        NestJS mínimo — só health endpoint + BullMQ processors/schedulers
                    (monitoramento de offline/toner, faturamento recorrente).
apps/frontend       Next.js App Router + Tailwind + shadcn/ui.
packages/shared     Código puro compartilhado entre api e worker (hoje: o motor de
                    franquia/faturamento em `billing.ts`, usado tanto pelo endpoint de
                    preview quanto pelo job de faturamento recorrente — uma única fonte
                    de verdade para o cálculo de dinheiro). Precisa ser compilado
                    (`npm run build -w packages/shared`) antes de `api`/`worker`
                    rodarem — o `postinstall` da raiz já faz isso automaticamente após
                    `npm install`.
```

Módulos de negócio na API seguem sempre o mesmo padrão:
`*.module.ts` → `*.controller.ts` (rotas + `@RequirePermissions`) → `*.service.ts`
(usa `TenantPrismaService`, nunca `PrismaService` diretamente) → `dto/*.dto.ts`
(validação com `class-validator`).

## Rodando testes

```bash
npm run test -w apps/api              # unit tests
npm run test:e2e -w apps/api          # e2e (precisa de DATABASE_URL apontando pra um Postgres real)
```

`test/tenant-isolation.e2e-spec.ts` é a suíte mais importante do projeto: registra dois
tenants pela API de verdade, semeia dados sob o Tenant B (customer, location, agent,
printer, service order, contract, alert, user) e garante que o Tenant A nunca consegue
ler/editar/excluir nada disso — sempre 404, nunca dado vazando. Ela se pula sozinha
(`describe.skip`) quando `DATABASE_URL` não está definida, então `npm run test:e2e` não
quebra em ambientes sem banco configurado — mas isso significa que **ela não substitui
rodar de fato** contra um Postgres antes de confiar no isolamento em produção.

## Convenções

- TypeScript `strict: true` nos três apps.
- DTOs sempre com `class-validator`; o `ValidationPipe` global usa
  `whitelist + forbidNonWhitelisted`, então campos não declarados no DTO são
  rejeitados (não silenciosamente ignorados).
- Toda rota autenticada exige `@RequirePermissions('<chave>')`; a lista de permissões
  vive em `apps/api/prisma/seed/permissions.ts` — nova permissão = adicionar lá +
  rodar o seed novamente (idempotente, usa `upsert`).
- Nunca inventar dado de impressora (contador, toner, serial ausente) — sempre `null`/
  omitir, nunca um valor calculado disfarçado de coletado.

## Comandos úteis

```bash
npm run dev:api        # API com hot reload
npm run dev:worker      # Worker com hot reload
npm run dev:frontend     # Frontend com hot reload
npm run prisma:generate  # regenerar @prisma/client após mudar o schema
npm run prisma:migrate   # criar/aplicar migration em dev
npm run prisma:seed      # popular tenant de demonstração
```
