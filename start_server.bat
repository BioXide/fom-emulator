@echo off
setlocal
cd /d "%~dp0Server"

set BUN_EXE=
if exist "%USERPROFILE%\\.bun\\bin\\bun.exe" set BUN_EXE=%USERPROFILE%\\.bun\\bin\\bun.exe
if "%BUN_EXE%"=="" set BUN_EXE=bun

if not exist node_modules (
  echo [Server] Installing dependencies...
  "%BUN_EXE%" install
)

set MODE=
set PORT=
set WORLD_PORT=
set WORLD_IP=

:parseargs
if "%~1"=="" goto parsedargs
set ARG=%~1

if /I "%ARG:~0,6%"=="-mode=" set MODE=%ARG:~6%& shift & goto parseargs
if /I "%ARG:~0,7%"=="--mode=" set MODE=%ARG:~7%& shift & goto parseargs
if /I "%ARG%"=="-mode" goto :read_mode
if /I "%ARG%"=="--mode" goto :read_mode

if /I "%ARG:~0,6%"=="-port=" set PORT=%ARG:~6%& shift & goto parseargs
if /I "%ARG:~0,7%"=="--port=" set PORT=%ARG:~7%& shift & goto parseargs
if /I "%ARG%"=="-port" goto :read_port
if /I "%ARG%"=="--port" goto :read_port

if /I "%ARG:~0,12%"=="-world-port=" set WORLD_PORT=%ARG:~12%& shift & goto parseargs
if /I "%ARG:~0,13%"=="--world-port=" set WORLD_PORT=%ARG:~13%& shift & goto parseargs
if /I "%ARG%"=="-world-port" goto :read_world_port
if /I "%ARG%"=="--world-port" goto :read_world_port

if /I "%ARG:~0,10%"=="-world-ip=" set WORLD_IP=%ARG:~10%& shift & goto parseargs
if /I "%ARG:~0,11%"=="--world-ip=" set WORLD_IP=%ARG:~11%& shift & goto parseargs
if /I "%ARG%"=="-world-ip" goto :read_world_ip
if /I "%ARG%"=="--world-ip" goto :read_world_ip

shift
goto parseargs

:read_mode
shift
set MODE=%~1
shift
goto parseargs

:read_port
shift
set PORT=%~1
shift
goto parseargs

:read_world_port
shift
set WORLD_PORT=%~1
shift
goto parseargs

:read_world_ip
shift
set WORLD_IP=%~1
shift
goto parseargs

:parsedargs

if "%MODE%"=="" set MODE=master
if "%PORT%"=="" (
  if /I "%MODE%"=="world" (
    set PORT=62000
  ) else (
    set PORT=61000
  )
)

set SERVER_MODE=%MODE%

if not defined FOM_INI (
  if /I "%MODE%"=="world" (
    set FOM_INI=%CD%\\apps\\master\\fom_world.ini
  ) else (
    set FOM_INI=%CD%\\apps\\master\\fom_server.ini
  )
)

call :kill_udp_port %PORT%
echo [Server] Starting server mode=%SERVER_MODE% on UDP port %PORT%...
echo [Server] Config: %FOM_INI%
"%BUN_EXE%" run --cwd apps\\master start
goto :eof

:kill_udp_port
set TARGET_PORT=%~1
if "%TARGET_PORT%"=="" exit /b 0
echo [Server] Closing UDP port %TARGET_PORT% if in use...
powershell -NoProfile -Command "$udpPids=Get-NetUDPEndpoint -LocalPort %TARGET_PORT% -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if($udpPids){foreach($procId in $udpPids){Write-Host ('[Server] Closing UDP %TARGET_PORT% (PID ' + $procId + ')...'); Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue}} else {Write-Host ('[Server] No UDP listeners on %TARGET_PORT%.')}"
exit /b 0
