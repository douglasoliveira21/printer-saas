# Banco de dados

PostgreSQL via Prisma ORM. Schema único em `apps/api/prisma/schema.prisma` (fonte de
verdade — Worker e demais apps consomem o `@prisma/client` gerado a partir dele, nunca
mantêm um schema próprio).

## Hierarquia

```
Tenant
 ├─ User (com Role → Permission, RBAC)
 ├─ Customer
 │   └─ Location
 ├─ Agent (vinculado a uma Location)
 │   └─ Printer (descoberta pelo Agent; vinculada a Customer/Location só após "claim")
 │       ├─ CounterReading (histórico)
 │       └─ ConsumableReading (histórico)
 ├─ Contract
 ├─ ServiceOrder
 ├─ Alert
 └─ InventoryItem
```

## Decisões relevantes

- **Identidade da impressora**: `Printer.fingerprint` (não o IP). Prioridade
  `serial > MAC > agentId+IP`. Isso resolve troca de IP (DHCP) sem duplicar o
  cadastro — ver spec §68-69 e `AgentsService.computeFingerprint`.
- **Discovered vs Monitored**: toda impressora entra como `DISCOVERED`; só passa a
  `MONITORED` quando um admin faz o "claim" vinculando a um cliente/local (spec §23).
  Isso evita que o sistema comece a cobrar/gerar alertas para equipamentos que não são
  do cliente.
- **Dado ausente ≠ zero**: colunas de contador/consumível são nullable. O backend nunca
  inventa um valor — quando o fabricante não fornece um dado, o campo fica `null` e o
  frontend deve exibir "Não disponível" (spec §67).
- **Histórico, não sobrescrita**: cada coleta gera uma linha nova em `CounterReading`/
  `ConsumableReading`. O "valor atual" é sempre a leitura mais recente; consumo por
  período é calculado a partir de duas leituras, não armazenado.

## Migrations

```bash
cd apps/api
npx prisma migrate dev --name <descricao>   # desenvolvimento
npx prisma migrate deploy                    # produção/CI
```

Nunca editar o schema do banco manualmente — toda alteração passa por uma migration
versionada e commitada.
