# Deploy no EasyPanel

Cada serviço tem seu próprio `Dockerfile` (multi-stage, build enxuto para produção).

| Serviço | Dockerfile | Porta | Healthcheck |
|---|---|---|---|
| api | `apps/api/Dockerfile` | 3001 | `GET /health` |
| worker | `apps/worker/Dockerfile` | 3002 (só health; não serve tráfego de negócio) | `GET /health` |
| frontend | `apps/frontend/Dockerfile` | 3000 | `GET /` |
| postgres | imagem oficial `postgres:16-alpine` | 5432 | `pg_isready` |
| redis | imagem oficial `redis:7-alpine` | 6379 | `redis-cli ping` |

`docker-compose.yml` na raiz do repositório reproduz essa topologia e serve tanto para
teste local da imagem de produção quanto como referência para criar os serviços no
EasyPanel (Projeto → Serviços → "From Dockerfile", apontando `Build Context` para a raiz
do repo e `Dockerfile Path` para o arquivo do serviço).

## Variáveis de ambiente obrigatórias

Ver `.env.example` na raiz. Em produção, gerar `JWT_SECRET`/`JWT_REFRESH_SECRET` novos
(nunca reaproveitar os de desenvolvimento):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

- `api`: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`
  (domínio do frontend em produção), `API_PORT`.
- `worker`: `DATABASE_URL`, `REDIS_URL`, `AGENT_OFFLINE_THRESHOLD_SECONDS`.
- `frontend`: `NEXT_PUBLIC_API_URL` (precisa ser passado como **build arg**, não só
  runtime — Next.js embute `NEXT_PUBLIC_*` no bundle no momento do build).

## Volumes

- `postgres_data`: dados do Postgres — **nunca** tratar o volume Docker como único
  backup (ver seção de backups abaixo).
- `redis_data`: persistência opcional do Redis (filas sobrevivem a restart do container).
- `api_uploads`: **única exceção** à regra de stateless abaixo — tudo que o
  `api` salva em disco (`/repo/apps/api/uploads` dentro do container),
  incluindo fotos anexadas em Ordens de Serviço **e a logo da empresa**
  (Configurações > Informações da empresa, salva em
  `uploads/tenant-logo/...`). No EasyPanel, criar um volume persistente pro
  serviço `api` apontando pra esse caminho (Service → Mounts/Storage →
  adicionar volume, path `/repo/apps/api/uploads`). **Sem isso, tudo que foi
  salvo ali some a cada redeploy** — o container é recriado do zero, mas o
  banco continua achando que o arquivo existe (só guarda o caminho), daí a
  logo "para de funcionar" e a impressão é de que a configuração se perdeu.
  Configure esse volume **antes** do primeiro upload de logo/foto em
  produção — senão é preciso subir o arquivo de novo depois de criar o
  volume. O app serve esses arquivos publicamente em `/uploads/...` — não é
  o lugar certo pra nada sensível.

Fora isso, os apps (`api`, `worker`, `frontend`) são stateless — não presumem
filesystem persistente; qualquer outro estado vai para Postgres/Redis.

## Ordem de inicialização

`postgres`/`redis` (com healthcheck) → `api` (roda migrations, ver abaixo) → `worker` →
`frontend`. No `docker-compose.yml` isso é expresso via `depends_on: condition:
service_healthy`.

### Schema do banco: `db push` (deploy de teste atual) vs. `migrate deploy` (futuro)

Este repositório ainda **não tem migrations do Prisma commitadas** — o schema nunca foi
rodado contra um banco real, então não há `apps/api/prisma/migrations/` para
`migrate deploy` aplicar. Para o primeiro deploy de teste no EasyPanel, sincronize o
schema direto com:

```bash
# via o console/terminal do serviço "api" no EasyPanel (ou qualquer máquina
# com acesso ao DATABASE_URL de produção)
cd apps/api && npx prisma db push
```

`db push` cria as tabelas a partir do `schema.prisma` sem gerar histórico de migration —
adequado para validar o deploy, mas **não** para produção com dados reais em evolução
(sem histórico, não há como aplicar mudanças de schema com segurança nem fazer
rollback). Antes de qualquer uso real do sistema, trocar para o fluxo versionado:

```bash
# uma única vez, ainda em ambiente de teste, para gerar a migration inicial
# a partir do estado atual do banco (criado via db push):
cd apps/api && npx prisma migrate resolve --applied 0_init  # ver docs do Prisma para o passo exato de baseline

# dali em diante, toda mudança de schema vira uma migration versionada:
npx prisma migrate dev --name <descricao>   # gera localmente
npx prisma migrate deploy                    # aplica em produção
```

O container `api` **não** roda `db push` nem `migrate deploy` automaticamente no `CMD`
(para evitar duas réplicas mexendo no schema ao mesmo tempo) — é sempre um passo manual,
antes de subir uma nova versão.

Rodar o seed (opcional, cria o tenant de demonstração — spec §62) depois do `db push`:

```bash
cd apps/api && npx prisma db seed
```

## Domínios

`app.<seudominio>` → frontend, `api.<seudominio>` → api. Nada disso é fixado em código;
tudo vem de `NEXT_PUBLIC_API_URL`/`CORS_ORIGINS`.

## Backups

- `pg_dump` agendado (fora do escopo deste repositório — configurar no EasyPanel ou via
  cron externo) com retenção definida e teste periódico de restauração.
- Nunca considerar o volume Docker do Postgres como backup válido isoladamente.
