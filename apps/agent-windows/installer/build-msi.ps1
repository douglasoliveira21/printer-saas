<#
.SYNOPSIS
  Builds PrinterAgentSetup.msi — the real Windows Installer package.

.DESCRIPTION
  Publishes both apps self-contained win-x64 into two sibling folders
  (wix\msi-publish\ConfigTool and wix\msi-publish\ServiceFiles — deliberately
  NOT nested the way build-package.ps1's ..\publish\ServiceFiles is, so the
  MSI's file-harvesting globs for the two apps can never overlap), then
  invokes `wix build`.

  Requires the WiX Toolset v5 CLI as a local/global dotnet tool:
    dotnet tool install --global wix --version 5.0.2
    wix extension add WixToolset.Util.wixext/5.0.2
    wix extension add WixToolset.UI.wixext/5.0.2
  (Explicitly pinned to v5 — v7+ requires accepting WiX's paid Open Source
  Maintenance Fee EULA to run at all; v5 is the last fully free major
  version and is what this project is authored against.)

.PARAMETER ProductVersion
  Version stamped into the MSI (Add/Remove Programs + MajorUpgrade
  comparisons). Bump this on every release you intend to ship — by
  convention kept in sync with AgentVersion.Current in
  PrinterAgent.Core/Configuration/AgentEnrollmentService.cs, though nothing
  enforces that automatically.

.EXAMPLE
  .\build-msi.ps1
  .\build-msi.ps1 -ProductVersion 1.1.0
  # Output: installer\wix\bin\x64\Release\PrinterAgentSetup.msi
#>
param(
    [string]$ProductVersion = "1.0.0",
    [string]$Runtime = "win-x64"
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot ".."
$wixDir = Join-Path $PSScriptRoot "wix"
$publishDir = Join-Path $wixDir "msi-publish"

if (Test-Path $publishDir) {
    Remove-Item -Path $publishDir -Recurse -Force
}

Write-Host "Publishing PrinterAgent.ConfigTool..." -ForegroundColor Cyan
dotnet publish (Join-Path $root "src\PrinterAgent.ConfigTool") `
    -c Release -r $Runtime --self-contained `
    -o (Join-Path $publishDir "ConfigTool")

Write-Host "Publishing PrinterAgent.Service..." -ForegroundColor Cyan
dotnet publish (Join-Path $root "src\PrinterAgent.Service") `
    -c Release -r $Runtime --self-contained `
    -o (Join-Path $publishDir "ServiceFiles")

Write-Host "Building MSI (wix build)..." -ForegroundColor Cyan
Push-Location $wixDir
try {
    dotnet build PrinterAgentInstaller.wixproj -c Release -p:ProductVersion=$ProductVersion
}
finally {
    Pop-Location
}

$msiPath = Join-Path $wixDir "bin\x64\Release\PrinterAgentSetup.msi"
if (-not (Test-Path $msiPath)) {
    throw "Build reported success but $msiPath wasn't found — something's off."
}

Write-Host "Done: $msiPath" -ForegroundColor Green
