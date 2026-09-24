#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Stops and removes the Vgon Printer Agent Windows Service and its files.
  Does NOT remove logs or stored credentials under ProgramData\PrinterSaaS\Agent
  unless -RemoveData is passed.
#>
param(
    [string]$InstallPath = "$env:ProgramFiles\PrinterSaaS\Agent",
    [string]$ServiceName = "PrinterSaaSAgent",
    [switch]$RemoveData
)

$ErrorActionPreference = "Stop"

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping service..."
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $ServiceName | Out-Null
}

if (Test-Path $InstallPath) {
    Write-Host "Removing $InstallPath..."
    Remove-Item -Path $InstallPath -Recurse -Force
}

if ($RemoveData) {
    $dataPath = "$env:ProgramData\PrinterSaaS\Agent"
    if (Test-Path $dataPath) {
        Write-Host "Removing $dataPath (logs and stored credentials)..."
        Remove-Item -Path $dataPath -Recurse -Force
    }
}

Write-Host "Done." -ForegroundColor Green
