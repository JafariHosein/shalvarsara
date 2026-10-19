@echo off
REM Frontend typecheck only (fast). Output: %TEMP%\fe.txt
setlocal
cd /d "%~dp0..\frontend"
set "OUT=%TEMP%\fe.txt"
echo === TYPECHECK === > "%OUT%"
call cmd /c "npm run typecheck" >> "%OUT%" 2>&1
echo EXIT=%ERRORLEVEL% >> "%OUT%"
type "%OUT%"
