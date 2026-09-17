# Agent Windows

> Status: **implementado** em `apps/agent-windows/` (.NET 10, LTS atual — ver
> `apps/agent-windows/README.md` para build, configuração e instalação). Este
> documento descreve o contrato HTTP entre o Agent e a API
> (`apps/api/src/agents/`).

## Fluxo de enrollment

1. Admin do tenant cria um "slot" de Agent no SaaS:
   `POST /api/v1/agents { name, locationId }` (autenticado, permissão `agents.create`) →
   retorna `{ agentId, enrollmentToken, expiresAt }` (token válido por 24h, uso único).
2. O instalador (`installer/install-agent.ps1`) recebe o token como parâmetro e o grava
   em `appsettings.json`. Na primeira execução, o Agent chama
   `POST /api/v1/agent-api/v1/enroll { enrollmentToken, hostname, agentVersion }`
   (sem autenticação — o próprio token é a credencial de bootstrap) → recebe
   `{ agentId, apiKey }`. O `apiKey` (formato `<agentId>.<secret>`) é a credencial
   permanente do Agent, persistida localmente criptografada via DPAPI
   (`AgentCredentialStore`, escopo `LocalMachine`) em
   `C:\ProgramData\PrinterSaaS\Agent\credentials.dat` — o `enrollmentToken` nunca é
   reutilizado depois disso.
3. Toda chamada seguinte do Agent usa `Authorization: AgentKey <agentId>.<secret>`.

## Endpoints do Agent (`/api/v1/agent-api/v1`)

| Método | Rota | Uso |
|---|---|---|
| POST | `/enroll` | bootstrap (token de instalação → apiKey) |
| POST | `/heartbeat` | a cada N segundos: hostname, IP local, versão, SO |
| GET | `/config` | configuração de discovery (subnets, SNMP) atribuída pelo SaaS |
| POST | `/devices` | payload normalizado de dispositivos descobertos/coletados |

Payload de `/devices` (`SubmitDevicesDto`):

```json
{
  "devices": [
    {
      "ip": "192.168.1.30",
      "serial": "ABC123",
      "manufacturer": "Ricoh",
      "model": "MP C3004",
      "counters": { "total": 164238, "blackWhite": 112808, "color": 51430, "copies": 12340 },
      "consumables": [{ "type": "toner", "color": "black", "levelPercent": 45 }]
    }
  ]
}
```

Campos não coletáveis pelo equipamento simplesmente são omitidos — tanto o Agent
(`SnmpDeviceReader`) quanto a API nunca preenchem com valor inventado (spec §67).

## Implementação do Agent (`apps/agent-windows/`)

| Componente | Responsabilidade |
|---|---|
| `PrinterAgent.Core/Snmp` | `SnmpDeviceReader` — GET/WALK SNMP v1/v2c sobre OIDs padrão MIB-II/Printer-MIB (`PrinterMibOids`) |
| `PrinterAgent.Core/Discovery` | `PrinterDiscoveryService` — varredura de `Networks` (CIDR/faixa/IP único) com concorrência limitada |
| `PrinterAgent.Core/Api` | `PrinterSaasApiClient` — único ponto de contato HTTP com a API |
| `PrinterAgent.Core/Queue` | `OfflineQueue` — fila local em JSON, offline-first (spec §39) |
| `PrinterAgent.Core/Configuration` | `AgentCredentialStore` (DPAPI), `AgentEnrollmentService` |
| `PrinterAgent.Service/AgentWorker` | Loop principal: heartbeat → refresh de config remota → flush da fila → discovery/coleta, cada um no seu próprio intervalo |

O Agent não tem lógica de negócio própria — só descobre, coleta, normaliza e envia
(spec §65); toda interpretação (o que vira alerta, cálculo de excedente de contrato
etc.) vive no backend.

## Responsabilidades do Agent

- Descoberta (SNMP) configurável por subnet/faixa/IP individual, com concorrência e
  timeout limitados (nunca scan agressivo por padrão) — implementado.
- SNMP v1/v2c (v3 fica para uma fase futura) — implementado; community configurável
  globalmente por Agent (por rede/equipamento individual fica para uma fase futura).
- Fila local (offline-first): continua coletando e reenvia quando a internet volta, com
  tamanho máximo de fila — implementado (`OfflineQueue`).
- Logs rotativos em `C:\ProgramData\PrinterSaaS\Agent\Logs`, nunca logando segredos —
  implementado (Serilog, 14 dias de retenção).
- Auto-update assinado (spec §42): **não implementado** — atualização é manual por ora.
