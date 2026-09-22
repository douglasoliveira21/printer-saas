# Arquitetura

## Visão geral

```
                 HTTPS                           HTTPS
Frontend (Next.js) ────────▶ API (NestJS) ◀──────────── Agent Windows (rede do cliente)
                                  │
                       ┌──────────┴──────────┐
                       │                      │
                  PostgreSQL               Redis (BullMQ)
                                                │
                                            Worker (NestJS)
```

- O Agent **inicia** a conexão (HTTPS de saída) — o SaaS nunca precisa acessar a rede do cliente.
- A API nunca executa trabalho pesado dentro do ciclo de request/response; tudo que é
  assíncrono (verificação de offline, geração de alertas, contadores agendados,
  faturamento recorrente) vai para filas do Redis via BullMQ, processadas pelo Worker.
- Frontend e API são desacoplados por uma API REST versionada (`/api/v1`).
- `packages/shared` guarda código puro usado por mais de um app — hoje só o motor de
  franquia/faturamento (`billing.ts`), usado tanto pela API (preview de contrato) quanto
  pelo Worker (faturamento recorrente), para nunca haver duas implementações do mesmo
  cálculo de dinheiro.

## Módulos da API

| Módulo | Responsabilidade |
|---|---|
| `auth` | Registro de tenant, login, refresh token, guards JWT/RBAC |
| `prisma` | Cliente Prisma raw + cliente tenant-scoped (ver `docs/security.md`) |
| `users` | Usuários do tenant (staff e portal do cliente) |
| `customers` | Clientes da empresa locadora |
| `locations` | Locais/filiais de um cliente |
| `agents` | Enrollment, heartbeat, config, ingestão de dispositivos descobertos |
| `printers` | Impressoras descobertas/monitoradas, claim, histórico |
| `dashboard` | Indicadores agregados |
| `alerts` | Listagem, reconhecimento e resolução de alertas |
| `service-orders` | CRUD completo, numeração sequencial por tenant, SLA |
| `contracts` | CRUD, ativação, motor de franquia/excedente (via `@printer-saas/shared`) |
| `financial` | Contas a receber/pagar, baixa, resumo de fluxo de caixa |
| `inventory` | Itens de estoque, movimentações (entrada/saída/ajuste), vínculo com OS |
| `reports` | Relatórios com exportação CSV (impressões, OS, financeiro, offline, contratos vencendo) |
| `portal` | Portal do cliente — só os dados do próprio `customerId` (spec §34) |
| `platform` | Super Admin da plataforma — cross-tenant, sempre atrás de `SuperAdminGuard` (spec §79) |

Módulos ainda não implementados: emissão fiscal (NF-e), `notifications` (e-mail/WhatsApp
de verdade — hoje os alertas só existem dentro do SaaS), auto-update assinado
do Agent, cobrança automática dos planos do SaaS (o schema já suporta via `Plan`).

## Worker

Duas filas com jobs recorrentes (BullMQ Job Schedulers):

- `monitoring`:
  - `check-offline` (a cada 60s): marca Agents/Impressoras sem heartbeat/coleta recente
    como offline e cria um alerta `WARNING`.
  - `check-toner` (a cada 5min): avalia a leitura de toner mais recente por
    impressora/cor e cria/atualiza alertas `WARNING`/`CRITICAL` conforme os limiares
    (20% / 10%).
- `billing`:
  - `generate-monthly-charges` (diário): para cada contrato ativo cujo `billingDay` é
    hoje, gera um `FinancialEntry` (receita) com o valor da mensalidade + excedente de
    franquia calculado a partir do histórico real de contadores — nunca fatura um
    excedente inventado; sem dados de contador suficientes, cobra só a mensalidade fixa
    e sinaliza isso na descrição do lançamento.

## Princípio: Agent sem lógica de negócio

O Agent Windows (`apps/agent-windows/`, .NET — ver `docs/agent.md`) só descobre, coleta,
normaliza e envia dados. Toda interpretação (o que vira alerta, como se calcula
excedente de contrato, etc.) vive no backend, para permitir evoluir regras sem
reinstalar Agents.

## Próximos passos (ordem sugerida)

1. Validar tudo end-to-end com Postgres/Redis reais (migration + seed + login + fluxo
   completo de OS/contrato/financeiro/estoque/portal/plataforma) — inclui rodar
   `test/tenant-isolation.e2e-spec.ts` e `test/portal-isolation.e2e-spec.ts`, escritas
   mas ainda não executadas neste ambiente por falta de acesso a um banco real. **É a
   pendência mais importante antes de considerar isso pronto para produção.**
2. Testar o Agent Windows de ponta a ponta contra uma API real: enrollment, heartbeat,
   discovery/SNMP contra uma impressora de verdade, fila offline.
3. Testar o instalador MSI (`apps/agent-windows/installer/wix/`) de ponta a ponta numa
   máquina real: instalação limpa, upgrade de versão, reparo, desinstalação — validado
   até aqui só por `wix build` (0 erros, todas as ICEs passando), nunca por um
   `msiexec /i` de verdade.
4. Emissão fiscal, notificações por e-mail/WhatsApp, auto-update assinado do Agent,
   cobrança automática dos planos do SaaS.
