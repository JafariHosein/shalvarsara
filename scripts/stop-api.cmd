@echo off
REM Kills whatever is listening on the API port (default 8080).
REM Override with: set HTTP_PORT=9090 && scripts\stop-api.cmd
setlocal
if "%HTTP_PORT%"=="" set "HTTP_PORT=8080"
set FOUND=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%HTTP_PORT% " ^| findstr LISTENING') do (
  echo killing PID %%a on port %HTTP_PORT%
  taskkill /PID %%a /F
  set FOUND=1
)
if not defined FOUND echo nothing listening on port %HTTP_PORT%
