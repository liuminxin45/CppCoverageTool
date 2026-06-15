@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -Clean -Configuration Release -Platform x64
exit /b %ERRORLEVEL%
