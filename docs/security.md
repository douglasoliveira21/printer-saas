# Segurança e isolamento multi-tenant

## Isolamento entre tenants (crítico)

O `tenantId` do request **nunca** vem de header, query string ou corpo enviado pelo
cliente. Ele é resolvido exclusivamente a partir do JWT de acesso validado:

1. `JwtStrategy.validate()` busca o usuário por `(id, tenantId)` do payload assinado e
   grava `tenantId`/`userId` no contexto da requisição via `nestjs-cls`
   (`AsyncLocalStorage`, sem overhead de escopo por request do Nest).
2. `TenantPrismaService.client` devolve um Prisma Client "tenant-scoped"
   (`PrismaService.forTenant(tenantId)`), construído com uma
   [Prisma Client Extension](../apps/api/src/prisma/tenant-scoped.extension.ts) que
   intercepta **toda** operação (`findMany`, `findFirst`, `update`, `delete`, `count`,
   `create`, etc.) contra os modelos tenant-owned e injeta/funde `tenantId` automaticamente.
3. Controllers/services de negócio devem sempre injetar `TenantPrismaService`, nunca o
   `PrismaService` raw — o raw client só é legítimo em `auth` (login não sabe o tenant
   ainda), no seed e em rotas de super-admin da plataforma (ainda não implementadas).
4. Relações cruzadas (ex.: criar um `Location` apontando para um `customerId`) são
   validadas explicitamente no service (`assertCustomerBelongsToTenant`), porque a
   extensão protege o modelo que está sendo escrito, não os IDs estrangeiros informados
   pelo cliente.

Qualquer novo modelo tenant-owned deve ser adicionado à allow-list
`TENANT_SCOPED_MODELS` em `tenant-scoped.extension.ts` — a lista é estática (não usa
introspecção do schema) de propósito, para que esquecer um modelo novo quebre os testes
de isolamento de forma barulhenta em vez de vazar dados silenciosamente.

### Testes de isolamento

Suite obrigatória (spec §61) implementada em
[apps/api/test/tenant-isolation.e2e-spec.ts](../apps/api/test/tenant-isolation.e2e-spec.ts):
usuário do Tenant A tentando ler/editar/excluir qualquer entidade do Tenant B recebe
sempre 404 (nunca dados, nunca um 403 que ao menos confirmaria a existência do ID).
Cobre customers, locations, printers (incluindo claim), agents (via listagem), service
orders, contracts (incluindo billing-preview), alerts, financial entries, inventory
items e users. Roda contra um Postgres real via `npm run test:e2e -w apps/api` — ainda
não foi executada neste ambiente por falta de acesso a um banco (ver
`docs/development.md`).

Uma segunda suíte, [portal-isolation.e2e-spec.ts](../apps/api/test/portal-isolation.e2e-spec.ts),
cobre a fronteira mais fina do Portal do Cliente (spec §34): um usuário do Cliente X não
pode ver nem criar OS para o Cliente Y, mesmo estando no mesmo tenant; e um usuário de
staff normal não consegue usar as rotas `/portal/*` (que exigem `customerId` no token —
ver `PortalGuard`).

## Autenticação

- Senhas: Argon2id (`argon2` npm package).
- Access token JWT de curta duração (15min por padrão) + refresh token opaco de 48 bytes,
  armazenado com hash SHA-256 no banco (`RefreshToken`), com rotação a cada uso
  (revoga o antigo, emite um novo).
- Agents Windows usam uma credencial própria (`AgentKey <agentId>.<secret>`), nunca a
  senha/JWT de um usuário humano, nunca um segredo global da plataforma. O secret é
  gerado no enrollment e seu hash (Argon2) é o único valor persistido no banco.

## Outras práticas aplicadas

- `helmet`, CORS restrito por `CORS_ORIGINS`, rate limiting global (`@nestjs/throttler`).
- Validação de entrada com `class-validator`/`class-transformer` (`whitelist` +
  `forbidNonWhitelisted`).
- Erros HTTP padronizados (`HttpExceptionFilter`) — nunca vaza stack trace para o cliente.
- Segredos apenas via variáveis de ambiente (`.env`, nunca commitado — ver `.gitignore`).

## Pendências de segurança (não implementadas na Fase 1)

- Auditoria (`AuditLog` já existe no schema, mas ainda não é escrita pelos services).
- Assinatura de pacotes de auto-update do Agent: mecanismo implementado (verificação real
  via `WinVerifyTrust` + thumbprint fixo no binário — ver `docs/agent.md`), mas ainda
  rodando com certificado placeholder até haver um certificado de assinatura de código
  de verdade (comprado de uma CA — ver `apps/agent-windows/installer/codesign/README.md`).
- Rotação de secrets da plataforma, 2FA.
