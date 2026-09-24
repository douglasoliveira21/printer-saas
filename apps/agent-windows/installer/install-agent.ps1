#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Installs the Vgon Printer Agent as a Windows Service.

.DESCRIPTION
  Pragmatic MVP installer (spec §11): copies the published, self-contained
  build to Program Files, writes Agent:ApiUrl / Agent:EnrollmentToken into
  appsettings.json, registers the Windows Service via sc.exe, and starts it.
  A proper MSI (WiX) is a documented future improvement — see README.md in
  this folder — this script is the "AgentSetup" for now.

.PARAMETER ApiUrl
  Base URL of the Vgon Printer API, e.g. https://api.seudominio.com.br

.PARAMETER EnrollmentToken
  One-time installation token from "Configurações > Agents > Adicionar Agent" in the SaaS.

.PARAMETER SourcePath
  Path to the published build output (dotnet publish -c Release -r win-x64 --self-contained).
  Defaults to a "publish" folder next to this script.

.EXAMPLE
  .\install-agent.ps1 -ApiUrl "https://api.seudominio.com.br" -EnrollmentToken "XXXX-XXXX-XXXX-XXXX"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$EnrollmentToken,

    [string]$SourcePath = (Join-Path $PSScriptRoot "..\publish"),

    [string]$InstallPath = "$env:ProgramFiles\PrinterSaaS\Agent",

    [string]$ServiceName = "PrinterSaaSAgent"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SourcePath)) {
    throw "Published build not found at '$SourcePath'. Run:`n  dotnet publish src/PrinterAgent.Service -c Release -r win-x64 --self-contained -o publish"
}

Write-Host "Stopping existing service (if any)..."
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

Write-Host "Copying files to $InstallPath..."
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
Copy-Item -Path (Join-Path $SourcePath "*") -Destination $InstallPath -Recurse -Force

$appsettingsPath = Join-Path $InstallPath "appsettings.json"
$settings = Get-Content $appsettingsPath -Raw | ConvertFrom-Json
$settings.Agent.ApiUrl = $ApiUrl
$settings.Agent.EnrollmentToken = $EnrollmentToken
$settings | ConvertTo-Json -Depth 10 | Set-Content $appsettingsPath -Encoding UTF8

$exePath = Join-Path $InstallPath "PrinterAgent.Service.exe"
if (-not (Test-Path $exePath)) {
    throw "PrinterAgent.Service.exe not found in $InstallPath — check the publish output."
}

Write-Host "Registering Windows Service '$ServiceName'..."
& sc.exe create $ServiceName binPath= "`"$exePath`"" start= auto DisplayName= "Vgon Printer Agent" | Out-Null
& sc.exe description $ServiceName "Descobre e monitora impressoras na rede local para o Vgon Printer." | Out-Null
& sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null

Write-Host "Starting service..."
Start-Service -Name $ServiceName

Write-Host "Done. Logs: $env:ProgramData\PrinterSaaS\Agent\Logs" -ForegroundColor Green
