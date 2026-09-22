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
| DELETE | `/printers/:id` | remove, só se `DISCOVERED` ou `IGNORED` (nunca uma já monitorada/claimed) |

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

`/devices` também aceita (opcionais, retrocompatíveis — um Agent antigo que não os
envia continua funcionando exatamente como antes): `deviceType` (`PRINTER`/`MFP`/
`PLOTTER`/…, ver seção de classificação abaixo — a API só cria/atualiza um `Printer`
quando esse campo, se presente, for um dos três tipos "impressora"; ausência do campo
= fluxo manual/USB, que não passa pelo classificador), `classificationConfidence`,
`classificationEvidence`, `capabilities` (`{ color, duplex, a3, copy, scan, fax }`,
cada um `true`/`false`/ausente — ausente = nunca determinado, nunca tratado como
`false`), `capabilitySources` e `diagnostics` (resultado por protocolo, só
troubleshooting).

## Discovery multiprotocolo e classificação de dispositivo

O Agent não decide mais "isso é impressora?" só pelo SNMP responder. Por host, o
`DeviceProbeOrchestrator` (`PrinterAgent.Core/Discovery/DeviceProbeOrchestrator.cs`)
roda em paralelo: SNMP (`SnmpDeviceReader` — agora só *coleta* evidência, não decide
mais sozinho), IPP (`Discovery/Ipp/IppClient.cs`, cliente mínimo RFC 8011), varredura
de portas TCP (`Discovery/TcpPortProbe.cs` — 9100/515/631/80/443), ARP (`ArpResolver`)
e OUI do MAC (`Discovery/OuiVendorLookup.cs`); mDNS (`Discovery/Dns/MdnsProbe.cs`,
`_ipp._tcp.local`/`_printer._tcp.local`) roda uma vez por varredura inteira (é
multicast, não por host). Tudo isso vira `DeviceSignals`, que o
`Classification/DeviceClassifier.cs` pesa — qualquer palavra-chave de infraestrutura
(roteador/firewall/switch/AP/câmera/servidor) no sysDescr/HTTP veta a classificação
como impressora imediatamente, e sem nenhuma evidência forte (Printer-MIB, IPP ou
porta 9100) o dispositivo fica `UNKNOWN` e nunca vira registro. A API repete essa
validação do lado dela (`AgentsService.submitDevices`) — nunca confia cegamente no
que o Agent mandou.

`Discovery/ModelDatabase.cs` (+ `printer-model-database.json`, embutido, editável sem
recompilar a lógica de match) só dá uma dica de família (Impressora/MFP/Plotter) uma
vez que fabricante/modelo já foram identificados por uma fonte real — nunca decide
sozinho se algo é impressora. `Vendors/` é um scaffold de providers por fabricante
(HP/Canon/Brother/…) — hoje todos se comportam como o genérico; é o lugar certo pra
entrar um OID privado *verificado* de cada marca no futuro (cópias/duplex não têm OID
padrão, ver nota mais abaixo).

**Fora do escopo desta fase** (documentado, não esquecido): WS-Discovery, correlação
com impressoras instaladas do Windows além da varredura USB local
(`UsbPrinterDiscoveryService`, no ConfigTool), banco OUI completo (fica só um
subconjunto curado e verificado), e OIDs privados de fabricante (arquitetura pronta,
população incremental conforme forem confirmados).

## Implementação do Agent (`apps/agent-windows/`)

| Componente | Responsabilidade |
|---|---|
| `PrinterAgent.Core/Snmp` | `SnmpDeviceReader` — GET/WALK SNMP v1/v2c sobre OIDs padrão MIB-II/Printer-MIB (`PrinterMibOids`); só coleta evidência, não classifica |
| `PrinterAgent.Core/Discovery` | `PrinterDiscoveryService` (varredura + mDNS sweep) → `DeviceProbeOrchestrator` (SNMP+IPP+TCP+ARP+OUI por host) → `Classification/DeviceClassifier` |
| `PrinterAgent.Core/Discovery/Ipp` | `IppClient` — cliente IPP mínimo (Get-Printer-Attributes) |
| `PrinterAgent.Core/Discovery/Dns` | `MdnsProbe` — descoberta mDNS/DNS-SD |
| `PrinterAgent.Core/Vendors` | Scaffold de providers por fabricante (extensão futura) |
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
- **Capacidades (`Printer.capabilities`, tri-state)**: `color`/`duplex` vêm de IPP
  (`color-supported`/`sides-supported`); `a3` vem das dimensões declaradas de cada
  bandeja de entrada (`prtInputEntry`, RFC 3805, prioridade Printer-MIB > IPP) — nunca
  inferido do nome do modelo. Ausente/`null` = nunca determinado; a UI só mostra o
  campo correspondente quando `true` (ver `counters-list.tsx`/`printer-info-grid.tsx`).
- **Cópias, scan, fax e o detalhamento impressão vs. cópia** continuam **sem fonte real
  implementada nesta fase** (`capabilities.copy`/`scan`/`fax` ficam sempre ausentes) —
  não existe OID padrão no Printer-MIB pra isso (são vendor-specific, cada fabricante
  com o seu MIB privado); a arquitetura de providers por fabricante (`Vendors/`) já
  existe pronta pra receber OIDs verificados incrementalmente.
- **Filtro "isso é mesmo uma impressora?"**: responder ao `sysDescr` (MIB-II básico)
  sozinho não basta mais pra virar um registro de impressora — roteador, switch, NAS ou
  servidor com SNMP habilitado também respondem isso. Só é aceito como impressora quando
  há alguma evidência real de Printer-MIB (nome, série, contadores, suprimentos ou
  bandeja de entrada). Registros de não-impressoras já cadastrados antes dessa mudança
  não somem sozinhos — remova pela aba Impressoras do ConfigTool (só funciona pra
  status "Pendente"/`DISCOVERED`).
- **Limite conhecido do MAC**: ARP só resolve dispositivos na mesma sub-rede do
  computador onde o Agent está instalado (não atravessa roteador); o fallback por
  IF-MIB só funciona se o dispositivo não bloquear leitura SNMP fora da subárvore
  Printer-MIB. Impressora em VLAN separada da máquina do Agent pode legitimamente
  nunca ter MAC disponível — isso é uma limitação de rede, não um bug.

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
