# terminalweb installer (Windows) - idempotent
$ErrorActionPreference = 'Stop'
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $DIR

Write-Host '[1/2] Installing npm dependencies...'
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[2/2] Copying vendor bundles...'
node scripts/vendor.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Done. Start with: .\start.ps1  (URL: http://localhost:8080)'