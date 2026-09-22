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
                           distribuível PrinterAgentSetup.exe (ver "Como
                           distribuir" abaixo).
  build-msi.ps1            Publica os dois projetos e gera o instalador
  wix/                     MSI de verdade via WiX Toolset v5 (ver "Sobre o
                           instalador" abaixo).
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
| `SnmpV3` | Configuração SNMP v3 (opcional) — se configurado, v3 é tentado antes de fallback para v2c/v1 |
| `OfflineQueueMaxEntries` | Tamanho máximo da fila local antes de descartar os lotes mais antigos (spec §39) |

Depois do primeiro `enroll` bem-sucedido, o Agent nunca mais usa o
`EnrollmentToken` — a credencial permanente (`AgentId` + secret) fica
armazenada criptografada via DPAPI em
`C:\ProgramData\PrinterSaaS\Agent\credentials.dat`.

### Configuração SNMP v3

Para usar SNMP v3 em vez de v1/v2c, adicione a seção `SnmpV3` ao `appsettings.json`:

```json
"SnmpV3": {
  "UserName": "snmpUser",
  "SecurityLevel": "authPriv",
  "AuthenticationProtocol": "SHA256",
  "AuthenticationPassword": "authPassword123",
  "PrivacyProtocol": "AES128",
  "PrivacyPassword": "privPassword123",
  "ContextName": ""
}
```

**Opções de configuração:**
- `SecurityLevel`: `noAuthNoPriv` (sem autenticação/privacidade), `authNoPriv` (autenticação apenas), ou `authPriv` (autenticação + privacidade)
- `AuthenticationProtocol`: `MD5`, `SHA1`, `SHA256`, `SHA384`, ou `SHA512`
- `PrivacyProtocol`: `DES`, `AES128`, `AES192`, ou `AES256`
- `ContextName`: Opcional, a maioria dos dispositivos usa contexto vazio

Quando o SNMP v3 é configurado, o Agent tenta v3 primeiro e faz fallback para v2c/v1 caso falhe.

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

### Instalador MSI (WiX Toolset)

`installer/wix/PrinterAgentSetup.msi` é um instalador Windows real (WiX
Toolset v5 — spec §11), útil quando você precisa do que só um MSI de
verdade oferece: código de upgrade (uma versão nova substitui a antiga
automaticamente), entrada em Programas e Recursos, instalação
transacional (falha no meio do caminho desfaz tudo, não deixa
`Program Files` pela metade) e distribuição via GPO/Intune/RMM que espera
um `.msi`.

Ele instala os mesmos arquivos que `PrinterAgentSetup.exe` já instalava
(ConfigTool + ServiceFiles em `C:\Program Files\PrinterSaaS\Agent`) e cria
um atalho no Menu Iniciar — mas **não registra o Windows Service sozinho**.
Depois de instalado, abra "Printer SaaS Agent" no Menu Iniciar (é o mesmo
`PrinterAgentSetup.exe` de sempre) e preencha ApiUrl/token/redes do jeito
que já fazia: é esse passo que efetivamente cria e inicia o serviço. A
desinstalação, por outro lado, já limpa o serviço sozinha (`sc.exe stop` +
`sc.exe delete`, melhor esforço — não falha se o serviço nunca chegou a
ser criado).

```powershell
cd installer
dotnet tool install --global wix --version 5.0.2   # uma vez só
wix extension add WixToolset.Util.wixext/5.0.2
wix extension add WixToolset.UI.wixext/5.0.2
.\build-msi.ps1
```

Gera `installer\wix\bin\x64\Release\PrinterAgentSetup.msi`. Fixado na v5 de
propósito — a v7+ do WiX exige aceitar uma taxa de manutenção paga (Open
Source Maintenance Fee) só para rodar o CLI; a v5 é a última versão major
totalmente livre e é contra o que este projeto foi escrito.

## Limitações conhecidas (MVP)

- SNMP v1/v2c/v3 suportados (v3 com authPriv, authNoPriv, noAuthNoPriv).
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
