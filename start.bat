@echo off
rem terminalweb Windows launcher — double-click to install (first run) + start + open browser.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [terminalweb] Node.js not found. Install Node.js LTS from https://nodejs.org and retry.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [terminalweb] First run: installing dependencies + vendor bundles...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
  if errorlevel 1 goto :fail
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 goto :fail

rem Let the server bind before opening the browser.
timeout /t 1 /nobreak >nul
start "" "http://localhost:8080"
exit /b 0

:fail
echo [terminalweb] Failed - see messages above.
pause
exit /b 1