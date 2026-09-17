# Printer SaaS — Agent Windows

Agent .NET (C#) que roda como Windows Service na rede do cliente: descobre
impressoras via SNMP, coleta contadores/consumíveis e envia tudo normalizado
para a API (`docs/agent.md` na raiz do repo documenta o protocolo HTTP).

## Estrutura

```
src/
  PrinterAgent.Core/     Lógica pura: SNMP, discovery, cliente HTTP da API,
                         fila offline, credenciais (DPAPI). Sem lógica de
                         negócio do SaaS — só descobre/coleta/normaliza/envia
                         (spec §65).
  PrinterAgent.Service/  Windows Service (BackgroundService) que orquestra
                         o loop: enroll → heartbeat/discovery/coleta/flush
                         da fila offline, em intervalos independentes.
installer/
  install-agent.ps1      Instalador (MVP — ver "Sobre o instalador" abaixo).
  uninstall-agent.ps1
```

## Build

```powershell
dotnet build                                    # debug, todos os projetos
dotnet run --project src/PrinterAgent.Service    # rodar localmente (console)
```

Publicar um build self-contained para instalar em outra máquina:

```powershell
dotnet publish src/PrinterAgent.Service -c Release -r win-x64 --self-contained -o publish
```

## Configuração (`appsettings.json`, seção `Agent`)

| Chave | Descrição |
|---|---|
| `ApiUrl` | URL base da API (`https://api.seudominio.com.br`) |
| `EnrollmentToken` | Token de instalação de uso único (gerado em Configurações → Agents no SaaS) — usado apenas na primeira execução |
| `HeartbeatIntervalSeconds` | Padrão 30s |
| `DiscoveryIntervalSeconds` | Padrão 3600s (varredura completa da rede) |
| `CollectionIntervalSeconds` | Padrão 900s (recoleta de equipamentos já conhecidos) |
| `Networks` | Lista de alvos: `"192.168.1.0/24"`, `"192.168.1.10"` ou `"192.168.1.100-192.168.1.200"` — também pode ser recebida remotamente via `GET /agent-api/v1/config` |
| `SnmpCommunity`, `SnmpTimeoutMs`, `SnmpRetries`, `DiscoveryConcurrency` | Ajustes de varredura — concorrência limitada por padrão (spec §15) |
| `OfflineQueueMaxEntries` | Tamanho máximo da fila local antes de descartar os lotes mais antigos (spec §39) |

Depois do primeiro `enroll` bem-sucedido, o Agent nunca mais usa o
`EnrollmentToken` — a credencial permanente (`AgentId` + secret) fica
armazenada criptografada via DPAPI em
`C:\ProgramData\PrinterSaaS\Agent\credentials.dat`.

## Logs

Rotativos por dia, 14 dias de retenção, em
`C:\ProgramData\PrinterSaaS\Agent\Logs\agent-*.log`. Nunca registram
tokens, community strings ou segredos.

## Sobre o instalador

`installer/install-agent.ps1` é um instalador PowerShell pragmático para o
MVP: copia o build publicado, grava `ApiUrl`/`EnrollmentToken` no
`appsettings.json`, registra o Windows Service via `sc.exe` (com restart
automático em caso de falha) e inicia o serviço.

Um instalador MSI de verdade (WiX Toolset, com wizard gráfico — spec §11
"AgentSetup.exe") é um passo futuro documentado aqui, não implementado
nesta versão — o PowerShell cobre o mesmo resultado funcional (serviço
instalado, iniciado, com inicialização automática) sem exigir o WiX
Toolset no ambiente de build.

## Limitações conhecidas (MVP)

- SNMP v1/v2c apenas (v3 fica para uma fase futura — spec §16).
- OIDs padronizados (MIB-II / Printer-MIB RFC 3805); nenhum OID
  específico de fabricante ainda (spec §18 — arquitetura já é extensível
  para isso via `PrinterMibOids`/`SnmpDeviceReader`).
- Sem auto-update assinado (spec §42) — atualização é manual (reinstalar).
- Fila offline é um arquivo JSON simples, não um banco embarcado — suficiente
  para o volume esperado de um Agent (uma rede local), não para milhares de
  itens.
