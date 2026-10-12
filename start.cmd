@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.23.3+ or 24.19.0+ and add it to PATH, then try again.
  pause
  exit /b 1
)
node server/index.mjs --open
if errorlevel 1 pause
