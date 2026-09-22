# terminalweb stop (Windows)
# Note: on win32 there is no tmux, so stopping ends all sessions.
$PIDFILE = Join-Path $HOME '.terminalweb\server.pid'

if (Test-Path $PIDFILE) {
  $pid2 = (Get-Content $PIDFILE -Raw).Trim()
  $proc = Get-Process -Id ([int]$pid2) -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $proc.Id -Force
    Write-Host "terminalweb stopped (pid $pid2)."
  } else {
    Write-Host 'No running process (stale pid file).'
  }
  Remove-Item $PIDFILE -Force
} else {
  Write-Host 'No pid file - server not running?'
}