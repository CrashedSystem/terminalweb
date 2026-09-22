# terminalweb start (Windows) - idempotent, background process + pidfile
$ErrorActionPreference = 'Stop'
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDir = Join-Path $HOME '.terminalweb'
$PIDFILE = Join-Path $DataDir 'server.pid'
$LOGFILE = Join-Path $DataDir 'server.log'
$ERRFILE = Join-Path $DataDir 'server.err.log'
$PORT = if ($env:PORT) { $env:PORT } else { '8080' }

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# Already running?
if (Test-Path $PIDFILE) {
  $oldPid = (Get-Content $PIDFILE -Raw).Trim()
  if ($oldPid -and (Get-Process -Id ([int]$oldPid) -ErrorAction SilentlyContinue)) {
    Write-Host "terminalweb already running (pid $oldPid) - http://localhost:$PORT"
    exit 0
  }
  Remove-Item $PIDFILE -Force
}

# Port already in use?
if (Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "Port $PORT already in use - assuming server running"
  exit 0
}

$p = Start-Process -FilePath 'node' -ArgumentList 'server/index.js' `
  -WorkingDirectory $DIR `
  -RedirectStandardOutput $LOGFILE -RedirectStandardError $ERRFILE `
  -WindowStyle Hidden -PassThru
$p.Id | Out-File -Encoding ascii $PIDFILE
Start-Sleep -Seconds 1

if (Get-Process -Id $p.Id -ErrorAction SilentlyContinue) {
  Write-Host "terminalweb started (pid $($p.Id)) - http://localhost:$PORT"
} else {
  Write-Host "FAILED to start - see $LOGFILE / $ERRFILE"
  exit 1
}