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
| GET | `/printers` | lista as impressoras deste Agent (aba Impressoras do ConfigTool) |
| GET | `/printers/:id` | detalhe de uma impressora + últimos counters/consumíveis |
| POST | `/printers/monitor` | `{ ids: string[] }` — marca como monitorada (bulk) |
| POST | `/printers/deactivate` | `{ ids: string[] }` — desativa (bulk) |
| DELETE | `/printers/:id` | remove, só se ainda `DISCOVERED` (nunca uma já monitorada) |

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

## Coleta de dados por impressora (SNMP)

- **MAC**: resolvido primeiro via ARP local (`SendARP`, Win32) — mais confiável que
  IF-MIB, funciona mesmo quando o dispositivo restringe leitura SNMP só à subárvore
  Printer-MIB — com fallback pra IF-MIB (`ifPhysAddress`) quando a impressora está em
  outra sub-rede (ARP não atravessa roteador).
- **Modelo/número de série**: lidos via *walk* da tabela geral do Printer-MIB (não mais
  `GET` fixo no índice `.1`), então um dispositivo multi-engine/multi-função que indexa
  diferente de 1 deixa de ser ignorado.
- **Suporte a A3**: detectado pelas dimensões declaradas de cada bandeja de entrada
  (`prtInputEntry`, RFC 3805) — nunca inferido do nome do modelo. `null` = o dispositivo
  não expõe essa tabela (desconhecido); a UI só mostra os campos de A3 quando o Agent
  realmente confirmou pelo menos uma bandeja compatível.
- **Cópias, duplex e o detalhamento impressão vs. cópia** continuam **não implementados**
  — não existe OID padrão no Printer-MIB pra isso (são vendor-specific, cada fabricante
  com o seu MIB privado); implementar isso corretamente exigiria uma tabela de OIDs por
  fabricante, o que ainda não existe neste projeto (ver nota em `PrinterMibOids.cs`).

## Responsabilidades do Agent

- Descoberta (SNMP) configurável por subnet/faixa/IP individual, com concorrência e
  timeout limitados (nunca scan agressivo por padrão) — implementado.
- SNMP v1/v2c (v3 fica para uma fase futura) — implementado; community configurável
  globalmente por Agent (por rede/equipamento individual fica para uma fase futura).
- Fila local (offline-first): continua coletando e reenvia quando a internet volta, com
  tamanho máximo de fila — implementado (`OfflineQueue`).
- Logs rotativos em `C:\ProgramData\PrinterSaaS\Agent\Logs`, nunca logando segredos —
  implementado (Serilog, 14 dias de retenção).
- Auto-update assinado (spec §42): **não implementado** — atualização é manual por ora
  (a aba "Ferramentas → Status do cliente" do ConfigTool mostra isso honestamente em vez
  de fabricar um status de serviço que não existe).

## ConfigTool (`PrinterAgentSetup.exe`) — telas de gestão

Além de instalar/iniciar/parar o serviço, o ConfigTool tem 3 abas que falam direto com
`agent-api/v1/*` usando a credencial permanente do próprio Agent (sem precisar de login
de usuário):

- **Impressoras**: lista as impressoras deste Agent, com monitorar/desativar em lote,
  adicionar por IP (faz um probe SNMP local e envia via `/devices`), remover (só
  `DISCOVERED`) e "Ver detalhes" (todos os campos + counters já coletados).
- **Ferramentas**: busca manual por rede/sub-rede (reusa `PrinterDiscoveryService`), busca
  de impressoras USB instaladas localmente (`System.Printing`, sem contadores — USB não
  fala SNMP) e status do serviço do Agent.
- **Configurações**: intervalo de busca de novas impressoras (ou "nunca buscar"),
  intervalo de heartbeat, e proxy (servidor/porta/usuário/senha/domínio — guardado
  criptografado via DPAPI em `proxy.dat`, nunca em `appsettings.json`; aplicar exige
  reiniciar o serviço, igual à troca de URL da API).

### Token pronto na instalação (`install-config.json`)

A tela "Adicionar Agent" do site, depois de gerar o token, oferece baixar um
`install-config.json` (`{ apiUrl, enrollmentToken, agentName, customerName }`, montado no
navegador, sem endpoint novo). Colocando esse arquivo ao lado de `PrinterAgentSetup.exe`,
o ConfigTool detecta sozinho na primeira tela, mostra o nome do cliente e preenche o
token — sem digitação manual. Depois de instalar com sucesso o arquivo é renomeado para
`install-config.json.used` (evita reuso em outra máquina). Sem o arquivo, a instalação
continua funcionando exatamente como antes (token digitado à mão).
