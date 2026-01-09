@echo off
setlocal
cd /d "%~dp0Server"

if not exist node_modules (
  echo [Server] Installing dependencies...
  bun install
)

echo [Server] Starting world app on UDP port 62000...
bun run --cwd apps\\world start
