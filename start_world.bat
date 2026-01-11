@echo off
setlocal
cd /d "%~dp0Server"

if not exist node_modules (
  echo [Server] Installing dependencies...
  bun install
)

set PORT=62000
call :kill_udp_port %PORT%
echo [Server] Starting world app on UDP port %PORT%...
bun run --cwd apps\\world start
goto :eof

:kill_udp_port
set TARGET_PORT=%~1
if "%TARGET_PORT%"=="" exit /b 0
echo [Server] Closing UDP port %TARGET_PORT% if in use...
powershell -NoProfile -Command "$udpPids=Get-NetUDPEndpoint -LocalPort %TARGET_PORT% -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if($udpPids){foreach($procId in $udpPids){Write-Host ('[Server] Closing UDP %TARGET_PORT% (PID ' + $procId + ')...'); Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue}} else {Write-Host ('[Server] No UDP listeners on %TARGET_PORT%.')}"
exit /b 0
