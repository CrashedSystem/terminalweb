# terminalweb installer (Windows) - idempotent
$ErrorActionPreference = 'Stop'
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $DIR

# Prereq check: Node 18+ LTS (20/22 recommended — node-pty ships prebuilt
# binaries for these ABIs; older/newer Node may need a C++ toolchain).
try {
  $nodeVer = (node --version).Trim()
} catch {
  Write-Error 'Node.js not found - install Node.js LTS from https://nodejs.org first.'
  exit 1
}
Write-Host "Using Node $nodeVer"

Write-Host '[1/2] Installing npm dependencies...'
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[2/2] Copying vendor bundles...'
node scripts/vendor.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Done. Start with: .\start.ps1  (URL: http://localhost:8080)'