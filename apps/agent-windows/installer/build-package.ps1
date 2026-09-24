<#
.SYNOPSIS
  Builds the distributable Vgon Printer Agent package: PrinterAgentSetup.exe
  (the GUI installer/dashboard) plus the Windows Service files it installs.

.DESCRIPTION
  Publishes both projects self-contained (no .NET runtime required on the
  target machine) and arranges them the way PrinterAgentSetup.exe expects:
  the service files inside a "ServiceFiles" subfolder next to the exe (see
  WindowsServiceInstaller.ServiceSourcePath in PrinterAgent.ConfigTool).

.EXAMPLE
  .\build-package.ps1
  # Output in ..\publish\ — zip that folder and hand it to whoever installs the Agent.
#>
param(
    [string]$OutputPath = (Join-Path $PSScriptRoot "..\publish"),
    [string]$Runtime = "win-x64"
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot ".."

if (Test-Path $OutputPath) {
    Remove-Item -Path $OutputPath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

Write-Host "Publishing PrinterAgent.Service..." -ForegroundColor Cyan
dotnet publish (Join-Path $root "src\PrinterAgent.Service") `
    -c Release -r $Runtime --self-contained `
    -o (Join-Path $OutputPath "ServiceFiles")

Write-Host "Publishing PrinterAgent.ConfigTool (installer/dashboard)..." -ForegroundColor Cyan
dotnet publish (Join-Path $root "src\PrinterAgent.ConfigTool") `
    -c Release -r $Runtime --self-contained `
    -o $OutputPath

Write-Host "Done. Distributable package at: $OutputPath" -ForegroundColor Green
Write-Host "Run PrinterAgentSetup.exe on the target machine (as Administrator) to install." -ForegroundColor Green
