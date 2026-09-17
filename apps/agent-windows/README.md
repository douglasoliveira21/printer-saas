# Printer SaaS — Agent Windows

Agent .NET (C#) que roda como Windows Service na rede do cliente: descobre
impressoras via SNMP, coleta contadores/consumíveis e envia tudo normalizado
para a API (`docs/agent.md` na raiz do repo documenta o protocolo HTTP).
Vem com um app de instalação/painel com interface gráfica
(`PrinterAgentSetup.exe`) — não precisa editar JSON na mão nem usar linha de
comando para instalar.

## Estrutura

```
src/
  PrinterAgent.Core/       Lógica pura: SNMP, discovery, cliente HTTP da API,
                           fila offline, credenciais (DPAPI). Sem lógica de
                           negócio do SaaS — só descobre/coleta/normaliza/envia
                           (spec §65).
  PrinterAgent.Service/    Windows Service (BackgroundService, sem tela) que
                           orquestra o loop: enroll → heartbeat/discovery/
                           coleta/flush da fila offline, em intervalos
                           independentes. Roda em segundo plano mesmo sem
                           ninguém logado na máquina.
  PrinterAgent.ConfigTool/ App WPF (`PrinterAgentSetup.exe`) — a interface que
                           a pessoa instalando realmente usa: informa URL da
                           API + token, instala/atualiza/inicia/para/remove o
                           Windows Service, e mostra status + logs recentes
                           em tempo real.
installer/
  build-package.ps1        Publica os dois projetos e monta o pacote
                           distribuível (ver "Como distribuir" abaixo).
  install-agent.ps1        Alternativa por linha de comando/silenciosa (útil
  uninstall-agent.ps1      para instalação em massa via GPO/RMM), sem tela.
```

## Build e execução local (desenvolvimento)

```powershell
dotnet build                                    # debug, todos os projetos
dotnet run --project src/PrinterAgent.Service    # o serviço, rodando como console
dotnet run --project src/PrinterAgent.ConfigTool # a tela de instalação/painel
```

## Como distribuir (gerar o pacote instalável)

```powershell
cd installer
.\build-package.ps1
```

Isso gera `apps/agent-windows/publish/` com:

```
publish/
  PrinterAgentSetup.exe   ← é isso que a pessoa no cliente executa (como Administrador)
  ServiceFiles/           ← arquivos do Windows Service, copiados automaticamente pelo instalador
```

Zipe a pasta `publish/` inteira e entregue — ela é self-contained (não precisa
o .NET instalado na máquina de destino).

## Usando o `PrinterAgentSetup.exe`

1. Execute como **Administrador** (ele pede elevação — necessário para
   registrar o Windows Service).
2. Preencha:
   - **URL da API**: ex. `https://api.seudominio.com.br`
   - **Token de instalação**: gerado no SaaS em `Configurações → Agents →
     Adicionar Agent` (válido por 24h, uso único)
3. Clique **Instalar e Iniciar**. A tela mostra o status (rodando/parado/não
   instalado) e os logs recentes, atualizados automaticamente a cada 5s.
4. Para reconfigurar, atualizar ou remover, é a mesma tela — os botões
   **Iniciar**, **Parar** e **Desinstalar** cuidam disso.

## Configuração avançada (`appsettings.json`, seção `Agent`)

A maioria das opções abaixo não tem campo na tela — são para ajuste fino,
editando `C:\Program Files\PrinterSaaS\Agent\appsettings.json` diretamente e
reiniciando o serviço (ou clicando **Parar**/**Iniciar** na tela):

| Chave | Descrição |
|---|---|
| `ApiUrl` | URL base da API — também editável pela tela |
| `EnrollmentToken` | Usado apenas na primeira instalação — também preenchido pela tela |
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
`C:\ProgramData\PrinterSaaS\Agent\Logs\agent-*.log` — a mesma tela do
`PrinterAgentSetup.exe` já mostra as últimas linhas. Nunca registram tokens,
community strings ou segredos.

## Sobre o instalador

`PrinterAgentSetup.exe` (WPF) é a forma recomendada de instalar: interface
gráfica, sem linha de comando. Ele copia os arquivos do serviço para
`C:\Program Files\PrinterSaaS\Agent`, grava `ApiUrl`/`EnrollmentToken`,
registra o Windows Service via `sc.exe` (com restart automático em caso de
falha) e inicia o serviço — o mesmo resultado que `installer/install-agent.ps1`
fazia, só que com tela em vez de parâmetros de linha de comando.

Os scripts PowerShell (`install-agent.ps1`/`uninstall-agent.ps1`) continuam
existindo como alternativa silenciosa/scriptável, útil para quem instala em
várias máquinas via GPO ou uma ferramenta de RMM.

Um instalador MSI de verdade (WiX Toolset, com wizard nativo do Windows —
spec §11) continua sendo um passo futuro possível, mas não é mais
estritamente necessário para ter uma experiência de instalação com tela: o
`PrinterAgentSetup.exe` já cobre isso.

## Limitações conhecidas (MVP)

- SNMP v1/v2c apenas (v3 fica para uma fase futura — spec §16).
- OIDs padronizados (MIB-II / Printer-MIB RFC 3805); nenhum OID
  específico de fabricante ainda (spec §18 — arquitetura já é extensível
  para isso via `PrinterMibOids`/`SnmpDeviceReader`).
- Sem auto-update assinado (spec §42) — atualização é manual (reinstalar).
- Fila offline é um arquivo JSON simples, não um banco embarcado — suficiente
  para o volume esperado de um Agent (uma rede local), não para milhares de
  itens.
- `PrinterAgentSetup.exe` não tem ícone de bandeja (system tray) — é uma
  janela que você abre quando precisa ver o status, não um processo residente
  além do próprio Windows Service.
