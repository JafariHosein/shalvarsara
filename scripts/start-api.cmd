@echo off
REM Starts the API in its own minimized window, logging to %TEMP%\apirun.txt.
REM Stop it with scripts\stop-api.cmd.
setlocal
set "PATH=C:\Program Files\Go\bin;%PATH%"
cd /d "%~dp0..\backend"
echo === api start %DATE% %TIME% === > "%TEMP%\apirun.txt"
start "shalvarsara-api" /min cmd /c "go run ./cmd/api >> ""%TEMP%\apirun.txt"" 2>&1"
echo launched - log: %TEMP%\apirun.txt
