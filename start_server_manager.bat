@echo off
setlocal
cd /d "%~dp0ServerManager"
if not exist node_modules (
  echo [ServerManager] Installing dependencies...
  npm install
)

npm run dev
